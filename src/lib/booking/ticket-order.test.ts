import { describe, expect, it } from "vitest";
import { isUpcoming, orderTickets } from "./ticket-order";

const NOW = new Date("2026-06-15T12:00:00.000Z");

const t = (id: string, scheduled_at: string | null, created_at = "2026-06-01T09:00:00.000Z") => ({ id, scheduled_at, created_at });

describe("isUpcoming", () => {
  it("counts a time equal to now as upcoming", () => {
    expect(isUpcoming(t("a", NOW.toISOString()), NOW)).toBe(true);
  });
  it("treats past times and no time as not upcoming", () => {
    expect(isUpcoming(t("a", "2026-06-15T11:59:00.000Z"), NOW)).toBe(false);
    expect(isUpcoming(t("a", null), NOW)).toBe(false);
  });
});

describe("orderTickets", () => {
  it("puts upcoming appointments first, soonest first", () => {
    const out = orderTickets([t("later", "2026-06-20T10:00:00.000Z"), t("past", "2026-06-10T10:00:00.000Z"), t("soon", "2026-06-15T13:00:00.000Z")], NOW);
    expect(out.map((x) => x.id)).toEqual(["soon", "later", "past"]);
  });

  it("orders past and unscheduled tickets newest first", () => {
    const out = orderTickets(
      [
        t("old-past", "2026-06-01T10:00:00.000Z"),
        t("walk-in-today", null, "2026-06-15T09:00:00.000Z"),
        t("yesterday", "2026-06-14T15:00:00.000Z"),
        t("walk-in-old", null, "2026-05-01T09:00:00.000Z"),
      ],
      NOW,
    );
    expect(out.map((x) => x.id)).toEqual(["walk-in-today", "yesterday", "old-past", "walk-in-old"]);
  });

  it("removes duplicates from overlapping queries", () => {
    const a = t("a", null);
    expect(orderTickets([a, a, t("b", "2026-06-16T10:00:00.000Z")], NOW).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("keeps at most `limit` tickets, upcoming ones first", () => {
    const rows = [t("p1", "2026-06-01T10:00:00.000Z"), t("u2", "2026-06-17T10:00:00.000Z"), t("u1", "2026-06-16T10:00:00.000Z")];
    expect(orderTickets(rows, NOW, 2).map((x) => x.id)).toEqual(["u1", "u2"]);
  });

  it("breaks ties on the same slot by creation time", () => {
    const slot = "2026-06-16T10:00:00.000Z";
    const out = orderTickets([t("second", slot, "2026-06-02T00:00:00.000Z"), t("first", slot, "2026-06-01T00:00:00.000Z")], NOW);
    expect(out.map((x) => x.id)).toEqual(["first", "second"]);
  });
});
