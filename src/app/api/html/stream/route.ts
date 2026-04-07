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

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const target = resolveHtmlTarget(req.nextUrl.searchParams.get("target"));
  const renderUrl = `${req.nextUrl.origin}/api/html/render?target=${encodeURIComponent(target)}`;

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

        pushStatus("sending", "Sending...", 92);
        await sleep(120);

        push("complete", {
          phase: "done",
          message: "Ready",
          progress: 100,
          target,
          sourceMode: prepared.sourceMode,
          sourcePath: prepared.sourcePath,
          buildId: prepared.buildId,
          renderUrl,
          timestamp: new Date().toISOString(),
        });
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
