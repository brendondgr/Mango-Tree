from __future__ import annotations

from django.db import models


class Setting(models.Model):
    """Key/value config store. Bound to the legacy ``settings`` table.

    The single ``categories`` row holds the JSON category taxonomy.
    """

    key = models.CharField(max_length=100, primary_key=True, db_column="key")
    value = models.TextField(null=True, blank=True, db_column="value")

    class Meta:
        app_label = "timekeeper"
        managed = False
        db_table = "settings"
