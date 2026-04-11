import { v4 as uuid } from "uuid";
import { mutate, readData } from "../storage.js";
import { Tag } from "../types.js";

export const tagTools = [
  {
    name: "list_tags",
    description: "Return all tags.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: async (_args: Record<string, unknown>) => {
      const data = await readData();
      return {
        content: [{ type: "text", text: JSON.stringify({ tags: data.tags }, null, 2) }],
      };
    },
  },

  {
    name: "create_tag",
    description: "Create a new tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Tag name (required)" },
        color: { type: "string", description: "Hex color, e.g. #3b82f6 (required)" },
      },
      required: ["name", "color"],
    },
    handler: async (args: Record<string, unknown>) => {
      let created: Tag | null = null;
      await mutate((d) => {
        const tag: Tag = { id: uuid(), name: args.name as string, color: args.color as string };
        created = tag;
        return { ...d, tags: [...d.tags, tag] };
      });
      return { content: [{ type: "text", text: JSON.stringify({ created }, null, 2) }] };
    },
  },

  {
    name: "update_tag",
    description: "Update a tag's name or color.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Tag ID (required)" },
        name: { type: "string" },
        color: { type: "string" },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = args.id as string;
      let updated: Tag | null = null;
      await mutate((d) => {
        const tags = d.tags.map((t) => {
          if (t.id !== id) return t;
          const result = { ...t };
          if (args.name !== undefined) result.name = args.name as string;
          if (args.color !== undefined) result.color = args.color as string;
          updated = result;
          return result;
        });
        return { ...d, tags };
      });
      if (!updated) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Tag ${id} not found` }) }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify({ updated }, null, 2) }] };
    },
  },

  {
    name: "delete_tag",
    description: "Delete a tag and remove it from all tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Tag ID to delete (required)" },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = args.id as string;
      await mutate((d) => ({
        ...d,
        tags: d.tags.filter((t) => t.id !== id),
        tasks: d.tasks.map((t) => ({ ...t, tags: t.tags.filter((tid) => tid !== id) })),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ deleted: id }) }] };
    },
  },

  {
    name: "add_tag_to_task",
    description: "Associate a tag with a task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task ID (required)" },
        tag_id: { type: "string", description: "Tag ID to add (required)" },
      },
      required: ["task_id", "tag_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const taskId = args.task_id as string;
      const tagId = args.tag_id as string;
      await mutate((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === taskId && !t.tags.includes(tagId)
            ? { ...t, tags: [...t.tags, tagId] }
            : t
        ),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ task_id: taskId, tag_id: tagId }) }] };
    },
  },

  {
    name: "remove_tag_from_task",
    description: "Remove a tag from a task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Task ID (required)" },
        tag_id: { type: "string", description: "Tag ID to remove (required)" },
      },
      required: ["task_id", "tag_id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const taskId = args.task_id as string;
      const tagId = args.tag_id as string;
      await mutate((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === taskId ? { ...t, tags: t.tags.filter((id) => id !== tagId) } : t
        ),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ task_id: taskId, tag_id: tagId }) }] };
    },
  },
];
