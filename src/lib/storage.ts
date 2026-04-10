import { AppData, AppSettings } from "@/types";

const STORAGE_KEY = "canvas-study-data";

function createDefaultSettings(): AppSettings {
  return {
    defaultTimerMinutes: 25,
    extraTimeMinutes: 5,
    theme: "light",
    excludedCourseIds: [],
    canvasTrackedCourseIds: [],
    canvasOnlyAddFromDate: null,
    canvasSkipNoDueDateTasks: false,
    canvasReviewNoDueDateTasks: false,
    notion: {},
  };
}

export function getDefaultData(): AppData {
  return {
    config: null,
    macros: [],
    courses: [],
    assignments: [],
    tasks: [],
    blocks: [],
    tags: [],
    taskRules: [],
    settings: createDefaultSettings(),
    lastSynced: null,
  };
}

export function loadData(): AppData {
  const defaults = getDefaultData();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      ...defaults,
      ...parsed,
      taskRules: parsed.taskRules ?? [],
      settings: {
        ...defaults.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
