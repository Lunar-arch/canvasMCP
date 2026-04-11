# StudyFlow MCP Server

Exposes StudyFlow task data to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io/).

## Setup

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

Set these environment variables before running:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable/anon key — same value as the Next.js app |
| `STUDYFLOW_EMAIL` | Yes | Email you use to sign in to StudyFlow |
| `STUDYFLOW_PASSWORD` | Yes | Password you use to sign in to StudyFlow |

## Running

```bash
# Production (after build)
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... STUDYFLOW_EMAIL=... STUDYFLOW_PASSWORD=... node dist/index.js

# Development (tsx, no build needed)
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... STUDYFLOW_EMAIL=... STUDYFLOW_PASSWORD=... npm run dev
```

## Claude Desktop config

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "studyflow": {
      "command": "node",
      "args": ["/absolute/path/to/canvasMCP/mcp-server/dist/index.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_...",
        "STUDYFLOW_EMAIL": "you@example.com",
        "STUDYFLOW_PASSWORD": "your-password"
      }
    }
  }
}
```

## Available Tools

### Tasks
| Tool | Description |
|---|---|
| `list_tasks` | List/search tasks — filter by id, search text, tag, course, priority, completion, block, due date range |
| `create_task` | Create a single task |
| `update_task` | Update any field on an existing task |
| `delete_task` | Delete a task |
| `bulk_create_tasks` | Create multiple tasks in one call |
| `bulk_update_tasks` | Apply a shared patch to many tasks by IDs, or per-task updates |
| `bulk_delete_tasks` | Delete multiple tasks by IDs |

### Tags
| Tool | Description |
|---|---|
| `list_tags` | List all tags |
| `create_tag` | Create a tag (name + hex color) |
| `update_tag` | Rename or recolor a tag |
| `delete_tag` | Delete a tag and remove it from all tasks |
| `add_tag_to_task` | Associate a tag with a task |
| `remove_tag_from_task` | Remove a tag from a task |

### Blocks
| Tool | Description |
|---|---|
| `list_blocks` | List all blocks (sorted by order) |
| `create_block` | Create a block (name + hex color) |
| `update_block` | Update name, color, order, or break duration |
| `delete_block` | Delete a block; tasks become unblocked |
| `move_task_to_block` | Move a task to a different block (or unblock it) |

### Courses
| Tool | Description |
|---|---|
| `list_courses` | List all courses |
