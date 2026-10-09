import "server-only";
import { requireShop } from "@/core/shop";
import { proposeTheme } from "@/lib/ai/customizer";
import { themeSchema, type StoreTheme } from "@/lib/store/config";
import { createClient } from "@/lib/supabase/server";
import { getOwnerStore, saveDraft } from "./store";

// SELLIFY STORES: the AI customizer. It changes only the theme of the DRAFT;
// the owner checks the preview and publishes. Every AI change first stores the
// previous theme in store_design_history (member client, so RLS applies),
// which is what Undo restores.

export const MAX_HISTORY = 20;
export const MAX_AI_REQUESTS_PER_HOUR = 20;

export type AiDesignResult =
  | { ok: true; explanation: string; theme: StoreTheme }
  | { ok: false; error: string };

/** Whether there is a previous design to go back to, and how many AI requests are left this hour. */
export async function getAiDesignStatus(): Promise<{ canUndo: boolean; remainingThisHour: number }> {
  const store = await getOwnerStore();
  if (!store) return { canUndo: false, remainingThisHour: 0 };
  const supabase = await createClient();
  const [{ count: total }, { count: lastHour }] = await Promise.all([
    supabase.from("store_design_history").select("id", { count: "exact", head: true }).eq("store_id", store.row.id),
    supabase
      .from("store_ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.row.id)
      .gte("created_at", hourAgo()),
  ]);
  return { canUndo: (total ?? 0) > 0, remainingThisHour: Math.max(0, MAX_AI_REQUESTS_PER_HOUR - (lastHour ?? 0)) };
}

function hourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

export async function applyAiTheme(prompt: string): Promise<AiDesignResult> {
  const { shop } = await requireShop();
  const store = await getOwnerStore();
  if (!store) return { ok: false, error: "Create your store first." };
  const supabase = await createClient();

  // Rate limit per store: every request in the last hour counts, including
  // failed ones and ones later undone (store_ai_requests is append-only).
  // Record first, then count (this request included): parallel requests each
  // see the others' rows, so they cannot all slip under the limit.
  const { error: logError } = await supabase.from("store_ai_requests").insert({ store_id: store.row.id });
  if (logError) return { ok: false, error: "Could not start the AI designer. Try again." };
  const { count, error: countError } = await supabase
    .from("store_ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.row.id)
    .gte("created_at", hourAgo());
  if (countError) return { ok: false, error: "Could not check your AI usage. Try again." };
  if ((count ?? 0) > MAX_AI_REQUESTS_PER_HOUR) {
    return { ok: false, error: `You've used the AI designer ${MAX_AI_REQUESTS_PER_HOUR} times in the last hour. Try again later, or change the design by hand below.` };
  }

  const current = store.draft;
  const result = await proposeTheme({ prompt, currentTheme: current.theme, storeName: current.content.storeName });
  if (!result.ok) return result;
  console.info(
    `[ai-customizer] shop=${shop.id} store=${store.row.id} model=${result.model} input_tokens=${result.usage.input_tokens} output_tokens=${result.usage.output_tokens}`,
  );

  // Remember the current design so the owner can undo.
  const { data: saved, error: historyError } = await supabase
    .from("store_design_history")
    .insert({ store_id: store.row.id, theme: current.theme, template: current.theme.template, prompt: prompt.slice(0, 1000) })
    .select("id")
    .single();
  if (historyError) return { ok: false, error: "Could not save your current design for undo, so nothing was changed. Try again." };

  const { error: saveError } = await saveDraft({ ...current, theme: result.theme });
  if (saveError) {
    await supabase.from("store_design_history").delete().eq("id", saved.id).eq("store_id", store.row.id);
    return { ok: false, error: "Could not save the new design. Try again." };
  }

  await trimHistory(store.row.id);
  return { ok: true, explanation: result.explanation, theme: result.theme };
}

/** Keep only the newest MAX_HISTORY rows for this store. */
async function trimHistory(storeId: string) {
  const supabase = await createClient();
  const { data: old } = await supabase
    .from("store_design_history")
    .select("id")
    .eq("store_id", storeId)
    .order("id", { ascending: false })
    .range(MAX_HISTORY, MAX_HISTORY + 99);
  if (old?.length) {
    await supabase
      .from("store_design_history")
      .delete()
      .eq("store_id", storeId)
      .in("id", old.map((r) => r.id));
  }
}

/** Restore the design from before the latest AI change, then forget that history entry. */
export async function undoAiTheme(): Promise<AiDesignResult> {
  await requireShop();
  const store = await getOwnerStore();
  if (!store) return { ok: false, error: "Create your store first." };
  const supabase = await createClient();

  const { data: last, error } = await supabase
    .from("store_design_history")
    .select("id, theme")
    .eq("store_id", store.row.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: "Could not load your previous design. Try again." };
  if (!last) return { ok: false, error: "There is nothing to undo." };

  const theme = themeSchema.safeParse(last.theme);
  if (!theme.success) {
    // A broken entry can never be restored; drop it so the next undo works.
    await supabase.from("store_design_history").delete().eq("id", last.id).eq("store_id", store.row.id);
    return { ok: false, error: "That earlier design could not be restored. Try Undo again." };
  }

  const { error: saveError } = await saveDraft({ ...store.draft, theme: theme.data });
  if (saveError) return { ok: false, error: "Could not restore the previous design. Try again." };
  await supabase.from("store_design_history").delete().eq("id", last.id).eq("store_id", store.row.id);
  return { ok: true, explanation: "Your previous design is back in the draft.", theme: theme.data };
}
