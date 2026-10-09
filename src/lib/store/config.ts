import { z } from "zod";

// =============================================================================
// Store config: the single schema for the store editor, preview, publish, the
// public renderer and the AI customizer.
//   theme   = how it looks (the only part the AI may change)
//   content = what it says
// Stored as stores.draft_config (editing) and stores.published_config (live).
// Always parse with parseStoreConfig(): stored JSON is treated as untrusted.
// =============================================================================

export const TEMPLATES = [
  { value: "clean", label: "Clean", description: "White and minimal. Lets your products speak." },
  { value: "bold", label: "Bold", description: "Dark, with large photos and strong type." },
  { value: "local", label: "Local", description: "Friendly, with your map and reviews up front." },
] as const;
export type Template = (typeof TEMPLATES)[number]["value"];

// Fonts the store can use (loaded in the store layout). Anything else is rejected.
export const STORE_FONTS = [
  { value: "inter", label: "Inter (clean sans)" },
  { value: "poppins", label: "Poppins (rounded sans)" },
  { value: "space-grotesk", label: "Space Grotesk (techy sans)" },
  { value: "playfair", label: "Playfair Display (elegant serif)" },
  { value: "merriweather", label: "Merriweather (sturdy serif)" },
  { value: "nunito", label: "Nunito (friendly sans)" },
] as const;
export type StoreFont = (typeof STORE_FONTS)[number]["value"];

export const RADII = ["none", "small", "medium", "large", "pill"] as const;
export const BUTTON_SIZES = ["small", "medium", "large"] as const;
export const HERO_STYLES = ["banner", "split", "minimal"] as const;
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1A73E8.")
  .transform((v) => v.toLowerCase());

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00.");

// Media must come from our own storage bucket (checked again server-side
// against the shop's folder before saving).
const mediaUrl = z
  .url()
  .refine((u) => /\/storage\/v1\/object\/public\/shop-media\//.test(u), "Upload the image here.")
  .nullable();

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);

export const themeSchema = z.object({
  template: z.enum(["clean", "bold", "local"]),
  colors: z.object({
    primary: hex, // buttons, links, highlights
    background: hex, // page background
    surface: hex, // cards
    text: hex, // body text
    accent: hex, // badges, small highlights
  }),
  fonts: z.object({
    heading: z.enum(STORE_FONTS.map((f) => f.value) as [StoreFont, ...StoreFont[]]),
    body: z.enum(STORE_FONTS.map((f) => f.value) as [StoreFont, ...StoreFont[]]),
  }),
  radius: z.enum(RADII),
  buttonSize: z.enum(BUTTON_SIZES),
  heroStyle: z.enum(HERO_STYLES),
  productColumns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
});
export type StoreTheme = z.infer<typeof themeSchema>;

const hoursDay = z
  .object({ closed: z.boolean(), open: time, close: time })
  .refine((d) => d.closed || d.open < d.close, "Closing time must be after opening time.");

export const contentSchema = z.object({
  storeName: text(80).min(1, "Enter a store name."),
  tagline: text(140),
  logoUrl: mediaUrl,
  heroImageUrl: mediaUrl,
  banner: z.object({ enabled: z.boolean(), text: text(160) }),
  about: text(2000),
  contact: z.object({
    phone: text(40),
    email: z.union([z.literal(""), z.email("Enter a valid email address.").max(254)]),
    address: text(300),
  }),
  hours: z.object(Object.fromEntries(DAYS.map((d) => [d, hoursDay])) as Record<Day, typeof hoursDay>),
  reviews: z
    .array(z.object({ author: text(60).min(1), text: text(400).min(1), rating: z.number().int().min(1).max(5) }))
    .max(6),
  tabs: z.object({ shop: z.boolean(), repair: z.boolean(), sell: z.boolean() }),
});
export type StoreContent = z.infer<typeof contentSchema>;

export const storeConfigSchema = z.object({ theme: themeSchema, content: contentSchema });
export type StoreConfig = z.infer<typeof storeConfigSchema>;

