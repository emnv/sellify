"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_PROMPT_LENGTH } from "@/lib/ai/theme-schema";
import { applyAiTheme, undoAiTheme } from "@/stores/ai-design";

export type AiState = {
  error?: string;
  /** What the AI changed (or "previous design restored" after Undo). */
  message?: string;
  /** Keeps what the owner typed after React resets the form. */
  prompt?: string;
  nonce?: number;
};

const promptSchema = z
  .string()
  .trim()
  .min(3, "Describe the look you want.")
  .max(MAX_PROMPT_LENGTH, `Keep your request under ${MAX_PROMPT_LENGTH} characters.`);

function revalidateStore() {
  revalidatePath("/store", "layout");
  revalidatePath("/store/preview", "layout");
}

export async function restyleWithAi(_prev: AiState, fd: FormData): Promise<AiState> {
  const raw = String(fd.get("prompt") ?? "");
  const prompt = promptSchema.safeParse(raw);
  if (!prompt.success) return { error: prompt.error.issues[0].message, prompt: raw, nonce: Date.now() };

  const result = await applyAiTheme(prompt.data);
  if (!result.ok) return { error: result.error, prompt: raw, nonce: Date.now() };
  revalidateStore();
  return { message: result.explanation, prompt: raw, nonce: Date.now() };
}

export async function undoAiRestyle(): Promise<AiState> {
  const result = await undoAiTheme();
  if (!result.ok) return { error: result.error, nonce: Date.now() };
  revalidateStore();
  return { message: result.explanation, nonce: Date.now() };
}
