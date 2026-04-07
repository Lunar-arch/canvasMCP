const { chromium } = require('playwright');

(async () => {
  const requestFailedLogs = [];
  const staticResponses = [];
  const consoleErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const entry = {
      method: request.method(),
      url: request.url(),
      errorText: failure ? failure.errorText : 'unknown',
    };
    requestFailedLogs.push(entry);
    console.log(`[requestfailed] ${entry.method} ${entry.url} :: ${entry.errorText}`);
  });

  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/_next/static/')) {
      return;
    }
    const headers = response.headers();
    const contentType = headers['content-type'] || '(missing)';
    const entry = {
      status: response.status(),
      contentType,
      url,
    };
    staticResponses.push(entry);
    console.log(`[static] ${entry.status} ${entry.contentType} ${entry.url}`);
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') {
      return;
    }
    const text = msg.text();
    consoleErrors.push(text);
    console.log(`[console.error] ${text}`);
  });

  const localFileUrl = 'file:///c:/Users/Nathan/Git/canvasMCP/public/studyflow-embed-fetch.html';
  console.log(`Opening: ${localFileUrl}`);
  await page.goto(localFileUrl, { waitUntil: 'domcontentloaded' });

  await page.fill('#origin', 'https://canvas-mcp-lemon.vercel.app');
  await page.selectOption('#target', '/');
  console.log('Set origin=https://canvas-mcp-lemon.vercel.app and target=/');

  await page.click('#load');
  console.log('Clicked "Stream + Load"; waiting 12s...');
  await page.waitForTimeout(12000);

  const iframeLocator = page.locator('#studyflow-frame');
  const iframeSrc = await iframeLocator.getAttribute('src');
  console.log(`iframe src attribute: ${iframeSrc || '(empty)'}`);

  const iframeHandle = await iframeLocator.elementHandle();
  const frame = iframeHandle ? await iframeHandle.contentFrame() : null;
  if (!frame) {
    console.log('iframe URL: (frame not available)');
  } else {
    console.log(`iframe URL: ${frame.url()}`);

    try {
      const iframeInfo = await frame.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]')).map((el) => el.getAttribute('src') || '');
        return {
          readyState: document.readyState,
          scriptCount: scripts.length,
          first8Scripts: scripts.slice(0, 8),
          bodyClassName: document.body ? document.body.className : '(no body)',
          bodyChildCount: document.body ? document.body.children.length : 0,
          innerTextLength: document.body && typeof document.body.innerText === 'string' ? document.body.innerText.length : 0,
          spinnerExists: !!document.querySelector('.animate-spin'),
        };
      });

      console.log(`iframe document.readyState: ${iframeInfo.readyState}`);
      console.log(`iframe script[src] count: ${iframeInfo.scriptCount}`);
      console.log(`iframe first 8 script srcs: ${JSON.stringify(iframeInfo.first8Scripts, null, 2)}`);
      console.log(`iframe body.className: ${JSON.stringify(iframeInfo.bodyClassName)}`);
      console.log(`iframe body child count: ${iframeInfo.bodyChildCount}`);
      console.log(`iframe innerText length: ${iframeInfo.innerTextLength}`);
      console.log(`iframe spinner (.animate-spin) exists: ${iframeInfo.spinnerExists}`);
    } catch (error) {
      console.log(`iframe inspection error: ${error && error.message ? error.message : String(error)}`);
    }
  }

  console.log('--- requestfailed summary ---');
  if (requestFailedLogs.length === 0) {
    console.log('No requestfailed entries');
  } else {
    requestFailedLogs.forEach((entry, i) => {
      console.log(`#${i + 1} ${entry.method} ${entry.url} :: ${entry.errorText}`);
    });
  }

  console.log('--- /_next/static/ response summary ---');
  if (staticResponses.length === 0) {
    console.log('No /_next/static/ responses captured');
  } else {
    staticResponses.forEach((entry, i) => {
      console.log(`#${i + 1} ${entry.status} ${entry.contentType} ${entry.url}`);
    });
  }

  console.log('--- console.error summary ---');
  if (consoleErrors.length === 0) {
    console.log('No console errors captured');
  } else {
    consoleErrors.forEach((text, i) => {
      console.log(`#${i + 1} ${text}`);
    });
  }

  await browser.close();
})().catch((error) => {
  console.error('Fatal script error:', error);
  process.exitCode = 1;
});
