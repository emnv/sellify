import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { requireShop } from "@/core/shop";
import { serverEnv } from "@/lib/env.server";
import { defaultStoreConfig, parseStoreConfig, storeConfigSchema, type StoreConfig } from "@/lib/store/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { storeUrl } from "./urls";

// SELLIFY STORES: the owner's store, as seen from the backend.

export type StoreRow = Tables<"stores">;
export type OwnerStore = {
  row: StoreRow;
  draft: StoreConfig;
  published: StoreConfig | null;
  /** Draft differs from what is live. */
  hasUnpublishedChanges: boolean;
  liveUrl: string;
  customDomain: string | null;
};

export function urlEnv() {
  const env = serverEnv();
  return { rootDomain: env.STORES_ROOT_DOMAIN, appUrl: env.APP_URL };
}

/** The signed-in shop's store, or null if it has not created one yet. */
export const getOwnerStore = cache(async (): Promise<OwnerStore | null> => {
  const { shop } = await requireShop();
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("stores").select("*").eq("shop_id", shop.id).maybeSingle();
  if (error) throw new Error(`Could not load your store: ${error.message}`);
  if (!row) return null;

  const { data: domains } = await supabase.from("store_domains").select("domain, status").eq("store_id", row.id);
  // Only an "active" domain (DNS correct, HTTPS issued) becomes the live link.
  const active = domains?.find((d) => d.status === "active")?.domain ?? null;

  const draft = parseStoreConfig(row.draft_config, shop.name);
  const published = row.published_config ? parseStoreConfig(row.published_config, shop.name) : null;
  return {
    row,
    draft,
    published,
    hasUnpublishedChanges: !published || JSON.stringify(published) !== JSON.stringify(draft),
    liveUrl: storeUrl(row.slug, urlEnv(), active),
    customDomain: active,
  };
});

export async function requireOwnerStore(): Promise<OwnerStore> {
  const store = await getOwnerStore();
  if (!store) redirect("/store");
  return store;
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "Use 3–40 lowercase letters, numbers and dashes, like fixit-galway.")
  .refine((s) => !s.includes("--"), "Don't use two dashes in a row.");

export function suggestSlug(name: string) {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return s.length >= 3 ? s : `${s}-store`.replace(/^-/, "");
}

/** Create the shop's store with a starter config built from the shop profile. */
export async function createStore(slug: string) {
  const { shop } = await requireShop();
  const supabase = await createClient();
  const config = defaultStoreConfig(shop);
  return supabase
    .from("stores")
    .insert({ shop_id: shop.id, slug, template: config.theme.template, draft_config: config })
    .select("id")
    .single();
}

/** Save a validated draft. Only the draft; customers see nothing until publish. */
export async function saveDraft(next: StoreConfig) {
  const { shop } = await requireShop();
  const config = storeConfigSchema.parse(next);
  assertOwnMedia(config, shop.id);
  const supabase = await createClient();
  return supabase
    .from("stores")
    .update({ draft_config: config, template: config.theme.template })
    .eq("shop_id", shop.id)
    .select("id")
    .single();
}

/** Media URLs must point into this shop's folder of the media bucket. */
export function assertOwnMedia(config: StoreConfig, shopId: string) {
  const prefix = `/storage/v1/object/public/shop-media/${shopId}/`;
  for (const url of [config.content.logoUrl, config.content.heroImageUrl]) {
    if (url && !new URL(url).pathname.startsWith(prefix)) throw new Error("Image is not from this shop.");
  }
}

/**
 * Publish: validate the draft against the schema, then copy it to
 * published_config with the service role (members cannot write the publish
 * columns directly; see migration 20261009090500).
 */
export async function publishStore(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { shop } = await requireShop();
  const store = await getOwnerStore();
  if (!store) return { ok: false, error: "Create your store first." };

  const parsed = storeConfigSchema.safeParse(store.row.draft_config);
  if (!parsed.success) return { ok: false, error: "Some settings are incomplete. Check each tab, save, then publish." };
  assertOwnMedia(parsed.data, shop.id);

  const { error } = await createAdminClient()
    .from("stores")
    .update({
      published_config: parsed.data,
      template: parsed.data.theme.template,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq("id", store.row.id)
    .eq("shop_id", shop.id);
  return error ? { ok: false, error: "Could not publish. Try again." } : { ok: true };
}

export async function unpublishStore() {
  const { shop } = await requireShop();
  return createAdminClient().from("stores").update({ is_published: false }).eq("shop_id", shop.id);
}
