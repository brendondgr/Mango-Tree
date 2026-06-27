from __future__ import annotations

from django.db import models


class Category(models.Model):
    """A project category. Bound to the legacy ``category`` table.

    ``color`` stores a CSS colour suffix (e.g. ``blue``, ``green``) exactly as
    the legacy app stored it; see ``shared.constants.CATEGORY_COLORS``.
    """

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=20, default="blue")

    class Meta:
        app_label = "projectmanager"
        managed = False
        db_table = "category"
