import { afterEach, describe, expect, it, vi } from "vitest";
import { addressLines, deliveryFeeFor, offeredFulfilments, shippingAddressJson, toShippingAddress } from "./fulfilment";

vi.mock("server-only", () => ({}));

describe("fulfilment", () => {
  it("offers only the enabled options, collection first", () => {
    expect(offeredFulfilments({ collection: true, delivery: true })).toEqual(["collection", "delivery"]);
    expect(offeredFulfilments({ collection: false, delivery: true })).toEqual(["delivery"]);
  });

  it("charges the fee only for delivery", () => {
    expect(deliveryFeeFor("delivery", { deliveryFeeCents: 495 })).toBe(495);
    expect(deliveryFeeFor("collection", { deliveryFeeCents: 495 })).toBe(0);
  });

  it("reads a Stripe shipping_details object and round-trips the stored form", () => {
    const a = toShippingAddress({ name: "Aoife", address: { line1: "1 Quay St", line2: "", city: "Galway", postal_code: "H91", state: null, country: "IE" } });
    expect(a).toEqual({ name: "Aoife", line1: "1 Quay St", line2: null, city: "Galway", postalCode: "H91", state: null, country: "IE" });
    expect(toShippingAddress(shippingAddressJson(a!))).toEqual(a);
    expect(addressLines(a)).toEqual(["Aoife", "1 Quay St", "Galway, H91", "IE"]);
    expect(toShippingAddress(null)).toBeNull();
    expect(toShippingAddress({ name: "No address" })).toBeNull();
  });
});

describe("platform fee", () => {
  const saved = process.env.PLATFORM_FEE_BPS;
  afterEach(() => {
    if (saved === undefined) delete process.env.PLATFORM_FEE_BPS;
    else process.env.PLATFORM_FEE_BPS = saved;
  });

  it("is total × bps / 10000, rounded, 0 by default and never the whole amount", async () => {
    const { platformFeeCents } = await import("./stripe");
    delete process.env.PLATFORM_FEE_BPS;
    expect(platformFeeCents(10_000)).toBe(0);
    process.env.PLATFORM_FEE_BPS = "250";
    expect(platformFeeCents(10_000)).toBe(250);
    expect(platformFeeCents(1_995)).toBe(50); // 49.875 → 50
    process.env.PLATFORM_FEE_BPS = "10000";
    expect(platformFeeCents(500)).toBe(0); // would be the whole charge
    process.env.PLATFORM_FEE_BPS = "nonsense";
    expect(platformFeeCents(500)).toBe(0);
  });
});
