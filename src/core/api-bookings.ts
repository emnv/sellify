import "server-only";
import { getBookedSlots, getPublicStore, getShopForPublishedStore, type ShopForStore } from "@/core/api";
import { getCatalog, storageLabel } from "@/core/catalog";
import { bookingWindow, findAvailableSlot } from "@/lib/booking/slots";
import { answersToJson, computeOffer, type BuybackAnswers, type BuybackDeductionPcts } from "@/lib/buyback/quote";
import type { StoreContent } from "@/lib/store/config";
import { createAdminClient } from "@/lib/supabase/admin";

// =============================================================================
// PART OF THE CORE SEAM (see src/core/api.ts): online bookings from a public
// store. Every function resolves the published store again from its key, reads
// prices from the database for THAT shop with the service role, and never
// accepts a price, a shop id or a label from the client.
// =============================================================================

export type BookingError = { ok: false; error: string; field?: string };
export type BookingResult<T> = { ok: true; data: T } | BookingError;

/** What the emails and the confirmation screen need about the shop. */
export type BookingShop = ShopForStore & {
  storeName: string;
  contact: StoreContent["contact"];
  hours: StoreContent["hours"];
};

export type Customer = { name: string; phone: string; email: string };

const UNAVAILABLE: BookingError = { ok: false, error: "This store isn't taking bookings right now. Call the shop instead." };
const FAILED: BookingError = { ok: false, error: "Something went wrong on our side. Try again, or call the shop." };

async function resolveShop(storeKey: string, tab: "repair" | "sell"): Promise<BookingShop | null> {
  const [shop, store] = await Promise.all([getShopForPublishedStore(storeKey), getPublicStore(storeKey)]);
  if (!shop || !store || !store.config.content.tabs[tab]) return null;
  const { storeName, contact, hours } = store.config.content;
  return { ...shop, storeName, contact, hours };
}

// ---------------------------------------------------------------------------
// Repairs
// ---------------------------------------------------------------------------

export type RepairBookingInput = { modelId: number; repairTypeId: number; scheduledAt: string; customer: Customer };

export type RepairBooking = {
  ticketId: string;
  shop: BookingShop;
  deviceLabel: string;
  repairLabel: string;
  priceCents: number;
  partInStock: boolean;
  scheduledAt: string;
  customer: Customer;
};

