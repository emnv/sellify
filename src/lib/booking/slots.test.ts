import { describe, expect, it } from "vitest";
import { availableSlots, bookingWindow, findAvailableSlot, type OpeningHours } from "./slots";

const TZ = "Europe/Dublin";
const weekday = { closed: false, open: "09:00", close: "18:00" };
const closed = { closed: true, open: "10:00", close: "16:00" };
const hours: OpeningHours = {
  mon: weekday,
  tue: weekday,
  wed: weekday,
  thu: weekday,
  fri: weekday,
  sat: { closed: false, open: "10:00", close: "17:00" },
  sun: closed,
};
// Monday 8 June 2026, 08:00 Irish summer time (UTC+1).
const MON_8AM = new Date("2026-06-08T07:00:00Z");

describe("availableSlots", () => {
  it("offers hourly slots inside opening hours, in UTC with local labels", () => {
    const days = availableSlots({ hours, timeZone: TZ, now: MON_8AM });
    const mon = days[0];
    expect(mon.date).toBe("2026-06-08");
    expect(mon.label).toBe("Mon 8 Jun");
    expect(mon.slots.map((s) => s.label)).toEqual(["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
    expect(mon.slots[0].iso).toBe("2026-06-08T08:00:00.000Z");
    expect(mon.slots.at(-1)?.iso).toBe("2026-06-08T16:00:00.000Z");
  });

  it("covers 14 days starting today and skips closed days", () => {
    const days = availableSlots({ hours, timeZone: TZ, now: MON_8AM });
    // 14 days from Mon 8 Jun = two weeks, minus two Sundays.
    expect(days).toHaveLength(12);
    expect(days.at(-1)?.date).toBe("2026-06-20");
    expect(days.some((d) => d.date === "2026-06-14" || d.date === "2026-06-21")).toBe(false);
    const sat = days.find((d) => d.date === "2026-06-13");
    expect(sat?.slots.map((s) => s.label)).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]);
  });

  it("drops slots inside the lead time and in the past", () => {
    // 09:30 local: 09:00 is past and 10:00 is within the next hour.
    const now = new Date("2026-06-08T08:30:00Z");
    const mon = availableSlots({ hours, timeZone: TZ, now })[0];
    expect(mon.slots[0].label).toBe("11:00");
  });

  it("leaves out a day once it has no free slots", () => {
    const lateMonday = new Date("2026-06-08T16:30:00Z"); // 17:30 local
    const days = availableSlots({ hours, timeZone: TZ, now: lateMonday });
    expect(days[0].date).toBe("2026-06-09");
  });

  it("excludes taken slots, whatever ISO format they come in", () => {
    const taken = ["2026-06-08T13:00:00+00:00", "2026-06-08T14:00:00.000Z"];
    const mon = availableSlots({ hours, timeZone: TZ, now: MON_8AM, taken })[0];
    expect(mon.slots.map((s) => s.label)).not.toContain("14:00");
    expect(mon.slots.map((s) => s.label)).not.toContain("15:00");
    expect(mon.slots.map((s) => s.label)).toContain("13:00");
  });

  it("only offers slots that end by closing time", () => {
    const h = { ...hours, mon: { closed: false, open: "09:30", close: "12:15" } };
    const mon = availableSlots({ hours: h, timeZone: TZ, now: MON_8AM })[0];
    expect(mon.slots.map((s) => s.label)).toEqual(["09:30", "10:30"]);
  });

  it("returns nothing when every day is closed", () => {
    const allClosed = Object.fromEntries(Object.keys(hours).map((k) => [k, closed])) as OpeningHours;
    expect(availableSlots({ hours: allClosed, timeZone: TZ, now: MON_8AM })).toEqual([]);
  });

  it("uses winter time (UTC+0) after the clocks go back", () => {
    const now = new Date("2026-11-02T07:00:00Z"); // Mon 2 Nov
    const mon = availableSlots({ hours, timeZone: TZ, now })[0];
    expect(mon.date).toBe("2026-11-02");
    expect(mon.slots[0]).toEqual({ iso: "2026-11-02T09:00:00.000Z", label: "09:00" });
  });

  it("skips the hour that doesn't exist when the clocks go forward", () => {
    // Sun 29 Mar 2026: Dublin jumps from 01:00 to 02:00.
    const night = { closed: false, open: "00:00", close: "04:00" };
    const h = { ...hours, sun: night };
    const now = new Date("2026-03-28T12:00:00Z");
    const sun = availableSlots({ hours: h, timeZone: TZ, now, leadMinutes: 0 }).find((d) => d.date === "2026-03-29");
    expect(sun?.slots.map((s) => s.label)).toEqual(["00:00", "02:00", "03:00"]);
    expect(sun?.slots.map((s) => s.iso)).toEqual(["2026-03-29T00:00:00.000Z", "2026-03-29T01:00:00.000Z", "2026-03-29T02:00:00.000Z"]);
  });

  it("gives distinct instants on the day the clocks go back", () => {
    // Sun 25 Oct 2026: Dublin goes from 02:00 back to 01:00.
    const h = { ...hours, sun: { closed: false, open: "09:00", close: "12:00" } };
    const now = new Date("2026-10-24T12:00:00Z");
    const sun = availableSlots({ hours: h, timeZone: TZ, now }).find((d) => d.date === "2026-10-25");
    expect(sun?.slots).toEqual([
      { iso: "2026-10-25T09:00:00.000Z", label: "09:00" },
      { iso: "2026-10-25T10:00:00.000Z", label: "10:00" },
      { iso: "2026-10-25T11:00:00.000Z", label: "11:00" },
    ]);
    // Saturday before is still summer time.
    const sat = availableSlots({ hours: h, timeZone: TZ, now }).find((d) => d.date === "2026-10-24");
    expect(sat?.slots.at(-1)?.iso).toBe("2026-10-24T15:00:00.000Z");
  });

  it("works for other timezones", () => {
    const now = new Date("2026-06-08T12:00:00Z"); // 08:00 in New York
    const mon = availableSlots({ hours, timeZone: "America/New_York", now })[0];
    expect(mon.slots[0]).toEqual({ iso: "2026-06-08T13:00:00.000Z", label: "09:00" });
  });
});

describe("findAvailableSlot", () => {
  const opts = { hours, timeZone: TZ, now: MON_8AM, taken: ["2026-06-09T08:00:00Z"] };
  it("accepts a generated slot", () => {
    expect(findAvailableSlot("2026-06-08T13:00:00.000Z", opts)?.label).toBe("14:00");
  });
  it("rejects taken, closed, off-grid, too-far and garbage times", () => {
    expect(findAvailableSlot("2026-06-09T08:00:00.000Z", opts)).toBeNull(); // taken
    expect(findAvailableSlot("2026-06-14T10:00:00.000Z", opts)).toBeNull(); // Sunday
    expect(findAvailableSlot("2026-06-08T13:30:00.000Z", opts)).toBeNull(); // half past
    expect(findAvailableSlot("2026-06-08T03:00:00.000Z", opts)).toBeNull(); // before opening
    expect(findAvailableSlot("2026-06-25T08:00:00.000Z", opts)).toBeNull(); // beyond 14 days
    expect(findAvailableSlot("not a date", opts)).toBeNull();
  });
});

describe("bookingWindow", () => {
  it("stays inside the 31-day limit of public_booked_slots", () => {
    const { from, to } = bookingWindow(MON_8AM);
    expect(to.getTime() - from.getTime()).toBeLessThanOrEqual(31 * 24 * 3_600_000);
    expect(from.getTime()).toBeLessThan(MON_8AM.getTime());
  });
});
