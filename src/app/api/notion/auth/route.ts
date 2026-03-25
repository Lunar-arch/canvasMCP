import { NextResponse } from "next/server";

const NOTION_AUTHORIZE = "https://api.notion.com/v1/oauth/authorize";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const redirectUri = `${base}/api/notion/callback`;
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Missing NOTION_CLIENT_ID on server" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user",
  });

  return NextResponse.redirect(`${NOTION_AUTHORIZE}?${params.toString()}`);
}
