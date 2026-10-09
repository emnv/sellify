import { describe, expect, it } from "vitest";
import { isAuthorizedCron, staleBefore } from "./cron";

describe("isAuthorizedCron", () => {
  const secret = "s3cret-value";

  it("accepts exactly Bearer <secret>", () => {
    expect(isAuthorizedCron(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("rejects a missing, wrong or differently formatted header", () => {
    for (const header of [null, undefined, "", secret, `bearer ${secret}`, `Bearer ${secret} `, `Bearer ${secret}x`, "Bearer wrong-value!"]) {
      expect(isAuthorizedCron(header, secret)).toBe(false);
    }
  });

  it("fails closed when CRON_SECRET is not set", () => {
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
  });
});

describe("staleBefore", () => {
  it("returns the ISO time N days earlier", () => {
    expect(staleBefore(new Date("2026-10-10T06:00:00.000Z"), 7)).toBe("2026-10-03T06:00:00.000Z");
  });
});
