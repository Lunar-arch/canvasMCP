import { NextRequest, NextResponse } from "next/server";
import { prepareHtmlDocument, resolveHtmlTarget } from "@/lib/html-build-artifacts";

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

export async function GET(req: NextRequest) {
  const target = resolveHtmlTarget(req.nextUrl.searchParams.get("target"));

  try {
    const built = await prepareHtmlDocument(req.nextUrl.origin, target);
    const response = new NextResponse(built.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-StudyFlow-Build-Id": built.buildId,
        "X-StudyFlow-Target": built.target,
        "X-StudyFlow-Source": built.sourceMode,
        "X-StudyFlow-Source-Path": built.sourcePath,
      },
    });
    return withCors(response);
  } catch (error) {
    return withCors(
      NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to render html payload",
        },
        { status: 500 }
      )
    );
  }
}
