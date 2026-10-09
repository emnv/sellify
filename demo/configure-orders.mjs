// FixIt Galway demo: turn on delivery (€5) and take 2 repairs per slot,
// through the backend UI. Usage: node demo/configure-orders.mjs [baseUrl]
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const BASE = (process.argv[2] ?? env.APP_URL).replace(/\/$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30_000);
const labelRe = (label) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`);
const field = (label) => page.getByLabel(labelRe(label)).filter({ visible: true }).first();
const button = (name) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

await page.goto(`${BASE}/login`);
await field("Email").fill(env.DEMO_EMAIL);
await field("Password").fill(env.DEMO_PASSWORD);
await button("Log in").click();
await page.getByText(/Store details|Create your online store/).filter({ visible: true }).first().waitFor();

console.log("• Settings: delivery €5");
await page.goto(`${BASE}/core/settings`);
await page.getByText("Online orders").filter({ visible: true }).first().waitFor();
// The switch's checkbox is visually hidden; read its state by name, click its label to change it.
const deliveryOn = await page.locator('input[name="delivery_enabled"]').first().isChecked();
if (!deliveryOn) await page.getByText(/^Delivery$/).filter({ visible: true }).first().click();
await field("Delivery fee").fill("5");
await button("Save online orders").click();
await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);

console.log("• Repair prices: 2 repairs per slot");
await page.goto(`${BASE}/core/repair-prices`);
await field("Repairs per time slot").selectOption("2");
await button("Save setting").click();
await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);

console.log("done");
await browser.close();
