// End-to-end walk through the real UI with a real browser, a real model and
// Requires Playwright with Chromium (pre-installed in CI images; otherwise `npm i -D playwright`). Not part of `tsc` because Playwright is not a project dependency.
// a real database. Registers a fresh user, creates the model from the UI,
// chats (streaming), uploads knowledge, and visits every screen on desktop and
// phone. Fails on any page error, console error or HTTP 5xx.
//
//   BASE_URL=http://localhost:3200 node e2e/ui-walkthrough.mts [outDir]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright") as typeof import("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = path.resolve(process.argv[2] ?? "e2e/artifacts");
mkdirSync(OUT, { recursive: true });

const problems: string[] = [];
const browser = await chromium.launch();

async function watch(page: import("playwright").Page, label: string) {
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`[${label}] console: ${m.text().slice(0, 300)}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`[${label}] HTTP ${r.status()} ${r.url()}`));
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await desktop.newPage();
await watch(page, "desktop");

const email = `ui-${Date.now()}@example.test`;
await page.goto(`${BASE}/register`);
await page.fill('input[name="name"]', "سعد");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "correct-horse-42");
await page.click('button.primary');
await page.waitForURL(`${BASE}/ai`);
await page.screenshot({ path: `${OUT}/01-first-run.png` });

await page.fill('input[name="displayName"]', "Saad AI");
await page.fill('input[name="description"]', "نموذجي الخاص داخل OMNIX");
await page.click('form button.primary');
await page.waitForSelector("h1:has-text('Saad AI')", { timeout: 30_000 });
await page.screenshot({ path: `${OUT}/02-dashboard.png` });

// Knowledge: upload a real file and wait until processed (background job inline in dev).
await page.goto(`${BASE}/ai/knowledge`);
await page.setInputFiles('input[type="file"]', path.resolve("tests/fixtures/oasis-project.md"));
await page.waitForSelector("text=oasis-project", { timeout: 30_000 });
await page.waitForSelector("text=جاهز", { timeout: 120_000 });
await page.fill('input[placeholder*="ابحث"]', "ما رمز مشروع الواحة؟");
await page.click('form.row button.primary');
await page.waitForSelector("text=ذو صلة", { timeout: 60_000 });
await page.screenshot({ path: `${OUT}/03-knowledge.png`, fullPage: true });

// Chat with the real model; streaming must produce text.
await page.goto(`${BASE}/ai/chat`);
await page.fill(".composer textarea", "ما هو رمز مشروع الواحة؟");
await page.keyboard.press("Enter");
await page.waitForURL(/\/ai\/chat\/[0-9a-f-]{36}/, { timeout: 60_000 });
await page.waitForFunction(() => !document.querySelector(".cursor") && document.querySelectorAll(".msg.assistant .bubble").length > 0, null, { timeout: 180_000 });
const answer = await page.locator(".msg.assistant .bubble").last().innerText();
console.log("UI chat answer:", answer.slice(0, 200));
if (!answer.trim()) problems.push("empty assistant answer");
await page.screenshot({ path: `${OUT}/04-chat.png` });

const screens = ["/hub", "/ai/model", "/ai/memory", "/ai/datasets", "/ai/training", "/ai/evaluations", "/ai/versions", "/ai/deploy", "/ai/api", "/ai/usage"];
let n = 5;
for (const s of screens) {
  const res = await page.goto(`${BASE}${s}`);
  if (!res || res.status() >= 400) problems.push(`${s} → HTTP ${res?.status()}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${String(n++).padStart(2, "0")}-${s.split("/").pop()}.png`, fullPage: true });
}

// English / LTR
await page.evaluate(() => (document.cookie = "omnix_locale=en; Path=/"));
await page.goto(`${BASE}/ai`);
const dir = await page.getAttribute("html", "dir");
if (dir !== "ltr") problems.push(`expected ltr after switching to English, got ${dir}`);
await page.screenshot({ path: `${OUT}/20-dashboard-en.png` });
await page.evaluate(() => (document.cookie = "omnix_locale=ar; Path=/"));

// Phone
const cookies = await desktop.cookies();
const phone = await browser.newContext({ ...devices["iPhone 13"] });
await phone.addCookies(cookies);
const p2 = await phone.newPage();
await watch(p2, "phone");
for (const s of ["/ai", "/ai/chat", "/ai/knowledge", "/ai/training"]) {
  await p2.goto(`${BASE}${s}`);
  await p2.waitForLoadState("networkidle");
  const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) problems.push(`phone ${s}: horizontal overflow`);
  await p2.screenshot({ path: `${OUT}/30-phone-${s.split("/").pop()}.png` });
}
await p2.click(".mobile-tabs button");
await p2.screenshot({ path: `${OUT}/35-phone-more.png` });

await browser.close();
if (problems.length) {
  console.error("UI problems:\n" + problems.join("\n"));
  process.exit(1);
}
console.log(`UI walkthrough OK — screenshots in ${OUT}`);
