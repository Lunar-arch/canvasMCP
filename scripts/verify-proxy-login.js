const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

function readEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;

  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }

  return out;
}

async function run() {
  const env = readEnv(path.resolve(".env.local"));
  const username = env.USERNAME;
  const password = env.PASSWORD;

  if (!username || !password) {
    throw new Error("Missing USERNAME/PASSWORD in .env.local");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const authTrace = [];
  const authPattern = /api\/rest\/v2\/authn|idp\/authn\/idauto|api%2Frest%2Fv2%2Fauthn|idp%2Fauthn%2Fidauto/i;

  page.on("request", (req) => {
    const url = req.url();
    if (authPattern.test(url)) {
      authTrace.push({ type: "REQ", method: req.method(), url });
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (authPattern.test(url)) {
      authTrace.push({ type: "RES", status: res.status(), url });
    }
  });

  await page.goto("http://localhost:3000/setup", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.getByRole("button", { name: "New Macro" }).first().click();
  await page.getByRole("textbox", { name: "Name" }).fill("Auto Proxy Verify");
  await page.getByRole("button", { name: /^Create$/ }).click();

  await page.getByRole("button", { name: /^Record$/ }).first().click();
  await page.getByPlaceholder("https://your-login-portal.com").fill("https://portal.allenisd.org");
  await page.getByRole("button", { name: /^Start$/ }).click();

  const frameLocator = page.frameLocator('iframe[title="Recording browser"]');

  const userInput = frameLocator
    .locator('input[type="text"], input:not([type])')
    .first();
  await userInput.waitFor({ state: "visible", timeout: 90000 });
  await userInput.fill(username);
  await frameLocator.getByRole("button", { name: /^Go$/ }).first().click();

  const passInput = frameLocator.locator('input[type="password"]').first();
  await passInput.waitFor({ state: "visible", timeout: 90000 });
  await passInput.fill(password);
  await passInput.press("Enter").catch(() => {});
  await frameLocator.getByRole("button", { name: /^Go$/ }).first().click().catch(() => {});

  await page.waitForTimeout(8000);

  const proxyFrame = page.frames().find((f) => f !== page.mainFrame());
  const frameUrl = proxyFrame ? proxyFrame.url() : "no-frame";
  const bodyText = proxyFrame
    ? (await proxyFrame.locator("body").innerText().catch(() => "")).slice(0, 500)
    : "";

  const hasNoLoginContextError = /Internal Error:\s*No login context available/i.test(bodyText);

  for (const item of authTrace) {
    if (item.type === "REQ") {
      console.log("TRACE_REQ", item.method, item.url);
    } else {
      console.log("TRACE_RES", item.status, item.url);
    }
  }
  console.log("FRAME_URL", frameUrl);
  console.log("HAS_NO_LOGIN_CONTEXT_ERROR", hasNoLoginContextError);
  console.log("BODY_PREVIEW", bodyText.replace(/\s+/g, " ").slice(0, 240));

  await browser.close();
}

run().catch((err) => {
  console.error("VERIFY_PROXY_LOGIN_ERROR", err);
  process.exit(1);
});
