// Integration test: row level security and the sale RPCs, run against the
// linked Supabase project. Creates two throwaway users/shops and removes them
// afterwards. Skips when the Supabase env vars are not set.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

type Client = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("RLS: shops only see their own data", () => {
  const run = Math.random().toString(36).slice(2, 8);
  const password = `Test-${run}-pass!`;
  let admin: Client;
  let anon: Client;
  const users: { id: string; client: Client; shopId: string }[] = [];

  async function makeUser(tag: string) {
    const email = `rls-${tag}-${run}@sellify.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient<Database>(url!, anonKey!, opts);
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
    const shop = await client.rpc("create_shop", { p_name: `RLS ${tag} ${run}` });
    if (shop.error) throw shop.error;
    return { id: data.user.id, client, shopId: shop.data };
  }

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceKey!, opts);
    anon = createClient<Database>(url!, anonKey!, opts);
    users.push(await makeUser("a"), await makeUser("b"));
  });

  afterAll(async () => {
    if (!admin) return;
    for (const u of users) {
      await admin.storage.from("shop-media").remove([`${u.shopId}/test/pixel.png`]);
      await admin.from("shops").delete().eq("id", u.shopId);
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  const A = () => users[0];
  const B = () => users[1];

  it("a user cannot create a second shop", async () => {
    const { error } = await A().client.rpc("create_shop", { p_name: "Second" });
    expect(error?.code).toBe("23505");
  });

  it("a member sees only their own shop", async () => {
    const { data } = await A().client.from("shops").select("id");
    expect(data?.map((s) => s.id)).toEqual([A().shopId]);
  });

  it("products are isolated between shops", async () => {
    const insert = await A().client
      .from("products")
      .insert({ shop_id: A().shopId, name: "Case", price_cents: 1500, stock_qty: 3 })
      .select("id")
      .single();
    expect(insert.error).toBeNull();
    const productId = insert.data!.id;

    const read = await B().client.from("products").select("id").eq("id", productId);
    expect(read.data).toEqual([]);

    const update = await B().client.from("products").update({ price_cents: 1 }).eq("id", productId).select("id");
    expect(update.data).toEqual([]);

    const foreignInsert = await B().client
      .from("products")
      .insert({ shop_id: A().shopId, name: "Injected", price_cents: 1 });
    expect(foreignInsert.error?.code).toBe("42501");
  });

  it("anonymous visitors cannot read shop tables, but can read the catalog", async () => {
    for (const table of ["shops", "products", "sales", "repair_tickets", "buybacks", "stores"] as const) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      // Either a permission error or an empty result: never rows.
      expect(error ? [] : data).toEqual([]);
    }
    const models = await anon.from("device_models").select("id").limit(1);
    expect(models.data?.length).toBe(1);
  });

  it("POS sale uses database prices and decrements stock atomically", async () => {
    const p = await A().client
      .from("products")
      .insert({ shop_id: A().shopId, name: "iPhone 13", price_cents: 45000, stock_qty: 2 })
      .select("id")
      .single();
    const productId = p.data!.id;

    const sale = await A().client.rpc("record_pos_sale", {
      p_shop_id: A().shopId,
      p_items: [{ product_id: productId, qty: 2, price_cents: 1 }],
    });
    expect(sale.error).toBeNull();

    const saved = await A().client.from("sales").select("total_cents, status, channel").eq("id", sale.data!).single();
    expect(saved.data).toEqual({ total_cents: 90000, status: "paid", channel: "pos" });

    const stock = await A().client.from("products").select("stock_qty").eq("id", productId).single();
    expect(stock.data?.stock_qty).toBe(0);

    const oversell = await A().client.rpc("record_pos_sale", {
      p_shop_id: A().shopId,
      p_items: [{ product_id: productId, qty: 1 }],
    });
    expect(oversell.error?.message).toMatch(/not enough stock/);
    const sales = await A().client.from("sales").select("id");
    expect(sales.data?.length).toBe(1); // the failed sale was rolled back
  });

  it("another shop cannot record a sale against your stock", async () => {
    const { error } = await B().client.rpc("record_pos_sale", {
      p_shop_id: A().shopId,
      p_items: [{ product_id: "00000000-0000-0000-0000-000000000000", qty: 1 }],
    });
    expect(error?.code).toBe("42501");
  });

  it("signed-in users cannot write sales directly or finalize online sales", async () => {
    const direct = await A().client
      .from("sales")
      .insert({ shop_id: A().shopId, channel: "online", total_cents: 0 });
    expect(direct.error).not.toBeNull();

    const finalize = await A().client.rpc("finalize_online_sale", {
      p_sale_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(finalize.error).not.toBeNull();
  });

  it("stores are isolated and slugs are validated", async () => {
    const mine = await A().client
      .from("stores")
      .insert({ shop_id: A().shopId, slug: `rls-a-${run}` })
      .select("id")
      .single();
    expect(mine.error).toBeNull();

    const theirs = await B().client.from("stores").select("id").eq("id", mine.data!.id);
    expect(theirs.data).toEqual([]);

    const reserved = await B().client.from("stores").insert({ shop_id: B().shopId, slug: "admin" });
    expect(reserved.error?.code).toBe("23514");
  });

  it("members cannot publish by writing the publish columns directly", async () => {
    const store = await A().client.from("stores").select("id").eq("shop_id", A().shopId).single();
    const direct = await A().client
      .from("stores")
      .update({ is_published: true, published_config: { injected: true } })
      .eq("id", store.data!.id);
    expect(direct.error?.code).toBe("42501");

    const draft = await A().client.from("stores").update({ draft_config: { ok: true } }).eq("id", store.data!.id);
    expect(draft.error).toBeNull();
  });

  it("media uploads are limited to the member's own shop folder", async () => {
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
      (c) => c.charCodeAt(0),
    );
    const own = await A().client.storage
      .from("shop-media")
      .upload(`${A().shopId}/test/pixel.png`, png, { contentType: "image/png", upsert: true });
    expect(own.error).toBeNull();

    const foreign = await B().client.storage
      .from("shop-media")
      .upload(`${A().shopId}/test/evil.png`, png, { contentType: "image/png" });
    expect(foreign.error).not.toBeNull();
  });
});
