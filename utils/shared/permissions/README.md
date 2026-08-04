# Permissions

**Placeholder — no code here.**

`config/permissions.yaml` declares filesystem globs and network host allowlists
per app, but nothing loads it at runtime. It is consumed only by tests
(`utils/tests/utils/apps/*/test_permissions.py`, `test_denials.py`), which assert
that the paths and hosts hardcoded in app services still match the declared
scopes. Treat the file as a reviewed record of intent, not an enforcement layer.

The controls that actually run at runtime are listed in `utils/shared/README.md`.

There is no `ExecutionContext` class in this repository.
