"""Tool groups: session-level toggle metadata and tool-set assembly.

Reads ``config/tools.yaml``, derives groups from each tool's ``app`` (or an
explicit ``group``), generates a JSON schema per tool (an explicit ``parameters``
block or one introspected from the resolved function), registers the app tools
into the coordinator registry via a :class:`ToolResult`-bridging adapter, and
exposes the helpers the coordinator and API use to assemble and gate the tool set.

Assembly emits a provider-neutral :class:`~utils.shared.llm.kit.types.ToolDef`,
not a wire envelope. The three vendors disagree about the shape — OpenAI nests
the schema under ``function.parameters``, Anthropic calls it ``input_schema``,
Gemini wants ``function_declarations`` — and that translation belongs to each
adapter, which already does it. Emitting the OpenAI envelope here made every
non-OpenAI provider a 400.

See ``docs/tool-groups.md`` for the decision record (D12-D15).
"""

from __future__ import annotations

import importlib
import inspect
import logging
import types
import typing
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from django.conf import settings

from utils.agents.schemas.agent import ToolResult
from utils.shared.llm.kit.types import ToolDef

logger = logging.getLogger(__name__)

# Keyword args that are dependency-injection seams on the app tools, not model
# inputs. They always have defaults and must never appear in a tool schema.
_INJECTED_PARAMS = {"service", "scraper", "store"}

CORE_GROUP = "core"


# --- config access ------------------------------------------------------------

@lru_cache(maxsize=1)
def _config() -> dict:
    path = Path(settings.BASE_DIR) / "config" / "tools.yaml"
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _tools_config() -> Dict[str, dict]:
    return _config().get("tools", {}) or {}


def _groups_config() -> Dict[str, dict]:
    return _config().get("tool_groups", {}) or {}


# --- group model --------------------------------------------------------------

def group_of(tool_name: str) -> Optional[str]:
    """Return the group id a tool belongs to, or ``None`` if unknown."""
    meta = _tools_config().get(tool_name)
    if not meta:
        return None
    return meta.get("group") or meta.get("app")


@lru_cache(maxsize=1)
def tool_groups() -> Dict[str, List[str]]:
    """Map of ``group id -> sorted list of tool names``."""
    groups: Dict[str, List[str]] = {}
    for name, meta in _tools_config().items():
        grp = meta.get("group") or meta.get("app")
        if not grp:
            continue
        groups.setdefault(grp, []).append(name)
    for names in groups.values():
        names.sort()
    return groups


def all_group_ids() -> List[str]:
    """All known group ids, ``core`` first then alphabetical."""
    ids = set(_groups_config().keys()) | set(tool_groups().keys())
    return sorted(ids, key=lambda g: (g != CORE_GROUP, g))


def group_label(group: str) -> str:
    cfg = _groups_config().get(group, {})
    return cfg.get("label") or group.replace("_", " ").title()


def group_requires(group: str) -> Optional[str]:
    """The capability a group is gated behind (D15), or ``None``."""
    return _groups_config().get(group, {}).get("requires")


def group_description(group: str) -> str:
    """One sentence on what the group's tools reach, for the router and the UI."""
    text = _groups_config().get(group, {}).get("description")
    if text:
        return str(text).strip()
    return f"Tools: {', '.join(tool_groups().get(group, []))}"


def group_keywords(group: str) -> List[str]:
    """Words that indicate the group in a plain request (router fallback only)."""
    words = _groups_config().get(group, {}).get("keywords") or []
    return [str(w).strip().lower() for w in words if str(w).strip()]


def selectable_groups(pinned=None, capabilities: Optional[set] = None) -> List[str]:
    """Groups the router may add to a turn: every known non-core group that is
    not already pinned and whose ``requires`` capability (D15) is satisfied."""
    pinned_set = set(pinned or [])
    capabilities = capabilities or set()
    out: List[str] = []
    for group in all_group_ids():
        if group == CORE_GROUP or group in pinned_set:
            continue
        requires = group_requires(group)
        if requires and requires not in capabilities:
            continue
        out.append(group)
    return out


def _group_default_enabled(group: str) -> bool:
    cfg = _groups_config().get(group, {})
    if "default_enabled" in cfg:
        return bool(cfg["default_enabled"])
    return group == CORE_GROUP


def default_enabled_groups() -> List[str]:
    """Groups a fresh session starts with enabled."""
    return [g for g in all_group_ids() if _group_default_enabled(g)]


def unknown_groups(groups) -> List[str]:
    known = set(all_group_ids())
    return [g for g in (groups or []) if g not in known]


