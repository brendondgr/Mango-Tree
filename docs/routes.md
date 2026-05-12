# Routes

The initial frontend skeleton defines only one route.

| Route | Purpose | Auth | Data |
| --- | --- | --- | --- |
| `/` | Structural landing shell for the future agent runtime dashboard. | Public/local only for now. | Static placeholder content. |

## Future Route Candidates

- `/tasks` for task history and active runs.
- `/agents` for orchestrator, general agent, and specialists.
- `/workflows` for workflow manifests and status.
- `/tools` for tool registry and capability bundles.
- `/memory` for namespace and dataset visibility.
- `/traces` for events, artifacts, and logs.

These routes should not be implemented until the corresponding API contract or static data contract is documented.
