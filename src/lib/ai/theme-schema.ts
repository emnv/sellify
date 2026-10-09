import {
  BUTTON_SIZES,
  HERO_STYLES,
  RADII,
  STORE_FONTS,
  TEMPLATES,
  themeSchema,
  type StoreTheme,
} from "@/lib/store/config";

// =============================================================================
// AI customizer: what the model is allowed to return.
//
// The JSON schema below is sent to OpenAI as a strict Structured Output, so
// the model can only produce the theme fields (plus a short explanation for
// the owner). It is built from the same constants as `themeSchema`; the unit
// test fails if the two drift apart. The model's output is then parsed with
// `themeSchema` again on our side (sanitizeAiTheme), so even a misbehaving
// model or API cannot smuggle in prices, stock, products or shop ids.
// =============================================================================

/** Longest request the owner may send to the AI customizer. */
export const MAX_PROMPT_LENGTH = 500;

const hexColor =(description: string) => ({
  type: "string",
  description: `${description} Six-digit hex colour like #1a73e8.`,
  pattern: "^#[0-9a-fA-F]{6}$",
});

const fontValues = STORE_FONTS.map((f) => f.value);
const fontDescription = `One of: ${STORE_FONTS.map((f) => `${f.value} = ${f.label}`).join("; ")}.`;

export const AI_THEME_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["explanation", "template", "colors", "fonts", "radius", "buttonSize", "heroStyle", "productColumns"],
  properties: {
    explanation: {
      type: "string",
      description: "One or two short, friendly sentences for the shop owner saying what you changed and why. No markdown.",
    },
    template: {
      type: "string",
      enum: TEMPLATES.map((t) => t.value),
      description: `Layout template. ${TEMPLATES.map((t) => `${t.value}: ${t.description}`).join(" ")}`,
    },
    colors: {
      type: "object",
      additionalProperties: false,
      required: ["primary", "background", "surface", "text", "accent"],
      properties: {
        primary: hexColor("Buttons, links and highlights. Button text is set to black or white automatically."),
        background: hexColor("Page background."),
        surface: hexColor("Card background."),
        text: hexColor("Body text. Must contrast strongly with background and surface."),
        accent: hexColor("Badges, the announcement banner and small highlights."),
      },
    },
    fonts: {
      type: "object",
      additionalProperties: false,
      required: ["heading", "body"],
      properties: {
        heading: { type: "string", enum: fontValues, description: `Heading font. ${fontDescription}` },
        body: { type: "string", enum: fontValues, description: `Body font. ${fontDescription}` },
      },
    },
    radius: { type: "string", enum: [...RADII], description: "Corner rounding, from square (none) to fully round (pill)." },
    buttonSize: { type: "string", enum: [...BUTTON_SIZES], description: "Button size: small, medium or large." },
    heroStyle: {
      type: "string",
      enum: [...HERO_STYLES],
      description: "Top of the homepage: banner = big banner with photo, split = text and photo side by side, minimal = text only.",
    },
    productColumns: { type: "integer", enum: [2, 3, 4], description: "Products per row on desktop." },
  },
} as const;

/** Keys of the theme the AI may set (everything in the JSON schema except the explanation). */
export const AI_THEME_KEYS = AI_THEME_JSON_SCHEMA.required.filter((k) => k !== "explanation");

/**
 * Validate anything the model returned and keep only theme fields. Unknown
 * keys (price, stock_qty, shop_id, nested junk) are dropped; wrong values
 * (a font we don't load, a colour that is not #rrggbb) throw.
 */
export function sanitizeAiTheme(raw: unknown): StoreTheme {
  return themeSchema.parse(raw);
}

const MAX_EXPLANATION = 400;

/** Parse the model's JSON text into a safe theme plus a short explanation, or null if unusable. */
export function parseAiThemeOutput(text: string): { theme: StoreTheme; explanation: string } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = themeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const explanationRaw = (raw as { explanation?: unknown }).explanation;
  const explanation =
    typeof explanationRaw === "string" && explanationRaw.trim()
      ? explanationRaw.trim().slice(0, MAX_EXPLANATION)
      : "Your store's design has been updated.";
  return { theme: parsed.data, explanation };
}
