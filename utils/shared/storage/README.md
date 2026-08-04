# Storage

**Placeholder — no code here.** There is no object-storage adapter.

Every file the platform writes goes to the local filesystem under `data/`:
artifacts to `data/artifacts/`, mailbox config and cache to `data/mailbox/`,
per-app SQLite databases to `data/{app}/`. Roots are declared in
`config/artifacts.yaml` and `config/permissions.yaml`.
