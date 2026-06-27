import { CalendarDays, ListTodo } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { type CalendarView, useWorkspaceStore } from "@/app/stores/workspaceStore";
import { CalendarView as CalendarGrid } from "@calendar/components/CalendarView";
import { SchedulesView } from "@calendar/components/SchedulesView";

import "@calendar/styles/calendar.css";

const NAV: Array<{ id: CalendarView; label: string; icon: LucideIcon }> = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "schedules", label: "Schedules", icon: ListTodo },
];

export function CalendarWorkspace() {
  const view = useWorkspaceStore((s) => s.calendarView);
  const setView = useWorkspaceStore((s) => s.setCalendarView);

  return (
    <div className="calendar-app flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <nav className="flex items-center gap-1.5" aria-label="Calendar sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="calendar-tab"
                data-active={active}
                aria-current={active ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "calendar" ? <CalendarGrid /> : <SchedulesView />}
      </div>
    </div>
  );
}
