import { describe, expect, it } from "vitest";
import { answersToJson, computeOffer, type BuybackAnswers } from "./quote";

const d = { screen_cracked_pct: 30, battery_bad_pct: 15, no_power_pct: 50 };
const perfect: BuybackAnswers = { screenCracked: false, batteryOk: true, turnsOn: true };

describe("computeOffer", () => {
  it("pays the full base price for a phone with no problems", () => {
    expect(computeOffer(20000, perfect, d)).toBe(20000);
  });

  it("deducts each reported problem", () => {
    expect(computeOffer(20000, { ...perfect, screenCracked: true }, d)).toBe(14000);
    expect(computeOffer(20000, { ...perfect, batteryOk: false }, d)).toBe(17000);
    expect(computeOffer(20000, { ...perfect, turnsOn: false }, d)).toBe(10000);
  });

  it("adds deductions together", () => {
    expect(computeOffer(20000, { screenCracked: true, batteryOk: false, turnsOn: true }, d)).toBe(11000);
  });

  it("caps the total deduction at 100%", () => {
    // 30 + 15 + 50 = 95%
    expect(computeOffer(20000, { screenCracked: true, batteryOk: false, turnsOn: false }, d)).toBe(1000);
    expect(computeOffer(20000, { screenCracked: true, batteryOk: false, turnsOn: false }, { screen_cracked_pct: 90, battery_bad_pct: 90, no_power_pct: 90 })).toBe(0);
  });

  it("ignores unanswered questions", () => {
    expect(computeOffer(20000, { screenCracked: null, batteryOk: null, turnsOn: null }, d)).toBe(20000);
  });

  it("rounds to whole cents", () => {
    // 999 * 0.85 = 849.15 → 849
    expect(computeOffer(999, { ...perfect, batteryOk: false }, d)).toBe(849);
    // 333 * 0.7 = 233.1 → 233
    expect(computeOffer(333, { ...perfect, screenCracked: true }, d)).toBe(233);
  });

  it("never goes negative and treats bad input as zero", () => {
    expect(computeOffer(-500, perfect, d)).toBe(0);
    expect(computeOffer(Number.NaN, perfect, d)).toBe(0);
    expect(computeOffer(20000, { ...perfect, screenCracked: true }, { ...d, screen_cracked_pct: -20 })).toBe(20000);
  });

  it("matches the brief's example (S21 128GB, no problems, €140)", () => {
    expect(computeOffer(14000, perfect, d)).toBe(14000);
  });
});

describe("answersToJson", () => {
  it("uses the stored key names", () => {
    expect(answersToJson({ screenCracked: true, batteryOk: false, turnsOn: null })).toEqual({ screen_cracked: true, battery_ok: false, turns_on: null });
  });
});
