"""The tool-calling loop, written once instead of once per provider.

Every provider expresses tool use differently on the wire, but the *loop* is
identical: send, check for tool calls, execute them, append results, repeat.
`run_tools` implements that against the normalized types, so the same agent
code runs on Claude, GPT, Gemini, and a Qwen model on a local vLLM box.

Two things this handles that hand-rolled loops usually miss:

  * Thinking/reasoning blocks are carried forward. Anthropic 400s if you drop
    a thinking block between a tool call and its result; Gemini 3 400s if a
    function_call loses its thought_signature. `ChatResponse.as_message()`
    preserves both, and this loop uses it.
  * A tool that raises is reported back to the model as an error result rather
    than crashing the process — models recover from that surprisingly well.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Iterator, Optional, Union

from .base import Provider
from .errors import LLMError, ToolExecutionError
from .params import GenParams
from .types import (
    ChatResponse,
    Message,
    StreamChunk,
    ToolCall,
    ToolDef,
    ToolResult,
    Usage,
)


@dataclass
class AgentStep:
    """One turn of the loop, for logging or a UI transcript."""

    index: int
    response: ChatResponse
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    elapsed_s: float = 0.0


@dataclass
class AgentRun:
    final: ChatResponse
    steps: list[AgentStep] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)
    usage: Usage = field(default_factory=Usage)
    stopped_because: str = "completed"

    @property
    def text(self) -> str:
        return self.final.text

    def __str__(self) -> str:
        return self.final.text


ToolExecutor = Callable[[ToolCall], Any]


def default_executor(tools: list[ToolDef]) -> ToolExecutor:
    """Dispatch to the `fn` attached to each ToolDef."""
    by_name = {t.name: t for t in tools}

    def execute(call: ToolCall) -> Any:
        tool = by_name.get(call.name)
        if tool is None:
            raise ToolExecutionError(f"Model called unknown tool {call.name!r}")
        if tool.fn is None:
            raise ToolExecutionError(
                f"Tool {call.name!r} has no `fn`; pass an executor= instead"
            )
        if call.arguments.get("_parse_error"):
            raise ToolExecutionError(
                f"Model emitted invalid JSON arguments for {call.name!r}: "
                f"{call.arguments.get('_raw')!r}"
            )
        return tool.fn(**call.arguments)

    return execute


def run_tools(
    provider: Provider,
    messages: Iterable[Union[Message, dict]],
    tools: list[ToolDef],
    *,
    model: Optional[str] = None,
    params: Optional[GenParams] = None,
    executor: Optional[ToolExecutor] = None,
    max_steps: int = 10,
    on_step: Optional[Callable[[AgentStep], None]] = None,
    **kwargs: Any,
) -> AgentRun:
    """Run the model until it stops asking for tools.

        run = run_tools(reg["openai"], msgs, [ToolDef.from_function(get_weather)])
        print(run.text, run.usage.total_tokens)

    `max_steps` is a hard stop, not a suggestion — a model in a tool loop with
    a failing tool will otherwise happily burn your budget. When it trips,
    `stopped_because == "max_steps"`.
    """
    from .types import normalize_messages

    history = list(normalize_messages(messages))
    execute = executor or default_executor(tools)
    steps: list[AgentStep] = []
    total = Usage()
    stopped = "completed"

    for index in range(max_steps):
        started = time.monotonic()
        response = provider.chat(
            history, model=model, tools=tools, params=params, **kwargs
        )
        total = total + response.usage

        # Preserve reasoning state — dropping it breaks the next request on
        # Anthropic and Gemini.
        history.append(response.as_message())

        step = AgentStep(
            index=index,
            response=response,
            tool_calls=list(response.tool_calls),
            elapsed_s=time.monotonic() - started,
        )

        if not response.tool_calls:
            steps.append(step)
            if on_step:
                on_step(step)
            return AgentRun(
                final=response, steps=steps, messages=history,
                usage=total, stopped_because=stopped,
            )

        results: list[ToolResult] = []
        for call in response.tool_calls:
            try:
                value = execute(call)
                content = value if isinstance(value, str) else json.dumps(
                    value, default=str
                )
                results.append(ToolResult(call.id, content, name=call.name))
            except Exception as exc:
                # Report the failure to the model rather than aborting; models
                # routinely retry with corrected arguments.
                results.append(
                    ToolResult(
                        call.id,
                        f"Error: {type(exc).__name__}: {exc}",
                        is_error=True,
                        name=call.name,
                    )
                )
        step.tool_results = results
        steps.append(step)
        if on_step:
            on_step(step)

        history.append(Message(role="tool", tool_results=results))

    stopped = "max_steps"
    return AgentRun(
        final=steps[-1].response if steps else ChatResponse(),
        steps=steps,
        messages=history,
        usage=total,
        stopped_because=stopped,
    )


def stream_tools(
    provider: Provider,
    messages: Iterable[Union[Message, dict]],
    tools: list[ToolDef],
    *,
    model: Optional[str] = None,
    params: Optional[GenParams] = None,
    executor: Optional[ToolExecutor] = None,
    max_steps: int = 10,
    **kwargs: Any,
) -> Iterator[StreamChunk]:
    """Same loop, but yields chunks so a UI can render tokens as they arrive.

    Emits an extra synthetic chunk type via `raw`: after each tool executes, a
    `StreamChunk(type="tool_call", raw={"result": ...})` is emitted so the UI
    can show the tool's output inline.
    """
    from .types import normalize_messages

    history = list(normalize_messages(messages))
    execute = executor or default_executor(tools)

    for _ in range(max_steps):
        text_parts: list[str] = []
        thinking_parts: list[str] = []
        calls: list[ToolCall] = []
        final_usage = Usage()

        for chunk in provider.stream(
            history, model=model, tools=tools, params=params, **kwargs
        ):
            if chunk.type == "text":
                text_parts.append(chunk.text)
            elif chunk.type == "thinking":
                thinking_parts.append(chunk.text)
            elif chunk.type == "tool_call" and chunk.tool_call:
                calls.append(chunk.tool_call)
            elif chunk.type == "done":
                final_usage = chunk.usage or Usage()
            yield chunk

        history.append(
            Message(
                role="assistant",
                content="".join(text_parts),
                tool_calls=calls,
                thinking="".join(thinking_parts) or None,
            )
        )

        if not calls:
            return

        results = []
        for call in calls:
            try:
                value = execute(call)
                content = value if isinstance(value, str) else json.dumps(
                    value, default=str
                )
                results.append(ToolResult(call.id, content, name=call.name))
            except Exception as exc:
                content = f"Error: {type(exc).__name__}: {exc}"
                results.append(
                    ToolResult(call.id, content, is_error=True, name=call.name)
                )
            yield StreamChunk(
                type="tool_call",
                tool_call=call,
                raw={"result": results[-1].content, "is_error": results[-1].is_error},
            )
        history.append(Message(role="tool", tool_results=results))

    yield StreamChunk(type="error", text="Reached max_steps without completion")
