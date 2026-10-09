// Builds the FixIt Galway demo store THROUGH THE SELLIFY BACKEND UI (no seed
// SQL, no hand-coded pages): a real browser logs in as the shop owner and fills
// in the same forms a person would. Brand: docs/brand/demo-store-fixit-galway.md
//
// Usage: node demo/build-fixit-galway.mjs [baseUrl]   (default: APP_URL from .env)
// Needs DEMO_EMAIL / DEMO_PASSWORD in .env and images from demo/make-images.mjs.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const BASE = (process.argv[2] ?? env.APP_URL).replace(/\/$/, "");
const img = (f) => resolve("demo/assets", f);
const HEADED = process.env.HEADED === "1";

const browser = await chromium.launch({ headless: !HEADED });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30_000);

// Only the visible copy of a control: Next keeps previous pages hidden in the DOM.
// Required fields' labels end in " *".
const labelRe = (label) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`);
const field = (label) => page.getByLabel(labelRe(label)).filter({ visible: true }).first();
const button = (name) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
const step = (msg) => console.log(`• ${msg}`);

async function go(path, readyText) {
  await page.goto(`${BASE}${path}`);
  if (readyText) await page.getByText(readyText, { exact: false }).filter({ visible: true }).first().waitFor();
}

async function upload(file) {
  const before = await page.getByRole("button", { name: /^Remove photo/ }).filter({ visible: true }).count();
  await page.locator('input[type="file"]').filter({ visible: false }).first().setInputFiles(file).catch(async () => {
    await page.locator('input[type="file"]').first().setInputFiles(file);
  });
  await page.getByRole("button", { name: /^Remove photo/ }).filter({ visible: true }).nth(before).waitFor();
}

// ---------------------------------------------------------------------------
step(`Log in at ${BASE}`);
await go("/login", "Log in");
await field("Email").fill(env.DEMO_EMAIL);
await field("Password").fill(env.DEMO_PASSWORD);
await button("Log in").click();
// /store streams a redirect to /onboarding for a new account: wait for content, not the URL.
// The /store static shell (sidebar, header) renders before that redirect, so
// wait for content that only exists once the shop question is settled.
await page
  .getByText(/Set up your shop|Store details|Create your online store/)
  .filter({ visible: true })
  .first()
  .waitFor();

if (page.url().includes("/onboarding")) {
  step("Set up the shop");
  await field("Shop name").fill("FixIt Galway");
  await field("Shop email").fill("hello@fixitgalway.ie");
  await button("Create shop").click();
  await page.waitForURL(/\/store/);
}

step("Shop settings");
await go("/core/settings", "Shop details");
await field("Phone").fill("+353 91 555 0142");
await field("Address").fill("Eyre Square, Galway");
await button("Save settings").click();
await page.getByText("Settings saved.").waitFor();

// ---------------------------------------------------------------------------
const products = [
  { name: "iPhone 13 128GB, Midnight", category: "Phone", condition: "Refurbished", price: "449", stock: "4", image: "iphone-13.png", description: "Grade A refurbished. New battery, 12-month warranty, tested in our Galway shop." },
  { name: "iPhone 12 64GB, Blue", category: "Phone", condition: "Refurbished", price: "349", stock: "2", image: "iphone-12.png", description: "Grade A refurbished with a 12-month warranty. Unlocked for any network." },
  { name: "Galaxy S21 128GB, Phantom Violet", category: "Phone", condition: "Refurbished", price: "299", stock: "3", image: "galaxy-s21.png", description: "Like new. Unlocked, 12-month warranty." },
  { name: "Clear case for iPhone 13", category: "Accessory", condition: "New", price: "19", stock: "20", image: "case.png", description: "Slim, clear and grippy. Won't go yellow." },
  { name: "20W USB-C fast charger", category: "Accessory", condition: "New", price: "24", stock: "15", image: "charger.png", description: "Charges an iPhone to 50% in about 30 minutes." },
  { name: "Tempered glass screen protector", category: "Accessory", condition: "New", price: "12", stock: "30", image: "protector.png", description: "9H glass. We fit it for free while you wait." },
];
const parts = [
  { name: "iPhone 12 replacement screen", price: "60", stock: "2", model: "iPhone 12", repair: "Screen replacement" },
  { name: "iPhone 13 battery", price: "35", stock: "3", model: "iPhone 13", repair: "Battery replacement" },
];

async function productExists(name) {
  await go(`/core/inventory?q=${encodeURIComponent(name)}`, "Inventory");
  await page.waitForLoadState("networkidle");
  return (await page.getByRole("link", { name, exact: true }).filter({ visible: true }).count()) > 0;
}

for (const p of products) {
  if (await productExists(p.name)) { step(`Product exists: ${p.name}`); continue; }
  step(`Product: ${p.name}`);
  await go("/core/inventory/new", "Product photos");
  await field("Name").fill(p.name);
  await field("Category").selectOption({ label: p.category });
  await field("Condition").selectOption({ label: p.condition });
  await field("Description").fill(p.description);
  await field("Price").fill(p.price);
  await field("In stock").fill(p.stock);
  await upload(img(p.image));
  await button("Add product").click();
  await page.getByText("Product saved.").waitFor();
}

for (const p of parts) {
  if (await productExists(p.name)) { step(`Part exists: ${p.name}`); continue; }
  step(`Repair part: ${p.name}`);
  await go("/core/inventory/new", "Product photos");
  await field("Name").fill(p.name);
  await field("Category").selectOption({ label: "Part" });
  await field("Condition").selectOption({ label: "New" });
  await field("Price").fill(p.price);
  await field("In stock").fill(p.stock);
  await field("Fits model").selectOption({ label: p.model });
  await field("Used for").selectOption({ label: p.repair });
  await button("Add product").click();
  await page.getByText("Product saved.").waitFor();
}

// ---------------------------------------------------------------------------
const repairPrices = [
  ["iPhone 12", "Screen replacement", "129", "60"],
  ["iPhone 12", "Battery replacement", "79", "45"],
  ["iPhone 13", "Screen replacement", "149", "60"],
  ["iPhone 13", "Battery replacement", "89", "45"],
  ["iPhone 14", "Screen replacement", "189", "60"],
  ["iPhone 15", "Screen replacement", "229", "90"],
  ["Galaxy S21", "Screen replacement", "159", "90"],
  ["Galaxy S21", "Battery replacement", "69", "60"],
  ["Pixel 7", "Screen replacement", "139", "60"],
  ["iPhone 13", "Charging port", "69", "60"],
];
for (const [model, repair, price, minutes] of repairPrices) {
  step(`Repair price: ${model} ${repair} €${price}`);
  await go("/core/repair-prices", "Add or update a price");
  await field("Model").selectOption({ label: model });
  await field("Repair").selectOption({ label: repair });
  await field("Price").fill(price);
  await field("Time needed (minutes)").fill(minutes);
  await button("Save price").click();
  await page.getByText(/Price saved/).waitFor();
}

const buybackPrices = [
  ["Galaxy S21", "128 GB", "200"],
  ["Galaxy S21", "256 GB", "230"],
  ["iPhone 12", "64 GB", "220"],
  ["iPhone 12", "128 GB", "250"],
  ["iPhone 13", "128 GB", "320"],
  ["iPhone 13", "256 GB", "360"],
  ["iPhone 14", "128 GB", "420"],
];
for (const [model, storage, price] of buybackPrices) {
  step(`Buyback price: ${model} ${storage} €${price}`);
  await go("/core/buyback-prices", "Add or update a price");
  await field("Model").selectOption({ label: model });
  await field("Storage").selectOption({ label: storage });
  await field("Base price").fill(price);
  await button("Save price").click();
  await page.getByText(/Price saved/).waitFor();
}

// ---------------------------------------------------------------------------
step("Create the online store");
await go("/store", "Online store");
if (await page.getByText("Create your online store").filter({ visible: true }).count()) {
  await field("Store address").fill("fixit-galway");
  await button("Create store").click();
  await page.waitForURL(/created=1/);
}

step("General: name, tagline, logo");
await go("/store", "Store details");
await field("Store name").fill("FixIt Galway");
await field("Tagline").fill("Phone repairs in the heart of Galway. Most screens fixed while you wait.");
if (!(await page.getByRole("button", { name: /^Remove photo/ }).filter({ visible: true }).count())) await upload(img("logo.png"));
await button("Save details").click();
await page.getByText("Saved to your draft").waitFor();

step("Design: Local template + FixIt Galway brand");
await go("/store/design", "Choose a template");
await page.getByText("Local", { exact: true }).filter({ visible: true }).first().click();
await button("Use this template").click();
await page.getByText("Template changed in your draft").waitFor();
await go("/store/design", "Colours");
const colours = { "Main colour": "#12263A", Accent: "#E2622F", "Page background": "#FBF6EE", Cards: "#FFFFFF", Text: "#1D1D1F" };
for (const [label, hex] of Object.entries(colours)) await field(label).fill(hex);
await field("Heading font").selectOption("poppins");
await field("Body font").selectOption("nunito");
await field("Corners").selectOption("large");
await field("Button size").selectOption("medium");
await field("Top of the homepage").selectOption("split");
await field("Products per row (desktop)").selectOption("3");
await button("Save design").click();
await page.getByText("Design saved to your draft").waitFor();

step("Content: banner, photo, about, contact, reviews");
await go("/store/content", "Opening hours");
if (!(await field("Show the banner").isChecked())) await page.getByText("Show the banner", { exact: true }).filter({ visible: true }).first().click(); // click the label, as a person would
await field("Banner text").fill("10% off screen repairs this week");
if (!(await page.getByRole("button", { name: /^Remove photo/ }).filter({ visible: true }).count())) await upload(img("hero.png"));
await field("About your shop").fill(
  "We're a family-run repair shop just off Eyre Square, fixing Galway's phones for over ten years. Most screens and batteries are done while you wait, with genuine-quality parts and a 6-month warranty on every repair. No fix, no fee.",
);
await field("Phone").fill("+353 91 555 0142");
await field("Email").fill("hello@fixitgalway.ie");
await field("Address").fill("Eyre Square, Galway");
const reviews = [
  ["Aoife M.", "5", "Cracked my screen on a Saturday morning, had it back before lunch. Friendly and fair price."],
  ["Ciarán D.", "5", "Sold them my old Galaxy for a fair offer and walked out with a refurbished iPhone. Easy."],
  ["Sarah K.", "4", "Battery swap in 40 minutes. Phone lasts all day again."],
];
for (let i = 0; i < reviews.length; i++) {
  if ((await page.getByLabel(labelRe("Name")).filter({ visible: true }).count()) <= i) await button("Add review").click();
  await page.getByLabel(labelRe("Name")).filter({ visible: true }).nth(i).fill(reviews[i][0]);
  await page.getByLabel(labelRe("Stars")).filter({ visible: true }).nth(i).selectOption(reviews[i][1]);
  await page.getByLabel(labelRe("Review")).filter({ visible: true }).nth(i).fill(reviews[i][2]);
}
await button("Save content").click();
await page.getByText("Content saved to your draft").waitFor();

step("Publish");
await go("/store", "Status");
await button("Publish").click();
await page.waitForURL(/published=1/);
const live = await page.getByRole("link", { name: /\/s\/fixit-galway|fixit-galway/ }).filter({ visible: true }).first().getAttribute("href");
console.log(`\nLive: ${live}`);

await browser.close();
