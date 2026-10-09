import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Part 1 enforcement: backend pages must be built from src/components/ui and
// the design tokens. See docs/brand/sellify-platform.md and CLAUDE.md.
const UI_KIT = "Use the shared component from '@/components/ui' instead (see docs/brand/sellify-platform.md).";
const backendRules = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea|table|dialog)$/]",
      message: `Raw <button>/<input>/<select>/<textarea>/<table>/<dialog>. ${UI_KIT}`,
    },
    {
      selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/], TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
      message: "Hard-coded hex colour. Use a colour token (bg-primary, text-fg-muted, …).",
    },
    {
      selector: "Literal[value=/(^|\\s)[a-z:-]*\\[[^\\]]+\\]/], TemplateElement[value.raw=/(^|\\s)[a-z:-]*\\[[^\\]]+\\]/]",
      message: "Arbitrary Tailwind value (e.g. p-[13px]). Use the spacing, size and colour tokens.",
    },
    {
      selector:
        "Literal[value=/\\b(bg|text|border|ring|outline|fill|stroke|divide|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b/]",
      message: "Tailwind default palette colour. It is disabled in this project; use a colour token.",
    },
    {
      selector: "JSXAttribute[name.name='style']",
      message: "Inline styles bypass the design tokens. Use token classes or a shared component.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/(backend)/**/*.{ts,tsx}", "src/app/(auth)/**/*.{ts,tsx}"],
    rules: backendRules,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
