"""Core tools (6): artifacts, skills, chat context, web search."""

from __future__ import annotations

from utils.agents.schemas.agent import AgentMessage
from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import find

G = ["core"]

SCENARIOS = [
    h.Scenario(
        id="core.read_uploaded_note",
        title="List artifacts, then read the markdown note",
        groups=G,
        prompt="What's in the notes file I uploaded?",
        notes="read_artifact accepts the id or filename from list_artifacts; text comes back inline.",
        turns=[
            h.calls(h.call("list_artifacts", "the user referred to a file; list to find it")),
            h.calls(h.dynamic("read_artifact", "read by the id the manifest listed",
                              lambda ctx: {"artifact_id": find(ctx.result("list_artifacts")["artifacts"],
                                                               filename="scenario-notes.md")["id"]},
                              check=lambda r: _assert("water the tomatoes" in r["content"]))),
            h.answer("Your note says to water the tomatoes on Thursday."),
        ],
        live=h.LiveExpectation(required=["list_artifacts", "read_artifact"],
                               order=[("list_artifacts", "read_artifact")], answer_any=["tomato"]),
    ),
    h.Scenario(
        id="core.look_at_image",
        title="An image artifact rides back as a separate media turn",
        groups=G,
        prompt="Describe the swatch image I saved.",
        turns=[
            h.calls(h.call("list_artifacts", "find the image")),
            h.calls(h.dynamic("read_artifact", "images are loaded and sent to the model as an image part",
                              lambda ctx: {"artifact_id": "scenario-swatch.png"},
                              check=lambda r: _assert(r["media_type"] == "image" and r["media_base64"]))),
            h.answer("It is a solid orange square."),
        ],
        live=h.LiveExpectation(required=["read_artifact"], answer_any=["orange", "yellow", "square", "solid", "color", "colour"]),
    ),
    h.Scenario(
        id="core.skills",
        title="Inspect then read a skill",
        groups=G,
        prompt="What skills do you have available? Read the artifacts one and summarise it.",
        turns=[
            h.calls(h.call("inspect_skills", "read_skill needs a valid name, so list first")),
            h.calls(h.call("read_skill", "the user named the artifacts skill", skill_name="artifacts",
                           check=lambda r: _assert("workspace" in r["content"]))),
            h.answer("The artifacts skill describes the workspace artifact store."),
        ],
        live=h.LiveExpectation(required=["inspect_skills", "read_skill"], order=[("inspect_skills", "read_skill")]),
    ),
    h.Scenario(
        id="core.chat_context",
        title="Inspect the conversation so far",
        groups=G,
        history=[AgentMessage(role="user", content="My cat is called Pumpkin."),
                 AgentMessage(role="agent", content="Noted: Pumpkin.")],
        prompt="Use your context tool to check: what did I say my cat is called?",
        notes="The observe node injects the state messages into the call; the model never supplies them.",
        turns=[
            h.calls(h.call("inspect_chat_context", "the user asked for the context tool explicitly",
                           check=lambda r: _assert(any("Pumpkin" in m["content"] for m in r["messages"])))),
            h.answer("You said your cat is called Pumpkin."),
        ],
        live=h.LiveExpectation(required=["inspect_chat_context"], answer_any=["pumpkin"]),
    ),
    h.Scenario(
        id="core.web_search_auto",
        title="Auto mode: an external fact triggers one search with citations",
        groups=G,
        prompt="What is the current Django LTS release? Search the web and cite your source.",
        turns=[
            h.calls(h.call("search_web", "the question needs current external facts", query="current Django LTS release",
                           check=lambda r: _assert(len(r["sources"]) == 2 and r["sources"][0]["index"] == 1))),
            h.answer("Django 5.2 is the current LTS [1]."),
        ],
        live=h.LiveExpectation(required=["search_web"], answer_any=["5.2", "django"]),
    ),
    h.Scenario(
        id="core.web_search_forced",
        title="Forced mode: the loop injects search_web when the model skips it",
        groups=G,
        web_search_mode="forced",
        prompt="What is the current Django LTS release?",
        notes="The model answers without searching; the reason node overrides that with an injected search_web call, then the model answers again with sources.",
        turns=[
            # The model's attempt to skip the search: the reason node discards
            # that answer and injects search_web with the user's message as query.
            h.answer("Django 4.2 is the LTS.", injected=[
                h.call("search_web", "web_search_mode=forced and no successful search yet -> the loop injects it",
                       check=lambda r: _assert(r["query"] == "What is the current Django LTS release?")),
            ]),
            h.answer("Django 5.2 is the current LTS [1]."),
        ],
    ),
    h.Scenario(
        id="core.missing_file",
        title="A missing artifact is reported, not invented",
        groups=G,
        prompt="Read the file called budget.xlsx.",
        turns=[
            h.calls(h.call("read_artifact", "read by filename; it does not exist", artifact_id="budget.xlsx",
                           expect=h.FAILED)),
            h.answer("There is no artifact called budget.xlsx."),
        ],
        live=h.LiveExpectation(required=["read_artifact"], answer_any=["no ", "not", "couldn't", "could not", "doesn't"]),
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
