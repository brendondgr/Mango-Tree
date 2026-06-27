from __future__ import annotations

from django.db import models


class Goal(models.Model):
    """A goal belonging to a project. Bound to the legacy ``goal`` table."""

    id = models.AutoField(primary_key=True)
    project = models.ForeignKey(
        "projectmanager.Project",
        on_delete=models.DO_NOTHING,
        db_column="project_id",
        related_name="goals",
    )
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=20, default="Pending")
    date_created = models.DateTimeField(null=True, blank=True)
    date_completed = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "projectmanager"
        managed = False
        db_table = "goal"
