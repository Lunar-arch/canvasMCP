const { chromium } = require('playwright');

(async () => {
  const targetUrl = 'https://canvas-mcp-lemon.vercel.app/html?target=%2F';
  const consoleErrors = [];
  const requestFailures = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const line = `[console.error] ${msg.text()}`;
      consoleErrors.push(line);
      console.log(line);
    }
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    const line = `[requestfailed] ${req.method()} ${req.url()} :: ${failure ? failure.errorText : 'unknown error'}`;
    requestFailures.push(line);
    console.log(line);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);

  const info = await page.evaluate(() => {
    const text = document.body?.innerText ?? '';
    return {
      currentUrl: location.href,
      title: document.title,
      hasAnimateSpin: !!document.querySelector('.animate-spin'),
      bodyLen: text.length,
      bodyPreview: text.slice(0, 200),
    };
  });

  console.log(`current URL: ${info.currentUrl}`);
  console.log(`document.title: ${info.title}`);
  console.log(`.animate-spin exists: ${info.hasAnimateSpin}`);
  console.log(`body innerText length: ${info.bodyLen}`);
  console.log(`first 200 chars: ${JSON.stringify(info.bodyPreview)}`);

  if (consoleErrors.length === 0) {
    console.log('[console.error] none');
  }
  if (requestFailures.length === 0) {
    console.log('[requestfailed] none');
  }

  await browser.close();
})().catch((err) => {
  console.error(`Script failed: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
