"""Stage 2 verification: the managed=False models bind to the legacy project
database through the dedicated connection + router, preserving the data."""

from __future__ import annotations

import pytest

from utils.apps.projectmanager.backend.models import Category, Goal, Project


def test_models_route_to_projectmanager_connection():
    assert Project.objects.db == "projectmanager"
    assert Goal.objects.db == "projectmanager"
    assert Category.objects.db == "projectmanager"


@pytest.mark.needs_legacy_data
def test_baseline_row_counts_preserved():
    assert Category.objects.count() == 7
    assert Project.objects.count() == 20
    assert Goal.objects.count() == 87


def test_models_are_unmanaged():
    assert Project._meta.managed is False
    assert Goal._meta.managed is False
    assert Category._meta.managed is False


@pytest.mark.needs_legacy_data
def test_foreign_key_relations_resolve():
    project = Project.objects.select_related("category").order_by("id").first()
    assert project.category is not None
    assert project.category.color  # colour suffix preserved
    # reverse relation: goals belong to their project
    assert all(goal.project_id == project.id for goal in project.goals.all())


@pytest.mark.needs_legacy_data
def test_two_goals_have_deadlines():
    assert Goal.objects.exclude(deadline__isnull=True).count() == 2


@pytest.mark.needs_legacy_data
def test_write_lands_in_projectmanager_db():
    Category.objects.create(name="QA-Binding", color="teal")
    assert Category.objects.filter(name="QA-Binding").exists()
    assert Category.objects.count() == 8
