import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { taskTools } from "./tools/tasks.js";
import { tagTools } from "./tools/tags.js";
import { blockTools } from "./tools/blocks.js";
import { readData } from "./storage.js";

// ─── Tool registry ─────────────────────────────────────────────────────────────

type Tool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
};

const allTools: Tool[] = [
  ...taskTools,
  ...tagTools,
  ...blockTools,
  // ── Courses (read-only via MCP) ────────────────────────────────────────────
  {
    name: "list_courses",
    description: "Return all courses.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const data = await readData();
      return {
        content: [{ type: "text", text: JSON.stringify({ courses: data.courses }, null, 2) }],
      };
    },
  },
];

const toolMap = new Map(allTools.map((t) => [t.name, t]));

// ─── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "studyflow-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const tool = toolMap.get(name);

  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    return await tool.handler(args as Record<string, unknown>);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("StudyFlow MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
