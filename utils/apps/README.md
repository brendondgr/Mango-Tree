# Utils Apps

Domain app modules. Each app follows the standard layout documented in `docs/skills/app-modules/`.

## Registered Apps

- `projects/` — Project management
- `notes/` — Notes and rich text
- `jobs/` — Job tracking
- `calendar/` — Calendar (implemented; weekly schedules + a dated calendar of merged schedule/direct events, themed PDF export — file-based JSON store, migrated from a standalone Flask app)
- `recipes/` — Recipe management
- `imdbspy/` — IMDB lookup and tracking
- `exercise/` — Exercise tracking (implemented; workouts, routines, equipment, history, Strava import — migrated from the standalone WorkoutTracker app)
- `timekeeper/` — Time tracking (implemented; 5-minute block time logging across user-defined categories + daily statistics — legacy SQLite bound read/write with `managed = False` models, migrated from a standalone Flask app)

Each app contains `backend/`, `frontend/`, `agent/`, and `shared/` subdirectories.
