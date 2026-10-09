// Buyback offer formula. Pure, so the backend (walk-in buybacks), the store's
// Sell tab and the tests all use exactly the same maths. Only ever call it on
// the server with prices read from the database: the client never sends a price.

/** What the customer told us. `null` = not answered (no deduction). */
export type BuybackAnswers = { screenCracked: boolean | null; batteryOk: boolean | null; turnsOn: boolean | null };

/** The shop's condition deductions, in whole percent of the base price. */
export type BuybackDeductionPcts = { screen_cracked_pct: number; battery_bad_pct: number; no_power_pct: number };

/**
 * Base price minus the percentage for each reported problem.
 * Deductions are added together and capped at 100%, so the offer is never
 * below zero. The result is rounded to whole cents.
 */
export function computeOffer(baseCents: number, answers: BuybackAnswers, d: BuybackDeductionPcts): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  const pctOf = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 0);
  let pct = 0;
  if (answers.screenCracked === true) pct += pctOf(d.screen_cracked_pct);
  if (answers.batteryOk === false) pct += pctOf(d.battery_bad_pct);
  if (answers.turnsOn === false) pct += pctOf(d.no_power_pct);
  return Math.max(0, Math.round((baseCents * (100 - Math.min(pct, 100))) / 100));
}

/** Answers as stored in `buybacks.answers`. */
export function answersToJson(a: BuybackAnswers) {
  return { screen_cracked: a.screenCracked, battery_ok: a.batteryOk, turns_on: a.turnsOn };
}
