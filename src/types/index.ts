export type WaitType = "duration" | "url" | "selector" | "navigation";

export interface MacroStep {
  id: string;
  action: "click" | "fill" | "navigate" | "wait" | "press";
  selector?: string;
  value?: string;
  url?: string;
  key?: string;
  waitTime?: number;
  waitType?: WaitType;
  waitUrl?: string;
  waitSelector?: string;
  label: string;
}

export interface CanvasConfig {
  username: string;
  password: string;
  portalUrl: string;
  schoolName: string;
  macroSteps: MacroStep[];
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

export interface Assignment {
  id: number;
  course_id: number;
  name: string;
  description?: string;
  due_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  html_url: string;
  has_submitted_submissions?: boolean;
  course_name?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
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
  priority: "low" | "medium" | "high" | "urgent";
  tags: string[];
  blockId?: string;
  order: number;
  custom?: boolean;
  secondsRemaining?: number;
}

export interface TaskBlock {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface AppData {
  config: CanvasConfig | null;
  courses: Course[];
  assignments: Assignment[];
  tasks: StudyTask[];
  blocks: TaskBlock[];
  tags: Tag[];
  settings: AppSettings;
  lastSynced: string | null;
}

export interface AppSettings {
  defaultTimerMinutes: number;
  extraTimeMinutes: number;
  theme: "light" | "dark";
  excludedCourseIds?: number[];
  notion?: {
    accessToken?: string;
    refreshToken?: string;
    databaseId?: string;
    workspaceName?: string;
  };
}

export type ViewMode = "tasks" | "calendar";

export interface FilterState {
  search: string;
  courses: number[];
  tags: string[];
  priorities: string[];
  dueDateRange: { start: string | null; end: string | null };
  hideCompleted: boolean;
}