export async function createOnlineRepairTicket(storeKey: string, input: RepairBookingInput): Promise<BookingResult<RepairBooking>> {
  const shop = await resolveShop(storeKey, "repair");
  if (!shop) return UNAVAILABLE;

  try {
    const admin = createAdminClient();
    const [{ data: price, error: priceError }, { count: parts, error: partsError }, catalog] = await Promise.all([
      admin
        .from("repair_prices")
        .select("price_cents")
        .eq("shop_id", shop.shopId)
        .eq("model_id", input.modelId)
        .eq("repair_type_id", input.repairTypeId)
        .maybeSingle(),
      admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.shopId)
        .eq("is_part", true)
        .eq("model_id", input.modelId)
        .eq("repair_type_id", input.repairTypeId)
        .gt("stock_qty", 0),
      getCatalog(),
    ]);
    if (priceError || partsError) {
      console.error("[bookings] repair price lookup failed", priceError?.message ?? partsError?.message);
      return FAILED;
    }
    const deviceLabel = catalog.modelLabels[input.modelId];
    const repairLabel = catalog.repairTypes.find((r) => r.id === input.repairTypeId)?.name;
    if (!price || !deviceLabel || !repairLabel) {
      return { ok: false, error: "We don't offer that repair online. Choose another repair or call the shop.", field: "repair" };
    }

    // The time must be one we would offer right now: inside the published
    // opening hours, far enough ahead, and not already full (public_booked_slots
    // returns only slots at the shop's capacity).
    const now = new Date();
    const { from, to } = bookingWindow(now);
    const taken = await getBookedSlots(storeKey, from, to);
    const slot = findAvailableSlot(input.scheduledAt, { hours: shop.hours, timeZone: shop.timezone, now, taken });
    if (!slot) return { ok: false, error: "That time is no longer available. Pick another.", field: "slot" };

    // Cheap pre-check; the authoritative check runs after the insert below.
    const preLimited = await overLimit("repair_tickets", shop.shopId, input.customer.email, false);
    if (preLimited) return { ok: false, error: preLimited };

    // Atomic: locks this shop + slot, checks the shop's slot capacity and
    // inserts. Null = the slot filled up since the check above.
    const { data: ticketId, error } = await admin.rpc("book_online_repair", {
      p_shop_id: shop.shopId,
      p_model_id: input.modelId,
      p_repair_type_id: input.repairTypeId,
      p_device_label: deviceLabel,
      p_repair_label: repairLabel,
      p_quoted_price_cents: price.price_cents,
      p_scheduled_at: slot.iso,
      p_customer_name: input.customer.name,
      p_customer_phone: input.customer.phone,
      p_customer_email: input.customer.email,
    });
    if (error) {
      console.error("[bookings] repair booking rpc failed", error.message);
      return FAILED;
    }
    if (!ticketId) return { ok: false, error: "That time was just taken. Pick another.", field: "slot" };

    // Authoritative limit: count with this row included, so parallel requests
    // cannot all pass. Over the limit → remove the row before any email.
    const postLimited = await overLimit("repair_tickets", shop.shopId, input.customer.email, true);
    if (postLimited) {
      await admin.from("repair_tickets").delete().eq("id", ticketId).eq("shop_id", shop.shopId);
      return { ok: false, error: postLimited };
    }

    return {
      ok: true,
      data: {
        ticketId,
        shop,
        deviceLabel,
        repairLabel,
        priceCents: price.price_cents,
        partInStock: (parts ?? 0) > 0,
        scheduledAt: slot.iso,
        customer: input.customer,
      },
    };
  } catch (e) {
    console.error("[bookings] repair booking threw", (e as Error).message);
    return FAILED;
  }
}

// ---------------------------------------------------------------------------
// Buybacks
// ---------------------------------------------------------------------------

// Same as the column defaults on buyback_settings (the row is created with the shop).
const DEFAULT_DEDUCTIONS: BuybackDeductionPcts = { screen_cracked_pct: 30, battery_bad_pct: 15, no_power_pct: 50 };

export type BuybackQuoteInput = { modelId: number; storageGb: number; answers: BuybackAnswers };

export type BuybackQuote = {
  deviceLabel: string;
  storageLabel: string;
  storageGb: number;
  offerCents: number;
  currency: string;
};

async function quoteFor(shop: BookingShop, input: BuybackQuoteInput): Promise<BookingResult<BuybackQuote>> {
  const admin = createAdminClient();
  const [{ data: price, error: priceError }, { data: settings, error: settingsError }, catalog] = await Promise.all([
    admin
      .from("buyback_prices")
      .select("base_price_cents")
      .eq("shop_id", shop.shopId)
      .eq("model_id", input.modelId)
      .eq("storage_gb", input.storageGb)
      .maybeSingle(),
    admin.from("buyback_settings").select("screen_cracked_pct, battery_bad_pct, no_power_pct").eq("shop_id", shop.shopId).maybeSingle(),
    getCatalog(),
  ]);
  if (priceError || settingsError) {
    console.error("[bookings] buyback price lookup failed", priceError?.message ?? settingsError?.message);
    return FAILED;
  }
  const deviceLabel = catalog.modelLabels[input.modelId];
  if (!price || !deviceLabel) {
    return { ok: false, error: "We don't buy that model and storage online. Choose another, or bring it in for a quote.", field: "storage" };
  }
  return {
    ok: true,
    data: {
      deviceLabel,
      storageLabel: storageLabel(input.storageGb),
      storageGb: input.storageGb,
      offerCents: computeOffer(price.base_price_cents, input.answers, settings ?? DEFAULT_DEDUCTIONS),
      currency: shop.currency,
    },
  };
}

