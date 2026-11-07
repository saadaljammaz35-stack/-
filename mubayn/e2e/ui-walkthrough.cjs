// Browser walkthrough of the customer journey (real Chromium, real clicks):
// register → verify (link from the dev mail folder) → sign in → device form →
// upload photos with the real file input and progress bar → submit → report
// page → PDF download. Screenshots go to e2e/artifacts.
//
//   BASE=http://localhost:3100 node e2e/ui-walkthrough.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const BASE = process.env.BASE || "http://localhost:3100";
const OUT = path.resolve(__dirname, "artifacts");
const MAIL = path.resolve(process.env.MAIL_DIR || ".storage/mail");
fs.mkdirSync(OUT, { recursive: true });

function latestMail(to, template) {
  const files = fs.readdirSync(MAIL).filter((f) => f.includes(template)).map((f) => path.join(MAIL, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const f of files) { const m = JSON.parse(fs.readFileSync(f, "utf8")); if (m.to === to) return m; }
  throw new Error("no mail");
}

(async () => {
  const photos = [];
  for (let i = 1; i <= 4; i++) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1050"><rect width="100%" height="100%" fill="hsl(${i * 60},25%,70%)"/><rect x="480" y="120" width="440" height="810" rx="60" fill="#1b2430"/><text x="60" y="100" font-size="56">ui ${i}</text></svg>`;
    const p = path.join(OUT, `ui-photo-${i}.jpg`);
    fs.writeFileSync(p, await sharp(Buffer.from(svg)).jpeg().toBuffer());
    photos.push(p);
  }
  const email = `ui-${Date.now()}@example.test`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  globalThis.__errors = errors;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.url().includes("/api/") && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const shot = (n) => { console.log("step", n); return page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: true }); };

  await page.goto(BASE + "/register");
  await page.fill("#fullName", "سارة");
  await page.fill("#email", email);
  await page.fill("#password", "Ui-Test-Passw0rd!");
  await page.check("input[name=terms]");
  await page.click("button.btn-signal");
  await page.waitForSelector(".alert-ok");
  await shot("01-registered");

  const token = /token=([A-Za-z0-9_-]+)/.exec(latestMail(email, "verify_email").text)[1];
  await page.goto(`${BASE}/verify-email?token=${token}`);
  await page.waitForSelector(".alert-ok");

  await page.goto(BASE + "/login");
  await page.fill("#email", email);
  await page.fill("#password", "Ui-Test-Passw0rd!");
  await page.click("form button.btn");
  await page.waitForURL("**/dashboard");
  await shot("02-dashboard");

  await page.goto(BASE + "/inspections/new");
  await page.fill("#brand", "Samsung");
  await page.fill("#model", "Galaxy S22");
  await page.fill("#sellerClaims", "استخدام خفيف، الشاشة سليمة");
  await page.click("form button.btn-signal");
  await page.waitForURL(/\/inspections\/[0-9a-f-]+/);
  await shot("03-inspection-draft");

  const progressSeen = [];
  const watcher = setInterval(async () => {
    const t = await page.locator(".ev-tile .thumb").allInnerTexts().catch(() => []);
    for (const x of t) if (/%/.test(x)) progressSeen.push(x);
  }, 50);
  await page.setInputFiles("input[type=file]", photos);
  await page.waitForFunction(() => document.querySelectorAll(".ev-tile img").length >= 4, null, { timeout: 60000 });
  clearInterval(watcher);
  await page.waitForTimeout(800);
  await shot("04-uploaded");

  await page.click("text=أرسل الفحص");
  await page.waitForURL(/\/reports\/[0-9a-f-]+/, { timeout: 120000 });
  await page.waitForLoadState("networkidle");
  await shot("05-report");

  const [download] = await Promise.all([page.waitForEvent("download"), page.click("text=تنزيل PDF")]);
  const pdfPath = path.join(OUT, "report.pdf");
  await download.saveAs(pdfPath);
  const head = fs.readFileSync(pdfPath).subarray(0, 5).toString();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(JSON.stringify({ ok: head === "%PDF-", progressSamples: progressSeen.slice(0, 5), overflow, errors }, null, 2));
  await browser.close();
  if (head !== "%PDF-" || errors.length) process.exit(1);
})().catch(async (e) => { console.error(e.message.split("\n")[0]); console.error(JSON.stringify(globalThis.__errors ?? [])); process.exit(1); });
