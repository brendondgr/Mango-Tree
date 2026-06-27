// Types for the projectmanager app API.
// Mirrors utils/apps/projectmanager/shared/schemas.py.

export interface DeadlineStatus {
  display: string;
  css_class: string;
  date_formatted: string;
  date_short: string;
  is_overdue: boolean;
  is_approaching: boolean;
}

export interface Category {
  id: number | null;
  name: string;
  color: string;
}

export interface Project {
  id: number;
  title: string;
  description: string | null;
  status: string;
  category: Category | null;
  progress: number;
  order_index: number;
  goal_count: number;
  completed_goal_count: number;
  date_created: string | null;
  date_completed: string | null;
  date_on_hold: string | null;
  date_abandoned: string | null;
  deadline: string | null;
  deadline_status: DeadlineStatus | null;
}

export interface Goal {
  id: number;
  project_id: number;
  title: string;
  status: string;
  date_created: string | null;
  date_completed: string | null;
  deadline: string | null;
  deadline_status: DeadlineStatus | null;
}

export interface NewProject {
  title: string;
  category_name: string;
  category_color?: string;
  description?: string | null;
  status?: string;
  deadline?: string | null;
}

export interface NewGoal {
  title: string;
  deadline?: string | null;
}

export interface ListResponse<T> {
  count: number;
  next: number | null;
  previous: number | null;
  results: T[];
}

export type TimelineItemType = "project" | "goal";

export interface TimelineItem {
  id: number;
  name: string;
  type: TimelineItemType;
  start_date: string | null;
  end_date: string | null;
  status: string;
  category_color: string;
  project_id: number | null;
  goal_count?: number;
  progress?: number;
}

export interface GanttAxisPoint {
  date: string;
  label: string;
  position: number;
}

export interface GanttData {
  items: TimelineItem[];
  dateAxis: GanttAxisPoint[];
  minDate: string;
  maxDate: string;
  zoomLevel: "day" | "week" | "month";
}

export interface TimelineFilters {
  status?: string[];
  type?: TimelineItemType;
  start_date?: string;
  end_date?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

// Project lifecycle states (board columns), in display order.
export const PROJECT_STATUSES = [
  "Active",
  "Completed",
  "On-Hold",
  "Abandoned",
] as const;

// Category colour suffixes understood by the UI (map to --projectmanager-cat-* tokens).
export const CATEGORY_COLORS = [
  "blue",
  "green",
  "purple",
  "orange",
  "red",
  "teal",
  "yellow",
  "pink",
] as const;
