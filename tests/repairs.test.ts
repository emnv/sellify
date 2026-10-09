// Integration test: repair slot capacity (book_online_repair) and the ticket
// notes history (repair_ticket_notes RLS), run against the linked Supabase
// project. Creates two throwaway users/shops and removes them afterwards.
// Skips when the Supabase env vars are not set.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

type Client = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("repairs: slot capacity and notes history", () => {
  const run = Math.random().toString(36).slice(2, 8);
  const password = `Test-${run}-pass!`;
  let admin: Client;
  const users: { id: string; client: Client; shopId: string }[] = [];
  let modelId: number;
  let repairTypeId: number;
  // A whole hour far in the future, unique per run.
  const slot = new Date(Date.UTC(2031, 0, 1 + Math.floor(Math.random() * 300), 10)).toISOString();

  async function makeUser(tag: string) {
    const email = `repairs-${tag}-${run}@sellify.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient<Database>(url!, anonKey!, opts);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    const shop = await client.rpc("create_shop", { p_name: `Repairs ${tag} ${run}` });
    if (shop.error) throw shop.error;
    return { id: data.user.id, client, shopId: shop.data };
  }

  const book = (shopId: string, customer: string) =>
    admin.rpc("book_online_repair", {
      p_shop_id: shopId,
      p_model_id: modelId,
      p_repair_type_id: repairTypeId,
      p_device_label: "Test phone",
      p_repair_label: "Test repair",
      p_quoted_price_cents: 5000,
      p_scheduled_at: slot,
      p_customer_name: customer,
      p_customer_phone: "000",
      p_customer_email: `${customer}-${run}@sellify.test`,
    });

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceKey!, opts);
    const [model, repair] = await Promise.all([
      admin.from("device_models").select("id").limit(1).single(),
      admin.from("repair_types").select("id").limit(1).single(),
    ]);
    if (model.error) throw model.error;
    if (repair.error) throw repair.error;
    modelId = model.data.id;
    repairTypeId = repair.data.id;
    users.push(await makeUser("a"), await makeUser("b"));
  });

  afterAll(async () => {
    if (!admin) return;
    for (const u of users) {
      await admin.from("shops").delete().eq("id", u.shopId);
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  const A = () => users[0];
  const B = () => users[1];

  it("a member can set the slot capacity within 1 to 10", async () => {
    const ok = await A().client.from("shops").update({ repair_slot_capacity: 2 }).eq("id", A().shopId).select("repair_slot_capacity").single();
    expect(ok.error).toBeNull();
    expect(ok.data?.repair_slot_capacity).toBe(2);

    const tooMany = await A().client.from("shops").update({ repair_slot_capacity: 11 }).eq("id", A().shopId);
    expect(tooMany.error).not.toBeNull();

    // Another shop's member cannot change it.
    const foreign = await B().client.from("shops").update({ repair_slot_capacity: 5 }).eq("id", A().shopId).select("id");
    expect(foreign.data ?? []).toEqual([]);
  });

  it("book_online_repair fills a slot up to capacity, and a cancellation frees a seat", async () => {
    const first = await book(A().shopId, "first");
    const second = await book(A().shopId, "second");
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).toBeTruthy();
    expect(second.data).toBeTruthy();

    const third = await book(A().shopId, "third");
    expect(third.error).toBeNull();
    expect(third.data).toBeNull();

    // The refused booking left no row behind.
    const active = await admin.from("repair_tickets").select("id").eq("shop_id", A().shopId).eq("scheduled_at", slot).neq("status", "cancelled");
    expect(active.data?.length).toBe(2);

    const cancel = await admin.from("repair_tickets").update({ status: "cancelled" }).eq("id", first.data!);
    expect(cancel.error).toBeNull();
    const again = await book(A().shopId, "again");
    expect(again.error).toBeNull();
    expect(again.data).toBeTruthy();
  });

  it("parallel bookings never exceed capacity", async () => {
    const parallelSlot = new Date(new Date(slot).getTime() + 3_600_000).toISOString();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        admin.rpc("book_online_repair", {
          p_shop_id: A().shopId,
          p_model_id: modelId,
          p_repair_type_id: repairTypeId,
          p_device_label: "Test phone",
          p_repair_label: "Test repair",
          p_quoted_price_cents: 5000,
          p_scheduled_at: parallelSlot,
          p_customer_name: `p${i}`,
          p_customer_phone: "000",
          p_customer_email: `p${i}-${run}@sellify.test`,
        }),
      ),
    );
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(results.filter((r) => r.data).length).toBe(2);
  });

  it("signed-in users cannot call book_online_repair", async () => {
    const { error } = await A().client.rpc("book_online_repair", {
      p_shop_id: A().shopId,
      p_model_id: modelId,
      p_repair_type_id: repairTypeId,
      p_device_label: "x",
      p_repair_label: "x",
      p_quoted_price_cents: 1,
      p_scheduled_at: slot,
      p_customer_name: "x",
      p_customer_phone: "x",
      p_customer_email: "x@sellify.test",
    });
    expect(error).not.toBeNull();
  });

  it("ticket notes: members add and read their own; other shops can't; author is always the caller", async () => {
    const ticket = await A().client.from("repair_tickets").select("id").eq("shop_id", A().shopId).limit(1).single();
    const ticketId = ticket.data!.id;

    const own = await A().client
      .from("repair_ticket_notes")
      .insert({ shop_id: A().shopId, ticket_id: ticketId, body: "Screen cracked top left.", author_id: A().id })
      .select("id")
      .single();
    expect(own.error).toBeNull();

    const read = await A().client.from("repair_ticket_notes").select("body").eq("ticket_id", ticketId);
    expect(read.data?.map((n) => n.body)).toEqual(["Screen cracked top left."]);

    // Author must be the caller.
    const spoofed = await A().client.from("repair_ticket_notes").insert({ shop_id: A().shopId, ticket_id: ticketId, body: "x", author_id: B().id });
    expect(spoofed.error?.code).toBe("42501");
    const noAuthor = await A().client.from("repair_ticket_notes").insert({ shop_id: A().shopId, ticket_id: ticketId, body: "x" });
    expect(noAuthor.error?.code).toBe("42501");

    // Other shop: cannot read, cannot write into A's shop, cannot attach to A's ticket from its own shop.
    const foreignRead = await B().client.from("repair_ticket_notes").select("id").eq("ticket_id", ticketId);
    expect(foreignRead.data).toEqual([]);
    const foreignInsert = await B().client.from("repair_ticket_notes").insert({ shop_id: A().shopId, ticket_id: ticketId, body: "x", author_id: B().id });
    expect(foreignInsert.error?.code).toBe("42501");
    const crossShop = await B().client.from("repair_ticket_notes").insert({ shop_id: B().shopId, ticket_id: ticketId, body: "x", author_id: B().id });
    expect(crossShop.error?.code).toBe("42501");

    // Append-only: no edits or deletes, even by the author.
    const edit = await A().client.from("repair_ticket_notes").update({ body: "changed" }).eq("id", own.data!.id);
    expect(edit.error).not.toBeNull();
    const del = await A().client.from("repair_ticket_notes").delete().eq("id", own.data!.id);
    expect(del.error).not.toBeNull();
    const still = await admin.from("repair_ticket_notes").select("body").eq("id", own.data!.id).single();
    expect(still.data?.body).toBe("Screen cracked top left.");
  });
});
