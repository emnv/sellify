"use server";

import { z } from "zod";
import { createOnlineBuyback, quoteOnlineBuyback } from "@/core/api-bookings";
import { storageLabel } from "@/core/catalog";
import { computeOffer, type BuybackAnswers } from "@/lib/buyback/quote";
import { buybackCustomerEmail, buybackShopEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { formatMoney } from "@/lib/money";
import { loadPreviewCtx, storeBuybackOptions } from "@/stores/data";

// Sell tab. The offer is ALWAYS computed here from the shop's prices in the
// database. The client sends only model, storage and its yes/no answers; there
// is no price field, and on submit the offer is computed again from scratch.

const id = (message: string) => z.coerce.number(message).int(message).positive(message).max(2_147_483_647, message);
const yesNo = (message: string) => z.enum(["yes", "no"], message).transform((v) => v === "yes");

const selectionSchema = z.object({
  storeKey: z.string().trim().min(1).max(253),
  modelId: id("Choose your model."),
  storageGb: id("Choose the storage size."),
  screenCracked: yesNo("Tell us if the screen is cracked."),
  batteryOk: yesNo("Tell us if the battery is OK."),
  turnsOn: yesNo("Tell us if the phone turns on."),
});

export type SellSelection = { storeKey: string; modelId: string; storageGb: string; screenCracked: string; batteryOk: string; turnsOn: string };

const answersOf = (v: z.infer<typeof selectionSchema>): BuybackAnswers => ({ screenCracked: v.screenCracked, batteryOk: v.batteryOk, turnsOn: v.turnsOn });

export type QuoteResult = { ok: true; offer: string; offerCents: number; device: string } | { ok: false; error: string };

/** The offer for the customer's selections, read from the shop's prices. */
export async function getQuote(selection: SellSelection, preview = false): Promise<QuoteResult> {
  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Answer every question to see your offer." };
  const v = parsed.data;

  if (preview) return previewQuote(v);

  try {
    const result = await quoteOnlineBuyback(v.storeKey.toLowerCase(), { modelId: v.modelId, storageGb: v.storageGb, answers: answersOf(v) });
    if (!result.ok) return { ok: false, error: result.error };
    const q = result.data;
    return { ok: true, offerCents: q.offerCents, offer: formatMoney(q.offerCents, q.currency), device: `${q.deviceLabel} ${q.storageLabel}` };
  } catch (e) {
    console.error("[sell] quote failed", (e as Error).message);
    return { ok: false, error: "We couldn't work out an offer just now. Try again." };
  }
}

/** Editor preview: the signed-in owner's own (draft) prices, read with their session. */
async function previewQuote(v: z.infer<typeof selectionSchema>): Promise<QuoteResult> {
  const ctx = await loadPreviewCtx();
  if (!ctx) return { ok: false, error: "Set up your store first." };
  const { prices, deductions } = await storeBuybackOptions(ctx);
  const price = prices.find((p) => p.model_id === v.modelId && p.storage_gb === v.storageGb);
  if (!price) return { ok: false, error: "You don't buy that model and storage yet. Add a buyback price for it." };
  const offerCents = computeOffer(price.base_price_cents, answersOf(v), deductions);
  return { ok: true, offerCents, offer: formatMoney(offerCents, ctx.currency), device: `${price.brand} ${price.model} ${storageLabel(price.storage_gb)}` };
}

export type SellFormValues = { name: string; phone: string; email: string };

export type SellState =
  | { status: "idle"; values?: SellFormValues }
  | { status: "error"; error: string; fieldErrors?: Partial<Record<keyof SellFormValues, string>>; values: SellFormValues }
  | {
      status: "accepted";
      confirmation: {
        reference: string;
        device: string;
        offer: string;
        email: string;
        emailSent: boolean;
        shopName: string;
        shopPhone: string;
        shopAddress: string;
      };
    };

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "Keep your name under 120 characters."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .max(40, "Enter a phone number under 40 characters.")
    .regex(/^\+?[0-9][0-9 ()-]{5,}$/, "Enter a phone number with digits only, like 087 123 4567."),
  email: z.string().trim().max(254, "Enter a shorter email address.").pipe(z.email("Enter an email address like name@example.com.")),
});

/** Accept the offer: recompute it from the selections and record the buyback. */
export async function acceptOffer(_prev: SellState, formData: FormData): Promise<SellState> {
  const s = (k: string) => String(formData.get(k) ?? "");
  const values: SellFormValues = { name: s("name"), phone: s("phone"), email: s("email") };

  const selection = selectionSchema.safeParse({
    storeKey: s("storeKey"),
    modelId: s("modelId"),
    storageGb: s("storageGb"),
    screenCracked: s("screenCracked"),
    batteryOk: s("batteryOk"),
    turnsOn: s("turnsOn"),
  });
  if (!selection.success) return { status: "error", error: "Go back and answer every question about your phone.", values };

  const contact = contactSchema.safeParse(values);
  if (!contact.success) {
    const fieldErrors: Partial<Record<keyof SellFormValues, string>> = {};
    for (const issue of contact.error.issues) {
      const key = issue.path[0] as keyof SellFormValues;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", error: "Check the highlighted fields.", fieldErrors, values };
  }

  const v = selection.data;
  try {
    const result = await createOnlineBuyback(v.storeKey.toLowerCase(), {
      modelId: v.modelId,
      storageGb: v.storageGb,
      answers: answersOf(v),
      customer: contact.data,
    });
    if (!result.ok) return { status: "error", error: result.error, values };

    const b = result.data;
    // Emails never fail the buyback: it is already saved and shows in Sellify.
    const shopMsg = buybackShopEmail(b);
    const [customerSent] = await Promise.all([sendEmail(buybackCustomerEmail(b)), shopMsg ? sendEmail(shopMsg) : null]);

    return {
      status: "accepted",
      confirmation: {
        reference: b.buybackId.slice(0, 8).toUpperCase(),
        device: `${b.deviceLabel} ${b.storageLabel}`,
        offer: formatMoney(b.offerCents, b.currency),
        email: b.customer.email,
        emailSent: customerSent.ok,
        shopName: b.shop.storeName,
        shopPhone: b.shop.contact.phone,
        shopAddress: b.shop.contact.address,
      },
    };
  } catch (e) {
    console.error("[sell] buyback failed", (e as Error).message);
    return { status: "error", error: "Something went wrong on our side. Try again, or call the shop.", values };
  }
}
