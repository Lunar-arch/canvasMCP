import { NextResponse } from "next/server";

// POST { refreshToken }
export async function POST(req: Request) {
  const body = await req.json();
  const { refreshToken } = body;
  if (!refreshToken) return NextResponse.json({ error: "Missing refreshToken" }, { status: 400 });

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  try {
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) return NextResponse.json({ error: tokenJson }, { status: 500 });
    return NextResponse.json(tokenJson);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
