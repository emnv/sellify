import { describe, expect, it } from "vitest";
import { formatDateTime, utcToZonedLocal, zonedLocalToUtc } from "./datetime";
import { centsToInput, formatMoney, parseMoneyToCents } from "./money";

const TZ = "Europe/Dublin";

describe("zonedLocalToUtc", () => {
  it("handles Irish summer time (UTC+1)", () => {
    expect(zonedLocalToUtc("2026-06-12T14:00", TZ)?.toISOString()).toBe("2026-06-12T13:00:00.000Z");
  });
  it("handles Irish winter time (UTC+0)", () => {
    expect(zonedLocalToUtc("2026-01-15T14:00", TZ)?.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });
  it("rejects malformed or impossible dates", () => {
    expect(zonedLocalToUtc("2026-02-31T10:00", TZ)).toBeNull();
    expect(zonedLocalToUtc("tomorrow", TZ)).toBeNull();
  });
  it("round-trips with utcToZonedLocal", () => {
    expect(utcToZonedLocal("2026-06-12T13:00:00Z", TZ)).toBe("2026-06-12T14:00");
  });
  it("formats in the shop timezone", () => {
    expect(formatDateTime("2026-06-12T13:00:00Z", TZ)).toMatch(/Fri 12 Jun, 14:00/);
  });
});

describe("money", () => {
  it.each([
    ["129", 12900],
    ["129.5", 12950],
    ["129,50", 12950],
    ["€1,299.00", 129900],
    ["1.299,50", 129950],
  ])("parses %s", (input, cents) => expect(parseMoneyToCents(input)).toBe(cents));
  it.each(["", "abc", "-5", "1.234", "12.345"])("rejects %j", (input) => expect(parseMoneyToCents(input)).toBeNull());
  it("formats euro amounts", () => {
    expect(formatMoney(12900)).toBe("€129.00");
    expect(centsToInput(12950)).toBe("129.50");
  });
});
