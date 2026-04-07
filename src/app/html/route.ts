import { NextRequest, NextResponse } from "next/server";
import { buildHtmlLoadingShell } from "./loading-shell";
import { resolveHtmlTarget } from "@/lib/html-build-artifacts";

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

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export function GET(req: NextRequest) {
  const target = resolveHtmlTarget(req.nextUrl.searchParams.get("target"));
  const html = buildHtmlLoadingShell({
    apiBase: req.nextUrl.origin,
    target,
  });

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

  return withCors(response);
}
