"""The tool router against the configured model. Opt-in: ``MANGO_LIVE_LLM=1``.

Only the selection call runs here — no tool calling — so this works on a
server that cannot yet parse tool calls, and isolates the one decision the
automatic mode adds: *which app groups does this message need?* Each case is a
prompt with the groups the router must select and must not select.
"""

from __future__ import annotations

import pytest

from utils.agents.coordinator import selection
from utils.agents.schemas.agent import AgentMessage
from utils.tests.scenarios.conftest import live_llm_config, live_llm_enabled

pytestmark = pytest.mark.skipif(
    not live_llm_enabled(), reason="set MANGO_LIVE_LLM=1 to run the router against the configured model"
)

ALL = ["calendar", "exercise", "imdbspy", "mailbox", "media_viewer", "projectmanager", "recipes", "timekeeper"]

CASES = [
    ("log a run", [], "Log a 30 minute 5 km run for today.", {"exercise"}, {"mailbox", "imdbspy", "recipes"}),
    ("tomorrow's calendar", [], "What do I have on tomorrow?", {"calendar"}, {"exercise", "mailbox"}),
    ("unread mail", [], "Anything new in my inbox?", {"mailbox"}, {"exercise", "calendar"}),
    ("cook from pantry", [], "I have eggs, onions and rice. What can I cook?", {"recipes"}, {"mailbox", "exercise"}),
    ("unseen movies", [], "Which movies in my tracker haven't I seen yet?", {"imdbspy"}, {"exercise", "recipes"}),
    ("tracked minutes", [], "How many minutes did I track yesterday?", {"timekeeper"}, {"exercise", "mailbox"}),
    ("project deadlines", [], "Is anything due soon on my projects?", {"projectmanager"}, {"exercise", "mailbox"}),
    ("saved files", [], "What files have I saved? Show me only the images.", {"media_viewer"}, {"mailbox", "exercise"}),
    ("two apps", [], "Log my run from this morning and mark the show Severance as abandoned.", {"exercise", "imdbspy"}, {"mailbox"}),
    ("email to calendar", [], "Find Sam's lunch email and put lunch with Sam on Thursday at noon.", {"mailbox", "calendar"}, {"exercise"}),
    ("small talk", [], "Thanks, that's all for today!", set(), set(ALL)),
    ("about the assistant", [], "What can you help me with?", set(), set(ALL)),
    ("follow-up via context",
     [AgentMessage(role="user", content="Which movies haven't I seen?"),
      AgentMessage(role="agent", content="Only The Shawshank Redemption is unseen.")],
     "Mark it as seen then.", {"imdbspy"}, {"exercise", "mailbox"}),
]


@pytest.mark.parametrize("label,history,prompt,required,forbidden", CASES, ids=[c[0] for c in CASES])
def test_router_selects_the_right_groups(label, history, prompt, required, forbidden, django_db_blocker):
    messages = list(history) + [AgentMessage(role="user", content=prompt)]
    # Provider resolution reads the owner's provider table.
    with django_db_blocker.unblock():
        result = selection.select_tool_groups(messages, ALL, live_llm_config())
    chosen = set(result.selected)
    detail = f"\nprompt: {prompt!r}\nselected: {sorted(chosen)} via {result.source}\nreason: {result.reason}\nraw: {result.raw_text[:300]!r}"
    assert result.source == "model", "the router reply was not parseable JSON" + detail
    assert required <= chosen, f"missing {sorted(required - chosen)}" + detail
    assert not (forbidden & chosen), f"wrongly selected {sorted(forbidden & chosen)}" + detail
