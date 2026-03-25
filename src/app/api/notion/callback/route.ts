import { NextResponse } from "next/server";

// Exchanges the authorization code for tokens and returns them to the client.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });

  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const redirectUri = `${base}/api/notion/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Server not configured for Notion OAuth" }, { status: 500 });
  }

  try {
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return NextResponse.json({ error: tokenJson }, { status: 500 });
    }
    // Return a small HTML payload that posts tokens to the opener window (if opened as popup)
    const script = `
      <html>
      <body>
        <script>
          const data = ${JSON.stringify(tokenJson)};
          try {
            if (window.opener && window.opener.postMessage) {
              window.opener.postMessage({ type: 'notion_oauth', data }, '*');
              window.close();
            } else {
              // fallback: store to localStorage and redirect to /setup
              localStorage.setItem('notion_oauth', JSON.stringify(data));
              window.location = '/setup';
            }
          } catch (e) {
            document.body.innerText = 'Authentication complete. You can close this window.';
          }
        </script>
      </body>
      </html>
    `;
    return new Response(script, { headers: { 'Content-Type': 'text/html' } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
