import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it.each(["/", "/onboarding", "/core/inventory?page=2", "/store#design"])("keeps %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
  ])("rejects %j", (path) => {
    expect(safeNextPath(path)).toBe("/");
  });

  it("rejects non-strings and uses the fallback", () => {
    expect(safeNextPath(null, "")).toBe("");
    expect(safeNextPath(["/a"])).toBe("/");
  });
});
