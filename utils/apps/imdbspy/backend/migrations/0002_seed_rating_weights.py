"""Seed the three default rating-weight scales (fun / grit / comfort).

Mirrors the initialization the legacy Flask app did on first run. Every weight
column defaults to 0.25 at the model level, so each scale's four active criteria
sum to 1.0. Idempotent via ``get_or_create``.
"""

from __future__ import annotations

from django.db import migrations

SCALES = ("fun", "grit", "comfort")


def seed_weights(apps, schema_editor):
    RatingWeights = apps.get_model("imdbspy", "RatingWeights")
    manager = RatingWeights.objects.using(schema_editor.connection.alias)
    for scale in SCALES:
        manager.get_or_create(scale_type=scale)


def unseed_weights(apps, schema_editor):
    RatingWeights = apps.get_model("imdbspy", "RatingWeights")
    RatingWeights.objects.using(schema_editor.connection.alias).filter(
        scale_type__in=SCALES
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("imdbspy", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_weights, unseed_weights),
    ]
