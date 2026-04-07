const { chromium } = require('playwright');

(async () => {
  const targetUrl = 'https://canvas-mcp-lemon.vercel.app/html?target=%2F';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[console.error] ${msg.text()}`);
    }
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    console.log(`[requestfailed] ${req.method()} ${req.url()} :: ${failure ? failure.errorText : 'unknown error'}`);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);

  const result = await page.evaluate(() => {
    const bodyText = document.body ? document.body.innerText : '';
    return {
      url: window.location.href,
      title: document.title,
      hasAnimateSpin: Boolean(document.querySelector('.animate-spin')),
      bodyLength: bodyText.length,
      bodyFirst200: bodyText.slice(0, 200),
    };
  });

  console.log(`current URL: ${result.url}`);
  console.log(`document.title: ${result.title}`);
  console.log(`.animate-spin exists: ${result.hasAnimateSpin}`);
  console.log(`body innerText length: ${result.bodyLength}`);
  console.log(`body innerText first 200 chars: ${JSON.stringify(result.bodyFirst200)}`);

  await browser.close();
})();
