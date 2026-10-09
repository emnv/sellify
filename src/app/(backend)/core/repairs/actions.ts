"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCatalog } from "@/core/catalog";
import { readTicketForm, readTicketUpdateForm, ticketSchema, ticketUpdateSchema } from "@/core/repairs";
import { requireShop } from "@/core/shop";
import { zonedLocalToUtc } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

type FieldErrors = Partial<Record<string, string>>;

export type TicketFormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  values?: ReturnType<typeof readTicketForm>;
};

export type TicketUpdateState = {
  error?: string;
  fieldErrors?: FieldErrors;
  values?: ReturnType<typeof readTicketUpdateForm>;
};

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createTicket(_prev: TicketFormState, formData: FormData): Promise<TicketFormState> {
  const { shop } = await requireShop();
  const catalog = await getCatalog();
  const values = readTicketForm(formData);
  const parsed = ticketSchema(catalog).safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }
  const t = parsed.data;

  let scheduledAt: string | null = null;
  if (t.scheduled_at) {
    const utc = zonedLocalToUtc(t.scheduled_at, shop.timezone);
    if (!utc) {
      return { error: "Check the highlighted fields.", fieldErrors: { scheduled_at: "Choose a date and time, or leave it empty." }, values };
    }
    scheduledAt = utc.toISOString();
  }

  const supabase = await createClient();

  // Never trust a client price: an empty quote uses the shop's own repair price.
  let quote = t.quoted_price;
  if (quote === null) {
    const { data: price, error } = await supabase
      .from("repair_prices")
      .select("price_cents")
      .eq("shop_id", shop.id)
      .eq("model_id", t.model_id)
      .eq("repair_type_id", t.repair_type_id)
      .maybeSingle();
    if (error) return { error: "Could not look up your repair price. Try again.", values };
    if (!price) {
      return {
        error: "Check the highlighted fields.",
        fieldErrors: { quoted_price: "No repair price set for this model and repair. Enter a price." },
        values,
      };
    }
    quote = price.price_cents;
  }

  const repairLabel = catalog.repairTypes.find((r) => r.id === t.repair_type_id)?.name ?? "Repair";
  const { data, error } = await supabase
    .from("repair_tickets")
    .insert({
      shop_id: shop.id,
      model_id: t.model_id,
      repair_type_id: t.repair_type_id,
      device_label: catalog.modelLabels[t.model_id],
      repair_label: repairLabel,
      quoted_price_cents: quote,
      scheduled_at: scheduledAt,
      status: "booked",
      source: "walk_in",
      customer_name: t.customer_name,
      customer_phone: t.customer_phone,
      customer_email: t.customer_email,
      notes: t.notes,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the ticket. Try again.", values };

  revalidatePath("/core/repairs");
  redirect(`/core/repairs/${data.id}?created=1`);
}

export async function updateTicket(_prev: TicketUpdateState, formData: FormData): Promise<TicketUpdateState> {
  const { shop } = await requireShop();
  const id = String(formData.get("id") ?? "");
  const values = readTicketUpdateForm(formData);
  if (!z.uuid().safeParse(id).success) return { error: "Could not find this ticket. Reload the page and try again.", values };

  const parsed = ticketUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_tickets")
    .update({ status: parsed.data.status, notes: parsed.data.notes })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not update the ticket. Try again.", values };

  revalidatePath("/core/repairs");
  revalidatePath(`/core/repairs/${id}`);
  redirect(`/core/repairs/${id}?updated=1`);
}
