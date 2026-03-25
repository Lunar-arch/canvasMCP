import { NextResponse } from "next/server";

// POST { accessToken, databaseId, events: [{ title, startISO, endISO, description? }] }
export async function POST(req: Request) {
  const body = await req.json();
  const { accessToken, databaseId, events } = body;
  if (!accessToken || !databaseId || !Array.isArray(events)) {
    return NextResponse.json({ error: "Missing accessToken, databaseId, or events" }, { status: 400 });
  }

  try {
    const created: any[] = [];
    for (const e of events) {
      const properties: any = {
        Name: { title: [{ text: { content: e.title || "Untitled" } }] },
        Date: {
          date: {
            start: e.startISO,
            end: e.endISO,
          },
        },
      };
      if (e.description) properties.Description = { rich_text: [{ text: { content: e.description } }] };

      const pageRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties,
        }),
      });
      const pageJson = await pageRes.json();
      if (!pageRes.ok) {
        // If rate limited, surface message and stop
        if (pageRes.status === 429) {
          return NextResponse.json({ error: "Rate limited by Notion API" }, { status: 429 });
        }
        return NextResponse.json({ error: pageJson }, { status: 500 });
      }
      created.push(pageJson);
    }

    return NextResponse.json({ created });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
