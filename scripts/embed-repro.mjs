import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const TEST_URL = 'file:///c:/Users/Nathan/Git/canvasMCP/public/studyflow-embed-fetch.html';
const SCREENSHOT_PATH = 'debug-logs/embed-repro.png';

const consoleEvents = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on('console', (msg) => {
  const location = msg.location();
  consoleEvents.push({
    type: msg.type(),
    text: msg.text(),
    location: location && location.url ? location : undefined,
  });
});

page.on('pageerror', (error) => {
  pageErrors.push(error?.stack || error?.message || String(error));
});

await page.goto(TEST_URL, { waitUntil: 'load' });
await page.fill('#origin', 'https://canvas-mcp-lemon.vercel.app');
await page.selectOption('#target', '/');
await page.click('#load');

await page.waitForTimeout(15000);

const iframeSrc = await page.$eval('#studyflow-frame', (el) => el.getAttribute('src') || '');

let iframeTitle = '';
let iframeBodyPreview = '';
let iframeReadError = '';

try {
  const iframeHandle = await page.$('#studyflow-frame');
  const frame = await iframeHandle?.contentFrame();

  if (!frame) {
    throw new Error('iframe contentFrame unavailable');
  }

  iframeTitle = await frame.title();

  const bodyText = await frame.locator('body').innerText({ timeout: 5000 });
  iframeBodyPreview = bodyText.replace(/\s+/g, ' ').trim().slice(0, 300);
} catch (error) {
  iframeReadError = error?.message || String(error);
}

const hostLogText = await page.$eval('#log', (el) => (el.textContent || '').replace(/\s+/g, ' ').trim());

await fs.mkdir('debug-logs', { recursive: true });
await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

await context.close();
await browser.close();

console.log(
  JSON.stringify(
    {
      testUrl: TEST_URL,
      consoleEvents,
      pageErrors,
      iframeSrc,
      iframeTitle,
      iframeBodyPreview,
      iframeReadError,
      hostLogText,
      screenshotPath: SCREENSHOT_PATH,
    },
    null,
    2,
  ),
);
