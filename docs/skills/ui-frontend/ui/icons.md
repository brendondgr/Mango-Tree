# Icons

Use Lucide React icons consistently across the application.

## Rules

- Import from `lucide-react`.
- Default icon size: `h-4 w-4` (16px) inline with text; `h-5 w-5` (20px) in toolbars.
- Icon-only buttons require `aria-label`.
- Status icons pair with text labels (e.g., CheckCircle + "Complete").
- Navigation icons appear in the sidebar and command palette consistently.

## Common Mappings

| Action | Icon |
| --- | --- |
| Dashboard | LayoutDashboard |
| Projects | FolderKanban |
| Notes | FileText |
| Jobs | Briefcase |
| Calendar | Calendar |
| Chat | MessageSquare |
| Settings | Settings |
| Search | Search |
| Command palette | Command |
| Success | CheckCircle |
| Error | XCircle |
| Warning | AlertTriangle |
| Loading | Loader2 (with animate-spin) |

## Agent Status

Use animated Loader2 for in-progress agent tasks. Use CheckCircle (success color) or XCircle (destructive color) for terminal states.
