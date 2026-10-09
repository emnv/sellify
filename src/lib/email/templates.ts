import type { BuybackAnswers } from "@/lib/buyback/quote";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { DAY_LABELS, DAYS, type StoreContent } from "@/lib/store/config";
import type { EmailMessage } from "./send";

// Plain-text emails for online bookings. One function per message; each
// returns null when there is nobody to send it to.

type ShopInfo = {
  storeName: string;
  notifyEmail: string | null;
  timezone: string;
  currency: string;
  contact: StoreContent["contact"];
  hours: StoreContent["hours"];
};
type Customer = { name: string; phone: string; email: string };

export type RepairEmailData = {
  ticketId: string;
  shop: ShopInfo;
  deviceLabel: string;
  repairLabel: string;
  priceCents: number;
  partInStock: boolean;
  scheduledAt: string;
  customer: Customer;
};

export type BuybackEmailData = {
  buybackId: string;
  shop: ShopInfo;
  deviceLabel: string;
  storageLabel: string;
  offerCents: number;
  answers: BuybackAnswers;
  customer: Customer;
};

const lines = (...rows: Array<string | null | false | undefined>) => rows.filter((r) => r !== null && r !== false && r !== undefined).join("\n");

/** Single-line value for a subject (no line breaks, bounded length). */
const oneLine = (s: string, max = 60) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** "Thu 12 Jun 14:00" */
const when = (iso: string, tz: string) => formatDateTime(iso, tz).replace(",", "");

function hoursText(hours: StoreContent["hours"]) {
  return DAYS.map((d) => `  ${DAY_LABELS[d]}: ${hours[d].closed ? "Closed" : `${hours[d].open}–${hours[d].close}`}`).join("\n");
}

function shopContact(shop: ShopInfo) {
  const { address, phone, email } = shop.contact;
  return lines(
    shop.storeName,
    address ? `Address: ${address}` : null,
    phone ? `Phone: ${phone}` : null,
    email ? `Email: ${email}` : null,
    "",
    "Opening hours:",
    hoursText(shop.hours),
  );
}

function customerBlock(c: Customer) {
  return lines(`Name: ${c.name}`, `Phone: ${c.phone}`, `Email: ${c.email}`);
}

export function describeCondition(a: BuybackAnswers) {
  return lines(
    `Screen cracked: ${a.screenCracked === null ? "not answered" : a.screenCracked ? "yes" : "no"}`,
    `Battery OK: ${a.batteryOk === null ? "not answered" : a.batteryOk ? "yes" : "no"}`,
    `Turns on: ${a.turnsOn === null ? "not answered" : a.turnsOn ? "yes" : "no"}`,
  );
}

const ref = (id: string) => id.slice(0, 8).toUpperCase();

// ---------------------------------------------------------------------------
// Repair booking
// ---------------------------------------------------------------------------

export function repairBookingShopEmail(d: RepairEmailData): EmailMessage | null {
  if (!d.shop.notifyEmail) return null;
  const at = when(d.scheduledAt, d.shop.timezone);
  return {
    to: d.shop.notifyEmail,
    replyTo: d.customer.email,
    subject: `New repair booking: ${oneLine(d.deviceLabel)} ${oneLine(d.repairLabel).toLowerCase()}, ${at}, ${oneLine(d.customer.name, 40)}`,
    text: lines(
      "You have a new repair booking from your online store.",
      "",
      `Device: ${d.deviceLabel}`,
      `Repair: ${d.repairLabel}`,
      `Quoted price: ${formatMoney(d.priceCents, d.shop.currency)}`,
      `Part in stock: ${d.partInStock ? "yes" : "no, order it before the appointment"}`,
      `When: ${at}`,
      "",
      "Customer",
      customerBlock(d.customer),
      "",
      `Reference: ${ref(d.ticketId)}`,
      "The booking is in Sellify under Repair tickets. Reply to this email to contact the customer.",
    ),
  };
}

export function repairBookingCustomerEmail(d: RepairEmailData): EmailMessage {
  const at = when(d.scheduledAt, d.shop.timezone);
  return {
    to: d.customer.email,
    replyTo: d.shop.contact.email || d.shop.notifyEmail,
    subject: `Your repair is booked: ${at} at ${oneLine(d.shop.storeName)}`,
    text: lines(
      `Hi ${d.customer.name},`,
      "",
      `Thanks for booking with ${d.shop.storeName}. Here are your details:`,
      "",
      `Device: ${d.deviceLabel}`,
      `Repair: ${d.repairLabel}`,
      `Price: ${formatMoney(d.priceCents, d.shop.currency)}`,
      `When: ${at}`,
      d.partInStock ? "Same-day repair available: we have the part in stock." : null,
      `Reference: ${ref(d.ticketId)}`,
      "",
      "Bring your phone and its charger to the shop at your booked time. Back up your phone first if you can.",
      "Need to change or cancel? Call or email us.",
      "",
      shopContact(d.shop),
    ),
  };
}

// ---------------------------------------------------------------------------
// Buyback
// ---------------------------------------------------------------------------

export function buybackShopEmail(d: BuybackEmailData): EmailMessage | null {
  if (!d.shop.notifyEmail) return null;
  return {
    to: d.shop.notifyEmail,
    replyTo: d.customer.email,
    subject: `New buyback: ${oneLine(d.deviceLabel)} ${d.storageLabel}, ${formatMoney(d.offerCents, d.shop.currency)}, ${oneLine(d.customer.name, 40)}`,
    text: lines(
      "A customer accepted a buyback offer on your online store. They will drop the phone in to the shop.",
      "",
      `Device: ${d.deviceLabel} ${d.storageLabel}`,
      `Offer: ${formatMoney(d.offerCents, d.shop.currency)}`,
      "",
      "Condition (as described by the customer)",
      describeCondition(d.answers),
      "",
      "Customer",
      customerBlock(d.customer),
      "",
      `Reference: ${ref(d.buybackId)}`,
      "The buyback is in Sellify under Buybacks. Check the phone when it arrives before you pay.",
    ),
  };
}

export function buybackCustomerEmail(d: BuybackEmailData): EmailMessage {
  return {
    to: d.customer.email,
    replyTo: d.shop.contact.email || d.shop.notifyEmail,
    subject: `Your offer from ${oneLine(d.shop.storeName)}: ${formatMoney(d.offerCents, d.shop.currency)} for your ${oneLine(d.deviceLabel)}`,
    text: lines(
      `Hi ${d.customer.name},`,
      "",
      `Thanks for accepting our offer of ${formatMoney(d.offerCents, d.shop.currency)} for your ${d.deviceLabel} ${d.storageLabel}.`,
      "",
      "Condition you told us",
      describeCondition(d.answers),
      `Reference: ${ref(d.buybackId)}`,
      "",
      "Next step: bring it in to the shop during opening hours. No appointment needed.",
      "",
      "What to bring",
      "  - The phone (and its charger if you have it)",
      "  - Photo ID",
      "  - The phone signed out of iCloud / Google (turn off Find My), backed up and reset",
      "",
      "We check the phone when you arrive. If its condition is different from what you told us, the offer may change.",
      "",
      shopContact(d.shop),
    ),
  };
}