/** The offer for a model, storage and condition, from the shop's own prices. */
export async function quoteOnlineBuyback(storeKey: string, input: BuybackQuoteInput): Promise<BookingResult<BuybackQuote>> {
  const shop = await resolveShop(storeKey, "sell");
  if (!shop) return UNAVAILABLE;
  try {
    return await quoteFor(shop, input);
  } catch (e) {
    console.error("[bookings] buyback quote threw", (e as Error).message);
    return FAILED;
  }
}

export type BuybackBookingInput = BuybackQuoteInput & { customer: Customer };

export type BuybackBooking = BuybackQuote & {
  buybackId: string;
  shop: BookingShop;
  answers: BuybackAnswers;
  customer: Customer;
};

// Abuse limits for the public forms. Every accepted submission emails the
// customer address it was given, so without limits the form could be used to
// send mail to strangers. Counted in the database, so they hold across
// serverless instances.
const PER_EMAIL_PER_DAY = 3;
const PER_STORE_PER_HOUR = 30;

/**
 * `includesNew`: the count already contains this request's own row (the
 * authoritative post-insert check), so the limit is exceeded at > instead of >=.
 * Fails closed: if the counts can't be read, the request is refused.
 */
async function overLimit(table: "repair_tickets" | "buybacks", shopId: string, email: string, includesNew: boolean): Promise<string | null> {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const [byEmail, byStore] = await Promise.all([
    admin.from(table).select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("source", "online").ilike("customer_email", email.replace(/[%_\\]/g, "\\$&")).gte("created_at", dayAgo),
    admin.from(table).select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("source", "online").gte("created_at", hourAgo),
  ]);
  if (byEmail.error || byStore.error || byEmail.count === null || byStore.count === null) {
    console.error("[bookings] limit check failed", byEmail.error?.message ?? byStore.error?.message);
    return "Something went wrong on our side. Try again in a minute or call the shop.";
  }
  const over = (n: number, max: number) => (includesNew ? n > max : n >= max);
  if (over(byEmail.count, PER_EMAIL_PER_DAY)) return "You've already sent us a few requests today. Call the shop if you need another.";
  if (over(byStore.count, PER_STORE_PER_HOUR)) return "We're getting a lot of requests right now. Try again in a little while or call the shop.";
  return null;
}

/** Recomputes the offer from the selections and records the accepted buyback. */
export async function createOnlineBuyback(storeKey: string, input: BuybackBookingInput): Promise<BookingResult<BuybackBooking>> {
  const shop = await resolveShop(storeKey, "sell");
  if (!shop) return UNAVAILABLE;
  try {
    const quote = await quoteFor(shop, input);
    if (!quote.ok) return quote;

    const preLimited = await overLimit("buybacks", shop.shopId, input.customer.email, false);
    if (preLimited) return { ok: false, error: preLimited };

    const { data, error } = await createAdminClient()
      .from("buybacks")
      .insert({
        shop_id: shop.shopId,
        model_id: input.modelId,
        storage_gb: input.storageGb,
        device_label: quote.data.deviceLabel,
        answers: answersToJson(input.answers),
        offer_cents: quote.data.offerCents,
        handover: "drop_in",
        status: "accepted",
        source: "online",
        customer_name: input.customer.name,
        customer_phone: input.customer.phone,
        customer_email: input.customer.email,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[bookings] buyback insert failed", error?.message);
      return FAILED;
    }
    const postLimited = await overLimit("buybacks", shop.shopId, input.customer.email, true);
    if (postLimited) {
      await createAdminClient().from("buybacks").delete().eq("id", data.id).eq("shop_id", shop.shopId);
      return { ok: false, error: postLimited };
    }
    return { ok: true, data: { ...quote.data, buybackId: data.id, shop, answers: input.answers, customer: input.customer } };
  } catch (e) {
    console.error("[bookings] buyback threw", (e as Error).message);
    return FAILED;
  }
}
