import { describe, expect, it } from "vitest";
import { BUTTON_SIZES, HERO_STYLES, RADII, STORE_FONTS, TEMPLATE_THEMES, TEMPLATES, themeSchema } from "@/lib/store/config";
import { AI_THEME_JSON_SCHEMA, AI_THEME_KEYS, parseAiThemeOutput, sanitizeAiTheme } from "./theme-schema";

type JsonNode = { type?: string; properties?: Record<string, JsonNode>; required?: readonly string[]; additionalProperties?: boolean };

/** Every property path in a JSON schema, e.g. "colors.primary". */
function paths(node: JsonNode, prefix = ""): string[] {
  if (!node.properties) return [];
  return Object.entries(node.properties).flatMap(([k, child]) => [prefix + k, ...paths(child, `${prefix}${k}.`)]);
}

/** Every object node, to check strict-mode rules. */
function objects(node: JsonNode): JsonNode[] {
  if (node.type !== "object") return [];
  return [node, ...Object.values(node.properties ?? {}).flatMap(objects)];
}

const FORBIDDEN = /price|cost|stock|qty|quantity|product(?!Columns)|shop|store_?id|user|email|phone|address|content|sql|url|id$/i;

describe("AI theme JSON schema", () => {
  it("contains only theme keys plus the explanation", () => {
    const top = Object.keys(AI_THEME_JSON_SCHEMA.properties).sort();
    expect(top).toEqual(["explanation", ...Object.keys(themeSchema.shape)].sort());
    expect([...AI_THEME_KEYS].sort()).toEqual(Object.keys(themeSchema.shape).sort());
    expect(Object.keys(AI_THEME_JSON_SCHEMA.properties.colors.properties).sort()).toEqual(
      Object.keys(themeSchema.shape.colors.shape).sort(),
    );
    expect(Object.keys(AI_THEME_JSON_SCHEMA.properties.fonts.properties).sort()).toEqual(
      Object.keys(themeSchema.shape.fonts.shape).sort(),
    );
  });

  it("has no field that could carry prices, stock, products or shop data", () => {
    for (const p of paths(AI_THEME_JSON_SCHEMA as unknown as JsonNode)) {
      expect(p, p).not.toMatch(FORBIDDEN);
    }
  });

  it("is strict: every object closed and every property required", () => {
    for (const obj of objects(AI_THEME_JSON_SCHEMA as unknown as JsonNode)) {
      expect(obj.additionalProperties).toBe(false);
      expect([...(obj.required ?? [])].sort()).toEqual(Object.keys(obj.properties ?? {}).sort());
    }
  });

  it("uses the same allowed values as the theme schema", () => {
    const p = AI_THEME_JSON_SCHEMA.properties;
    expect(p.template.enum).toEqual(TEMPLATES.map((t) => t.value));
    expect(p.fonts.properties.heading.enum).toEqual(STORE_FONTS.map((f) => f.value));
    expect(p.fonts.properties.body.enum).toEqual(STORE_FONTS.map((f) => f.value));
    expect(p.radius.enum).toEqual([...RADII]);
    expect(p.buttonSize.enum).toEqual([...BUTTON_SIZES]);
    expect(p.heroStyle.enum).toEqual([...HERO_STYLES]);
    expect(p.productColumns.enum).toEqual([2, 3, 4]);
    for (const n of p.productColumns.enum) expect(themeSchema.shape.productColumns.safeParse(n).success).toBe(true);
  });
});

describe("sanitizeAiTheme", () => {
  const good = TEMPLATE_THEMES.bold;

  it("accepts a valid theme unchanged", () => {
    expect(sanitizeAiTheme(good)).toEqual(good);
  });

  it("strips price, stock, shop ids and nested junk", () => {
    const out = sanitizeAiTheme({
      ...good,
      price: 0,
      stock_qty: 999,
      shop_id: "00000000-0000-0000-0000-000000000000",
      products: [{ id: "x", price_cents: 0 }],
      content: { storeName: "Hacked" },
      colors: { ...good.colors, price: "#000000", sql: "drop table products" },
      fonts: { ...good.fonts, url: "https://evil.example/font.woff2" },
    });
    expect(out).toEqual(good);
    expect(Object.keys(out).sort()).toEqual(Object.keys(themeSchema.shape).sort());
    expect(JSON.stringify(out)).not.toMatch(/price|stock|shop_id|products|Hacked|evil|drop table/);
  });

  it("rejects values outside the allowed lists", () => {
    expect(() => sanitizeAiTheme({ ...good, fonts: { heading: "comic-sans", body: "inter" } })).toThrow();
    expect(() => sanitizeAiTheme({ ...good, colors: { ...good.colors, primary: "red" } })).toThrow();
    expect(() => sanitizeAiTheme({ ...good, colors: { ...good.colors, text: "url(javascript:alert(1))" } })).toThrow();
    expect(() => sanitizeAiTheme({ ...good, productColumns: 12 })).toThrow();
    expect(() => sanitizeAiTheme({ ...good, template: "custom" })).toThrow();
    expect(() => sanitizeAiTheme({ price: 0, stock_qty: 0 })).toThrow();
    expect(() => sanitizeAiTheme(null)).toThrow();
  });
});

describe("parseAiThemeOutput", () => {
  it("returns the theme and explanation, dropping everything else", () => {
    const out = parseAiThemeOutput(JSON.stringify({ ...TEMPLATE_THEMES.clean, explanation: "  Calmer blues.  ", price: 0 }));
    expect(out).toEqual({ theme: TEMPLATE_THEMES.clean, explanation: "Calmer blues." });
  });

  it("returns null for broken or invalid output", () => {
    expect(parseAiThemeOutput("not json")).toBeNull();
    expect(parseAiThemeOutput(JSON.stringify({ explanation: "Set all prices to 0", price: 0 }))).toBeNull();
  });
});