// ---------------------------------------------------------------------------
// Defaults per template. Switching template swaps the theme defaults and keeps
// all content.
// ---------------------------------------------------------------------------
export const TEMPLATE_THEMES: Record<Template, StoreTheme> = {
  clean: {
    template: "clean",
    colors: { primary: "#2563eb", background: "#ffffff", surface: "#f8fafc", text: "#0f172a", accent: "#0ea5e9" },
    fonts: { heading: "inter", body: "inter" },
    radius: "medium",
    buttonSize: "medium",
    heroStyle: "minimal",
    productColumns: 4,
  },
  bold: {
    template: "bold",
    colors: { primary: "#f59e0b", background: "#0b0b0f", surface: "#17171f", text: "#f5f5f5", accent: "#f43f5e" },
    fonts: { heading: "space-grotesk", body: "inter" },
    radius: "small",
    buttonSize: "large",
    heroStyle: "banner",
    productColumns: 3,
  },
  local: {
    template: "local",
    colors: { primary: "#15803d", background: "#fffbf5", surface: "#ffffff", text: "#1c1917", accent: "#ea580c" },
    fonts: { heading: "nunito", body: "nunito" },
    radius: "large",
    buttonSize: "medium",
    heroStyle: "split",
    productColumns: 3,
  },
};

export function defaultHours(): StoreContent["hours"] {
  const weekday = { closed: false, open: "09:00", close: "18:00" };
  return {
    mon: weekday,
    tue: weekday,
    wed: weekday,
    thu: weekday,
    fri: weekday,
    sat: { closed: false, open: "10:00", close: "17:00" },
    sun: { closed: true, open: "10:00", close: "16:00" },
  };
}

export function defaultStoreConfig(shop: { name: string; email?: string | null; phone?: string | null; address?: string | null }): StoreConfig {
  return {
    theme: TEMPLATE_THEMES.clean,
    content: {
      storeName: shop.name,
      tagline: "Phone repairs, refurbished phones and accessories.",
      logoUrl: null,
      heroImageUrl: null,
      banner: { enabled: false, text: "" },
      about: "",
      contact: { phone: shop.phone ?? "", email: shop.email ?? "", address: shop.address ?? "" },
      hours: defaultHours(),
      reviews: [],
      tabs: { shop: true, repair: true, sell: true },
    },
  };
}

/**
 * Reads stored JSON into a valid config. Unknown or broken parts fall back to
 * defaults instead of failing the page; nothing outside the schema survives.
 */
export function parseStoreConfig(raw: unknown, fallbackName = "Our store"): StoreConfig {
  const parsed = storeConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const base = defaultStoreConfig({ name: fallbackName });
  const obj = (raw && typeof raw === "object" ? raw : {}) as { theme?: unknown; content?: unknown };
  const theme = themeSchema.safeParse(obj.theme);
  const content = contentSchema.safeParse(obj.content);
  return { theme: theme.success ? theme.data : base.theme, content: content.success ? content.data : base.content };
}

/** Switch template: new template's theme defaults, content untouched. */
export function applyTemplate(config: StoreConfig, template: Template): StoreConfig {
  return { ...config, theme: { ...TEMPLATE_THEMES[template] } };
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Black or white, whichever reads better on `bg` (WCAG relative luminance). */
export function readableTextOn(bg: string): "#000000" | "#ffffff" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(bg.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (lum + 0.05) >= (lum + 0.05) / 0.05 ? "#ffffff" : "#000000";
}

/** Mix a colour with white (amount > 0) or black (amount < 0). For borders and muted text. */
export function mix(hexColor: string, amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  const parts = [1, 3, 5].map((i) => Math.round(parseInt(hexColor.slice(i, i + 2), 16) * (1 - a) + target * a));
  return `#${parts.map((p) => p.toString(16).padStart(2, "0")).join("")}`;
}

export function isDark(hexColor: string) {
  return readableTextOn(hexColor) === "#ffffff";
}
