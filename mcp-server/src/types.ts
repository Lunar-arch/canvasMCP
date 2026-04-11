// Mirror of src/types/index.ts — kept in sync manually

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface FocusSession {
  startTime: string;
  endTime: string;
}

export interface FileLink {
  name: string;
  url: string;
  type?: string;
}

export interface UrlLink {
  label?: string;
  url: string;
}

export interface StudyTask {
  id: string;
  assignmentId?: number;
  courseId?: number;
  title: string;
  description?: string;
  courseName?: string;
  dueAt: string | null;
  pointsPossible: number | null;
  htmlUrl?: string;
  completed: boolean;
  estimatedMinutes: number;
  elapsedMinutes: number;
  priority: "low" | "medium" | "high" | "urgent" | null;
  tags: string[];
  blockId?: string;
  order: number;
  custom?: boolean;
  secondsRemaining?: number;
  taskType: "completion" | "timed" | "practice";
  sessions: FocusSession[];
  remind?: {
    onDay?: string;
    timeBefore?: string;
  };
  fileLinks: FileLink[];
  links: UrlLink[];
  taskLinks: string[];
}

export interface TaskBlock {
  id: string;
  name: string;
  color: string;
  order: number;
  breakMinutes?: number;
}

export interface Course {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id?: number;
  start_at?: string;
  end_at?: string;
  color?: string;
}

export interface AppSettings {
  defaultTimerMinutes: number;
  extraTimeMinutes: number;
  theme: "light" | "dark";
  excludedCourseIds?: number[];
  canvasTrackedCourseIds?: number[];
  canvasOnlyAddFromDate?: string | null;
  canvasSkipNoDueDateTasks?: boolean;
  canvasReviewNoDueDateTasks?: boolean;
  notion?: {
    accessToken?: string;
    refreshToken?: string;
    databaseId?: string;
    workspaceName?: string;
  };
}

export interface AppData {
  config: unknown;
  macros: unknown[];
  courses: Course[];
  assignments: unknown[];
  tasks: StudyTask[];
  blocks: TaskBlock[];
  tags: Tag[];
  taskRules: unknown[];
  settings: AppSettings;
  lastSynced: string | null;
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
    settings: {
      defaultTimerMinutes: 25,
      extraTimeMinutes: 5,
      theme: "light",
      excludedCourseIds: [],
      canvasTrackedCourseIds: [],
      canvasOnlyAddFromDate: null,
      canvasSkipNoDueDateTasks: false,
      canvasReviewNoDueDateTasks: false,
      notion: {},
    },
    lastSynced: null,
  };
}
