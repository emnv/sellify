"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShop } from "@/core/shop";
import {
  applyTemplate,
  contentSchema,
  DAYS,
  storeConfigSchema,
  themeSchema,
  type StoreConfig,
  type Template,
} from "@/lib/store/config";
import { createClient } from "@/lib/supabase/server";
import { createStore, getOwnerStore, publishStore, saveDraft, slugSchema, unpublishStore } from "@/stores/store";

export type EditorState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  saved?: boolean;
  /** Changes on every response, so forms can remount with fresh defaults. */
  nonce?: number;
};

function issuesToFields(error: z.ZodError, prefix = "") {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = prefix + issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}

function revalidateStore() {
  revalidatePath("/store", "layout");
  revalidatePath("/store/preview", "layout");
}

async function save(next: StoreConfig): Promise<EditorState> {
  const parsed = storeConfigSchema.safeParse(next);
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: issuesToFields(parsed.error), nonce: Date.now() };
  try {
    const { error } = await saveDraft(parsed.data);
    if (error) return { error: "Could not save. Try again.", nonce: Date.now() };
  } catch {
    return { error: "One of the images could not be used. Upload it again.", nonce: Date.now() };
  }
  revalidateStore();
  return { saved: true, nonce: Date.now() };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// ---------------------------------------------------------------------------

export async function createStoreAction(_prev: EditorState, fd: FormData): Promise<EditorState> {
  await requireShop();
  const slug = slugSchema.safeParse(s(fd, "slug"));
  if (!slug.success) return { fieldErrors: { slug: slug.error.issues[0].message }, nonce: Date.now() };
  const { error } = await createStore(slug.data);
  if (error) {
    if (error.code === "23505") return { fieldErrors: { slug: "That address is taken. Try another." }, nonce: Date.now() };
    if (error.code === "23514") return { fieldErrors: { slug: "That address is reserved. Try another." }, nonce: Date.now() };
    return { error: "Could not create your store. Try again.", nonce: Date.now() };
  }
  revalidateStore();
  redirect("/store?created=1");
}

export async function publishAction() {
  const result = await publishStore();
  revalidateStore();
  redirect(result.ok ? "/store?published=1" : `/store?publishError=${encodeURIComponent(result.error)}`);
}

export async function unpublishAction() {
  await unpublishStore();
  revalidateStore();
  redirect("/store?unpublished=1");
}

export async function saveGeneral(_prev: EditorState, fd: FormData): Promise<EditorState> {
  const store = await getOwnerStore();
  if (!store) redirect("/store");

  const slug = slugSchema.safeParse(s(fd, "slug"));
  if (!slug.success) return { fieldErrors: { slug: slug.error.issues[0].message }, nonce: Date.now() };

  const next: StoreConfig = {
    ...store.draft,
    content: {
      ...store.draft.content,
      storeName: s(fd, "storeName"),
      tagline: s(fd, "tagline"),
      logoUrl: s(fd, "logoUrl") || null,
    },
  };
  const result = await save(next);
  if (result.error || slug.data === store.row.slug) return result;

  // Address change: a separate column, members may update it (RLS + grants).
  const supabase = await createClient();
  const { error } = await supabase.from("stores").update({ slug: slug.data }).eq("id", store.row.id);
  if (error) {
    const msg = error.code === "23505" ? "That address is taken. Try another." : error.code === "23514" ? "That address is reserved. Try another." : "Could not change the address.";
    return { fieldErrors: { slug: msg }, nonce: Date.now() };
  }
  revalidateStore();
  return result;
}

export async function changeTemplate(_prev: EditorState, fd: FormData): Promise<EditorState> {
  const store = await getOwnerStore();
  if (!store) redirect("/store");
  const t = z.enum(["clean", "bold", "local"]).safeParse(s(fd, "template"));
  if (!t.success) return { error: "Choose a template.", nonce: Date.now() };
  return save(applyTemplate(store.draft, t.data as Template));
}

export async function saveDesign(_prev: EditorState, fd: FormData): Promise<EditorState> {
  const store = await getOwnerStore();
  if (!store) redirect("/store");
  const theme = themeSchema.safeParse({
    template: store.draft.theme.template,
    colors: {
      primary: s(fd, "colors.primary"),
      background: s(fd, "colors.background"),
      surface: s(fd, "colors.surface"),
      text: s(fd, "colors.text"),
      accent: s(fd, "colors.accent"),
    },
    fonts: { heading: s(fd, "fonts.heading"), body: s(fd, "fonts.body") },
    radius: s(fd, "radius"),
    buttonSize: s(fd, "buttonSize"),
    heroStyle: s(fd, "heroStyle"),
    productColumns: Number(s(fd, "productColumns")),
  });
  if (!theme.success) return { error: "Check the highlighted fields.", fieldErrors: issuesToFields(theme.error), nonce: Date.now() };
  return save({ ...store.draft, theme: theme.data });
}

export async function saveContent(_prev: EditorState, fd: FormData): Promise<EditorState> {
  const store = await getOwnerStore();
  if (!store) redirect("/store");

  const hours = Object.fromEntries(
    DAYS.map((d) => [d, { closed: fd.get(`hours.${d}.closed`) === "on", open: s(fd, `hours.${d}.open`), close: s(fd, `hours.${d}.close`) }]),
  );
  const authors = fd.getAll("reviews.author").map(String);
  const texts = fd.getAll("reviews.text").map(String);
  const ratings = fd.getAll("reviews.rating").map(Number);
  const reviews = authors
    .map((author, i) => ({ author: author.trim(), text: (texts[i] ?? "").trim(), rating: ratings[i] || 5 }))
    .filter((r) => r.author || r.text);

  const content = contentSchema.safeParse({
    ...store.draft.content,
    heroImageUrl: s(fd, "heroImageUrl") || null,
    banner: { enabled: fd.get("banner.enabled") === "on", text: s(fd, "banner.text") },
    about: s(fd, "about"),
    contact: { phone: s(fd, "contact.phone"), email: s(fd, "contact.email").trim().toLowerCase(), address: s(fd, "contact.address") },
    hours,
    reviews,
  });
  if (!content.success) return { error: "Check the highlighted fields.", fieldErrors: issuesToFields(content.error), nonce: Date.now() };
  return save({ ...store.draft, content: content.data });
}

export async function savePages(_prev: EditorState, fd: FormData): Promise<EditorState> {
  const store = await getOwnerStore();
  if (!store) redirect("/store");
  const tabs = { shop: fd.get("tabs.shop") === "on", repair: fd.get("tabs.repair") === "on", sell: fd.get("tabs.sell") === "on" };
  return save({ ...store.draft, content: { ...store.draft.content, tabs } });
}
