/**
 * Captures README screenshots against a running instance (real data).
 *   npm run build && npm start        # in one terminal
 *   npm run screenshots               # in another   (SCREENSHOT_URL defaults to http://localhost:3000)
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a specific Chromium binary.
 */
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SCREENSHOT_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

type Shot = { file: string; path: string; width: number; height: number; scheme: "light" | "dark"; full: boolean; wait?: number; act?: (p: Page) => Promise<void> };

const shots: Shot[] = [
  { file: "01-dashboard-desktop-light.png", path: "/", width: 1440, height: 900, scheme: "light", full: true, wait: 5000 },
  { file: "02-dashboard-mobile-dark.png", path: "/", width: 390, height: 844, scheme: "dark", full: false, wait: 5000 },
  {
    file: "03-map-hotspots-desktop-dark.png", path: "/map", width: 1440, height: 900, scheme: "dark", full: false, wait: 6000,
    act: async (p) => {
      await p.getByRole("button", { name: /^1\s/ }).first().click().catch(() => {});
      await p.waitForTimeout(2500);
    },
  },
  {
    file: "04-history-desktop-light.png", path: "/history", width: 1440, height: 900, scheme: "light", full: true, wait: 4000,
    act: async (p) => {
      await p.getByRole("button", { name: /Diwali week/ }).click();
      await p.waitForTimeout(6000);
    },
  },
  { file: "05-compare-desktop-light.png", path: "/compare?locs=28.614,77.209,Delhi~19.076,72.878,Mumbai~52.520,13.405,Berlin", width: 1440, height: 900, scheme: "light", full: true, wait: 9000 },
  { file: "06-forecast-desktop-light.png", path: "/forecast", width: 1440, height: 900, scheme: "light", full: true, wait: 6000 },
  { file: "07-health-mobile-light.png", path: "/health", width: 390, height: 844, scheme: "light", full: false, wait: 6000 },
  {
    file: "08-assistant-desktop-light.png", path: "/assistant", width: 1280, height: 900, scheme: "light", full: false, wait: 1500,
    act: async (p) => {
      await p.getByRole("button", { name: "Should I wear a mask today?" }).click();
      await p.waitForTimeout(14000);
    },
  },
  { file: "09-ml-prediction-desktop-light.png", path: "/prediction", width: 1440, height: 900, scheme: "light", full: true, wait: 20000 },
  { file: "10-diwali-check-desktop-dark.png", path: "/diwali", width: 1440, height: 900, scheme: "dark", full: true, wait: 9000 },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, colorScheme: s.scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + s.path, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(s.wait ?? 4000);
  if (s.act) await s.act(page);
  await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: s.full });
  console.log("saved", s.file);
  await ctx.close();
}
await browser.close();
