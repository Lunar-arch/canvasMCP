const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { chromium } = require("playwright");

function parseArgs(argv) {
  const opts = {
    startUrl: "http://localhost:3000/setup",
    headless: false,
    autoStopSeconds: 0,
  };

  for (const arg of argv) {
    if (arg === "--headless") {
      opts.headless = true;
      continue;
    }
    if (arg.startsWith("--start-url=")) {
      opts.startUrl = arg.slice("--start-url=".length).trim() || opts.startUrl;
      continue;
    }
    if (arg.startsWith("--auto-stop-seconds=")) {
      const raw = Number(arg.slice("--auto-stop-seconds=".length));
      if (Number.isFinite(raw) && raw > 0) {
        opts.autoStopSeconds = Math.floor(raw);
      }
      continue;
    }
  }

  return opts;
}

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function redactText(value) {
  if (!value) return value;
  let out = String(value);

  const rules = [
    {
      // JSON-ish or text key:value pairs
      re: /((?:password|pass|passwd|pwd|secret|token|username|user|email)\s*["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^&\s,}\]]+)/gi,
      replace: "$1[REDACTED]",
    },
    {
      // Query/form pairs
      re: /((?:password|pass|passwd|pwd|secret|token|username|user|email)=)([^&\s]+)/gi,
      replace: "$1[REDACTED]",
    },
    {
      // Common auth headers
      re: /(authorization\s*[:=]\s*)([^\n\r]+)/gi,
      replace: "$1[REDACTED]",
    },
    {
      // Cookies
      re: /(cookie\s*[:=]\s*)([^\n\r]+)/gi,
      replace: "$1[REDACTED]",
    },
  ];

  for (const rule of rules) {
    out = out.replace(rule.re, rule.replace);
  }

  if (out.length > 5000) {
    return `${out.slice(0, 5000)}... [truncated ${out.length - 5000} chars]`;
  }

  return out;
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return {};

  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = String(k).toLowerCase();
    if (["set-cookie", "cookie", "authorization", "proxy-authorization"].includes(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (key === "location" || key === "content-type" || key === "x-proxy-url" || key === "x-proxy-redirect-count") {
      out[key] = redactText(v);
    }
  }
  return out;
}

async function captureIframes(page) {
  return page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll("iframe"));
    return frames.map((frame, index) => {
      const info = {
        index,
        titleAttr: frame.getAttribute("title") || "",
        srcAttr: frame.getAttribute("src") || "",
        srcProp: frame.src || "",
      };

      try {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        info.sameOrigin = true;
        info.href = win?.location?.href || "";
        info.origin = win?.location?.origin || "";
        info.docTitle = doc?.title || "";
        info.bodyPreview = (doc?.body?.innerText || "").slice(0, 300);
      } catch (err) {
        info.sameOrigin = false;
        info.accessError = String(err);
      }

      return info;
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(process.cwd(), "debug-logs");
  fs.mkdirSync(outDir, { recursive: true });

  const fileStamp = stamp();
  const logFile = path.join(outDir, `proxy-session-${fileStamp}.txt`);
  const screenshotFile = path.join(outDir, `proxy-session-${fileStamp}.png`);

  const stream = fs.createWriteStream(logFile, { flags: "a" });
  const pageIds = new Map();
  const lastIframeSig = new Map();
  const attachedPages = new WeakSet();
  let nextPageId = 1;

  const log = (event, payload) => {
    const header = `[${nowIso()}] [${event}]`;
    if (payload === undefined) {
      stream.write(`${header}\n`);
      return;
    }
    const serialized = typeof payload === "string" ? payload : safeSerialize(payload);
    stream.write(`${header} ${redactText(serialized)}\n`);
  };

  const browser = await chromium.launch({
    headless: opts.headless,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  function getPageId(page) {
    if (!pageIds.has(page)) {
      pageIds.set(page, `p${nextPageId++}`);
    }
    return pageIds.get(page);
  }

  function attachPage(page) {
    if (attachedPages.has(page)) {
      return;
    }
    attachedPages.add(page);

    const pid = getPageId(page);
    log("page-attached", { page: pid, url: page.url() });

    page.on("framenavigated", (frame) => {
      log("frame-navigated", {
        page: pid,
        isMainFrame: frame === page.mainFrame(),
        name: frame.name(),
        url: frame.url(),
      });
    });

    page.on("request", (req) => {
      const url = req.url();
      const isInteresting =
        /api\/proxy|rapididentity|portal\.allenisd\.org|saml|authn|AuthnEngine/i.test(url) ||
        req.resourceType() === "document";
      if (!isInteresting) return;

      const body = req.postData();
      log("request", {
        page: pid,
        method: req.method(),
        resourceType: req.resourceType(),
        url,
        postData: body ? redactText(body) : undefined,
      });
    });

    page.on("response", async (res) => {
      const req = res.request();
      const url = res.url();
      const isInteresting =
        /api\/proxy|rapididentity|portal\.allenisd\.org|saml|authn|AuthnEngine/i.test(url) ||
        req.resourceType() === "document" ||
        res.status() >= 300;
      if (!isInteresting) return;

      log("response", {
        page: pid,
        status: res.status(),
        method: req.method(),
        resourceType: req.resourceType(),
        url,
        headers: summarizeHeaders(res.headers()),
      });
    });

    page.on("requestfailed", (req) => {
      const url = req.url();
      const isInteresting = /api\/proxy|rapididentity|portal\.allenisd\.org|saml|authn|AuthnEngine/i.test(url);
      if (!isInteresting) return;

      log("request-failed", {
        page: pid,
        method: req.method(),
        resourceType: req.resourceType(),
        url,
        error: req.failure()?.errorText || "unknown",
      });
    });

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "log" && !/api\/proxy|rapididentity|portal\.allenisd\.org|saml|authn|AuthnEngine|refused|ERR_/i.test(text)) {
        return;
      }
      log("console", {
        page: pid,
        type,
        text,
        location: msg.location(),
      });
    });

    page.on("pageerror", (err) => {
      log("page-error", {
        page: pid,
        message: err?.message || String(err),
      });
    });
  }

  context.on("page", attachPage);

  const page = await context.newPage();
  attachPage(page);

  log("session-start", {
    startUrl: opts.startUrl,
    headless: opts.headless,
    autoStopSeconds: opts.autoStopSeconds,
    cwd: process.cwd(),
    node: process.version,
    platform: process.platform,
  });

  await page.goto(opts.startUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  log("navigated", {
    page: getPageId(page),
    url: page.url(),
    title: await page.title(),
  });

  const poll = setInterval(async () => {
    try {
      for (const p of context.pages()) {
        const pid = getPageId(p);
        const iframes = await captureIframes(p);
        const sig = redactText(safeSerialize(iframes));
        if (lastIframeSig.get(pid) !== sig) {
          lastIframeSig.set(pid, sig);
          log("iframe-state", {
            page: pid,
            iframes,
          });
        }
      }
    } catch (err) {
      log("iframe-state-error", String(err));
    }
  }, 1500);

  let stopRequested = false;
  const stop = async (reason) => {
    if (stopRequested) return;
    stopRequested = true;
    clearInterval(poll);

    try {
      await page.screenshot({ path: screenshotFile, fullPage: true });
      log("screenshot", { path: screenshotFile });
    } catch (err) {
      log("screenshot-error", String(err));
    }

    const summary = [];
    for (const p of context.pages()) {
      summary.push({ page: getPageId(p), url: p.url(), title: await p.title().catch(() => "") });
    }
    log("session-summary", summary);
    log("session-end", { reason, logFile });

    await context.close();
    await browser.close();
    stream.end();

    process.stdout.write(`\nDebug capture written to:\n${logFile}\n`);
    process.stdout.write(`Screenshot written to:\n${screenshotFile}\n`);
  };

  process.on("SIGINT", () => {
    void stop("SIGINT");
  });

  if (opts.autoStopSeconds > 0) {
    process.stdout.write(
      `Capturing for ${opts.autoStopSeconds}s. Reproduce the issue now...\n`
    );
    setTimeout(() => {
      void stop("auto-stop");
    }, opts.autoStopSeconds * 1000);
  } else {
    process.stdout.write("Reproduce the issue in the opened browser, then press Enter here to stop capture.\n");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise((resolve) => {
      rl.question("Press Enter to stop capture... ", () => {
        rl.close();
        resolve();
      });
    });

    await stop("manual-stop");
  }
}

main().catch((err) => {
  const outDir = path.resolve(process.cwd(), "debug-logs");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `proxy-session-crash-${stamp()}.txt`);
  fs.writeFileSync(file, `${nowIso()}\n${String(err?.stack || err)}\n`, "utf8");
  process.stderr.write(`Capture script crashed. Details written to ${file}\n`);
  process.exit(1);
});
