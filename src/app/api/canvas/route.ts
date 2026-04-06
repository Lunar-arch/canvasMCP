import { NextRequest, NextResponse } from "next/server";
import { MacroStep } from "@/types";

export const maxDuration = 300;

// Unified browser abstraction so puppeteer and playwright share the same macro runner
interface BrowserPage {
  goto(url: string, opts?: { waitUntil?: string; timeout?: number }): Promise<void>;
  url(): string;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  press(selector: string, key: string): Promise<void>;
  waitForSelector(selector: string, opts?: { timeout?: number }): Promise<void>;
  waitForNavigation(opts?: { waitUntil?: string; timeout?: number }): Promise<void>;
  waitForUrl(pattern: string, opts?: { timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
}

interface BrowserSession {
  pages: () => BrowserPage[];
  activePage: () => BrowserPage;
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
  engine: "puppeteer" | "playwright";
}

// ---------- Puppeteer Stealth ----------
async function launchPuppeteer(): Promise<BrowserSession> {
  const puppeteerExtra = (await import("puppeteer-extra")).default;
  const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
  puppeteerExtra.use(StealthPlugin());

  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
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
        const cleanPattern = pattern.replace(/\*\*/g, "").replace(/\*/g, "");
        while (Date.now() - start < timeout) {
          // Check all pages in the browser
          const browserPages = await browser.pages();
          for (const bp of browserPages) {
            if (bp.url().includes(cleanPattern)) {
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
  const browser = await chromium.launch({ headless: false });
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
        const rawUrl = pattern;
        if (rawUrl.includes("*")) {
          await p.waitForURL(rawUrl, { timeout, waitUntil: "domcontentloaded" });
        } else {
          // Poll across all context pages
          const start = Date.now();
          const clean = rawUrl.replace(/\/+$/, "");
          while (Date.now() - start < timeout) {
            for (const cp of context.pages()) {
              if (cp.url().startsWith(clean)) {
                active = wrapPage(cp);
                return;
              }
            }
            await p.waitForTimeout(500);
          }
          throw new Error(`Timeout waiting for URL: ${rawUrl}`);
        }
      },
      waitForTimeout: (ms) => p.waitForTimeout(ms),
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
  portalUrl: string
) {
  // Backstop: if the macro has no explicit navigate step, open the portal first.
  if (!steps.some((step) => step.action === "navigate")) {
    await session.activePage().goto(portalUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
  }

  for (const step of steps) {
    const page = session.activePage();

    switch (step.action) {
      case "navigate":
        await page.goto(step.url || portalUrl, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        break;
      case "fill": {
        let value = step.value || "";
        value = value
          .replace("{{username}}", username)
          .replace("{{password}}", password);
        await page.type(step.selector!, value);
        break;
      }
      case "click":
        await page.click(step.selector!, { timeout: 10000 });
        break;
      case "press":
        await page.press(step.selector || "body", step.key || "Enter");
        break;
      case "wait": {
        const waitType = step.waitType || "duration";
        const timeout = step.waitTime || 30000;

        switch (waitType) {
          case "url":
            await page.waitForUrl(step.waitUrl || "**", { timeout });
            break;
          case "selector":
            await page.waitForSelector(step.waitSelector || "body", { timeout });
            break;
          case "navigation":
            await page.waitForNavigation({ waitUntil: "networkidle", timeout });
            break;
          case "duration":
          default:
            await page.waitForTimeout(step.waitTime || 2000);
            break;
        }
        break;
      }
    }
  }
}

// ---------- API route ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, portalUrl, schoolName, macroSteps } = body as {
      username: string;
      password: string;
      portalUrl: string;
      schoolName: string;
      macroSteps: MacroStep[];
    };

    // Try puppeteer-stealth first, fall back to playwright
    let session: BrowserSession;
    try {
      session = await launchPuppeteer();
      console.log("[canvas-sync] Using puppeteer-stealth");
    } catch (puppeteerErr) {
      console.warn("[canvas-sync] Puppeteer failed, falling back to Playwright:", puppeteerErr);
      session = await launchPlaywright();
      console.log("[canvas-sync] Using playwright fallback");
    }

    try {
      // Execute login macro
      await runMacro(session, macroSteps, username, password, portalUrl);

      // Brief pause then check for Canvas page
      await session.activePage().waitForTimeout(3000);

      const baseUrl = `https://${schoolName}.instructure.com`;
      let page = session.activePage();

      // Check if any tab is already on Canvas
      const canvasPage = session.pages().find((p) =>
        p.url().includes(`${schoolName}.instructure.com`)
      );
      if (canvasPage) {
        page = canvasPage;
      }

      // Navigate to Canvas if not already there
      if (!page.url().includes(`${schoolName}.instructure.com`)) {
        await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
      }

      // Wait for session cookies to settle
      await page.waitForTimeout(3000);

      // Fetch courses via API
      const apiPage = await session.newPage();
      await apiPage.goto(
        `${baseUrl}/api/v1/courses?per_page=100&enrollment_state=active`,
        { waitUntil: "networkidle", timeout: 30000 }
      );
      const coursesText = await apiPage.evaluate(() => document.body.innerText);
      let courses = [];
      try {
        courses = JSON.parse(coursesText);
      } catch {
        await session.close();
        return NextResponse.json(
          {
            error: "Failed to parse courses. Login may have failed.",
            raw: coursesText.substring(0, 500),
          },
          { status: 400 }
        );
      }

      if (!Array.isArray(courses)) {
        await session.close();
        const raw = coursesText.substring(0, 500);
        const errorMsg =
          typeof courses === "object" && courses !== null
            ? (courses as Record<string, unknown>).errors ||
              (courses as Record<string, unknown>).status ||
              "Unexpected response"
            : "Unexpected response";
        return NextResponse.json(
          { error: `Canvas API error: ${JSON.stringify(errorMsg)}`, raw },
          { status: 400 }
        );
      }

      // Fetch assignments for each course
      const allAssignments = [];
      for (const course of courses) {
        try {
          await apiPage.goto(
            `${baseUrl}/api/v1/courses/${course.id}/assignments?per_page=100&order_by=due_at`,
            { waitUntil: "networkidle", timeout: 30000 }
          );
          const assignmentsText = await apiPage.evaluate(
            () => document.body.innerText
          );
          const assignments = JSON.parse(assignmentsText);
          if (Array.isArray(assignments)) {
            for (const a of assignments) {
              allAssignments.push({
                ...a,
                course_id: course.id,
                course_name: course.name,
              });
            }
          }
        } catch {
          // Skip courses with errors
        }
      }

      await session.close();

      return NextResponse.json({
        engine: session.engine,
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
      });
    } catch (error) {
      await session.close();
      throw error;
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
