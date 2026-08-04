# Icons

Use Lucide React icons consistently across the application. Prefer rounded stroke icons where available to align with the Canva-inspired soft geometry.

## Rules

- Import from `lucide-react`.
- Default icon size: `h-4 w-4` (16px) inline with text; `h-5 w-5` (20px) in toolbars.
- Icon-only buttons require `aria-label`.
- Status icons pair with text labels (e.g., CheckCircle + "Complete").
- An app's nav-rail icon, launcher-card icon, and tab icon must be the same one;
  it is declared once in `appRegistry.tsx`.
- Canva's fixture uses filled rounded iconography; Lucide outline icons are acceptable — do not switch libraries for fill style alone.

## Common Mappings

| Action | Icon |
| --- | --- |
| Mailbox | Mail |
| Exercise | Dumbbell |
| Projects | FolderKanban |
| Calendar | CalendarDays |
| IMDbSpy | Film |
| Recipes | ChefHat |
| Artifacts | FolderOpen |
| Time Keeper | Clock |
| Chat | MessageSquare |
| Settings | Settings |
| Search | Search |
| Tool groups | SlidersHorizontal |
| Success | CheckCircle |
| Error | XCircle |
| Warning | AlertTriangle |
| Loading | Loader2 (with animate-spin) |

## Agent Status

Use animated Loader2 for in-progress agent tasks. Use CheckCircle (success color) or XCircle (destructive color) for terminal states.
