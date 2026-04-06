import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type StoredCookie = {
  name: string;
  value: string;
  path: string;
};

type CookieJar = Map<string, Map<string, StoredCookie>>;
type ProxyFetchResult = {
  response: Response;
  finalUrl: string;
  redirectCount: number;
  lastRequestCookieHeader: string;
  lastRequestReferer: string;
};

// In-memory cookie jar per proxy session (dev-friendly; resets on server restart)
const sessionCookies = new Map<string, CookieJar>();
const SESSION_STORE_FILE = path.join(process.cwd(), ".proxy-session-store.json");
let sessionStoreLoaded = false;

function ensureSessionStoreLoaded() {
  if (sessionStoreLoaded) return;
  sessionStoreLoaded = true;

  try {
    if (!fs.existsSync(SESSION_STORE_FILE)) return;
    const raw = fs.readFileSync(SESSION_STORE_FILE, "utf8");
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<
      string,
      Record<string, Array<StoredCookie>>
    >;

    Object.entries(parsed).forEach(([sessionId, domains]) => {
      const jar: CookieJar = new Map();
      Object.entries(domains).forEach(([domain, cookies]) => {
        const perDomain = new Map<string, StoredCookie>();
        cookies.forEach((cookie) => {
          const safePath = cookie.path?.startsWith("/") ? cookie.path : "/";
          perDomain.set(`${cookie.name};${safePath}`, {
            name: cookie.name,
            value: cookie.value,
            path: safePath,
          });
        });
        if (perDomain.size > 0) {
          jar.set(domain, perDomain);
        }
      });
      if (jar.size > 0) {
        sessionCookies.set(sessionId, jar);
      }
    });
  } catch {
    // Ignore bad persisted state and continue with in-memory-only behavior.
  }
}

function persistSessionStore() {
  try {
    const out: Record<string, Record<string, Array<StoredCookie>>> = {};
    sessionCookies.forEach((jar, sessionId) => {
      const domains: Record<string, Array<StoredCookie>> = {};
      jar.forEach((cookies, domain) => {
        domains[domain] = Array.from(cookies.values());
      });
      out[sessionId] = domains;
    });

    fs.writeFileSync(SESSION_STORE_FILE, JSON.stringify(out), "utf8");
  } catch {
    // Best-effort persistence only.
  }
}

// Injected into every proxied HTML page — sends actions to parent via postMessage
const RECORDING_SCRIPT = `
(function(){
  'use strict';
  function sel(el){
    if(!el||el===document.body)return'body';
    if(el.id)return'#'+el.id;
    var n=el.getAttribute('name');
    if(n)return'[name="'+n.replace(/"/g,'\\"')+'"]';
    if(el.tagName==='INPUT'&&el.type&&el.type!=='text')return'input[type="'+el.type+'"]';
    var tag=el.tagName.toLowerCase();
    var par=el.parentElement;
    if(!par||par===document.documentElement)return tag;
    var sibs=[].filter.call(par.children,function(s){return s.tagName===el.tagName;});
    var sfx=sibs.length>1?':nth-of-type('+(sibs.indexOf(el)+1)+')':'';
    return(par!==document.body?sel(par)+' > ':'')+tag+sfx;
  }
  function send(data){try{window.parent.postMessage(data,'*');}catch(e){}}

  // Fill: record on blur with final value
  document.addEventListener('blur',function(e){
    var el=e.target;
    if(!'INPUT TEXTAREA SELECT'.split(' ').includes(el.tagName))return;
    if(!el.value)return;
    var isPass=el.type==='password';
    var isUser=!isPass&&(el.type==='email'||['username','email','user','login'].indexOf(el.name||'')>-1);
    send({type:'record',step:{
      action:'fill',
      selector:sel(el),
      value:isPass?'{{password}}':isUser?'{{username}}':el.value,
      label:'Fill '+(el.placeholder||el.name||el.id||'input')
    }});
  },true);

  // Click
  document.addEventListener('click',function(e){
    var el=e.target;
    var txt=(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40);
    send({type:'record',step:{
      action:'click',
      selector:sel(el),
      label:'Click '+(txt||el.id||el.tagName.toLowerCase())
    }});
  },true);

  // Key press (special keys only)
  document.addEventListener('keydown',function(e){
    if(['Enter','Tab','Escape'].indexOf(e.key)===-1)return;
    var active=document.activeElement;
    send({type:'record',step:{
      action:'press',
      key:e.key,
      selector:active&&active!==document.body?sel(active):undefined,
      label:'Press '+e.key
    }});
  },true);

  var current = window.__UPSTREAM_URL__ || window.location.href;
  send({type:'urlChange',url:current});
})();
`;

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function proxyHref(absolute: string): string {
  return `/api/proxy?url=${encodeURIComponent(absolute)}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);?/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);?/g, (_m, dec) =>
      String.fromCharCode(parseInt(dec, 10))
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function rewriteAttr(
  html: string,
  tags: string,
  attr: string,
  base: string,
  skip?: (v: string) => boolean
): string {
  // Support double-quoted, single-quoted, and unquoted attribute values
  const re = new RegExp(
    `(<(?:${tags})[^>]*\\s${attr}=)(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "gi"
  );
  return html.replace(re, (match, prefix, dq, sq, unq) => {
    const raw = dq !== undefined ? dq : sq !== undefined ? sq : unq;
    const quote = dq !== undefined ? '"' : sq !== undefined ? "'" : "";
    if (!raw) return match;
    const normalized = decodeHtmlEntities(raw).trim();
    if (!normalized) return match;
    if (
      normalized.startsWith("data:") ||
      normalized === "undefined" ||
      normalized.startsWith("javascript:") ||
      normalized.startsWith("mailto:") ||
      normalized.startsWith("#") ||
      normalized.startsWith("/api/proxy")
    )
      return match;
    if (skip && skip(normalized)) return match;
    const absolute = resolveUrl(base, normalized);
    if (quote) return `${prefix}${quote}${proxyHref(absolute)}${quote}`;
    return `${prefix}${proxyHref(absolute)}`;
  });
}

