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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const pageErrors = [];
  const failed = [];
  const docFlow = [];
  const authFlow = [];

  page.on("pageerror", (err) => {
    pageErrors.push({
      message: err.message,
      stack: String(err.stack || "").slice(0, 600),
    });
  });

  page.on("requestfailed", (req) => {
    failed.push({
      type: req.resourceType(),
      url: req.url(),
      err: req.failure() ? req.failure().errorText : "unknown",
    });
  });

  page.on("response", (res) => {
    const req = res.request();
    const url = res.url();

    if (req.resourceType() === "document") {
      docFlow.push({
        status: res.status(),
        method: req.method(),
        url,
      });
    }

    if (/api\/rest\/v2\/authn|idp\/authn\/idauto|saml\/acs|SAML2\/Redirect\/SSO|\/p\/portal|\/p\/$/i.test(url)) {
      authFlow.push({
        status: res.status(),
        method: req.method(),
        type: req.resourceType(),
        url,
      });
    }
  });

  await page.goto("http://localhost:3000/api/proxy?url=https%3A%2F%2Fportal.allenisd.org", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  const initialInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input"))
      .map((el) => ({
        type: el.getAttribute("type") || "",
        id: el.getAttribute("id") || "",
        name: el.getAttribute("name") || "",
        placeholder: el.getAttribute("placeholder") || "",
      }))
      .slice(0, 20);
  });
  console.log("INITIAL_URL", page.url());
  console.log("INITIAL_TITLE", await page.title());
  console.log("INITIAL_INPUTS", JSON.stringify(initialInputs, null, 2));

  const userSelector = [
    "input[name='username']",
    "input[name='login']",
    "input[id='username']",
    "input[id='userName']",
    "input[autocomplete='username']",
    "input[name='email']",
    "input[type='email']",
    "input[type='text']",
    "input:not([type])",
  ].join(", ");

  const userInput = page.locator(userSelector).first();
  await userInput.waitFor({ state: "visible", timeout: 120000 });
  await userInput.fill(username);

  const goButton = page.getByRole("button", { name: /^Go$/i }).first();
  if (await goButton.count()) {
    await goButton.click();
  } else {
    await userInput.press("Enter");
  }

  await page.waitForTimeout(2000);
  const afterUsernameInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input"))
      .map((el) => ({
        type: el.getAttribute("type") || "",
        id: el.getAttribute("id") || "",
        name: el.getAttribute("name") || "",
        placeholder: el.getAttribute("placeholder") || "",
      }))
      .slice(0, 20);
  });
  console.log("AFTER_USERNAME_URL", page.url());
  console.log("AFTER_USERNAME_TITLE", await page.title());
  console.log("AFTER_USERNAME_INPUTS", JSON.stringify(afterUsernameInputs, null, 2));

  const passInput = page.locator("input[type='password']").first();
  await passInput.waitFor({ state: "visible", timeout: 120000 });
  await passInput.fill(password);

  if (await goButton.count()) {
    await goButton.click();
  } else {
    await passInput.press("Enter");
  }

  await page.waitForTimeout(22000);

  const finalText = await page.locator("body").innerText().catch(() => "");
  const final = {
    url: page.url(),
    title: await page.title(),
    bodyLen: finalText.length,
    bodyPreview: finalText.replace(/\s+/g, " ").slice(0, 240),
  };

  console.log("FINAL", JSON.stringify(final, null, 2));
  console.log("DOC_FLOW", JSON.stringify(docFlow.slice(-40), null, 2));
  console.log("AUTH_FLOW", JSON.stringify(authFlow.slice(-80), null, 2));
  console.log("PAGE_ERRORS", JSON.stringify(pageErrors, null, 2));
  console.log("FAILED", JSON.stringify(failed.slice(-40), null, 2));

  await browser.close();
}

run().catch((err) => {
  console.error("REPRO_PROXY_FINAL_ERROR", err);
  process.exit(1);
});
