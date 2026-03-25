import { AppData, AppSettings } from "@/types";

const STORAGE_KEY = "canvas-study-data";

const defaultSettings: AppSettings = {
  defaultTimerMinutes: 25,
  extraTimeMinutes: 5,
  theme: "light",
  excludedCourseIds: [],
  notion: {},
};

const defaultData: AppData = {
  config: null,
  courses: [],
  assignments: [],
  tasks: [],
  blocks: [],
  tags: [],
  settings: defaultSettings,
  lastSynced: null,
};

export function loadData(): AppData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    return { ...defaultData, ...JSON.parse(raw) };
  } catch {
    return defaultData;
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
