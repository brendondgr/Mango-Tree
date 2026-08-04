# Tool Groups & Session Toggles

Design record for the additive, user-controlled tool-group toggle system. Groups
are the unit of visibility: the coordinator assembles only enabled groups into the
LLM request, and the registry denies disabled tools at execution time.

## Why

Function-calling accuracy degrades as the visible tool catalogue grows (selection
quality drops well before 50 visible tools). `config/tools.yaml` already defines
**63 app tools across 8 apps**, but until this change none of them were wired into
the coordinator — `TOOL_SCHEMAS` exposed only the 6 core tools. Wiring all 63 in at
once would flood the model. Grouping + default-off makes the wiring safe: the
visible set stays small per session, and the user opts a group in when they need it.

So this change does two things at once:

1. **Wires the app tools into the coordinator** for the first time (schemas,
   registry execution, per-group prompt blocks), driven by `config/tools.yaml`.
2. **Gates that wiring by an enabled-group set** that the user controls.

## Decision record

- **D12 — Additive composition.** Enabling a group *adds* its tool group to the
  session's tool set; it never removes another. Scopes don't interact — filesystem
  confinement, account scoping, and network allowlists stay independently enforced
  in code, unchanged by toggles.
- **D13 — Toggle granularity is the group, not the tool.** Groups derive from the
  `app:` field already on every `tools.yaml` entry (`mailbox`, `calendar`,
  `exercise`, `projectmanager`, `imdbspy`, `recipes`, `timekeeper`, `media_viewer`),
  plus a synthetic **`core`** group for the six base tools (artifacts, skills,
  web search, chat-context). Nine switches, not sixty-three. Per-tool overrides can
  layer on later without changing the contract.
- **D14 — Toggles are enforced in code, twice.**
  1. *Assembly* — the coordinator builds `build_tool_schemas(enabled_groups)` and the
     tool-prompt sections only from enabled groups, so disabled tools never enter the
     model's context. This is the optimization.
  2. *Execution* — `registry.execute(name, args, enabled_groups=...)` checks the
     session's enabled set and returns the standard `permission_denied` envelope for
     a disabled tool. This is the guarantee — a hallucinated or stale call can't slip
     through.
- **D15 — Generic per-group precondition (`requires`).** A group may declare
  `requires: <capability>`; it can only be enabled when the session satisfies that
  capability, enforced server-side and reflected in the UI (switch disabled with a
  hint). No group declares a `requires` today (the originally-planned `workspace`
  group depended on a workspace-binding app that does not exist in this repo), but
  the mechanism ships ready so a future capability-gated group is a config change,
  not a code change.

## Persistence model

Global default + per-session override (matches how mailbox prefs already work in the
store). A persisted `defaultEnabledToolGroups` preference seeds every new chat;
`/enable`, `/disable`, and the toggle popover mutate only the current session.
`startNewChat` resets the session's enabled set back to the saved default.

## Config shape (`config/tools.yaml`)

```yaml
tool_groups:            # group-level metadata (new)
  core:
    label: Core
    default_enabled: true
  mailbox:
    label: Mailbox
    default_enabled: false
    prompt: utils.apps.mailbox.agent.prompts:MAILBOX_TOOLS_PROMPT
  # ... one entry per app; optional `requires: <capability>`
tools:
  list_artifacts:       # core tools added here with explicit `parameters`
    app: core
    module: utils.agents.tools.registry
    function: list_artifacts
    description: List all files in the artifacts directory.
    parameters: { type: object, properties: {} }
  mailbox_list_messages:
    app: mailbox        # group derives from `app` unless `group:` overrides
    module: utils.apps.mailbox.agent.tools
    function: list_messages
    description: List messages in a folder.
    # no `parameters` -> schema introspected from the function signature
```

- **Group** of a tool = `entry.get("group", entry["app"])`.
- **default_enabled** of a group comes from `tool_groups`, defaulting to `False`
  (only `core` is `True`).
- **Schema** of a tool = explicit `entry["parameters"]` if present, else generated
  by introspecting the resolved function signature (keyword-only params; skip the
  injected `service`/context params; map `str/int/float/bool/list/dict`; unwrap
  `X | None` to optional).
- **ToolResult bridging** — app tools return plain dicts (`{...}` or
  `{"error": {...}}`); a registration adapter wraps them into the coordinator's
  `ToolResult(success, result, summary, artifact_ids)` so `registry.execute` is
  uniform. Core tools already return `ToolResult` and pass through.

## Where it lives

All nine stages of this design have shipped. The implementation is spread across:

| Concern | Location |
| --- | --- |
| Group metadata + loader | `utils/agents/tools/groups.py` — `tool_groups()`, `group_of`, `default_enabled_groups`, `build_tool_schemas`, `tools_prompt_for`, `group_metadata` |
| App-tool registration adapter | `register_app_tools()` in the same module, run at import |
| Session tool state | `AgentState.enabled_groups` / `workspace_id`, parsed and validated in `utils/api/routes/agent.py` |
| Conditional assembly | `build_tool_schemas(enabled_groups)` and `build_system_prompt(mode, enabled_groups)` — only enabled groups contribute schemas and prompt blocks |
| Execution enforcement | `registry.execute(..., enabled_groups)` in `utils/agents/tools/registry.py`, denying with `details.action = "enable_tool_group"` |
| API surface | `GET /api/tools/groups/` (`utils/api/routes/tools.py`) |
| Store + turn payload | `web/src/app/stores/workspaceStore.ts` — persisted `defaultEnabledToolGroups`, session `enabledToolGroups` / `boundWorkspaceId` |
| Toggle popover | `web/src/features/chat/components/ToolGroupsPopover.tsx` |
| Slash commands | `/tools`, `/enable <group>`, `/disable <group>` — store mutations only, no endpoints |
| Inline enable chip | `EnableToolGroupChip.tsx`, rendered from a denied `enable_tool_group` result |

Tests: `utils/tests/agents/test_tool_group*.py` and
`web/src/app/stores/workspaceStore.toolGroups.test.ts`.

## Assumptions

- The `core` group is always available and default-on; disabling it is allowed but
  strips the base tools (artifacts/skills/web-search) from the turn.
- Introspected schemas are sufficient for scalar/array params; tools with rich object
  params get an explicit `parameters` override in `tools.yaml` as needed.
- No behavioural change for existing clients: a turn with no `enabled_groups` uses the
  default set, so today's frontend keeps working through S1–S5.