def normalize_enabled_groups(groups) -> List[str]:
    """Keep only known group ids, de-duplicated, preserving order."""
    known = set(all_group_ids())
    out: List[str] = []
    for g in groups or []:
        if g in known and g not in out:
            out.append(g)
    return out


def resolve_enabled_groups(
    requested, capabilities: Optional[set] = None
):
    """Validate a client-requested enabled-group set for one turn.

    Returns ``(groups, error)`` where exactly one is non-``None``:

    - ``requested is None`` -> the default enabled set (backward compatible).
    - a non-list, or unknown group ids -> a ``validation_error`` envelope.
    - a group whose ``requires`` capability is not in ``capabilities`` (D15) ->
      a ``permission_denied`` envelope carrying the ``enable_tool_group`` action.
    - otherwise -> the normalized, de-duplicated list of known groups.
    """
    if requested is None:
        return default_enabled_groups(), None
    if not isinstance(requested, list):
        return None, {
            "code": "validation_error",
            "message": "enabled_groups must be a list of group ids.",
            "details": {},
        }
    unknown = unknown_groups(requested)
    if unknown:
        return None, {
            "code": "validation_error",
            "message": f"Unknown tool group(s): {', '.join(unknown)}.",
            "details": {"unknown": unknown, "known": all_group_ids()},
        }
    capabilities = capabilities or set()
    normalized = normalize_enabled_groups(requested)
    for group in normalized:
        requires = group_requires(group)
        if requires and requires not in capabilities:
            return None, {
                "code": "permission_denied",
                "message": f"Tool group '{group}' requires '{requires}' first.",
                "details": {
                    "action": "enable_tool_group",
                    "group": group,
                    "requires": requires,
                },
            }
    return normalized, None


def group_metadata() -> List[Dict[str, Any]]:
    """Descriptor list for ``GET /api/tools/groups``."""
    out: List[Dict[str, Any]] = []
    for group in all_group_ids():
        entry: Dict[str, Any] = {
            "id": group,
            "label": group_label(group),
            "description": group_description(group),
            "tools": tool_groups().get(group, []),
            "default_enabled": _group_default_enabled(group),
        }
        requires = group_requires(group)
        if requires:
            entry["requires"] = requires
        out.append(entry)
    return out


# --- schema generation --------------------------------------------------------

def _resolve_func(meta: dict):
    module = importlib.import_module(meta["module"])
    return getattr(module, meta["function"])


def _schema_for_annotation(annotation) -> Dict[str, Any]:
    """Map a Python type annotation to a JSON-schema fragment.

    ``X | None`` / ``Optional[X]`` unwrap to ``X``; heterogeneous unions and
    unknown/``Any`` annotations map to ``{}`` (accept anything).
    """
    none_type = type(None)
    origin = typing.get_origin(annotation)
    is_union = origin is typing.Union or isinstance(
        annotation, getattr(types, "UnionType", ())
    )
    if is_union:
        args = [a for a in typing.get_args(annotation) if a is not none_type]
        if len(args) == 1:
            return _schema_for_annotation(args[0])
        return {}
    if origin in (list, typing.List) or annotation in (list, typing.List):
        args = typing.get_args(annotation)
        if args:
            return {"type": "array", "items": _schema_for_annotation(args[0])}
        return {"type": "array"}
    if origin in (dict, typing.Dict) or annotation in (dict, typing.Dict):
        return {"type": "object"}
    if annotation is bool:
        return {"type": "boolean"}
    if annotation is int:
        return {"type": "integer"}
    if annotation is float:
        return {"type": "number"}
    if annotation is str:
        return {"type": "string"}
    return {}


def _resolve_hints(func) -> Dict[str, Any]:
    """Resolved type hints, tolerating ``from __future__ import annotations``.

    Under PEP 563 the annotations on a signature are plain strings, so
    ``get_type_hints`` (which evaluates them) is needed to recover real types.
    Falls back to a per-annotation eval if the whole-function resolution fails.
    """
    try:
        return typing.get_type_hints(func)
    except Exception:  # pragma: no cover - defensive
        hints: Dict[str, Any] = {}
        func_globals = getattr(func, "__globals__", {})
        for pname, ann in getattr(func, "__annotations__", {}).items():
            if not isinstance(ann, str):
                hints[pname] = ann
                continue
            try:
                hints[pname] = eval(ann, func_globals)  # noqa: S307 - repo source
            except Exception:
                pass
        return hints


