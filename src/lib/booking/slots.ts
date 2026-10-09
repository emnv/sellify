import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/datetime";

// Repair booking slots. Pure: the server computes them for the date picker and
// recomputes them on submit, so a customer can only book a time this returns.
// Opening hours are wall-clock times in the shop's timezone; slots are stored
// and compared as UTC instants.

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayHours = { closed: boolean; open: string; close: string };
export type OpeningHours = Record<DayKey, DayHours>;

export type Slot = {
  /** UTC instant, e.g. "2026-06-12T13:00:00.000Z". */
  iso: string;
  /** Local start time in the shop's timezone, e.g. "14:00". */
  label: string;
};

export type SlotDay = {
  /** Local date in the shop's timezone, "2026-06-12". */
  date: string;
  /** "Thu 12 Jun" */
  label: string;
  slots: Slot[];
};

export type SlotOptions = {
  hours: OpeningHours;
  timeZone: string;
  now: Date;
  /** Days to offer, starting today. */
  days?: number;
  slotMinutes?: number;
  /** No bookings starting sooner than this from now. */
  leadMinutes?: number;
  /** Start times that already have a booking (any ISO format). */
  taken?: Iterable<string>;
};

export const BOOKING_DAYS = 14;
export const SLOT_MINUTES = 60;
export const LEAD_MINUTES = 60;

// Date.getUTCDay() order.
const WEEKDAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toMinutes = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const toHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function dayLabel(date: string) {
  const parts = new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).formatToParts(new Date(`${date}T12:00:00Z`));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/** Available slots, grouped by local date. Days without a free slot are left out. */
export function availableSlots(opts: SlotOptions): SlotDay[] {
  const { hours, timeZone, now } = opts;
  const days = opts.days ?? BOOKING_DAYS;
  const slotMinutes = opts.slotMinutes ?? SLOT_MINUTES;
  const earliest = now.getTime() + (opts.leadMinutes ?? LEAD_MINUTES) * 60_000;
  const taken = new Set<number>();
  for (const t of opts.taken ?? []) {
    const ms = new Date(t).getTime();
    if (Number.isFinite(ms)) taken.add(ms);
  }

  const today = utcToZonedLocal(now, timeZone).slice(0, 10);
  const [y, m, d] = today.split("-").map(Number);
  const out: SlotDay[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const date = day.toISOString().slice(0, 10);
    const h = hours[WEEKDAYS[day.getUTCDay()]];
    if (!h || h.closed) continue;
    const open = toMinutes(h.open);
    const close = toMinutes(h.close);
    if (!(open < close)) continue;

    const slots: Slot[] = [];
    for (let start = open; start + slotMinutes <= close; start += slotMinutes) {
      const local = `${date}T${toHhmm(start)}`;
      const utc = zonedLocalToUtc(local, timeZone);
      // Skip wall-clock times that don't exist (spring-forward gap).
      if (!utc || utcToZonedLocal(utc, timeZone) !== local) continue;
      // The slot must also END inside opening hours on the same day, in real
      // elapsed time (matters on DST change days).
      const endLocal = utcToZonedLocal(new Date(utc.getTime() + slotMinutes * 60_000), timeZone);
      if (endLocal.slice(0, 10) !== date || toMinutes(endLocal.slice(11, 16)) > close) continue;
      if (utc.getTime() < earliest || taken.has(utc.getTime())) continue;
      slots.push({ iso: utc.toISOString(), label: toHhmm(start) });
    }
    if (slots.length) out.push({ date, label: dayLabel(date), slots });
  }
  return out;
}

/** The slot matching `iso` if it is currently bookable, else null. */
export function findAvailableSlot(iso: string, opts: SlotOptions): Slot | null {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  for (const day of availableSlots(opts)) for (const s of day.slots) if (new Date(s.iso).getTime() === ms) return s;
  return null;
}

/** The window to ask the database for existing bookings. */
export function bookingWindow(now: Date, days = BOOKING_DAYS) {
  return { from: new Date(now.getTime() - 24 * 3_600_000), to: new Date(now.getTime() + (days + 1) * 24 * 3_600_000) };
}
