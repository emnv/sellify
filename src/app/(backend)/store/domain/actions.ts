"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireShop } from "@/core/shop";
import { addDomain, checkDomain, removeDomain } from "@/stores/domains";

export type DomainFormState = {
  error?: string;
  fieldError?: string;
  values?: { domain?: string };
};

const inputSchema = z.object({ domain: z.string().trim().min(1, "Enter your domain, like fixitgalway.ie.").max(300, "That domain is too long.") });

function revalidateDomain() {
  revalidatePath("/store", "layout");
}

export async function connectDomainAction(_prev: DomainFormState, fd: FormData): Promise<DomainFormState> {
  await requireShop();
  const raw = String(fd.get("domain") ?? "");
  const parsed = inputSchema.safeParse({ domain: raw });
  if (!parsed.success) return { fieldError: parsed.error.issues[0].message, values: { domain: raw } };

  const result = await addDomain(parsed.data.domain);
  if (!result.ok) {
    return result.field === "domain" ? { fieldError: result.error, values: { domain: raw } } : { error: result.error, values: { domain: raw } };
  }
  revalidateDomain();
  redirect("/store/domain?connected=1");
}

export async function checkDomainAction() {
  await requireShop();
  const result = await checkDomain();
  revalidateDomain();
  redirect(result.ok ? "/store/domain?checked=1" : `/store/domain?domainError=${encodeURIComponent(result.error)}`);
}

export async function removeDomainAction() {
  await requireShop();
  const result = await removeDomain();
  revalidateDomain();
  redirect(result.ok ? "/store/domain?removed=1" : `/store/domain?domainError=${encodeURIComponent(result.error)}`);
}
