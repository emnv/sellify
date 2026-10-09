// Dates are stored as UTC timestamps and shown in the shop's timezone
// (shops.timezone, e.g. "Europe/Dublin"), whatever timezone the server runs in.

/** "Thu 12 Jun, 14:00" */
export function formatDateTime(iso: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")}`;
}

/** "12 Jun 2026" */
export function formatDate(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IE", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/** Offset of `timeZone` from UTC at `date`, in minutes (Dublin summer → 60). */
function offsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * A wall-clock time in the shop's timezone → UTC Date.
 * Accepts the value of <input type="datetime-local"> ("2026-06-12T14:00").
 * Returns null for anything else.
 */
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (guess.getUTCMonth() !== mo - 1 || guess.getUTCDate() !== d) return null; // e.g. 31 Feb
  // Two passes handle DST boundaries.
  let utc = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000);
  utc = new Date(guess.getTime() - offsetMinutes(utc, timeZone) * 60000);
  return utc;
}

/** UTC → value for <input type="datetime-local"> in the shop's timezone. */
export function utcToZonedLocal(iso: string | Date, timeZone: string): string {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() + offsetMinutes(date, timeZone) * 60000);
  return shifted.toISOString().slice(0, 16);
}
