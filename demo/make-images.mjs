// Renders the FixIt Galway logo and simple product illustrations to PNG, so
// the demo can upload them through the store's normal upload buttons.
// Usage: node demo/make-images.mjs   (writes demo/assets/*.png)
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = "demo/assets";
mkdirSync(OUT, { recursive: true });

const NAVY = "#12263A";
const RUST = "#E2622F";
const SAND = "#FBF6EE";

function phone({ body, screen, label, sub }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="${SAND}"/>
    <circle cx="400" cy="380" r="300" fill="#ffffff"/>
    <rect x="270" y="110" width="260" height="520" rx="44" fill="${body}"/>
    <rect x="288" y="140" width="224" height="460" rx="30" fill="${screen}"/>
    <rect x="360" y="122" width="80" height="12" rx="6" fill="#00000055"/>
    <text x="400" y="700" font-family="Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="${NAVY}">${label}</text>
    <text x="400" y="750" font-family="Arial, sans-serif" font-size="30" text-anchor="middle" fill="${RUST}">${sub}</text>
  </svg>`;
}

function accessory({ shape, label, sub }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <rect width="800" height="800" fill="${SAND}"/>
    <circle cx="400" cy="360" r="280" fill="#ffffff"/>
    ${shape}
    <text x="400" y="700" font-family="Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="${NAVY}">${label}</text>
    <text x="400" y="750" font-family="Arial, sans-serif" font-size="30" text-anchor="middle" fill="${RUST}">${sub}</text>
  </svg>`;
}

const images = {
  "logo.png": readFileSync("docs/brand/fixit-galway-logo.svg", "utf8"),
  "iphone-13.png": phone({ body: "#2b2f36", screen: "#5b8def", label: "iPhone 13", sub: "Refurbished · 128GB" }),
  "iphone-12.png": phone({ body: "#1f3b5c", screen: "#7fb3d5", label: "iPhone 12", sub: "Refurbished · 64GB" }),
  "galaxy-s21.png": phone({ body: "#4b4458", screen: "#b48ead", label: "Galaxy S21", sub: "Refurbished · 128GB" }),
  "case.png": accessory({
    shape: `<rect x="290" y="130" width="220" height="440" rx="48" fill="none" stroke="#9fb6c9" stroke-width="22"/><rect x="330" y="170" width="70" height="90" rx="20" fill="#9fb6c9"/>`,
    label: "Clear case",
    sub: "For iPhone 13",
  }),
  "charger.png": accessory({
    shape: `<rect x="300" y="200" width="200" height="220" rx="30" fill="#f5f5f5" stroke="#c9c9c9" stroke-width="8"/><rect x="370" y="140" width="18" height="70" fill="#9a9a9a"/><rect x="412" y="140" width="18" height="70" fill="#9a9a9a"/><path d="M400 420 C 400 520, 520 520, 520 600" stroke="${NAVY}" stroke-width="18" fill="none"/>`,
    label: "20W USB-C charger",
    sub: "Fast charging",
  }),
  "protector.png": accessory({
    shape: `<rect x="290" y="130" width="220" height="440" rx="36" fill="#e8f3fb" stroke="#7fb3d5" stroke-width="10"/><path d="M320 220 L 480 160 M320 300 L480 240" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>`,
    label: "Glass protector",
    sub: "9H tempered glass",
  }),
  "hero.png": `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <rect width="1200" height="900" fill="${NAVY}"/>
    <path d="M0 640 C 200 560, 380 720, 600 640 S 1000 560, 1200 640 L1200 900 L0 900 Z" fill="${RUST}"/>
    <path d="M0 690 C 200 610, 380 770, 600 690 S 1000 610, 1200 690" fill="none" stroke="${SAND}" stroke-width="14"/>
    <rect x="470" y="150" width="260" height="470" rx="44" fill="${SAND}"/>
    <rect x="495" y="190" width="210" height="370" rx="20" fill="${NAVY}"/>
    <text x="600" y="400" font-family="Arial, sans-serif" font-size="52" font-weight="700" text-anchor="middle" fill="${SAND}">Fixed</text>
    <text x="600" y="460" font-family="Arial, sans-serif" font-size="34" text-anchor="middle" fill="${RUST}">while you wait</text>
  </svg>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, svg] of Object.entries(images)) {
  const size = file === "hero.png" ? { w: 1200, h: 900 } : file === "logo.png" ? { w: 640, h: 640 } : { w: 800, h: 800 };
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.locator("svg").screenshot({ path: `${OUT}/${file}`, omitBackground: file === "logo.png" });
  console.log("wrote", `${OUT}/${file}`);
}
await browser.close();
