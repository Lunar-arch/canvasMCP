import { NextRequest, NextResponse } from "next/server";
import {
  detectHtmlSourceMode,
  prepareHtmlDocument,
  resolveHtmlTarget,
} from "@/lib/html-build-artifacts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(response: Response): Response {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function sseEvent(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type HtmlDeliveryMode = "navigate" | "inline";

function resolveDeliveryMode(rawMode: string | null): HtmlDeliveryMode {
  return String(rawMode || "").trim().toLowerCase() === "inline"
    ? "inline"
    : "navigate";
}

function encodeBase64Utf8(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function toAbsoluteUrl(rawUrl: string, origin: string): string | null {
  try {
    return new URL(rawUrl, `${trimTrailingSlashes(origin)}/`).toString();
  } catch {
    return null;
  }
}

function isSameOrigin(urlText: string, origin: string): boolean {
  try {
    return new URL(urlText).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

function escapeInlineStyle(source: string): string {
  return source.replace(/<\/style/gi, "<\\/style");
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

interface InlinedHtmlResult {
  html: string;
  inlinedScriptCount: number;
  inlinedStyleCount: number;
}

interface InlineAssetOptions {
  inlineScripts?: boolean;
  inlineStyles?: boolean;
}

async function inlineHtmlAssets(
  html: string,
  origin: string,
  options: InlineAssetOptions = {}
): Promise<InlinedHtmlResult> {
  const inlineScripts = options.inlineScripts === true;
  const inlineStyles = options.inlineStyles !== false;
  const normalizedOrigin = trimTrailingSlashes(origin);
  let output = html;
  let inlinedScriptCount = 0;
  let inlinedStyleCount = 0;

  if (inlineScripts) {
    const scriptTags = Array.from(
      output.matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>\s*<\/script>/gi)
    );

    for (const match of scriptTags) {
      const scriptTag = match[0];
      const rawSrc = match[2];
      const resolvedSrc = toAbsoluteUrl(rawSrc, normalizedOrigin);
      if (!resolvedSrc || !isSameOrigin(resolvedSrc, normalizedOrigin)) {
        continue;
      }

      const scriptSource = await fetchText(resolvedSrc);
      if (!scriptSource) {
        continue;
      }

      const openTagEnd = scriptTag.indexOf(">");
      if (openTagEnd < 0) {
        continue;
      }

      const openTag = scriptTag.slice(0, openTagEnd + 1);
      const openTagWithoutSrc = openTag.replace(/\s+\bsrc=(["']).*?\1/i, "");
      const replacement = `${openTagWithoutSrc}${escapeInlineScript(scriptSource)}</script>`;
      output = output.replace(scriptTag, () => replacement);
      inlinedScriptCount += 1;
    }
  }

  if (inlineStyles) {
    const linkTags = Array.from(output.matchAll(/<link\b[^>]*>/gi));
    for (const match of linkTags) {
      const linkTag = match[0];
      const relMatch = linkTag.match(/\brel=(["'])([^"']+)\1/i);
      if (!relMatch || relMatch[2].toLowerCase() !== "stylesheet") {
        continue;
      }

      const hrefMatch = linkTag.match(/\bhref=(["'])([^"']+)\1/i);
      if (!hrefMatch) {
        continue;
      }

      const rawHref = hrefMatch[2];
      const resolvedHref = toAbsoluteUrl(rawHref, normalizedOrigin);
      if (!resolvedHref || !isSameOrigin(resolvedHref, normalizedOrigin)) {
        continue;
      }

      const styleSource = await fetchText(resolvedHref);
      if (!styleSource) {
        continue;
      }

      const safeHrefAttr = rawHref.replace(/"/g, "&quot;");
      const replacement = `<style data-inline-href="${safeHrefAttr}">${escapeInlineStyle(styleSource)}</style>`;
      output = output.replace(linkTag, () => replacement);
      inlinedStyleCount += 1;
    }
  }

  output = output.replace(
    /<link\b[^>]*\brel=(["'])(modulepreload|preload)\1[^>]*\bas=(["'])(script|style)\3[^>]*>/gi,
    ""
  );
  output = output.replace(/<link\b[^>]*\brel=(["'])modulepreload\1[^>]*>/gi, "");

  return {
    html: output,
    inlinedScriptCount,
    inlinedStyleCount,
  };
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const target = resolveHtmlTarget(req.nextUrl.searchParams.get("target"));
  const delivery = resolveDeliveryMode(req.nextUrl.searchParams.get("delivery"));
  const inlineScripts =
    String(req.nextUrl.searchParams.get("inlineScripts") || "").trim() === "1";
  const renderUrl = `${req.nextUrl.origin}/api/html/render?target=${encodeURIComponent(target)}`;
  const appUrl = `${req.nextUrl.origin}${target}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, payload)));
      };

      const pushStatus = (phase: string, message: string, progress: number) => {
        push("status", {
          phase,
          message,
          progress,
          target,
          timestamp: new Date().toISOString(),
        });
      };

      try {
        pushStatus("typescript-checking", "Scanning build artifacts...", 8);
        const sourceMode = await detectHtmlSourceMode(target);
        await sleep(180);

        pushStatus(
          "compiling",
          sourceMode === "build-artifact"
            ? "Build artifacts found"
            : "Build artifacts unavailable, switching to live route capture",
          36
        );
        await sleep(220);

        pushStatus("rendering", "Preparing exact HTML payload...", 68);
        const prepared = await prepareHtmlDocument(req.nextUrl.origin, target);
        await sleep(160);

        let htmlPayload = prepared.html;
        let inlinedScriptCount = 0;
        let inlinedStyleCount = 0;

        if (delivery === "inline") {
          pushStatus(
            "packaging",
            inlineScripts
              ? "Inlining JS and CSS assets..."
              : "Inlining CSS assets and preserving script URLs...",
            82
          );
          const inlined = await inlineHtmlAssets(prepared.html, req.nextUrl.origin, {
            inlineScripts,
            inlineStyles: true,
          });
          htmlPayload = inlined.html;
          inlinedScriptCount = inlined.inlinedScriptCount;
          inlinedStyleCount = inlined.inlinedStyleCount;
          await sleep(120);
        }

        pushStatus(
          "sending",
          delivery === "inline"
            ? "Streaming HTML + JS payload..."
            : "Sending launch metadata...",
          92
        );
        await sleep(120);

        const completePayload: Record<string, unknown> = {
          phase: "done",
          message: "Ready",
          progress: 100,
          target,
          appUrl,
          delivery,
          sourceMode: prepared.sourceMode,
          sourcePath: prepared.sourcePath,
          buildId: prepared.buildId,
          renderUrl,
          timestamp: new Date().toISOString(),
        };

        if (delivery === "inline") {
          completePayload.htmlBase64 = encodeBase64Utf8(htmlPayload);
          completePayload.htmlLength = htmlPayload.length;
          completePayload.inlineScripts = inlineScripts;
          completePayload.inlinedScriptCount = inlinedScriptCount;
          completePayload.inlinedStyleCount = inlinedStyleCount;
        }

        push("complete", completePayload);
      } catch (error) {
        push("fatal", {
          phase: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unknown html stream error",
          target,
          timestamp: new Date().toISOString(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return withCors(
    new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  );
}
