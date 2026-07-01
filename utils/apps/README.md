# Utils Apps

Domain app modules. Each app follows the standard layout documented in `docs/skills/app-modules/`.

## Registered Apps

- `projects/` — Project management
- `notes/` — Notes and rich text
- `jobs/` — Job tracking
- `calendar/` — Calendar (implemented; weekly schedules + a dated calendar of merged schedule/direct events, themed PDF export — file-based JSON store, migrated from a standalone Flask app)
- `recipes/` — Recipe management (implemented; browse/filter recipes, pantry ingredient matching, and recipe CRUD with an LLM recipe-text parser — SQLite store bound `managed=False` and seeded on first run, migrated from a standalone Flask app)
- `imdbspy/` — IMDB lookup and tracking
- `exercise/` — Exercise tracking (implemented; workouts, routines, equipment, history, Strava import — migrated from the standalone WorkoutTracker app)
- `timekeeper/` — Time tracking

Each app contains `backend/`, `frontend/`, `agent/`, and `shared/` subdirectories.
