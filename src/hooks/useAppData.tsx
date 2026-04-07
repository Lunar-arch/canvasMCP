"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import {
  AppData,
  StudyTask,
  TaskBlock,
  Tag,
  Course,
  Assignment,
  CanvasConfig,
  CanvasSyncOptions,
  FilterState,
  AppSettings,
  Macro,
} from "@/types";
import { getDefaultData, loadData, saveData } from "@/lib/storage";
import { COURSE_COLORS } from "@/lib/colors";

interface AppContextType {
  data: AppData;
  isLoaded: boolean;
  // Config
  saveConfig: (config: CanvasConfig) => void;
  // Macros
  createMacro: (input: Partial<Macro>) => Macro;
  updateMacro: (id: string, updates: Partial<Macro>) => void;
  deleteMacro: (id: string) => void;
  // Sync
  syncFromCanvas: (
    courses: Course[],
    assignments: Assignment[],
    options?: CanvasSyncOptions
  ) => void;
  // Tasks
  createTask: (input: Partial<StudyTask>) => StudyTask;
  updateTask: (id: string, updates: Partial<StudyTask>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  // Blocks
  createBlock: (name: string, color: string) => TaskBlock;
  updateBlock: (id: string, updates: Partial<TaskBlock>) => void;
  deleteBlock: (id: string) => void;
  moveTaskToBlock: (taskId: string, blockId: string | undefined) => void;
  reorderTasks: (taskIds: string[]) => void;
  // Tags
  createTag: (name: string, color: string) => Tag;
  // Courses
  createCourse: (name: string, course_code?: string, color?: string) => Course;
  deleteTag: (id: string) => void;
  addTagToTask: (taskId: string, tagId: string) => void;
  removeTagFromTask: (taskId: string, tagId: string) => void;
  // Settings
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => getDefaultData());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setData(loadData());
    setIsLoaded(true);
  }, []);

  const persist = useCallback((updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  const saveConfig = useCallback(
    (config: CanvasConfig) => {
      persist((d) => ({ ...d, config }));
    },
    [persist]
  );

  const createMacro = useCallback(
    (input: Partial<Macro>): Macro => {
      const macro: Macro = {
        id: uuid(),
        name: input.name || "New Macro",
        description: input.description,
        sourceType: input.sourceType || "generic",
        schoolName: input.schoolName,
        steps: input.steps || [],
        fieldMappings: input.fieldMappings || [],
        schedule: input.schedule || { type: "manual" },
        credentials: input.credentials || [],
        enabled: input.enabled ?? true,
        lastRun: input.lastRun,
        lastRunStatus: input.lastRunStatus,
      };
      persist((d) => ({ ...d, macros: [...(d.macros || []), macro] }));
      return macro;
    },
    [persist]
  );

  const updateMacro = useCallback(
    (id: string, updates: Partial<Macro>) => {
      persist((d) => ({
        ...d,
        macros: (d.macros || []).map((m) => (m.id === id ? { ...m, ...updates } : m)),
      }));
    },
    [persist]
  );

  const deleteMacro = useCallback(
    (id: string) => {
      persist((d) => ({ ...d, macros: (d.macros || []).filter((m) => m.id !== id) }));
    },
    [persist]
  );

  const syncFromCanvas = useCallback(
    (courses: Course[], assignments: Assignment[], options?: CanvasSyncOptions) => {
      persist((d) => {
        const coloredCourses = courses.map((c, i) => ({
          ...c,
          color: COURSE_COLORS[i % COURSE_COLORS.length],
        }));

        const trackedCourseIds =
          options?.trackedCourseIds && options.trackedCourseIds.length > 0
            ? options.trackedCourseIds
            : d.settings?.canvasTrackedCourseIds && d.settings.canvasTrackedCourseIds.length > 0
              ? d.settings.canvasTrackedCourseIds
              : coloredCourses.map((c) => c.id);

        const excluded = coloredCourses
          .map((c) => c.id)
          .filter((id) => !trackedCourseIds.includes(id));

        const trackedAssignments = assignments.filter((a) =>
          trackedCourseIds.includes(a.course_id)
        );

        const existingTaskMap = new Map(
          d.tasks
            .filter((t) => t.assignmentId)
            .map((t) => [t.assignmentId!, t])
        );

        const onlyAddFromDate = options?.onlyAddFromDate
          ? new Date(options.onlyAddFromDate)
          : null;
        const onlyAddFromMs =
          onlyAddFromDate && !Number.isNaN(onlyAddFromDate.getTime())
            ? onlyAddFromDate.getTime()
            : null;
        const excludeNoDueDateTasks = options?.excludeNoDueDateTasks ?? false;
        const reviewNoDueDateTasks = options?.reviewNoDueDateTasks ?? false;
        const approvedNoDueIds = new Set(options?.approvedNoDueAssignmentIds || []);

        const importedTasks: StudyTask[] = trackedAssignments
          .filter((a) => {
            const existing = existingTaskMap.get(a.id);
            if (existing) return true;

            const dueMs = a.due_at ? new Date(a.due_at).getTime() : null;
            if (onlyAddFromMs !== null && dueMs !== null && dueMs < onlyAddFromMs) {
              return false;
            }

            if (!a.due_at) {
              if (excludeNoDueDateTasks) return false;
              if (reviewNoDueDateTasks && !approvedNoDueIds.has(a.id)) return false;
            }

            return true;
          })
          .map((a, i) => {
            const existing = existingTaskMap.get(a.id);
            const course = coloredCourses.find((c) => c.id === a.course_id);
            return {
              id: existing?.id || uuid(),
              assignmentId: a.id,
              courseId: a.course_id,
              title: a.name,
              courseName: course?.name || a.course_name || "Unknown Course",
              dueAt: a.due_at,
              pointsPossible: a.points_possible,
              htmlUrl: a.html_url,
              completed: existing?.completed || false,
              estimatedMinutes: existing?.estimatedMinutes ?? 0,
              elapsedMinutes: existing?.elapsedMinutes || 0,
              priority: existing?.priority || "medium",
              tags: existing?.tags || [],
              blockId: existing?.blockId,
              order: existing?.order ?? i,
              taskType: existing?.taskType || "timed",
              sessions: existing?.sessions || [],
              fileLinks: existing?.fileLinks || [],
              links: existing?.links || [],
              taskLinks: existing?.taskLinks || [],
            };
          });

        const customTasks = d.tasks.filter((t) => !t.assignmentId);

        return {
          ...d,
          courses: coloredCourses,
          assignments: trackedAssignments,
          tasks: [...customTasks, ...importedTasks],
          settings: {
            ...d.settings,
            excludedCourseIds: excluded,
            canvasTrackedCourseIds: trackedCourseIds,
            canvasOnlyAddFromDate:
              options?.onlyAddFromDate ?? d.settings.canvasOnlyAddFromDate ?? null,
            canvasSkipNoDueDateTasks:
              options?.excludeNoDueDateTasks ??
              d.settings.canvasSkipNoDueDateTasks ??
              false,
            canvasReviewNoDueDateTasks:
              options?.reviewNoDueDateTasks ??
              d.settings.canvasReviewNoDueDateTasks ??
              false,
          },
          lastSynced: new Date().toISOString(),
        };
      });
    },
    [persist]
  );

  const createTask = useCallback(
    (input: Partial<StudyTask>) => {
      const task: StudyTask = {
        id: uuid(),
        assignmentId: undefined,
        courseId: input.courseId,
        title: input.title || "New Task",
        description: input.description,
        courseName: input.courseName,
        dueAt: input.dueAt ?? null,
        pointsPossible: input.pointsPossible ?? null,
        htmlUrl: input.htmlUrl,
        completed: input.completed ?? false,
        estimatedMinutes: input.estimatedMinutes ?? 0,
        elapsedMinutes: input.elapsedMinutes ?? 0,
        priority: input.priority !== undefined ? input.priority : null,
        tags: input.tags ?? [],
        blockId: input.blockId,
        order:
          input.order ??
          (data.tasks.filter((t) => t.blockId === input.blockId).length ?? 0),
        custom: true,
        taskType: input.taskType ?? "completion",
        sessions: input.sessions ?? [],
        remind: input.remind,
        fileLinks: input.fileLinks ?? [],
        links: input.links ?? [],
        taskLinks: input.taskLinks ?? [],
      };
      persist((d) => ({ ...d, tasks: [...d.tasks, task] }));
      return task;
    },
    [persist, data.tasks]
  );

  const deleteTask = useCallback(
    (id: string) => {
      persist((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    },
    [persist]
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<StudyTask>) => {
      persist((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
    },
    [persist]
  );

  const completeTask = useCallback(
    (id: string) => {
      persist((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === id ? { ...t, completed: !t.completed } : t
        ),
      }));
    },
    [persist]
  );

  const createBlock = useCallback(
    (name: string, color: string) => {
      const block: TaskBlock = {
        id: uuid(),
        name,
        color,
        order: data.blocks.length,
      };
      persist((d) => ({ ...d, blocks: [...d.blocks, block] }));
      return block;
    },
    [persist, data.blocks.length]
  );

  const updateBlock = useCallback(
    (id: string, updates: Partial<TaskBlock>) => {
      persist((d) => ({
        ...d,
        blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      }));
    },
    [persist]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      persist((d) => ({
        ...d,
        blocks: d.blocks.filter((b) => b.id !== id),
        tasks: d.tasks.map((t) =>
          t.blockId === id ? { ...t, blockId: undefined } : t
        ),
      }));
    },
    [persist]
  );

  const moveTaskToBlock = useCallback(
    (taskId: string, blockId: string | undefined) => {
      persist((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === taskId ? { ...t, blockId } : t
        ),
      }));
    },
    [persist]
  );

  const reorderTasks = useCallback(
    (taskIds: string[]) => {
      persist((d) => ({
        ...d,
        tasks: d.tasks.map((t) => {
          const idx = taskIds.indexOf(t.id);
          return idx !== -1 ? { ...t, order: idx } : t;
        }),
      }));
    },
    [persist]
  );

  const createTag = useCallback(
    (name: string, color: string) => {
      const tag: Tag = { id: uuid(), name, color };
      persist((d) => ({ ...d, tags: [...d.tags, tag] }));
      return tag;
    },
    [persist]
  );

  const createCourse = useCallback(
    (name: string, course_code?: string, color?: string) => {
      const nextId = Math.max(0, ...data.courses.map((c) => c.id)) + 1;
      const course: Course = {
        id: nextId,
        name,
        course_code: course_code || `COURSE-${nextId}`,
        color: color || COURSE_COLORS[data.courses.length % COURSE_COLORS.length],
      };
      persist((d) => ({ ...d, courses: [...d.courses, course] }));
      return course;
    },
    [persist, data.courses]
  );

  const deleteTag = useCallback(
    (id: string) => {
      persist((d) => ({
        ...d,
        tags: d.tags.filter((t) => t.id !== id),
        tasks: d.tasks.map((t) => ({
          ...t,
          tags: t.tags.filter((tagId) => tagId !== id),
        })),
      }));
    },
    [persist]
  );

  const addTagToTask = useCallback(
    (taskId: string, tagId: string) => {
      persist((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === taskId && !t.tags.includes(tagId)
            ? { ...t, tags: [...t.tags, tagId] }
            : t
        ),
      }));
    },
    [persist]
  );

  const removeTagFromTask = useCallback(
    (taskId: string, tagId: string) => {
      persist((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === taskId
            ? { ...t, tags: t.tags.filter((id) => id !== tagId) }
            : t
        ),
      }));
    },
    [persist]
  );

  const updateSettings = useCallback(
    (settings: Partial<AppSettings>) => {
      persist((d) => ({
        ...d,
        settings: { ...d.settings, ...settings },
      }));
    },
    [persist]
  );

  return (
    <AppContext.Provider
      value={{
        data,
        isLoaded,
        saveConfig,
        createMacro,
        updateMacro,
        deleteMacro,
        syncFromCanvas,
        createTask,
        updateTask,
        deleteTask,
        completeTask,
        createBlock,
        updateBlock,
        deleteBlock,
        moveTaskToBlock,
        reorderTasks,
        createTag,
            createCourse,
        deleteTag,
        addTagToTask,
        removeTagFromTask,
        updateSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppData must be used within AppProvider");
  return ctx;
}
