import { mkdirSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { adminClient, deleteE2eUser, E2E_EMAIL, E2E_PASSWORD } from "./support";

// Creates a confirmed shop owner with one product, logs in through the UI,
// and saves the session for the tests.
export default async function globalSetup(config: FullConfig) {
  await deleteE2eUser();
  const admin = adminClient();
  const { error } = await admin.auth.admin.createUser({ email: E2E_EMAIL, password: E2E_PASSWORD, email_confirm: true });
  if (error) throw error;

  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("textbox", { name: /Shop name/ }).fill("E2E Test Shop");
  await page.getByRole("button", { name: "Create shop" }).click();
  await page.waitForURL("**/store");

  mkdirSync("e2e/.auth", { recursive: true });
  await page.context().storageState({ path: "e2e/.auth/state.json" });
  await browser.close();
}