function rewriteMetaRefresh(html: string, baseUrl: string): string {
  return html.replace(/<meta[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)[^>]*>/gi, (meta) => {
    const contentMatch = meta.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/i);
    if (!contentMatch) return meta;
    const contentVal = contentMatch[1] ?? contentMatch[2] ?? contentMatch[3] ?? "";
    const parts = contentVal.split(";");
    const newParts = parts.map((part) => {
      const m = part.match(/^\s*url\s*=\s*(.*)$/i);
      if (!m) return part;
      let urlPart = m[1].trim().replace(/^['"]|['"]$/g, "");
      if (
        urlPart.startsWith("data:") ||
        urlPart.startsWith("javascript:") ||
        urlPart.startsWith("mailto:") ||
        urlPart.startsWith("#") ||
        urlPart.startsWith("/api/proxy")
      ) {
        return part;
      }
      const absolute = resolveUrl(baseUrl, urlPart);
      return part.replace(m[1], proxyHref(absolute));
    });
    const newContent = newParts.join(";");
    const quote = contentMatch[1] ? '"' : contentMatch[2] ? "'" : "";
    return meta.replace(contentMatch[0], `content=${quote}${newContent}${quote}`);
  });
}

function rewriteInlineScripts(html: string, baseUrl: string): string {
  // Rewrite JS location-redirect patterns inside inline <script> blocks.
  // Location.prototype.href is non-configurable in Chrome so client-side patching silently
  // fails — server-side rewriting is the only reliable approach.
  //
  // Handles both absolute (https://...) and root-relative (/path) URLs so ACS pages
  // using window.location = '/' don't resolve relative to the proxy origin.
  function rewriteUrl(url: string): string {
    // Skip already-proxied URLs and non-navigable schemes
    if (url.startsWith("/api/proxy?url=") || url.startsWith("javascript:") || url.startsWith("data:") || url.startsWith("#")) return url;
    return proxyHref(resolveUrl(baseUrl, url));
  }

  return html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, body) => {
    if (/\bsrc\s*=/i.test(attrs)) return match; // skip external scripts

    const rewritten = body
      // window.location.href = '...', location.href = '...', window.location = '...', location = '...'
      // Handles both "double" and 'single' quoted absolute and root-relative URLs
      .replace(
        /\b((?:window\.)?location(?:\.href)?)\s*=\s*"((?:https?:\/\/|\/)[^"]*)"/g,
        (_m: string, lhs: string, url: string) => `${lhs} = "${rewriteUrl(url)}"`
      )
      .replace(
        /\b((?:window\.)?location(?:\.href)?)\s*=\s*'((?:https?:\/\/|\/)[^']*)'/g,
        (_m: string, lhs: string, url: string) => `${lhs} = '${rewriteUrl(url)}'`
      )
      // location.assign('...'), location.replace('...')
      .replace(
        /\b(?:window\.)?location\.(assign|replace)\s*\(\s*"((?:https?:\/\/|\/)[^"]*)"\s*\)/g,
        (_m: string, method: string, url: string) => `location.${method}("${rewriteUrl(url)}")`
      )
      .replace(
        /\b(?:window\.)?location\.(assign|replace)\s*\(\s*'((?:https?:\/\/|\/)[^']*)'\s*\)/g,
        (_m: string, method: string, url: string) => `location.${method}('${rewriteUrl(url)}')`
      );

    return `<script${attrs}>${rewritten}</script>`;
  });
}

