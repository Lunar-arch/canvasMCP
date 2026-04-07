export type WaitType = "duration" | "url" | "selector" | "navigation";
export type MacroIfConditionType =
  | "always"
  | "urlIncludes"
  | "urlMatches"
  | "elementExists"
  | "elementNotExists"
  | "elementTextContains"
  | "elementTextEquals";

export interface MacroStep {
  id: string;
  action: "click" | "fill" | "navigate" | "wait" | "press" | "newTab" | "switchTab" | "if";
  selector?: string;
  value?: string;
  url?: string;
  key?: string;
  waitTime?: number;
  waitType?: WaitType;
  waitUrl?: string;
  waitSelector?: string;
  tabUrl?: string;
  parentIfId?: string;
  ifConditionType?: MacroIfConditionType;
  ifTarget?: string;
  ifValue?: string;
  ifCaseSensitive?: boolean;
  label: string;
}

export interface FieldMapping {
  id: string;
  selector: string;
  attribute: "textContent" | "href" | "value" | "innerHTML" | "src";
  taskField: "title" | "description" | "dueAt" | "htmlUrl" | "courseName" | "estimatedMinutes" | "custom";
  customFieldName?: string;
  transform?: string;
  isRepeating: boolean;
}

export interface MacroSchedule {
  type: "manual" | "immediate" | "hourly" | "daily" | "weekly";
  time?: string;
  dayOfWeek?: number;
}

export interface MacroCredential {
  id: string;
  key: string;
  value: string;
  label: string;
  isSecret: boolean;
}

export interface Macro {
  id: string;
  name: string;
  description?: string;
  sourceType: "canvas" | "generic";
  schoolName?: string;
  steps: MacroStep[];
  fieldMappings: FieldMapping[];
  schedule: MacroSchedule;
  credentials: MacroCredential[];
  enabled: boolean;
  lastRun?: string;
  lastRunStatus?: "success" | "error";
}

export interface CanvasConfig {
  username: string;
  password: string;
  portalUrl: string;
  schoolName: string;
  macroSteps: MacroStep[];
  syncOptions?: CanvasSyncOptions;
}

export interface CanvasSyncOptions {
  trackedCourseIds?: number[];
  onlyAddFromDate?: string | null;
  excludeNoDueDateTasks?: boolean;
  reviewNoDueDateTasks?: boolean;
  approvedNoDueAssignmentIds?: number[];
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

export interface FocusSession {
  startTime: string; // ISO date string
  endTime: string;   // ISO date string
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
    onDay?: string;       // ISO date string — reminder on a specific day
    timeBefore?: string;  // cron expression — e.g. "0 9 * * 1"
  };
  fileLinks: FileLink[];
  links: UrlLink[];
  taskLinks: string[]; // IDs of linked StudyTasks
}

export interface TaskBlock {
  id: string;
  name: string;
  color: string;
  order: number;
  breakMinutes?: number;
}

export interface AppData {
  config: CanvasConfig | null;
  macros: Macro[];
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

export type ViewMode = "tasks" | "calendar";

export interface FilterState {
  search: string;
  courses: number[];
  tags: string[];
  priorities: string[];
  dueDateRange: { start: string | null; end: string | null };
  hideCompleted: boolean;
}
