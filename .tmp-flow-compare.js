const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function readEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function interesting(url) {
  return /api\/rest\/v2\/authn|idp\/authn\/idauto|idp\/profile\/SAML2\/Redirect\/SSO|\/saml\/acs|\/login|\/p\/portal|aisd-tx\.us001-rapididentity\.com\/$|portal\.allenisd\.org\/p\/portal|api\/proxy\?url=/i.test(url);
}

async function runFlow(label, startUrl, username, password) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  const events = [];
  page.on('response', (res) => {
    const url = res.url();
    if (!interesting(url)) return;
    const req = res.request();
    const headers = res.headers();
    events.push({
      status: res.status(),
      method: req.method(),
      url,
      location: headers.location || '',
      contentType: headers['content-type'] || '',
    });
  });

  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

  const user = page.getByRole('textbox', { name: 'Username' });
  await user.waitFor({ state: 'visible', timeout: 90000 });
  await user.fill(username);
  await page.getByRole('button', { name: /^Go$/ }).first().click();

  const pass = page.getByRole('textbox', { name: 'Password' });
  await pass.waitFor({ state: 'visible', timeout: 90000 });
  await pass.fill(password);
  await page.getByRole('button', { name: /^Go$/ }).first().click();

  await page.waitForTimeout(5000);
  const title1 = await page.title().catch(() => '');
  if (/Password Authentication/i.test(title1) || /#\/authn$/i.test(page.url())) {
    await pass.press('Enter').catch(() => {});
  }

  await page.waitForTimeout(15000);
  const body = await page.locator('body').innerText().catch(() => '');

  const result = {
    label,
    finalUrl: page.url(),
    finalTitle: await page.title().catch(() => ''),
    bodyLen: body.length,
    bodyPreview: body.replace(/\s+/g, ' ').slice(0, 220),
    events,
  };

  await browser.close();
  return result;
}

(async () => {
  const env = readEnv(path.resolve('.env.local'));
  const username = env.USERNAME;
  const password = env.PASSWORD;
  if (!username || !password) throw new Error('Missing USERNAME/PASSWORD in .env.local');

  const direct = await runFlow('direct', 'https://portal.allenisd.org/login', username, password);
  const proxied = await runFlow('proxied', 'http://localhost:3000/api/proxy?url=' + encodeURIComponent('https://portal.allenisd.org/login'), username, password);

  console.log(JSON.stringify({ direct, proxied }, null, 2));
})();
