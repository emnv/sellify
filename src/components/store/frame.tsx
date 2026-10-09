import type { CSSProperties, ReactNode } from "react";
import { readableTextOn, type StoreTheme } from "@/lib/store/config";
import { fontStack, storeFontVariables } from "./fonts";

/** Linear mix of two #rrggbb colours (t = 0 → a, 1 → b). */
function blend(a: string, b: string, t: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

const RADIUS: Record<StoreTheme["radius"], [string, string]> = {
  none: ["0px", "0px"],
  small: ["4px", "6px"],
  medium: ["8px", "12px"],
  large: ["14px", "20px"],
  pill: ["9999px", "24px"],
};

const BUTTON: Record<StoreTheme["buttonSize"], { h: string; px: string; fs: string }> = {
  small: { h: "2.25rem", px: "0.875rem", fs: "0.875rem" },
  medium: { h: "2.75rem", px: "1.25rem", fs: "0.9375rem" },
  large: { h: "3.25rem", px: "1.75rem", fs: "1.0625rem" },
};

/** Theme → CSS variables consumed by the store-* Tailwind tokens. */
export function themeVars(theme: StoreTheme): CSSProperties {
  const { colors } = theme;
  const [radius, radiusCard] = RADIUS[theme.radius];
  const btn = BUTTON[theme.buttonSize];
  return {
    "--store-bg": colors.background,
    "--store-surface": colors.surface,
    "--store-text": colors.text,
    "--store-muted": blend(colors.text, colors.background, 0.38),
    "--store-border": blend(colors.text, colors.background, 0.85),
    "--store-primary": colors.primary,
    "--store-on-primary": readableTextOn(colors.primary),
    "--store-accent": colors.accent,
    "--store-on-accent": readableTextOn(colors.accent),
    "--store-font-heading": fontStack(theme.fonts.heading),
    "--store-font-body": fontStack(theme.fonts.body),
    "--store-radius": radius,
    "--store-radius-card": radiusCard,
    "--store-btn-h": btn.h,
    "--store-btn-px": btn.px,
    "--store-btn-fs": btn.fs,
  } as CSSProperties;
}

/** Root of every public store page (and the editor preview). */
export function StoreFrame({ theme, children }: { theme: StoreTheme; children: ReactNode }) {
  return (
    <div
      className={`${storeFontVariables} flex min-h-screen flex-col bg-store-bg font-store-body text-store-text antialiased`}
      style={themeVars(theme)}
      data-template={theme.template}
    >
      {children}
    </div>
  );
}
