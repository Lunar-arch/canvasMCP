import { v4 as uuid } from "uuid";
import { z } from "zod";
import { mutate, readData } from "../storage.js";
import { StudyTask } from "../types.js";

// ─── Shared schemas ────────────────────────────────────────────────────────────

const TaskInput = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  courseName: z.string().optional(),
  courseId: z.number().optional(),
  dueAt: z.string().nullable().optional(),
  pointsPossible: z.number().nullable().optional(),
  htmlUrl: z.string().optional(),
  completed: z.boolean().optional(),
  estimatedMinutes: z.number().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional(),
  tags: z.array(z.string()).optional(),
  blockId: z.string().optional(),
  taskType: z.enum(["completion", "timed", "practice"]).optional(),
  remind: z
    .object({
      onDay: z.string().optional(),
      timeBefore: z.string().optional(),
    })
    .optional(),
  links: z
    .array(z.object({ label: z.string().optional(), url: z.string() }))
    .optional(),
  fileLinks: z
    .array(z.object({ name: z.string(), url: z.string(), type: z.string().optional() }))
    .optional(),
  taskLinks: z.array(z.string()).optional(),
});

export type TaskInputType = z.infer<typeof TaskInput>;

// ─── Filter helper ─────────────────────────────────────────────────────────────

function matchesFilters(
  task: StudyTask,
  filters: {
    id?: string;
    search?: string;
    tagId?: string;
    tagName?: string;
    courseId?: number;
    courseName?: string;
    priority?: string;
    completed?: boolean;
    blockId?: string;
    dueBefore?: string;
    dueAfter?: string;
  },
  tagMap: Map<string, string>
): boolean {
  if (filters.id && task.id !== filters.id) return false;
  if (filters.completed !== undefined && task.completed !== filters.completed) return false;
  if (filters.blockId !== undefined && task.blockId !== filters.blockId) return false;
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.courseId && task.courseId !== filters.courseId) return false;

  if (filters.courseName) {
    const cn = task.courseName?.toLowerCase() ?? "";
    if (!cn.includes(filters.courseName.toLowerCase())) return false;
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    const inTitle = task.title.toLowerCase().includes(q);
    const inDesc = (task.description ?? "").toLowerCase().includes(q);
    if (!inTitle && !inDesc) return false;
  }

  if (filters.tagId && !task.tags.includes(filters.tagId)) return false;

  if (filters.tagName) {
    const tn = filters.tagName.toLowerCase();
    const hasTag = task.tags.some((tid) => (tagMap.get(tid) ?? "").toLowerCase() === tn);
    if (!hasTag) return false;
  }

  if (filters.dueBefore && task.dueAt) {
    if (new Date(task.dueAt) > new Date(filters.dueBefore)) return false;
  }
  if (filters.dueAfter && task.dueAt) {
    if (new Date(task.dueAt) < new Date(filters.dueAfter)) return false;
  }

  return true;
}

// ─── Tool definitions ──────────────────────────────────────────────────────────