function rewriteHtml(html: string, baseUrl: string): string {
  // Links and form actions
  html = rewriteAttr(html, "a", "href", baseUrl);
  html = rewriteAttr(html, "form", "action", baseUrl);
  // Assets
  html = rewriteAttr(html, "script", "src", baseUrl);
  html = rewriteAttr(html, "link", "href", baseUrl);
  html = rewriteAttr(html, "img|source|video|audio", "src", baseUrl);
  // Embedded/nested documents and plugins
  html = rewriteAttr(html, "iframe|frame|embed", "src", baseUrl);
  html = rewriteAttr(html, "object", "data", baseUrl);
  // Inline <script> JS redirects (location.href / window.location = '...')
  html = rewriteInlineScripts(html, baseUrl);
  return html;
}

function rewriteJs(js: string, sourceUrl: string): string {
  function rewriteUrl(url: string): string {
    if (
      url.startsWith("/api/proxy?url=") ||
      url.startsWith("javascript:") ||
      url.startsWith("data:") ||
      url.startsWith("mailto:") ||
      url.startsWith("#")
    ) {
      return url;
    }
    return proxyHref(resolveUrl(sourceUrl, url));
  }

  // Keep external JS-driven hard navigations inside proxy.
  let rewritten = js
    .replace(
      /\b((?:window\.)?location(?:\.href)?)\s*=\s*"((?:https?:\/\/|\/)[^"]*)"/g,
      (_m: string, lhs: string, url: string) => `${lhs} = "${rewriteUrl(url)}"`
    )
    .replace(
      /\b((?:window\.)?location(?:\.href)?)\s*=\s*'((?:https?:\/\/|\/)[^']*)'/g,
      (_m: string, lhs: string, url: string) => `${lhs} = '${rewriteUrl(url)}'`
    )
    .replace(
      /\b(?:window\.)?location\.(assign|replace)\s*\(\s*"((?:https?:\/\/|\/)[^"]*)"\s*\)/g,
      (_m: string, method: string, url: string) =>
        `location.${method}("${rewriteUrl(url)}")`
    )
    .replace(
      /\b(?:window\.)?location\.(assign|replace)\s*\(\s*'((?:https?:\/\/|\/)[^']*)'\s*\)/g,
      (_m: string, method: string, url: string) =>
        `location.${method}('${rewriteUrl(url)}')`
    );

  // Special-case Identity Automation redirect script to keep login redirect inside proxy
  if (sourceUrl.includes("redirectToLogin.js")) {
    const origin = (() => {
      try {
        return new URL(sourceUrl).origin;
      } catch {
        return "";
      }
    })();

    // Keep the post-auth-redirect cookie value anchored to the upstream page URL,
    // not the localhost proxy URL, so downstream post-auth routing can resolve correctly.
    rewritten = rewritten.replace(
      /(?:const|let|var)\s+requestUrl\s*=\s*window\.location\.href\s*;?/g,
      "const requestUrl = (window.__UPSTREAM_URL__ || window.location.href);"
    );

    // Replace only the known login redirect line to avoid recursive or over-broad rewrites.
    rewritten = rewritten.replace(
      /window\.location\.href\s*=\s*contextPath\s*\+\s*["']\/login["']\s*;?/g,
      () =>
        `(() => {
          var cp = (typeof contextPath === 'string' ? contextPath : '') || '';
          if (cp.endsWith('/')) cp = cp.slice(0, -1);
          var loginPath = cp ? cp + '/login' : '/login';
          if (loginPath.indexOf('/api/proxy?url=') === 0) {
            window.location.href = loginPath;
            return;
          }
          var abs = new URL(loginPath, '${origin}').toString();
          window.location.href = '/api/proxy?url=' + encodeURIComponent(abs);
        })();`
    );

    return rewritten;
  }
  return js;
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const name = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!name) return;
    out[name] = value;
  });
  return out;
}

