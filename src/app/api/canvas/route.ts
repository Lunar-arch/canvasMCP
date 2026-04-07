import { NextRequest, NextResponse } from "next/server";
import { MacroStep } from "@/types";

export const maxDuration = 300;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const IS_VERCEL_ENV = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const ENABLE_PLAYWRIGHT_FALLBACK =
  process.env.ENABLE_PLAYWRIGHT_FALLBACK === "1" ||
  process.env.ENABLE_PLAYWRIGHT_FALLBACK === "true";

function getRemoteBrowserWSEndpoint(): string | null {
  const candidates = [
    process.env.BROWSER_WS_ENDPOINT,
    process.env.BROWSERLESS_WS_ENDPOINT,
    process.env.PUPPETEER_WS_ENDPOINT,
  ];

  for (const candidate of candidates) {
    const value = (candidate || "").trim();
    if (value) return value;
  }

  return null;
}

function withCors(response: Response): Response {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// Unified browser abstraction so puppeteer and playwright share the same macro runner
interface BrowserPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<void>;
  url(): string;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  press(selector: string, key: string): Promise<void>;
  textContent(selector: string): Promise<string | null>;
  waitForSelector(selector: string, opts?: { timeout?: number }): Promise<void>;
  waitForNavigation(opts?: { waitUntil?: string; timeout?: number }): Promise<void>;
  waitForUrl(pattern: string, opts?: { timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(opts?: { fullPage?: boolean }): Promise<string>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
}

interface MacroDebugStep {
  stepNumber: number;
  action: MacroStep["action"];
  label: string;
  status: "success" | "error";
  detail?: string;
  url?: string;
  error?: string;
  screenshotDataUrl?: string;
}

interface BrowserSession {
  pages: () => BrowserPage[];
  activePage: () => BrowserPage;
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
  engine: "puppeteer" | "playwright";
}

type LogLevel = "info" | "success" | "warn" | "error";

type CanvasProgressEvent =
  | { type: "log"; level: LogLevel; msg: string; time: string }
  | { type: "debugStep"; step: MacroDebugStep };

type CanvasProgressEmitter = (event: CanvasProgressEvent) => void;

type CanvasRunInput = {
  username: string;
  password: string;
  portalUrl: string;
  schoolName: string;
  macroSteps: MacroStep[];
};

type CanvasRunPayload = {
  engine: BrowserSession["engine"];
  debugSteps: MacroDebugStep[];
  courses: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
};

type CanvasRouteError = Error & {
  status?: number;
  debugSteps?: MacroDebugStep[];
  raw?: string;
};

function emitLog(
  emit: CanvasProgressEmitter | undefined,
  msg: string,
  level: LogLevel = "info"
) {
  emit?.({
    type: "log",
    level,
    msg,
    time: new Date().toLocaleTimeString(),
  });
}

function createRouteError(
  message: string,
  status: number,
  debugSteps: MacroDebugStep[] = [],
  raw?: string
): CanvasRouteError {
  const error = new Error(message) as CanvasRouteError;
  error.status = status;
  error.debugSteps = debugSteps;
  if (raw) error.raw = raw;
  return error;
}

function toRouteError(error: unknown): CanvasRouteError {
  if (error instanceof Error) {
    return error as CanvasRouteError;
  }
  const wrapped = new Error(String(error ?? "Unknown error occurred")) as CanvasRouteError;
  wrapped.status = 500;
  return wrapped;
}

function normalizeUrlValue(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function matchesUrlPattern(currentUrl: string, pattern: string): boolean {
  const rawPattern = pattern.trim();
  if (!rawPattern || rawPattern === "*" || rawPattern === "**") return true;

  const normalizedCurrent = normalizeUrlValue(currentUrl);
  const cleanedPattern = rawPattern.replace(/\*+/g, "");
  const normalizedPattern = normalizeUrlValue(cleanedPattern);

  if (!normalizedPattern) return true;
  if (normalizedCurrent.includes(normalizedPattern)) return true;

  const current = tryParseUrl(currentUrl);
  const patternCandidate = /^https?:\/\//i.test(cleanedPattern)
    ? cleanedPattern
    : `https://${cleanedPattern.replace(/^\/+/, "")}`;
  const expected = tryParseUrl(patternCandidate);

  if (current && expected) {
    const currentPath = normalizeUrlValue(current.pathname || "/");
    const expectedPath = normalizeUrlValue(expected.pathname || "/");
    if (current.hostname === expected.hostname) {
      if (!expectedPath || expectedPath === "/") return true;
      if (currentPath === expectedPath) return true;
      if (currentPath.startsWith(`${expectedPath}/`)) return true;
    }
  }

  const currentNoProtocol = normalizedCurrent.replace(/^https?:\/\//, "");
  const patternNoProtocol = normalizedPattern.replace(/^https?:\/\//, "");
  return currentNoProtocol.includes(patternNoProtocol);
}

// ---------- Puppeteer Stealth ----------
async function launchPuppeteer(): Promise<BrowserSession> {
  const puppeteerExtra = (await import("puppeteer-extra")).default;
  const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
  puppeteerExtra.use(StealthPlugin());

  const remoteWSEndpoint = getRemoteBrowserWSEndpoint();
  const browser = remoteWSEndpoint
    ? await puppeteerExtra.connect({ browserWSEndpoint: remoteWSEndpoint })
    : await puppeteerExtra.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1920,1080",
          ...(IS_VERCEL_ENV ? ["--disable-dev-shm-usage"] : []),
        ],
        defaultViewport: { width: 1920, height: 1080 },
      });

  const allPages: BrowserPage[] = [];
  let active: BrowserPage;

  const wrapPage = (p: Awaited<ReturnType<typeof browser.newPage>>): BrowserPage => {
    const wrapped: BrowserPage = {
      goto: async (url, opts) => {
        const wuMap: Record<string, "load" | "domcontentloaded" | "networkidle0" | "networkidle2"> = {
          load: "load",
          domcontentloaded: "domcontentloaded",
          networkidle: "networkidle0",
        };
        await p.goto(url, {
          waitUntil: wuMap[opts?.waitUntil || "load"] || "load",
          timeout: opts?.timeout ?? 30000,
        });
      },
      url: () => p.url(),
      click: async (sel, opts) => {
        await p.waitForSelector(sel, { timeout: opts?.timeout ?? 10000 });
        await p.click(sel);
      },
      type: async (sel, text) => {
        await p.waitForSelector(sel, { timeout: 10000 });
        // Clear existing value first
        await p.click(sel, { count: 3 });
        await p.type(sel, text);
      },
      press: async (sel, key) => {
        if (sel && sel !== "body") {
          await p.waitForSelector(sel, { timeout: 10000 });
          await p.focus(sel);
        }
        await p.keyboard.press(key as Parameters<typeof p.keyboard.press>[0]);
      },
      textContent: async (sel) => {
        try {
          const value = await p.$eval(sel, (el) => (el.textContent || "").trim());
          return value;
        } catch {
          return null;
        }
      },
      waitForSelector: async (sel, opts) => {
        await p.waitForSelector(sel, { timeout: opts?.timeout ?? 30000 });
      },
      waitForNavigation: async (opts) => {
        const wuMap: Record<string, "load" | "domcontentloaded" | "networkidle0" | "networkidle2"> = {
          load: "load",
          domcontentloaded: "domcontentloaded",
          networkidle: "networkidle0",
        };
        await p.waitForNavigation({
          waitUntil: wuMap[opts?.waitUntil || "networkidle"] || "networkidle0",
          timeout: opts?.timeout ?? 30000,
        });
      },
      waitForUrl: async (pattern, opts) => {
        const timeout = opts?.timeout ?? 30000;
        const start = Date.now();
        while (Date.now() - start < timeout) {
          // Check all pages in the browser
          const browserPages = await browser.pages();
          for (const bp of browserPages) {
            if (matchesUrlPattern(bp.url(), pattern)) {
              const w = wrapPage(bp);
              active = w;
              if (!allPages.includes(w)) allPages.push(w);
              return;
            }
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        throw new Error(`Timeout waiting for URL matching: ${pattern}`);
      },
      waitForTimeout: (ms) => new Promise((r) => setTimeout(r, ms)),
      screenshot: async (opts) => {
        const image = (await p.screenshot({
          type: "jpeg",
          quality: 55,
          fullPage: opts?.fullPage ?? false,
          encoding: "base64",
        })) as string;
        return `data:image/jpeg;base64,${image}`;
      },
      evaluate: (fn) => p.evaluate(fn),
      close: () => p.close(),
    };
    return wrapped;
  };

  // Listen for new targets (new tabs)
  browser.on("targetcreated", async (target) => {
    if (target.type() === "page") {
      const newPage = await target.page();
      if (newPage) {
        const w = wrapPage(newPage);
        allPages.push(w);
        active = w;
      }
    }
  });

  const firstPage = (await browser.pages())[0] || (await browser.newPage());
  active = wrapPage(firstPage);
  allPages.push(active);

  return {
    pages: () => [...allPages],
    activePage: () => active,
    newPage: async () => {
      const p = await browser.newPage();
      const w = wrapPage(p);
      allPages.push(w);
      active = w;
      return w;
    },
    close: () => browser.close(),
    engine: "puppeteer",
  };
}

// ---------- Playwright fallback ----------
async function launchPlaywright(): Promise<BrowserSession> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  const allPages: BrowserPage[] = [];
  let active: BrowserPage;

  const wrapPage = (p: Awaited<ReturnType<typeof context.newPage>>): BrowserPage => {
    const wrapped: BrowserPage = {
      goto: async (url, opts) => {
        await p.goto(url, {
          waitUntil: (opts?.waitUntil as "load" | "domcontentloaded" | "networkidle") || "load",
          timeout: opts?.timeout ?? 30000,
        });
      },
      url: () => p.url(),
      click: async (sel, opts) => await p.click(sel, { timeout: opts?.timeout ?? 10000 }),
      type: async (sel, text) => await p.fill(sel, text),
      press: async (sel, key) => await p.press(sel || "body", key),
      textContent: async (sel) => {
        try {
          const value = await p.locator(sel).first().textContent({ timeout: 3000 });
          return value ? value.trim() : null;
        } catch {
          return null;
        }
      },
      waitForSelector: async (sel, opts) => {
        await p.waitForSelector(sel, { timeout: opts?.timeout ?? 30000 });
      },
      waitForNavigation: async (opts) => {
        await p.waitForLoadState(
          (opts?.waitUntil as "load" | "domcontentloaded" | "networkidle") || "networkidle",
          { timeout: opts?.timeout ?? 30000 }
        );
      },
      waitForUrl: async (pattern, opts) => {
        const timeout = opts?.timeout ?? 30000;
        const start = Date.now();
        while (Date.now() - start < timeout) {
          for (const cp of context.pages()) {
            if (matchesUrlPattern(cp.url(), pattern)) {
              active = wrapPage(cp);
              return;
            }
          }
          await p.waitForTimeout(500);
        }
        throw new Error(`Timeout waiting for URL matching: ${pattern}`);
      },
      waitForTimeout: (ms) => p.waitForTimeout(ms),
      screenshot: async (opts) => {
        const buffer = await p.screenshot({
          type: "jpeg",
          quality: 55,
          fullPage: opts?.fullPage ?? false,
        });
        return `data:image/jpeg;base64,${buffer.toString("base64")}`;
      },
      evaluate: (fn) => p.evaluate(fn),
      close: () => p.close(),
    };
    return wrapped;
  };

  context.on("page", (newPage) => {
    const w = wrapPage(newPage);
    allPages.push(w);
    active = w;
  });

  const firstPage = await context.newPage();
  active = wrapPage(firstPage);
  allPages.push(active);

  return {
    pages: () => [...allPages],
    activePage: () => active,
    newPage: async () => {
      const p = await context.newPage();
      const w = wrapPage(p);
      allPages.push(w);
      active = w;
      return w;
    },
    close: () => browser.close(),
    engine: "playwright",
  };
}

// ---------- Macro runner ----------
async function runMacro(
  session: BrowserSession,
  steps: MacroStep[],
  username: string,
  password: string,
  portalUrl: string,
  debugSteps: MacroDebugStep[],
  emit?: CanvasProgressEmitter
) {
  const resolveTemplate = (input?: string) => {
    if (!input) return "";
    return input
      .replaceAll("{{username}}", username)
      .replaceAll("{{password}}", password)
      .replaceAll("{{portalUrl}}", portalUrl);
  };

  const toNavigableUrl = (input?: string) => {
    const resolved = resolveTemplate(input) || portalUrl;
    if (!resolved) {
      throw new Error("Missing portal URL for navigation");
    }
    return /^https?:\/\//i.test(resolved) ? resolved : `https://${resolved}`;
  };

  const stepById = new Map<string, MacroStep>();
  const childrenByParent = new Map<string, MacroStep[]>();
  const topLevelSteps: MacroStep[] = [];

  steps.forEach((step) => {
    stepById.set(step.id, step);
  });

  steps.forEach((step) => {
    if (step.parentIfId && stepById.has(step.parentIfId)) {
      if (!childrenByParent.has(step.parentIfId)) {
        childrenByParent.set(step.parentIfId, []);
      }
      childrenByParent.get(step.parentIfId)!.push(step);
    } else {
      topLevelSteps.push(step);
    }
  });

  const stepChildren = (stepId: string) => childrenByParent.get(stepId) || [];

  const checkElementExists = async (page: BrowserPage, selector: string) => {
    try {
      await page.waitForSelector(selector, { timeout: 1200 });
      return true;
    } catch {
      return false;
    }
  };

  const compareText = (left: string, right: string, caseSensitive: boolean) => {
    if (caseSensitive) {
      return { left, right };
    }
    return { left: left.toLowerCase(), right: right.toLowerCase() };
  };

  const evaluateIfCondition = async (step: MacroStep, page: BrowserPage) => {
    const conditionType = step.ifConditionType || "always";
    const target = resolveTemplate(step.ifTarget || "").trim();
    const expected = resolveTemplate(step.ifValue || "");
    const caseSensitive = Boolean(step.ifCaseSensitive);
    const currentUrl = page.url();

    switch (conditionType) {
      case "always":
        return {
          passed: true,
          detail: "If condition matched: always",
        };
      case "urlIncludes": {
        if (!target) {
          return { passed: false, detail: "If skipped: URL fragment is empty" };
        }
        const compared = compareText(currentUrl, target, caseSensitive);
        const passed = compared.left.includes(compared.right);
        return {
          passed,
          detail: passed
            ? `If condition matched: URL includes ${target}`
            : `If condition not met: URL does not include ${target}`,
        };
      }
      case "urlMatches": {
        if (!target) {
          return { passed: false, detail: "If skipped: URL pattern is empty" };
        }
        const passed = matchesUrlPattern(currentUrl, target);
        return {
          passed,
          detail: passed
            ? `If condition matched: URL matches ${target}`
            : `If condition not met: URL does not match ${target}`,
        };
      }
      case "elementExists": {
        if (!target) {
          return { passed: false, detail: "If skipped: selector is empty" };
        }
        const passed = await checkElementExists(page, target);
        return {
          passed,
          detail: passed
            ? `If condition matched: element exists (${target})`
            : `If condition not met: element missing (${target})`,
        };
      }
      case "elementNotExists": {
        if (!target) {
          return { passed: false, detail: "If skipped: selector is empty" };
        }
        const exists = await checkElementExists(page, target);
        const passed = !exists;
        return {
          passed,
          detail: passed
            ? `If condition matched: element not found (${target})`
            : `If condition not met: element exists (${target})`,
        };
      }
      case "elementTextContains": {
        if (!target) {
          return { passed: false, detail: "If skipped: selector is empty" };
        }
        const text = await page.textContent(target);
        if (text === null) {
          return {
            passed: false,
            detail: `If condition not met: element missing (${target})`,
          };
        }
        const compared = compareText(text, expected, caseSensitive);
        const passed = compared.left.includes(compared.right);
        return {
          passed,
          detail: passed
            ? `If condition matched: element text contains ${expected || "(empty)"}`
            : `If condition not met: element text does not contain ${expected || "(empty)"}`,
        };
      }
      case "elementTextEquals": {
        if (!target) {
          return { passed: false, detail: "If skipped: selector is empty" };
        }
        const text = await page.textContent(target);
        if (text === null) {
          return {
            passed: false,
            detail: `If condition not met: element missing (${target})`,
          };
        }
        const compared = compareText(text, expected, caseSensitive);
        const passed = compared.left === compared.right;
        return {
          passed,
          detail: passed
            ? `If condition matched: element text equals ${expected || "(empty)"}`
            : `If condition not met: element text does not equal ${expected || "(empty)"}`,
        };
      }
      default:
        return {
          passed: false,
          detail: "If condition not met: unknown condition",
        };
    }
  };

  let stepCounter = 0;

  const executeSteps = async (stepList: MacroStep[]) => {
    for (const step of stepList) {
      const page = session.activePage();
      const debugStep: MacroDebugStep = {
        stepNumber: ++stepCounter,
        action: step.action,
        label: step.label || `Step ${stepCounter}`,
        status: "success",
        url: page.url(),
      };
      let runChildren = false;

      try {
        switch (step.action) {
          case "if": {
            emitLog(emit, `Evaluating if block: ${step.label || "If block"}`);
            const evaluation = await evaluateIfCondition(step, page);
            debugStep.detail = evaluation.detail;
            runChildren = evaluation.passed;
            emitLog(emit, evaluation.detail, evaluation.passed ? "success" : "warn");
            break;
          }
          case "navigate": {
            const targetUrl = toNavigableUrl(step.url);
            emitLog(emit, `Navigating to ${targetUrl}`);
            await page.goto(targetUrl, {
              waitUntil: "networkidle",
              timeout: 30000,
            });
            debugStep.detail = `Navigated to ${session.activePage().url()}`;
            break;
          }
          case "newTab": {
            const targetUrl = toNavigableUrl(step.url);
            emitLog(emit, `Opening new tab ${targetUrl}`);
            const newPage = await session.newPage();
            await newPage.goto(targetUrl, {
              waitUntil: "networkidle",
              timeout: 30000,
            });
            debugStep.detail = `Opened new tab ${targetUrl}`;
            break;
          }
          case "switchTab": {
            const pattern = resolveTemplate(step.tabUrl) || "**";
            emitLog(emit, `Switching tab by URL pattern ${pattern}`);
            await page.waitForUrl(pattern, {
              timeout: 30000,
            });
            debugStep.detail = `Switched tab by URL pattern ${pattern}`;
            break;
          }
          case "fill": {
            const value = resolveTemplate(step.value);
            emitLog(emit, `Filling ${step.selector || "(missing selector)"}`);
            await page.type(step.selector!, value);
            debugStep.detail = `Filled ${step.selector || "(missing selector)"}`;
            break;
          }
          case "click":
            emitLog(emit, `Clicking ${step.selector || "(missing selector)"}`);
            await page.click(step.selector!, { timeout: 10000 });
            debugStep.detail = `Clicked ${step.selector || "(missing selector)"}`;
            break;
          case "press":
            emitLog(emit, `Pressing ${step.key || "Enter"} on ${step.selector || "body"}`);
            await page.press(step.selector || "body", step.key || "Enter");
            debugStep.detail = `Pressed ${step.key || "Enter"} on ${step.selector || "body"}`;
            break;
          case "wait": {
            const waitType = step.waitType || "duration";
            const timeout = step.waitTime || 30000;

            switch (waitType) {
              case "url": {
                const waitUrl = resolveTemplate(step.waitUrl) || "**";
                emitLog(emit, `Waiting for URL matching ${waitUrl}`);
                await page.waitForUrl(waitUrl, {
                  timeout,
                });
                debugStep.detail = `Waited for URL matching ${waitUrl}`;
                break;
              }
              case "selector":
                emitLog(emit, `Waiting for element ${step.waitSelector || "body"}`);
                await page.waitForSelector(step.waitSelector || "body", { timeout });
                debugStep.detail = `Waited for element ${step.waitSelector || "body"}`;
                break;
              case "navigation":
                emitLog(emit, "Waiting for page navigation");
                await page.waitForNavigation({ waitUntil: "networkidle", timeout });
                debugStep.detail = "Waited for page navigation";
                break;
              case "duration":
              default:
                emitLog(emit, `Waiting ${step.waitTime || 2000} ms`);
                await page.waitForTimeout(step.waitTime || 2000);
                debugStep.detail = `Waited ${step.waitTime || 2000} ms`;
                break;
            }
            break;
          }
        }

        const activePage = session.activePage();
        debugStep.url = activePage.url();

        if (step.action !== "wait") {
          try {
            debugStep.screenshotDataUrl = await activePage.screenshot();
            if (debugStep.screenshotDataUrl) {
              emitLog(emit, "Captured screenshot");
            }
          } catch (screenshotErr) {
            const screenshotMessage =
              screenshotErr instanceof Error ? screenshotErr.message : String(screenshotErr);
            debugStep.detail = debugStep.detail
              ? `${debugStep.detail} (screenshot failed: ${screenshotMessage})`
              : `Screenshot failed: ${screenshotMessage}`;
            emitLog(emit, `Screenshot failed: ${screenshotMessage}`, "warn");
          }
        }

        debugSteps.push(debugStep);
        emit?.({ type: "debugStep", step: debugStep });

        if (step.action === "if") {
          const children = stepChildren(step.id);
          if (runChildren && children.length > 0) {
            emitLog(
              emit,
              `Running ${children.length} nested step${children.length === 1 ? "" : "s"} in if block`
            );
            await executeSteps(children);
          } else if (!runChildren && children.length > 0) {
            emitLog(
              emit,
              `Skipping ${children.length} nested step${children.length === 1 ? "" : "s"} in if block`,
              "warn"
            );
          }
        }
      } catch (error) {
        debugStep.status = "error";
        debugStep.error = error instanceof Error ? error.message : String(error);
        debugStep.url = session.activePage().url();

        if (step.action !== "wait") {
          try {
            debugStep.screenshotDataUrl = await session.activePage().screenshot();
          } catch {
            // ignore screenshot failures in error path
          }
        }

        debugSteps.push(debugStep);
        emit?.({ type: "debugStep", step: debugStep });
        emitLog(emit, debugStep.error || "Action failed", "error");
        throw error;
      }
    }
  };

  // Backstop: if the macro has no explicit navigate step, open the portal first.
  if (!steps.some((step) => step.action === "navigate")) {
    const backstopUrl = toNavigableUrl(portalUrl);
    emitLog(emit, `Navigating to ${backstopUrl}`);
    await session.activePage().goto(backstopUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    emitLog(emit, `Navigated to ${session.activePage().url()}`, "success");
  }

  await executeSteps(topLevelSteps);
}

async function executeCanvasRun(
  input: CanvasRunInput,
  emit?: CanvasProgressEmitter
): Promise<CanvasRunPayload> {
  const { username, password, portalUrl, schoolName, macroSteps } = input;
  const debugSteps: MacroDebugStep[] = [];
  let session: BrowserSession | null = null;

  try {
    emitLog(emit, "Launching browser automation...");
    try {
      session = await launchPuppeteer();
      console.log(
        `[canvas-sync] Using puppeteer-stealth${getRemoteBrowserWSEndpoint() ? " (remote endpoint)" : ""}`
      );
    } catch (puppeteerErr) {
      if (IS_VERCEL_ENV) {
        throw createRouteError(
          "Puppeteer launch failed on Vercel. Set BROWSER_WS_ENDPOINT (or BROWSERLESS_WS_ENDPOINT / PUPPETEER_WS_ENDPOINT) to a remote Chromium service.",
          500,
          debugSteps,
          puppeteerErr instanceof Error ? puppeteerErr.message : String(puppeteerErr)
        );
      }

      if (!ENABLE_PLAYWRIGHT_FALLBACK) {
        throw createRouteError(
          "Puppeteer launch failed and Playwright fallback is disabled. Install Puppeteer browser binaries and set PUPPETEER_EXECUTABLE_PATH if needed, or enable Playwright fallback with ENABLE_PLAYWRIGHT_FALLBACK=1.",
          500,
          debugSteps,
          puppeteerErr instanceof Error ? puppeteerErr.message : String(puppeteerErr)
        );
      }

      console.warn("[canvas-sync] Puppeteer failed, falling back to Playwright:", puppeteerErr);
      session = await launchPlaywright();
      console.log("[canvas-sync] Using playwright fallback");
    }

    emitLog(emit, `Browser launched (${session.engine})`, "success");
    emitLog(emit, "Running login steps...");

    await runMacro(
      session,
      macroSteps,
      username,
      password,
      portalUrl,
      debugSteps,
      emit
    );

    emitLog(emit, "Login steps completed", "success");

    // Brief pause then check for Canvas page
    await session.activePage().waitForTimeout(3000);

    const baseUrl = `https://${schoolName}.instructure.com`;
    let page = session.activePage();

    emitLog(emit, "Checking authenticated Canvas tab...");

    // Check if any tab is already on Canvas
    const canvasPage = session.pages().find((p) =>
      p.url().includes(`${schoolName}.instructure.com`)
    );
    if (canvasPage) {
      page = canvasPage;
      emitLog(emit, `Using existing Canvas tab ${page.url()}`);
    }

    // Navigate to Canvas if not already there
    if (!page.url().includes(`${schoolName}.instructure.com`)) {
      emitLog(emit, `Navigating to Canvas ${baseUrl}`);
      await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
      emitLog(emit, `Navigated to Canvas ${page.url()}`, "success");
    }

    // Wait for session cookies to settle
    emitLog(emit, "Waiting for session cookies to settle...");
    await page.waitForTimeout(3000);

    // Fetch courses via API
    emitLog(emit, "Opening API tab to fetch courses...");
    const apiPage = await session.newPage();
    await apiPage.goto(
      `${baseUrl}/api/v1/courses?per_page=100&enrollment_state=active`,
      { waitUntil: "networkidle", timeout: 30000 }
    );
    const coursesText = await apiPage.evaluate(() => document.body.innerText);
    let courses: unknown = [];

    try {
      courses = JSON.parse(coursesText);
    } catch {
      throw createRouteError(
        "Failed to parse courses. Login may have failed.",
        400,
        debugSteps,
        coursesText.substring(0, 500)
      );
    }

    if (!Array.isArray(courses)) {
      const raw = coursesText.substring(0, 500);
      const errorMsg =
        typeof courses === "object" && courses !== null
          ? (courses as Record<string, unknown>).errors ||
            (courses as Record<string, unknown>).status ||
            "Unexpected response"
          : "Unexpected response";

      throw createRouteError(
        `Canvas API error: ${JSON.stringify(errorMsg)}`,
        400,
        debugSteps,
        raw
      );
    }

    emitLog(emit, `Fetched ${courses.length} course${courses.length === 1 ? "" : "s"}`, "success");

    // Fetch assignments for each course
    const allAssignments: Record<string, unknown>[] = [];
    for (const course of courses) {
      const courseRecord = course as Record<string, unknown>;
      const courseId = courseRecord.id;
      const courseName =
        typeof courseRecord.name === "string"
          ? courseRecord.name
          : `Course ${String(courseId)}`;

      try {
        emitLog(emit, `Fetching assignments for ${courseName}`);
        await apiPage.goto(
          `${baseUrl}/api/v1/courses/${courseId}/assignments?per_page=100&order_by=due_at`,
          { waitUntil: "networkidle", timeout: 30000 }
        );
        const assignmentsText = await apiPage.evaluate(
          () => document.body.innerText
        );
        const assignments = JSON.parse(assignmentsText);
        if (Array.isArray(assignments)) {
          for (const assignment of assignments) {
            allAssignments.push({
              ...(assignment as Record<string, unknown>),
              course_id: courseId,
              course_name: courseName,
            });
          }
        }
      } catch {
        emitLog(emit, `Skipped assignment fetch for ${courseName}`, "warn");
      }
    }

    emitLog(
      emit,
      `Fetched ${allAssignments.length} assignment${allAssignments.length === 1 ? "" : "s"}`,
      "success"
    );

    return {
      engine: session.engine,
      debugSteps,
      courses: courses.map((c: Record<string, unknown>) => ({
        id: c.id,
        name: c.name,
        course_code: c.course_code,
        enrollment_term_id: c.enrollment_term_id,
        start_at: c.start_at,
        end_at: c.end_at,
      })),
      assignments: allAssignments.map((a: Record<string, unknown>) => ({
        id: a.id,
        course_id: a.course_id,
        name: a.name,
        description:
          typeof a.description === "string"
            ? a.description.substring(0, 500)
            : null,
        due_at: a.due_at,
        points_possible: a.points_possible,
        submission_types: a.submission_types || [],
        html_url: a.html_url,
        has_submitted_submissions: a.has_submitted_submissions,
        course_name: a.course_name,
      })),
    };
  } catch (error) {
    const routeError = toRouteError(error);

    if (session) {
      try {
        const finalPage = session.activePage();
        const screenshotDataUrl = await finalPage.screenshot();
        const finalErrorStep: MacroDebugStep = {
          stepNumber: debugSteps.length + 1,
          action: "wait",
          label: "Final error snapshot",
          status: "error",
          detail: "Captured final screenshot before stopping",
          url: finalPage.url(),
          error: routeError.message,
          screenshotDataUrl,
        };
        debugSteps.push(finalErrorStep);
        emit?.({ type: "debugStep", step: finalErrorStep });
        emitLog(emit, "Captured final error screenshot", "warn");
      } catch {
        emitLog(emit, "Could not capture final error screenshot", "warn");
      }
    }

    if (!routeError.debugSteps) routeError.debugSteps = debugSteps;
    throw routeError;
  } finally {
    if (session) {
      await session.close().catch(() => {
        // ignore close errors
      });
      emitLog(emit, "Browser session closed");
    }
  }
}

// ---------- API route ----------
export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  let body: Partial<CanvasRunInput>;
  try {
    body = (await req.json()) as Partial<CanvasRunInput>;
  } catch {
    return withCors(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    );
  }

  const { username, password, portalUrl, schoolName, macroSteps } = body;
  if (
    !username ||
    !password ||
    !portalUrl ||
    !schoolName ||
    !Array.isArray(macroSteps)
  ) {
    return withCors(
      NextResponse.json(
        {
          error:
            "Missing required fields: username, password, portalUrl, schoolName, macroSteps",
        },
        { status: 400 }
      )
    );
  }

  const input: CanvasRunInput = {
    username,
    password,
    portalUrl,
    schoolName,
    macroSteps,
  };

  const streamMode = req.nextUrl.searchParams.get("stream") === "1";
  if (streamMode) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          const payload = await executeCanvasRun(input, (event) => send(event));
          send({ type: "result", payload });
        } catch (error) {
          const routeError = toRouteError(error);
          send({
            type: "error",
            error: routeError.message || "Unknown error occurred",
            debugSteps: routeError.debugSteps || [],
            raw: routeError.raw,
          });
        } finally {
          controller.close();
        }
      },
    });

    return withCors(new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }));
  }

  try {
    const payload = await executeCanvasRun(input);
    return withCors(NextResponse.json(payload));
  } catch (error) {
    const routeError = toRouteError(error);
    const response: Record<string, unknown> = {
      error: routeError.message || "Unknown error occurred",
      debugSteps: routeError.debugSteps || [],
    };
    if (routeError.raw) response.raw = routeError.raw;
    return withCors(
      NextResponse.json(response, { status: routeError.status || 500 })
    );
  }
}
