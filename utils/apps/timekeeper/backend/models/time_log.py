from __future__ import annotations

from django.db import models


class TimeLog(models.Model):
    """A contiguous tracked interval. Bound to the legacy ``time_logs`` table.

    A row spans ``duration`` minutes starting at ``start_time`` (``HH:MM``) on
    ``date`` (``YYYY-MM-DD``), tagged with a free-form ``category_id`` /
    ``subcategory_id`` that reference ids in the categories taxonomy.
    """

    id = models.AutoField(primary_key=True)
    date = models.CharField(max_length=10, db_column="date")
    start_time = models.CharField(max_length=5, db_column="start_time")
    duration = models.IntegerField(db_column="duration")
    notes = models.TextField(null=True, blank=True, db_column="notes")
    category_id = models.CharField(
        max_length=64, null=True, blank=True, db_column="category_id"
    )
    subcategory_id = models.CharField(
        max_length=64, null=True, blank=True, db_column="subcategory_id"
    )
    created_at = models.DateTimeField(null=True, blank=True, db_column="created_at")

    class Meta:
        app_label = "timekeeper"
        managed = False
        db_table = "time_logs"
