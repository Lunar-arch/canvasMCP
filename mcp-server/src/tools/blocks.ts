import { v4 as uuid } from "uuid";
import { mutate, readData } from "../storage.js";
import { TaskBlock } from "../types.js";

export const blockTools = [
  {
    name: "list_blocks",
    description: "Return all task blocks, sorted by order.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async (_args: Record<string, unknown>) => {
      const data = await readData();
      const blocks = [...data.blocks].sort((a, b) => a.order - b.order);
      return {
        content: [{ type: "text", text: JSON.stringify({ blocks }, null, 2) }],
      };
    },
  },

  {
    name: "create_block",
    description: "Create a new task block.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Block name (required)" },
        color: { type: "string", description: "Hex color, e.g. #6366f1 (required)" },
        break_minutes: { type: "number", description: "Optional break duration in minutes after this block" },
      },
      required: ["name", "color"],
    },
    handler: async (args: Record<string, unknown>) => {
      let created: TaskBlock | null = null;
      await mutate((d) => {
        const block: TaskBlock = {
          id: uuid(),
          name: args.name as string,
          color: args.color as string,
          order: d.blocks.length,
          breakMinutes: args.break_minutes as number | undefined,
        };
        created = block;
        return { ...d, blocks: [...d.blocks, block] };
      });
      return { content: [{ type: "text", text: JSON.stringify({ created }, null, 2) }] };
    },
  },

  {
    name: "update_block",
    description: "Update a task block's name, color, order, or break duration.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Block ID (required)" },
        name: { type: "string" },
        color: { type: "string" },
        order: { type: "number" },
        break_minutes: { type: ["number", "null"] },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = args.id as string;
      let updated: TaskBlock | null = null;
      await mutate((d) => {
        const blocks = d.blocks.map((b) => {
          if (b.id !== id) return b;
          const result = { ...b };
          if (args.name !== undefined) result.name = args.name as string;
          if (args.color !== undefined) result.color = args.color as string;
          if (args.order !== undefined) result.order = args.order as number;
          if ("break_minutes" in args) result.breakMinutes = args.break_minutes as number | undefined;
          updated = result;
          return result;
        });
        return { ...d, blocks };
      });
      if (!updated) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Block ${id} not found` }) }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify({ updated }, null, 2) }] };
    },
  },

  {
    name: "delete_block",
    description: "Delete a block. Tasks that were in the block become unblocked (blockId removed).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Block ID to delete (required)" },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = args.id as string;
      await mutate((d) => ({
        ...d,
        blocks: d.blocks.filter((b) => b.id !== id),
        tasks: d.tasks.map((t) =>
          t.blockId === id ? { ...t, blockId: undefined } : t
        ),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ deleted: id }) }] };
    },
  },

  {
    name: "move_task_to_block",
    description: "Move a task to a different block, or remove it from its current block.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task ID (required)" },
        block_id: {
          type: ["string", "null"],
          description: "Block ID to move to, or null to remove from any block",
        },
      },
      required: ["task_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const taskId = args.task_id as string;
      const blockId = (args.block_id as string | null | undefined) ?? undefined;
      await mutate((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === taskId ? { ...t, blockId } : t
        ),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ task_id: taskId, block_id: blockId ?? null }) }] };
    },
  },
];
