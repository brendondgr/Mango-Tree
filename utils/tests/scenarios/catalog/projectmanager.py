"""Project manager tools (4): list projects, deadlines, create project, add goals."""

from __future__ import annotations

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import find

G = ["core", "projectmanager"]


def _project_titles(sb):
    from utils.apps.projectmanager.backend.services import projects
    return [p.title for p in projects.list_projects()]


SCENARIOS = [
    h.Scenario(
        id="projectmanager.board",
        title="What projects exist and what is due",
        groups=G,
        prompt="What projects am I working on, and is anything due soon?",
        turns=[
            h.calls(
                h.call("projectmanager_list_projects", "the board"),
                h.call("projectmanager_list_goals_with_deadlines", "'due soon' -> the deadline view, soonest first",
                       check=lambda r: _assert(any(g["title"] == "Order lumber" for g in r["goals"]))),
            ),
            h.answer("Scenario Garden Build is active; 'Order lumber' is due tomorrow."),
        ],
        live=h.LiveExpectation(required=["projectmanager_list_projects", "projectmanager_list_goals_with_deadlines"],
                               answer_any=["lumber", "garden"]),
    ),
    h.Scenario(
        id="projectmanager.new_project_with_goals",
        title="Create a project, then add goals to it",
        groups=G,
        prompt=("Start a project 'Scenario Kitchen Refresh' in the Home category (orange), due 2026-12-01, "
                "with two goals: 'Pick a paint color' due 2026-10-01 and 'Replace cabinet handles'."),
        notes="create_goals needs the integer id create_project returned; goals cannot be created first.",
        turns=[
            h.calls(h.call("projectmanager_create_project", "the project must exist before goals can attach",
                           project={"title": "Scenario Kitchen Refresh", "category_name": "Home",
                                    "category_color": "orange", "deadline": "2026-12-01T00:00:00"})),
            h.calls(h.dynamic("projectmanager_create_goals", "attach both goals in one call using the returned id",
                              lambda ctx: {"project_id": ctx.result("projectmanager_create_project")["project"]["id"],
                                           "goals": [{"title": "Pick a paint color", "deadline": "2026-10-01T00:00:00"},
                                                     {"title": "Replace cabinet handles"}]},
                              check=lambda r: _assert(len(r["goals"]) == 2))),
            h.answer("Created Scenario Kitchen Refresh with two goals."),
        ],
        live=h.LiveExpectation(required=["projectmanager_create_project", "projectmanager_create_goals"],
                               order=[("projectmanager_create_project", "projectmanager_create_goals")]),
        verify=lambda sb: _assert("Scenario Kitchen Refresh" in _project_titles(sb)),
    ),
    h.Scenario(
        id="projectmanager.add_goal_to_existing",
        title="Add a goal to an existing project found by name",
        groups=G,
        prompt="Add a goal 'Install drip lines' to the Scenario Garden Build project.",
        turns=[
            h.calls(h.call("projectmanager_list_projects", "resolve the project id by title")),
            h.calls(h.dynamic("projectmanager_create_goals", "use the id from the list",
                              lambda ctx: {"project_id": find(ctx.result("projectmanager_list_projects")["projects"],
                                                              title="Scenario Garden Build")["id"],
                                           "goals": [{"title": "Install drip lines"}]})),
            h.answer("Added 'Install drip lines' to Scenario Garden Build."),
        ],
        live=h.LiveExpectation(required=["projectmanager_list_projects", "projectmanager_create_goals"],
                               order=[("projectmanager_list_projects", "projectmanager_create_goals")]),
    ),
    h.Scenario(
        id="projectmanager.typed_errors",
        title="Unknown project and bad color are typed errors",
        groups=G,
        prompt="Add a goal to project 999999, and create a project 'Neon' with category color 'chartreuse'.",
        turns=[
            h.calls(
                h.call("projectmanager_create_goals", "unknown project id", project_id=999999,
                       goals=[{"title": "x"}], expect=h.error("not_found")),
                h.call("projectmanager_create_project", "color outside the palette",
                       project={"title": "Neon", "category_name": "Misc", "category_color": "chartreuse"},
                       expect=h.error("validation_error")),
            ),
            h.answer("Project 999999 does not exist, and chartreuse is not one of the allowed colors."),
        ],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
