from __future__ import annotations

from django.db import models


class Project(models.Model):
    """A project. Bound to the legacy ``project`` table.

    ``managed = False`` so Django never issues DDL. The lifecycle timestamps
    (``date_completed``/``date_on_hold``/``date_abandoned``) mirror the status,
    exactly as the legacy app maintained them.
    """

    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, default="Active")
    category = models.ForeignKey(
        "projectmanager.Category",
        on_delete=models.DO_NOTHING,
        db_column="category_id",
        related_name="projects",
    )
    progress = models.IntegerField(default=0, null=True)
    order_index = models.IntegerField(default=0, null=True)
    date_created = models.DateTimeField(null=True, blank=True)
    date_completed = models.DateTimeField(null=True, blank=True)
    date_on_hold = models.DateTimeField(null=True, blank=True)
    date_abandoned = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "projectmanager"
        managed = False
        db_table = "project"
