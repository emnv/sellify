import { Inter, Merriweather, Nunito, Playfair_Display, Poppins, Space_Grotesk } from "next/font/google";
import type { StoreFont } from "@/lib/store/config";

// The fonts a store can pick (see STORE_FONTS). Not preloaded: a store only
// downloads the files of the fonts its theme actually uses.
const inter = Inter({ subsets: ["latin"], variable: "--font-store-inter", preload: false, display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-store-poppins", preload: false, display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-store-space-grotesk", preload: false, display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-store-playfair", preload: false, display: "swap" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-store-merriweather", preload: false, display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-store-nunito", preload: false, display: "swap" });

/** Class that defines every store font variable. Put it on the store root. */
export const storeFontVariables = [inter, poppins, spaceGrotesk, playfair, merriweather, nunito].map((f) => f.variable).join(" ");

const STACKS: Record<StoreFont, string> = {
  inter: "var(--font-store-inter), ui-sans-serif, system-ui, sans-serif",
  poppins: "var(--font-store-poppins), ui-sans-serif, system-ui, sans-serif",
  "space-grotesk": "var(--font-store-space-grotesk), ui-sans-serif, system-ui, sans-serif",
  playfair: "var(--font-store-playfair), ui-serif, Georgia, serif",
  merriweather: "var(--font-store-merriweather), ui-serif, Georgia, serif",
  nunito: "var(--font-store-nunito), ui-sans-serif, system-ui, sans-serif",
};

export function fontStack(font: StoreFont) {
  return STACKS[font];
}
