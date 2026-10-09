"use server";

import { z } from "zod";
import { createOnlineRepairTicket } from "@/core/api-bookings";
import { formatDateTime } from "@/lib/datetime";
import { repairBookingCustomerEmail, repairBookingShopEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { formatMoney } from "@/lib/money";

// Online repair booking from the store's Repair tab. The client sends only
// its selections and contact details; the price, labels and the shop come
// from the database (see @/core/api-bookings).

export type RepairFormValues = { name: string; phone: string; email: string };

export type RepairBookingState =
  | { status: "idle"; values?: RepairFormValues }
  | { status: "error"; error: string; field?: string; fieldErrors?: Partial<Record<keyof RepairFormValues, string>>; values: RepairFormValues }
  | {
      status: "booked";
      confirmation: {
        reference: string;
        device: string;
        repair: string;
        price: string;
        when: string;
        sameDay: boolean;
        email: string;
        emailSent: boolean;
        shopName: string;
        shopPhone: string;
        shopAddress: string;
      };
    };

const id = (message: string) => z.coerce.number(message).int(message).positive(message).max(2_147_483_647, message);

const schema = z.object({
  storeKey: z.string().trim().min(1).max(253),
  modelId: id("Choose your model."),
  repairTypeId: id("Choose a repair."),
  slot: z.string().trim().min(1, "Choose a date and time.").max(40, "Choose a date and time."),
  name: z.string().trim().min(1, "Enter your name.").max(120, "Keep your name under 120 characters."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .max(40, "Enter a phone number under 40 characters.")
    .regex(/^\+?[0-9][0-9 ()-]{5,}$/, "Enter a phone number with digits only, like 087 123 4567."),
  email: z.string().trim().max(254, "Enter a shorter email address.").pipe(z.email("Enter an email address like name@example.com.")),
});

function read(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? "");
  return { storeKey: s("storeKey"), modelId: s("modelId"), repairTypeId: s("repairTypeId"), slot: s("slot"), name: s("name"), phone: s("phone"), email: s("email") };
}

export async function bookRepair(_prev: RepairBookingState, formData: FormData): Promise<RepairBookingState> {
  const raw = read(formData);
  const values: RepairFormValues = { name: raw.name, phone: raw.phone, email: raw.email };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof RepairFormValues, string>> = {};
    let field: string | undefined;
    let error = "Check the highlighted fields.";
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (key === "name" || key === "phone" || key === "email") fieldErrors[key] ??= issue.message;
      else if (!field) {
        field = key === "slot" ? "slot" : "repair";
        error = issue.message;
      }
    }
    return { status: "error", error, field, fieldErrors, values };
  }
  const v = parsed.data;

  try {
    const result = await createOnlineRepairTicket(v.storeKey.toLowerCase(), {
      modelId: v.modelId,
      repairTypeId: v.repairTypeId,
      scheduledAt: v.slot,
      customer: { name: v.name, phone: v.phone, email: v.email },
    });
    if (!result.ok) return { status: "error", error: result.error, field: result.field, values };

    const b = result.data;
    // Emails never fail the booking: it is already saved and shows in Sellify.
    const shopMsg = repairBookingShopEmail(b);
    const [customerSent] = await Promise.all([sendEmail(repairBookingCustomerEmail(b)), shopMsg ? sendEmail(shopMsg) : null]);

    return {
      status: "booked",
      confirmation: {
        reference: b.ticketId.slice(0, 8).toUpperCase(),
        device: b.deviceLabel,
        repair: b.repairLabel,
        price: formatMoney(b.priceCents, b.shop.currency),
        when: formatDateTime(b.scheduledAt, b.shop.timezone),
        sameDay: b.partInStock,
        email: b.customer.email,
        emailSent: customerSent.ok,
        shopName: b.shop.storeName,
        shopPhone: b.shop.contact.phone,
        shopAddress: b.shop.contact.address,
      },
    };
  } catch (e) {
    console.error("[repair] booking failed", (e as Error).message);
    return { status: "error", error: "Something went wrong on our side. Try again, or call the shop.", values };
  }
}