def _introspect_parameters(func) -> Dict[str, Any]:
    sig = inspect.signature(func)
    hints = _resolve_hints(func)
    properties: Dict[str, Any] = {}
    required: List[str] = []
    for pname, param in sig.parameters.items():
        if param.kind in (param.VAR_KEYWORD, param.VAR_POSITIONAL):
            continue
        if pname in _INJECTED_PARAMS:
            continue
        ann = hints.get(pname, param.annotation)
        if ann is inspect.Parameter.empty or isinstance(ann, str):
            properties[pname] = {}
        else:
            properties[pname] = _schema_for_annotation(ann)
        if param.default is inspect.Parameter.empty:
            required.append(pname)
    schema: Dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def build_tool_schema(tool_name: str) -> Optional[ToolDef]:
    """Neutral tool definition for one tool, or ``None`` if unknown.

    ``parameters`` is plain JSON Schema; the adapter wraps it in whatever
    envelope its provider expects.
    """
    meta = _tools_config().get(tool_name)
    if not meta:
        return None
    params = meta.get("parameters")
    if params is None:
        try:
            params = _introspect_parameters(_resolve_func(meta))
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("tool-groups: could not introspect %s: %s", tool_name, exc)
            params = {"type": "object", "properties": {}}
    return ToolDef(
        name=tool_name,
        description=meta.get("description", ""),
        parameters=params,
    )


def build_tool_schemas(enabled_groups: Optional[List[str]] = None) -> List[ToolDef]:
    """Tool definitions for every tool in the enabled groups (D14 assembly)."""
    if enabled_groups is None:
        enabled_groups = default_enabled_groups()
    enabled = set(enabled_groups)
    schemas: List[ToolDef] = []
    for group in all_group_ids():
        if group not in enabled:
            continue
        for tool_name in tool_groups().get(group, []):
            schema = build_tool_schema(tool_name)
            if schema:
                schemas.append(schema)
    return schemas


# --- prompt assembly ----------------------------------------------------------

def _resolve_prompt(spec: Optional[str]) -> Optional[str]:
    if not spec or ":" not in spec:
        return None
    mod_path, attr = spec.split(":", 1)
    try:
        value = getattr(importlib.import_module(mod_path), attr)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("tool-groups: could not load prompt %s: %s", spec, exc)
        return None
    return value if isinstance(value, str) else None


def tools_prompt_for(enabled_groups: Optional[List[str]] = None) -> str:
    """Concatenated ``*_TOOLS_PROMPT`` blocks for the enabled groups."""
    if enabled_groups is None:
        enabled_groups = default_enabled_groups()
    enabled = set(enabled_groups)
    blocks: List[str] = []
    for group in all_group_ids():
        if group not in enabled:
            continue
        text = _resolve_prompt(_groups_config().get(group, {}).get("prompt"))
        if text:
            blocks.append(text.strip())
    return "\n\n".join(blocks)


# --- registry wiring ----------------------------------------------------------

def _adapt(tool_name: str, func):
    """Wrap an app tool (returns a plain dict) into a coordinator ``ToolResult``."""

    def wrapper(**kwargs) -> ToolResult:
        raw = func(**kwargs)
        if isinstance(raw, ToolResult):
            return raw
        if isinstance(raw, dict):
            err = raw.get("error")
            if isinstance(err, dict):
                message = err.get("message") or "Tool failed"
                return ToolResult(
                    success=False, result=raw, summary=f"{tool_name}: {message}",
                    artifact_ids=[],
                )
            arts = raw.get("artifact_ids")
            return ToolResult(
                success=True,
                result=raw,
                summary=raw.get("summary") or f"{tool_name} completed.",
                artifact_ids=arts if isinstance(arts, list) else [],
            )
        return ToolResult(
            success=True, result={"value": raw}, summary=f"{tool_name} completed.",
            artifact_ids=[],
        )

    wrapper.__name__ = f"adapted_{tool_name}"
    return wrapper


_registered = False


def register_app_tools(force: bool = False) -> None:
    """Register every non-core tool into the coordinator registry (idempotent).

    Core tools register themselves via ``@registry.register`` decorators in
    ``utils.agents.tools.registry`` and are skipped here.
    """
    global _registered
    if _registered and not force:
        return
    from utils.agents.tools.registry import registry

    for tool_name, meta in _tools_config().items():
        group = meta.get("group") or meta.get("app")
        if group == CORE_GROUP:
            continue
        try:
            func = _resolve_func(meta)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("tool-groups: could not import %s: %s", tool_name, exc)
            continue
        registry.register(tool_name)(_adapt(tool_name, func))
    _registered = True


# Wire app tools in when this module is imported (the coordinator imports it).
register_app_tools()