export const taskTools = [
  {
    name: "list_tasks",
    description:
      "List tasks with optional filters. Returns matching tasks sorted by order.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Return only the task with this ID" },
        search: { type: "string", description: "Full-text search across title and description" },
        tag_id: { type: "string", description: "Filter by tag ID" },
        tag_name: { type: "string", description: "Filter by tag name (case-insensitive)" },
        course_id: { type: "number", description: "Filter by numeric course ID" },
        course_name: { type: "string", description: "Filter by course name (partial match)" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Filter by priority",
        },
        completed: { type: "boolean", description: "Filter by completion status" },
        block_id: { type: "string", description: "Filter by block ID (pass empty string for unblocked tasks)" },
        due_before: { type: "string", description: "ISO date — only tasks due on or before this date" },
        due_after: { type: "string", description: "ISO date — only tasks due on or after this date" },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const data = await readData();
      const tagMap = new Map(data.tags.map((t) => [t.id, t.name]));

      const filters = {
        id: args.id as string | undefined,
        search: args.search as string | undefined,
        tagId: args.tag_id as string | undefined,
        tagName: args.tag_name as string | undefined,
        courseId: args.course_id as number | undefined,
        courseName: args.course_name as string | undefined,
        priority: args.priority as string | undefined,
        completed: args.completed as boolean | undefined,
        blockId: args.block_id as string | undefined,
        dueBefore: args.due_before as string | undefined,
        dueAfter: args.due_after as string | undefined,
      };

      const results = data.tasks
        .filter((t) => matchesFilters(t, filters, tagMap))
        .sort((a, b) => a.order - b.order);

      return {
        content: [{ type: "text", text: JSON.stringify({ tasks: results, total: results.length }, null, 2) }],
      };
    },
  },

  {
    name: "create_task",
    description: "Create a new task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title (required)" },
        description: { type: "string" },
        course_name: { type: "string" },
        course_id: { type: "number" },
        due_at: { type: "string", description: "ISO date string or null" },
        points_possible: { type: "number" },
        html_url: { type: "string" },
        completed: { type: "boolean" },
        estimated_minutes: { type: "number" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        tags: { type: "array", items: { type: "string" }, description: "Array of tag IDs" },
        block_id: { type: "string" },
        task_type: { type: "string", enum: ["completion", "timed", "practice"] },
        remind: {
          type: "object",
          properties: {
            on_day: { type: "string", description: "ISO date string" },
            time_before: { type: "string", description: "Cron expression" },
          },
        },
        links: {
          type: "array",
          items: { type: "object", properties: { label: { type: "string" }, url: { type: "string" } } },
        },
        file_links: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, url: { type: "string" }, type: { type: "string" } },
          },
        },
        task_links: { type: "array", items: { type: "string" }, description: "IDs of linked tasks" },
      },
      required: ["title"],
    },
    handler: async (args: Record<string, unknown>) => {
      let created: StudyTask | null = null;
      await mutate((d) => {
        const task: StudyTask = {
          id: uuid(),
          title: args.title as string,
          description: args.description as string | undefined,
          courseName: args.course_name as string | undefined,
          courseId: args.course_id as number | undefined,
          dueAt: (args.due_at as string | null | undefined) ?? null,
          pointsPossible: (args.points_possible as number | null | undefined) ?? null,
          htmlUrl: args.html_url as string | undefined,
          completed: (args.completed as boolean | undefined) ?? false,
          estimatedMinutes: (args.estimated_minutes as number | undefined) ?? 0,
          elapsedMinutes: 0,
          priority: (args.priority as StudyTask["priority"] | undefined) ?? null,
          tags: (args.tags as string[] | undefined) ?? [],
          blockId: args.block_id as string | undefined,
          order: d.tasks.filter((t) => t.blockId === args.block_id).length,
          custom: true,
          taskType: (args.task_type as StudyTask["taskType"] | undefined) ?? "completion",
          sessions: [],
          remind: args.remind
            ? {
                onDay: (args.remind as Record<string, string>).on_day,
                timeBefore: (args.remind as Record<string, string>).time_before,
              }
            : undefined,
          fileLinks: (args.file_links as StudyTask["fileLinks"] | undefined) ?? [],
          links: (args.links as StudyTask["links"] | undefined) ?? [],
          taskLinks: (args.task_links as string[] | undefined) ?? [],
        };
        created = task;
        return { ...d, tasks: [...d.tasks, task] };
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ created }, null, 2) }],
      };
    },
  },

  {
    name: "update_task",
    description: "Update fields on an existing task by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task ID to update (required)" },
        title: { type: "string" },
        description: { type: "string" },
        course_name: { type: "string" },
        course_id: { type: "number" },
        due_at: { type: ["string", "null"] },
        points_possible: { type: ["number", "null"] },
        html_url: { type: "string" },
        completed: { type: "boolean" },
        estimated_minutes: { type: "number" },
        priority: { type: ["string", "null"], enum: ["low", "medium", "high", "urgent", null] },
        tags: { type: "array", items: { type: "string" } },
        block_id: { type: ["string", "null"] },
        task_type: { type: "string", enum: ["completion", "timed", "practice"] },
        remind: { type: ["object", "null"] },
        links: { type: "array" },
        file_links: { type: "array" },
        task_links: { type: "array", items: { type: "string" } },
        order: { type: "number" },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = args.id as string;
      let updated: StudyTask | null = null;
      await mutate((d) => {
        const tasks = d.tasks.map((t) => {
          if (t.id !== id) return t;
          const patch: Partial<StudyTask> = {};
          if (args.title !== undefined) patch.title = args.title as string;
          if (args.description !== undefined) patch.description = args.description as string;
          if (args.course_name !== undefined) patch.courseName = args.course_name as string;
          if (args.course_id !== undefined) patch.courseId = args.course_id as number;
          if ("due_at" in args) patch.dueAt = args.due_at as string | null;
          if ("points_possible" in args) patch.pointsPossible = args.points_possible as number | null;
          if (args.html_url !== undefined) patch.htmlUrl = args.html_url as string;
          if (args.completed !== undefined) patch.completed = args.completed as boolean;
          if (args.estimated_minutes !== undefined) patch.estimatedMinutes = args.estimated_minutes as number;
          if ("priority" in args) patch.priority = args.priority as StudyTask["priority"];
          if (args.tags !== undefined) patch.tags = args.tags as string[];
          if ("block_id" in args) patch.blockId = args.block_id as string | undefined;
          if (args.task_type !== undefined) patch.taskType = args.task_type as StudyTask["taskType"];
          if ("remind" in args) patch.remind = args.remind as StudyTask["remind"];
          if (args.links !== undefined) patch.links = args.links as StudyTask["links"];
          if (args.file_links !== undefined) patch.fileLinks = args.file_links as StudyTask["fileLinks"];
          if (args.task_links !== undefined) patch.taskLinks = args.task_links as string[];
          if (args.order !== undefined) patch.order = args.order as number;
          const result = { ...t, ...patch };
          updated = result;
          return result;
        });
        return { ...d, tasks };
      });
      if (!updated) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Task ${id} not found` }) }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify({ updated }, null, 2) }] };
    },
  },

  {
    name: "delete_task",
    description: "Delete a task by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Task ID to delete (required)" },
      },
      required: ["id"],
    },
    handler: async (args: Record<string, unknown>) => {
      const id = args.id as string;
      await mutate((d) => ({
        ...d,
        tasks: d.tasks.filter((t) => t.id !== id),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ deleted: id }) }] };
    },
  },

  {
    name: "bulk_create_tasks",
    description: "Create multiple tasks at once. Returns the created tasks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasks: {
          type: "array",
          description: "Array of task objects to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              course_name: { type: "string" },
              course_id: { type: "number" },
              due_at: { type: ["string", "null"] },
              completed: { type: "boolean" },
              estimated_minutes: { type: "number" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              tags: { type: "array", items: { type: "string" } },
              block_id: { type: "string" },
              task_type: { type: "string", enum: ["completion", "timed", "practice"] },
            },
            required: ["title"],
          },
        },
      },
      required: ["tasks"],
    },
    handler: async (args: Record<string, unknown>) => {
      const inputs = args.tasks as Array<Record<string, unknown>>;
      const created: StudyTask[] = [];
      await mutate((d) => {
        const newTasks = inputs.map((input, i) => {
          const task: StudyTask = {
            id: uuid(),
            title: input.title as string,
            description: input.description as string | undefined,
            courseName: input.course_name as string | undefined,
            courseId: input.course_id as number | undefined,
            dueAt: (input.due_at as string | null | undefined) ?? null,
            pointsPossible: (input.points_possible as number | null | undefined) ?? null,
            htmlUrl: input.html_url as string | undefined,
            completed: (input.completed as boolean | undefined) ?? false,
            estimatedMinutes: (input.estimated_minutes as number | undefined) ?? 0,
            elapsedMinutes: 0,
            priority: (input.priority as StudyTask["priority"] | undefined) ?? null,
            tags: (input.tags as string[] | undefined) ?? [],
            blockId: input.block_id as string | undefined,
            order: d.tasks.length + i,
            custom: true,
            taskType: (input.task_type as StudyTask["taskType"] | undefined) ?? "completion",
            sessions: [],
            fileLinks: [],
            links: [],
            taskLinks: [],
          };
          created.push(task);
          return task;
        });
        return { ...d, tasks: [...d.tasks, ...newTasks] };
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ created, count: created.length }, null, 2) }],
      };
    },
  },

  {
    name: "bulk_update_tasks",
    description:
      "Apply the same patch to multiple tasks by IDs, or update each task individually with its own patch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Task IDs to update when applying a shared patch",
        },
        patch: {
          type: "object",
          description:
            "Fields to apply to all tasks in `ids`. Accepted fields: completed, priority, block_id, estimated_minutes, tags, task_type, course_name",
        },
        updates: {
          type: "array",
          description: "Alternative: array of { id, ...fields } objects for per-task updates",
          items: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          },
        },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const updatedIds: string[] = [];
      await mutate((d) => {
        let tasks = [...d.tasks];

        // Mode 1: shared patch applied to a list of IDs
        if (args.ids && args.patch) {
          const ids = new Set(args.ids as string[]);
          const patch = args.patch as Record<string, unknown>;
          tasks = tasks.map((t) => {
            if (!ids.has(t.id)) return t;
            updatedIds.push(t.id);
            const result = { ...t };
            if (patch.completed !== undefined) result.completed = patch.completed as boolean;
            if ("priority" in patch) result.priority = patch.priority as StudyTask["priority"];
            if ("block_id" in patch) result.blockId = patch.block_id as string | undefined;
            if (patch.estimated_minutes !== undefined) result.estimatedMinutes = patch.estimated_minutes as number;
            if (patch.tags !== undefined) result.tags = patch.tags as string[];
            if (patch.task_type !== undefined) result.taskType = patch.task_type as StudyTask["taskType"];
            if (patch.course_name !== undefined) result.courseName = patch.course_name as string;
            return result;
          });
        }

        // Mode 2: per-task update objects
        if (args.updates) {
          const updateMap = new Map(
            (args.updates as Array<Record<string, unknown>>).map((u) => [u.id as string, u])
          );
          tasks = tasks.map((t) => {
            const u = updateMap.get(t.id);
            if (!u) return t;
            updatedIds.push(t.id);
            const result = { ...t };
            if (u.title !== undefined) result.title = u.title as string;
            if (u.description !== undefined) result.description = u.description as string;
            if (u.completed !== undefined) result.completed = u.completed as boolean;
            if ("priority" in u) result.priority = u.priority as StudyTask["priority"];
            if ("block_id" in u) result.blockId = u.block_id as string | undefined;
            if (u.estimated_minutes !== undefined) result.estimatedMinutes = u.estimated_minutes as number;
            if (u.tags !== undefined) result.tags = u.tags as string[];
            if (u.task_type !== undefined) result.taskType = u.task_type as StudyTask["taskType"];
            if ("due_at" in u) result.dueAt = u.due_at as string | null;
            if (u.course_name !== undefined) result.courseName = u.course_name as string;
            if (u.order !== undefined) result.order = u.order as number;
            return result;
          });
        }

        return { ...d, tasks };
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ updated_ids: updatedIds, count: updatedIds.length }, null, 2) }],
      };
    },
  },

  {
    name: "bulk_delete_tasks",
    description: "Delete multiple tasks by their IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Task IDs to delete (required)" },
      },
      required: ["ids"],
    },
    handler: async (args: Record<string, unknown>) => {
      const ids = new Set(args.ids as string[]);
      await mutate((d) => ({
        ...d,
        tasks: d.tasks.filter((t) => !ids.has(t.id)),
      }));
      return { content: [{ type: "text", text: JSON.stringify({ deleted: [...ids], count: ids.size }, null, 2) }] };
    },
  },
];
