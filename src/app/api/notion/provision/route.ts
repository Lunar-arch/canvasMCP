import { NextResponse } from "next/server";

// POST { accessToken, dbName }
export async function POST(req: Request) {
  const body = await req.json();
  const { accessToken, dbName } = body;
  if (!accessToken || !dbName) return NextResponse.json({ error: "Missing accessToken or dbName" }, { status: 400 });

  try {
    // Search for existing database by name
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: dbName,
        filter: { property: "object", value: "database" },
      }),
    });
    const searchJson = await searchRes.json();
    if (!searchRes.ok) return NextResponse.json({ error: searchJson }, { status: 500 });

    const found = (searchJson.results || []).find((r: any) => {
      const title = r.title || (r.properties && r.properties.Name && r.properties.Name.title && r.properties.Name.title[0] && r.properties.Name.title[0].plain_text);
      return title && title.toLowerCase().includes(dbName.toLowerCase());
    });

    if (found) {
      return NextResponse.json({ databaseId: found.id });
    }

    // If not found, attempt to create a database. Note: Notion API requires a parent page_id
    // for database creation. Many workspaces do not have a suitable parent page accessible
    // to the integration. We cannot reliably create a top-level database without a parent.
    // Return an informative error so the user can create a page and share it with the integration.
    return NextResponse.json({
      error:
        "Database not found. Automatic creation requires a parent page. Please create a page in Notion, share it with the integration, then re-run provisioning and provide its page id as the 'parentPageId' (this UI will be updated to accept a parent).",
    }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
