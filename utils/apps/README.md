# Utils Apps

Domain app modules. Each app follows the standard layout documented in `docs/skills/app-modules/`.

## Registered Apps

- `projects/` — Project management
- `notes/` — Notes and rich text
- `jobs/` — Job tracking
- `calendar/` — Calendar (implemented; weekly schedules + a dated calendar of merged schedule/direct events, themed PDF export — file-based JSON store, migrated from a standalone Flask app)
- `recipes/` — Recipe management
- `imdbspy/` — IMDbSpy (implemented; movie/TV tracker with IMDb scraping, weighted Fun/Grit/Comfort ratings, and a local media cache — dedicated managed SQLite store, migrated from a standalone Flask app)
- `exercise/` — Exercise tracking (implemented; workouts, routines, equipment, history, Strava import — migrated from the standalone WorkoutTracker app)
- `timekeeper/` — Time tracking

Each app contains `backend/`, `frontend/`, `agent/`, and `shared/` subdirectories.