function normalizeUpstreamReferer(req: NextRequest, fallback: string): string {
  const rawReferer = req.headers.get("referer");
  if (!rawReferer) return fallback;

  try {
    const parsed = new URL(rawReferer, req.nextUrl.origin);
    if (parsed.pathname === "/api/proxy") {
      const upstream = parsed.searchParams.get("url");
      if (upstream) {
        return /^https?:\/\//i.test(upstream) ? upstream : `https://${upstream}`;
      }
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function getSetCookieValues(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  // Fallback split for combined Set-Cookie strings. Split only at actual cookie
  // boundaries (", <cookieName>=...") so Expires date commas remain intact.
  return raw
    .split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function storeSetCookies(
  jar: CookieJar,
  setCookies: string[],
  defaultHost: string
): boolean {
  let changed = false;
  setCookies.forEach((cookieStr) => {
    const parts = cookieStr.split(";").map((p) => p.trim());
    const nameValue = parts.shift();
    if (!nameValue) return;
    const eq = nameValue.indexOf("=");
    if (eq === -1) return;
    const name = nameValue.slice(0, eq).trim();
    const value = nameValue.slice(eq + 1).trim();
    if (!name) return;

    let domain = defaultHost;
    const domainAttr = parts.find((p) => /^domain=/i.test(p));
    if (domainAttr) {
      domain = domainAttr.split("=")[1]?.trim().toLowerCase() || defaultHost;
      if (domain.startsWith(".")) domain = domain.slice(1);
    }

    let path = "/";
    const pathAttr = parts.find((p) => /^path=/i.test(p));
    if (pathAttr) {
      const parsedPath = pathAttr.split("=")[1]?.trim();
      if (parsedPath) {
        path = parsedPath.startsWith("/") ? parsedPath : `/${parsedPath}`;
      }
    }

    const maxAgeAttr = parts.find((p) => /^max-age=/i.test(p));
    const expiresAttr = parts.find((p) => /^expires=/i.test(p));
    const maxAge = maxAgeAttr ? Number(maxAgeAttr.split("=")[1]) : undefined;
    const expiresAt = expiresAttr ? Date.parse(expiresAttr.split("=").slice(1).join("=")) : NaN;
    const isExpired =
      (Number.isFinite(maxAge) && (maxAge as number) <= 0) ||
      (!Number.isNaN(expiresAt) && expiresAt <= Date.now());

    if (!jar.has(domain)) jar.set(domain, new Map());
    const domainCookies = jar.get(domain)!;
    const cookieKey = `${name};${path}`;

    if (isExpired) {
      if (domainCookies.delete(cookieKey)) {
        changed = true;
      }
      return;
    }

    domainCookies.set(cookieKey, { name, value, path });
    changed = true;
  });

  return changed;
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (!cookiePath || cookiePath === "/") return true;
  if (requestPath === cookiePath) return true;
  return requestPath.startsWith(cookiePath.endsWith("/") ? cookiePath : `${cookiePath}/`);
}

function summarizeCookieNames(cookieHeader: string): string {
  if (!cookieHeader) return "";
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      return idx === -1 ? part : part.slice(0, idx);
    })
    .join(",")
    .slice(0, 256);
}

function buildUpstreamHeaders(
  req: NextRequest,
  referer: string,
  cookieHeader: string,
  origin?: string
): Record<string, string> {
  const headers: Record<string, string> = {};

  const blocked = new Set([
    "host",
    "content-length",
    "connection",
    "transfer-encoding",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "upgrade",
    "cookie",
    "referer",
    "origin",
  ]);

  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (blocked.has(lower)) return;
    headers[key] = value;
  });

  headers["Referer"] = referer;
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  if (origin) headers["Origin"] = origin;

  if (!headers["user-agent"] && !headers["User-Agent"]) {
    headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }

  return headers;
}

