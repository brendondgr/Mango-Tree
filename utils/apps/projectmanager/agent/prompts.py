from __future__ import annotations

# Planner-facing guidance for the projectmanager tools. Each tool calls the
# same service as the matching /api/projectmanager/ endpoint.
PROJECTMANAGER_TOOLS_PROMPT = """\
Project manager tools (projects and goals):

Read first to ground answers:
- projectmanager_list_projects — all projects with category, status, progress,
  and deadline. IDs are integers; reuse the exact id from this call.
- projectmanager_list_goals_with_deadlines — all goals that have a deadline set,
  sorted soonest first. Each goal carries a deadline_status (overdue/warning/normal).
  Use this to answer "what is due / overdue" questions.

Write:
- projectmanager_create_project — create a new project. Required fields:
  `title` (string) and `category_name` (string). Optional: `category_color`
  (one of blue/green/orange/pink/purple/red/teal/yellow; default blue),
  `description`, `deadline` (ISO 8601), `status` (Active/Completed/On-Hold/Abandoned;
  default Active).
- projectmanager_create_goals — add one or more goals to an existing project.
  Required: `project_id` (integer from list_projects) and `goals` (list of
  objects each with `title` and optional `deadline` in ISO 8601).

Notes:
- IDs are integers returned by read tools; never invent an id.
- Errors carry a stable `code` (validation_error, not_found); surface the
  message to the user rather than retrying blindly.
"""
