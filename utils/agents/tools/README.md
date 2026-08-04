# Tools

The tool registry and the tool-group gate.

| File | Role |
| --- | --- |
| `registry.py` | `ToolRegistry` (dict-backed `register` decorator + `execute`), and the core tools |
| `groups.py` | Reads `config/tools.yaml`, derives groups, generates JSON schemas, and registers every app tool at import time |
| `web_search.py` | The `search_web` core tool, backed by `utils/shared/search/` |

## Core tools

Registered directly in this package, in the always-on `core` group:
`list_artifacts`, `read_artifact`, `inspect_skills`, `read_skill`,
`inspect_chat_context`, `search_web`.

## App tools

App tools are **not** registered by decorators in the app packages. Each is
declared in `config/tools.yaml` with its `app`, `module`, `function`, and
parameter schema; `register_app_tools()` in `groups.py` imports and wraps each
one at module import. To add a tool, write the function under
`utils/apps/{app}/agent/tools.py` and add a `config/tools.yaml` entry.

## Enforcement

A tool's group is its `app` value unless it sets `group`. Only `core` is
`default_enabled`; all 63 app tools start off. The enabled set is client-driven
per turn, validated by `resolve_enabled_groups`, and enforced twice:
`build_tool_schemas` only offers schemas for enabled groups, and
`registry.execute` denies a disabled group's tool with a `permission_denied`
result even if the model calls it anyway.

See `docs/tool-groups.md`.
