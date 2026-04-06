/**
 * deep-debug.js
 *
 * Opens a browser at the proxy URL — YOU control the login.
 * Everything is logged automatically: full request/response headers,
 * response bodies for auth endpoints, all console messages, and
 * screenshots on demand (press S + Enter) or on close.
 *
 * Usage:
 *   node scripts/deep-debug.js
 *
 * While running:
 *   Press Enter → stop and save
 *   Type s + Enter → take a screenshot now
 */

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { chromium } = require("playwright");

// ─── helpers ─────────────────────────────────────────────────────────────────

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
function now() {
  return new Date().toISOString();
}

function redact(text) {
  if (!text) return text;
  return String(text)
    .replace(/(password|passwd|pwd|secret)\s*[=:]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/(authorization\s*:\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(set-cookie\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/(cookie\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/SAMLResponse=[^&\s"'<]{20,}/g, "SAMLResponse=[REDACTED]");
}

function isInteresting(url) {
  return /api\/proxy\?url=|rapididentity|portal\.allenisd\.org|saml|authn|AuthnEngine|SAML2/i.test(url);
}

function isCritical(url) {
  return /authn|saml\/acs|SAML2\/Redirect\/SSO|idp\/authn\/idauto/i.test(url);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.resolve("debug-logs");
  fs.mkdirSync(outDir, { recursive: true });
  const fileStamp = stamp();
  const logFile = path.join(outDir, `deep-debug-${fileStamp}.txt`);
  const stream = fs.createWriteStream(logFile, { flags: "a" });

  let screenshotIdx = 0;

  function log(tag, payload) {
    const body =
      payload === undefined
        ? ""
        : typeof payload === "string"
        ? redact(payload)
        : redact(JSON.stringify(payload, null, 2));
    const line = `[${now()}] [${tag}] ${body}`;
    stream.write(line + "\n");
    const short = line.length > 180 ? line.slice(0, 180) + "…" : line;
    process.stdout.write(short + "\n");
  }

  async function takeScreenshot(page, label) {
    screenshotIdx++;
    const file = path.join(
      outDir,
      `deep-debug-${fileStamp}-${String(screenshotIdx).padStart(2, "0")}-${label}.png`
    );
    try {
      await page.screenshot({ path: file, fullPage: true });
      log("screenshot", { label, file });
    } catch (e) {
      log("screenshot-error", String(e));
    }
    return file;
  }

  async function htmlSnapshot(page, label) {
    for (const frame of page.frames()) {
      const frameLabel = frame === page.mainFrame() ? "main" : (frame.name() || "iframe");
      try {
        const html = await frame.content();
        const file = path.join(outDir, `deep-debug-${fileStamp}-${label}-${frameLabel}.html`);
        fs.writeFileSync(file, html, "utf8");
        log("html-snapshot", { label, frame: frameLabel, url: frame.url(), bytes: html.length, file });
      } catch (e) {
        log("html-snapshot-error", { label, frame: frameLabel, error: String(e) });
      }
    }
  }

  // ── Browser setup ─────────────────────────────────────────────────────────

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  // ── Request capture ───────────────────────────────────────────────────────

  context.on("request", (req) => {
    if (!isInteresting(req.url())) return;
    const safeHeaders = Object.fromEntries(
      Object.entries(req.headers()).map(([k, v]) => [
        k,
        ["cookie", "authorization"].includes(k.toLowerCase()) ? "[REDACTED]" : v,
      ])
    );
    log("request", {
      method: req.method(),
      url: req.url(),
      headers: safeHeaders,
      postData: req.method() !== "GET" ? redact(req.postData() || "") : undefined,
    });
  });

  context.on("response", async (res) => {
    if (!isInteresting(res.url())) return;
    const safeHeaders = Object.fromEntries(
      Object.entries(res.headers()).map(([k, v]) => [
        k,
        ["set-cookie", "cookie"].includes(k.toLowerCase()) ? "[REDACTED]" : v,
      ])
    );
    log("response", {
      status: res.status(),
      method: res.request().method(),
      url: res.url(),
      headers: safeHeaders,
    });

    if (isCritical(res.url())) {
      try {
        const body = await res.body();
        const ct = res.headers()["content-type"] || "";
        let bodyStr;
        if (ct.includes("json")) {
          try { bodyStr = JSON.stringify(JSON.parse(body.toString("utf8")), null, 2); }
          catch { bodyStr = body.toString("utf8"); }
        } else if (ct.includes("text") || ct.includes("html") || ct.includes("xml") || ct.includes("form")) {
          bodyStr = body.toString("utf8");
        } else {
          bodyStr = `[binary ${body.length} bytes, content-type: ${ct}]`;
        }
        const truncated = bodyStr.length > 6000
          ? bodyStr.slice(0, 6000) + `\n… [${bodyStr.length - 6000} more chars truncated]`
          : bodyStr;
        log("response-body", { url: res.url(), status: res.status(), contentType: ct, body: redact(truncated) });
      } catch (e) {
        log("response-body-error", { url: res.url(), error: String(e) });
      }
    }
  });

  context.on("requestfailed", (req) => {
    if (!isInteresting(req.url())) return;
    log("request-failed", { method: req.method(), url: req.url(), error: req.failure()?.errorText });
  });

  // ── Page events ───────────────────────────────────────────────────────────

  context.on("page", (page) => {
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "log" &&
          !/proxy|rapididentity|authn|saml|error|refused|ERR_|location|href|navigate|redirect/i.test(text)) return;
      log("console", { type: msg.type(), text: text.slice(0, 800), location: msg.location() });
    });
    page.on("pageerror", (err) => {
      log("page-error", { message: err?.message, stack: err?.stack?.slice(0, 600) });
    });
    page.on("framenavigated", (frame) => {
      log("frame-navigated", { isMain: frame === page.mainFrame(), name: frame.name(), url: frame.url() });
    });
  });

  const page = await context.newPage();

  // Wire up the events for the initial page too (context 'page' fires for NEW pages only)
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "log" &&
        !/proxy|rapididentity|authn|saml|error|refused|ERR_|location|href|navigate|redirect/i.test(text)) return;
    log("console", { type: msg.type(), text: text.slice(0, 800), location: msg.location() });
  });
  page.on("pageerror", (err) => {
    log("page-error", { message: err?.message, stack: err?.stack?.slice(0, 600) });
  });
  page.on("framenavigated", (frame) => {
    log("frame-navigated", { isMain: frame === page.mainFrame(), name: frame.name(), url: frame.url() });
  });

  // ── Navigate ──────────────────────────────────────────────────────────────

  const startUrl = "http://localhost:3000/api/proxy?url=https%3A%2F%2Fportal.allenisd.org";
  log("session-start", { startUrl });
  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  // ── Interactive control ───────────────────────────────────────────────────

  process.stdout.write(
    "\n" +
    "═══════════════════════════════════════════════════════\n" +
    "  Browser is open — do the login manually.\n" +
    "  Commands:\n" +
    "    s + Enter  → take screenshot + HTML snapshot now\n" +
    "    Enter      → finish and save log\n" +
    "═══════════════════════════════════════════════════════\n\n"
  );

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let stopped = false;
  const stop = async (reason) => {
    if (stopped) return;
    stopped = true;
    rl.close();

    // Final snapshot
    await htmlSnapshot(page, "final");
    await takeScreenshot(page, "final");

    log("session-end", {
      reason,
      mainUrl: page.url(),
      frames: page.frames().map((f) => ({ url: f.url(), name: f.name() })),
      logFile,
    });

    await browser.close().catch(() => {});
    stream.end();
    process.stdout.write(`\nLog: ${logFile}\n`);
  };

  rl.on("line", async (input) => {
    const cmd = input.trim().toLowerCase();
    if (cmd === "s") {
      await htmlSnapshot(page, `manual-${stamp()}`);
      await takeScreenshot(page, "manual");
      process.stdout.write("  → snapshot saved\n");
    } else {
      await stop("manual-stop");
    }
  });

  browser.on("disconnected", () => stop("browser-closed"));
  process.on("SIGINT", () => stop("SIGINT"));
}

main().catch((err) => {
  const file = path.join("debug-logs", `deep-debug-crash-${stamp()}.txt`);
  fs.mkdirSync("debug-logs", { recursive: true });
  fs.writeFileSync(file, `${now()}\n${String(err?.stack || err)}\n`);
  console.error("Crashed:", file);
  process.exit(1);
});
