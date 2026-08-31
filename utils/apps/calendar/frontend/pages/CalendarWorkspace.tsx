import { CalendarDays, ListTodo } from "lucide-react";

import { type CalendarView, useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AppHeader } from "@/components/app-shell/AppHeader";
import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { CalendarView as CalendarGrid } from "@calendar/components/CalendarView";
import { SchedulesView } from "@calendar/components/SchedulesView";

import "@calendar/styles/calendar.css";

const NAV: Segment<CalendarView>[] = [
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "schedules", label: "Schedules", icon: ListTodo },
];

export function CalendarWorkspace() {
  const view = useWorkspaceStore((s) => s.calendarView);
  const setView = useWorkspaceStore((s) => s.setCalendarView);

  return (
    // `containerType` makes the pane itself the query container, so every
    // `@[…]` rule below reflows when the chat sidebar is dragged, not only when
    // the browser window changes size.
    <div
      className="calendar-app flex min-h-0 flex-1 flex-col bg-background"
      style={{ containerType: "inline-size" }}
    >
      <AppHeader
        icon={CalendarDays}
        title="Calendar"
        description="Recurring schedules and one-off events"
        nav={
          <SegmentedControl
            segments={NAV}
            value={view}
            onValueChange={setView}
            label="Calendar sections"
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "calendar" ? <CalendarGrid /> : <SchedulesView />}
      </div>
    </div>
  );
}