function buildCookieHeader(jar: CookieJar, host: string, requestPath: string): string {
  const selected: StoredCookie[] = [];
  jar.forEach((cookies, domain) => {
    if (host === domain || host.endsWith(`.${domain}`)) {
      cookies.forEach((cookie) => {
        selected.push(cookie);
      });
    }
  });

  // Browser-compatible ordering: longer/more-specific paths first.
  selected.sort((a, b) => b.path.length - a.path.length);
  return selected.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchWithRedirects(
  initialUrl: string,
  req: NextRequest,
  jar: CookieJar
): Promise<ProxyFetchResult> {
  let currentUrl = initialUrl;
  let redirectCount = 0;
  let referer = normalizeUpstreamReferer(req, initialUrl);
  let lastRequestCookieHeader = "";
  let lastRequestReferer = referer;

  while (true) {
    const current = new URL(currentUrl);
    const cookieHeader = buildCookieHeader(jar, current.hostname, current.pathname);
    const headers = buildUpstreamHeaders(req, referer, cookieHeader);
    lastRequestCookieHeader = cookieHeader;
    lastRequestReferer = referer;

    const response = await fetch(currentUrl, {
      headers,
      redirect: "manual",
    });

    const setCookies = getSetCookieValues(response.headers);
    if (setCookies.length > 0) {
      if (storeSetCookies(jar, setCookies, current.hostname)) {
        persistSessionStore();
      }
    }

    const location = response.headers.get("location");
    const isRedirect =
      response.status >= 300 && response.status < 400 && Boolean(location);

    if (!isRedirect) {
      return {
        response,
        finalUrl: currentUrl,
        redirectCount,
        lastRequestCookieHeader,
        lastRequestReferer,
      };
    }

    if (redirectCount >= 10) {
      throw new Error("Too many upstream redirects");
    }

    const nextUrl = resolveUrl(currentUrl, location!);
    referer = currentUrl;
    currentUrl = nextUrl;
    redirectCount += 1;
  }
}

async function handleProxy(req: NextRequest) {
  ensureSessionStoreLoaded();

  const inboundCookies = parseCookieHeader(req.headers.get("cookie") || "");
  let sessionId = inboundCookies["proxy-session"];
  let isNewSession = false;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    isNewSession = true;
  }
  if (!sessionCookies.has(sessionId)) {
    sessionCookies.set(sessionId, new Map());
    persistSessionStore();
  }
  const jar = sessionCookies.get(sessionId)!;

  let url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  // about:blank — return an empty page rather than trying to fetch it
  if (url.trim() === "about:blank") {
    return new NextResponse("<!DOCTYPE html><html><head></head><body></body></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Allow bare hosts like portal.allenisd.org by defaulting to https
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }
  void targetUrl;

  const method = req.method.toUpperCase();
  const debugMode = req.nextUrl.searchParams.get("__debug") === "1";

  try {
    let upstream: Response;
    let redirectCount = 0;
    let effectiveUpstreamUrl = targetUrl.toString();
    let lastOutboundCookieHeader = "";
    let lastOutboundReferer = "";

    if (method === "GET") {
      const result = await fetchWithRedirects(url, req, jar);
      upstream = result.response;
      redirectCount = result.redirectCount;
      lastOutboundCookieHeader = result.lastRequestCookieHeader;
      lastOutboundReferer = result.lastRequestReferer;
      effectiveUpstreamUrl =
        result.finalUrl || result.response.url || targetUrl.toString();
    } else {
      const cookieHeader = buildCookieHeader(jar, targetUrl.hostname, targetUrl.pathname);
      const normalizedReferer = normalizeUpstreamReferer(req, targetUrl.toString());
      lastOutboundCookieHeader = cookieHeader;
      lastOutboundReferer = normalizedReferer;
      const upstreamHeaders = buildUpstreamHeaders(
        req,
        normalizedReferer,
        cookieHeader,
        targetUrl.origin
      );

      const body =
        method === "HEAD" || method === "OPTIONS"
          ? undefined
          : await req.arrayBuffer();

      upstream = await fetch(targetUrl.toString(), {
        method,
        headers: upstreamHeaders,
        body: body && body.byteLength > 0 ? body : undefined,
        redirect: "manual",
      });

      const setCookies = getSetCookieValues(upstream.headers);
      if (setCookies.length > 0) {
        if (storeSetCookies(jar, setCookies, targetUrl.hostname)) {
          persistSessionStore();
        }
      }

      effectiveUpstreamUrl = upstream.url || targetUrl.toString();
    }

    const contentType = upstream.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html");

    const responseHeaders = new Headers();
    responseHeaders.set("X-Proxy-Url", effectiveUpstreamUrl);
    responseHeaders.set("X-Proxy-Redirect-Count", String(redirectCount));
    if (debugMode) {
      responseHeaders.set("X-Proxy-Debug-Referer", lastOutboundReferer.slice(0, 256));
      responseHeaders.set(
        "X-Proxy-Debug-Cookie-Names",
        summarizeCookieNames(lastOutboundCookieHeader)
      );
    }
    // Strip framing restrictions so our iframe can load the page
    // (intentionally NOT forwarding X-Frame-Options or Content-Security-Policy)
    if (contentType) {
      responseHeaders.set(
        "Content-Type",
        isHtml ? "text/html; charset=utf-8" : contentType
      );
    }
    // Upstream cookies are already captured in fetchWithRedirects and stored in jar.
    if (isNewSession) {
      responseHeaders.append(
        "Set-Cookie",
        `proxy-session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`
      );
    }

    // For non-GET requests, preserve upstream redirects and rewrite Location back through proxy.
    const upstreamLocation = upstream.headers.get("location");
    const isRedirectResponse =
      upstream.status >= 300 && upstream.status < 400 && Boolean(upstreamLocation);
    if (isRedirectResponse && method !== "GET") {
      const absoluteLocation = resolveUrl(
        effectiveUpstreamUrl || targetUrl.toString(),
        upstreamLocation!
      );
      responseHeaders.set("Location", proxyHref(absoluteLocation));
      const cc = upstream.headers.get("cache-control");
      if (cc) responseHeaders.set("Cache-Control", cc);
      return new NextResponse(null, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    if (isHtml) {
      let html = await upstream.text();
      html = rewriteHtml(html, effectiveUpstreamUrl);
      html = rewriteMetaRefresh(html, effectiveUpstreamUrl);
      // Inject scripts at the start of <head> to run before any page scripts
      const UPSTREAM_SCRIPT = `window.__UPSTREAM_URL__ = ${JSON.stringify(
        effectiveUpstreamUrl
      )};`;
      const NAV_SCRIPT = `
      (function(){
        'use strict';
        function fixProxyPath(raw){
          try{
            if(!raw) return raw;
            var str = String(raw);

            // Normalize malformed absolute URLs such as
            // http://localhost:3000/p/api/proxy?url=...
            if(str.indexOf(location.origin + '/p/api/proxy?url=') === 0){
              return location.origin + '/api/proxy?url=' + str.split('?url=')[1];
            }

            // Normalize malformed relative URLs such as /p/api/proxy?url=...
            if(str.indexOf('/p/api/proxy?url=') === 0){
              return '/api/proxy?url=' + str.split('?url=')[1];
            }

            // Normalize missing leading slash: api/proxy?url=...
            if(str.indexOf('api/proxy?url=') === 0){
              return '/' + str;
            }

            return str;
          }catch(e){
            return raw;
          }
        }
        function rewriteAttrValue(el, attr){
          try{
            if(!el || !el.getAttribute || !el.setAttribute) return;
            var raw = el.getAttribute(attr);
            if(!raw) return;
            var proxied = toProxyUrl(raw);
            if(proxied && proxied !== raw) el.setAttribute(attr, proxied);
          }catch(e){}
        }
        function rewriteElementUrls(el){
          try{
            if(!el || !el.tagName) return;
            var tag = String(el.tagName).toUpperCase();
            if(tag === 'A' || tag === 'LINK') rewriteAttrValue(el, 'href');
            if(tag === 'FORM') rewriteAttrValue(el, 'action');
            if(tag === 'SCRIPT' || tag === 'IMG' || tag === 'SOURCE' || tag === 'VIDEO' || tag === 'AUDIO' || tag === 'IFRAME' || tag === 'FRAME' || tag === 'EMBED') rewriteAttrValue(el, 'src');
            if(tag === 'OBJECT') rewriteAttrValue(el, 'data');
          }catch(e){}
        }
        function rewriteTreeUrls(root){
          try{
            if(!root) return;
            if(root.nodeType === 1) rewriteElementUrls(root);
            if(root.querySelectorAll){
              var all = root.querySelectorAll('*');
              for(var i=0;i<all.length;i++) rewriteElementUrls(all[i]);
            }
          }catch(e){}
        }
        function toProxyUrl(url){
          try{
            if(!url || String(url)==='undefined') return;
            var raw = fixProxyPath(String(url));
            if(raw.indexOf('/api/proxy?url=')===0) return raw;
            if(raw.indexOf(location.origin + '/api/proxy?url=')===0) return raw;
            if(raw.indexOf('data:')===0 || raw.indexOf('blob:')===0 || raw.indexOf('javascript:')===0 || raw.indexOf('mailto:')===0 || raw.indexOf('#')===0) return raw;
            var base = window.__UPSTREAM_URL__ || location.href;
            var abs = new URL(raw, base).toString();
            return '/api/proxy?url=' + encodeURIComponent(abs);
          }catch(e){}
        }
        function proxyNavigate(url){
          var proxied = toProxyUrl(url);
          if(!proxied) return;
          location.href = proxied;
        }

        // Some SPA redirects mutate URL via history APIs; normalize malformed proxy paths.
        try{
          var origPushState = history.pushState;
          if(typeof origPushState === 'function'){
            history.pushState = function(state, title, url){
              var nextUrl = url;
              try{
                if(typeof url === 'string') nextUrl = fixProxyPath(url);
              }catch(e){}
              return origPushState.call(this, state, title, nextUrl);
            };
          }
          var origReplaceState = history.replaceState;
          if(typeof origReplaceState === 'function'){
            history.replaceState = function(state, title, url){
              var nextUrl = url;
              try{
                if(typeof url === 'string') nextUrl = fixProxyPath(url);
              }catch(e){}
              return origReplaceState.call(this, state, title, nextUrl);
            };
          }
        }catch(e){}

        // Rewrite existing and dynamically-added URL-bearing elements.
        rewriteTreeUrls(document);
        try{
          var mo = new MutationObserver(function(mutations){
            for(var i=0;i<mutations.length;i++){
              var m = mutations[i];
              if(m.type === 'attributes'){
                rewriteElementUrls(m.target);
                continue;
              }
              if(m.type === 'childList' && m.addedNodes){
                for(var j=0;j<m.addedNodes.length;j++){
                  var n = m.addedNodes[j];
                  if(n && n.nodeType === 1) rewriteTreeUrls(n);
                }
              }
            }
          });
          mo.observe(document.documentElement || document, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['href', 'src', 'action', 'data']
          });
        }catch(e){}

        // Keep SPA/API calls inside the proxy as well (RapidIdentity uses /api/rest/*).
        try{
          var origFetch = window.fetch;
          window.fetch = function(input, init){
            try{
              if(typeof input === 'string'){
                var proxied = toProxyUrl(input);
                if(proxied) input = proxied;
              }else if(input && input.url){
                var proxiedReqUrl = toProxyUrl(input.url);
                if(proxiedReqUrl) input = new Request(proxiedReqUrl, input);
              }
            }catch(e){}
            return origFetch.call(this, input, init);
          };
        }catch(e){}

        try{
          var origOpenXhr = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url){
            try{
              var proxied = toProxyUrl(url);
              if(proxied) arguments[1] = proxied;
            }catch(e){}
            return origOpenXhr.apply(this, arguments);
          };
        }catch(e){}

        function rewriteFormAction(form){
          try{
            if(!form) return;
            var actionAttr = form.getAttribute && form.getAttribute('action');
            var action = actionAttr || form.action || (window.__UPSTREAM_URL__ || location.href);
            var proxied = toProxyUrl(action);
            if(proxied) form.setAttribute('action', proxied);
          }catch(e){}
        }

        document.addEventListener('submit', function(e){
          var form = e.target;
          if(!form || form.tagName !== 'FORM') return;
          rewriteFormAction(form);
        }, true);

        try{
          var origSubmit = HTMLFormElement.prototype.submit;
          HTMLFormElement.prototype.submit = function(){
            rewriteFormAction(this);
            return origSubmit.apply(this, arguments);
          };
        }catch(e){}

        try{
          var origRequestSubmit = HTMLFormElement.prototype.requestSubmit;
          if(origRequestSubmit){
            HTMLFormElement.prototype.requestSubmit = function(submitter){
              rewriteFormAction(this);
              return origRequestSubmit.call(this, submitter);
            };
          }
        }catch(e){}

        try{
          var origSendBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
          if(origSendBeacon){
            navigator.sendBeacon = function(url, data){
              try{
                var proxied = toProxyUrl(url);
                return origSendBeacon(proxied || url, data);
              }catch(e){
                return origSendBeacon(url, data);
              }
            };
          }
        }catch(e){}

        // Keep direct location.assign/replace/href navigations inside proxy.
        try{
          var locProto = Object.getPrototypeOf(window.location);
          if(locProto){
            var origLocAssign = locProto.assign;
            if(typeof origLocAssign === 'function'){
              locProto.assign = function(url){
                var proxied = toProxyUrl(url);
                return origLocAssign.call(this, proxied || url);
              };
            }
            var origLocReplace = locProto.replace;
            if(typeof origLocReplace === 'function'){
              locProto.replace = function(url){
                var proxied = toProxyUrl(url);
                return origLocReplace.call(this, proxied || url);
              };
            }
          }
        }catch(e){}

        document.addEventListener('click', function(e){
          var a = e.target && e.target.closest && e.target.closest('a');
          if(!a) return;
          var href = a.getAttribute && a.getAttribute('href');
          if(!href) return;
          if(href.startsWith('javascript:') || href.startsWith('#')) return;
          e.preventDefault();
          proxyNavigate(href);
        }, true);
        var origOpen = window.open;
        window.open = function(url,name,features){ if(url){ proxyNavigate(url); return null; } return origOpen.apply(this, arguments); };
        try{
          var topLoc = window.top.location;
          if(topLoc){
            var origAssign = topLoc.assign;
            if(origAssign) topLoc.assign = function(url){ proxyNavigate(url); };
            var origReplace = topLoc.replace;
            if(origReplace) topLoc.replace = function(url){ proxyNavigate(url); };
            Object.defineProperty(topLoc, 'href', { set: function(url){ proxyNavigate(url); } });
          }
        }catch(e){}
      })();
      `;
      const tag = `<script>${UPSTREAM_SCRIPT}</script><script>${NAV_SCRIPT}</script><script>${RECORDING_SCRIPT}</script>`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${tag}`);
      } else {
        html = tag + html;
      }
      return new NextResponse(html, {
        headers: responseHeaders,
        status: upstream.status,
      });
    }

    if (contentType.includes("javascript") || contentType.includes("ecmascript")) {
      const js = await upstream.text();
      const rewritten = rewriteJs(js, effectiveUpstreamUrl);
      responseHeaders.set("Content-Type", contentType || "text/javascript");
      const cc = upstream.headers.get("cache-control");
      if (cc) responseHeaders.set("Cache-Control", cc);
      return new NextResponse(rewritten, {
        headers: responseHeaders,
        status: upstream.status,
      });
    }

    const body = await upstream.arrayBuffer();
    const cc = upstream.headers.get("cache-control");
    if (cc) responseHeaders.set("Cache-Control", cc);
    return new NextResponse(body, {
      headers: responseHeaders,
      status: upstream.status,
    });
  } catch (err) {
    return new NextResponse(`Proxy error: ${err}`, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

export async function PUT(req: NextRequest) {
  return handleProxy(req);
}

export async function PATCH(req: NextRequest) {
  return handleProxy(req);
}

export async function DELETE(req: NextRequest) {
  return handleProxy(req);
}

export async function OPTIONS(req: NextRequest) {
  return handleProxy(req);
}

export async function HEAD(req: NextRequest) {
  return handleProxy(req);
}
