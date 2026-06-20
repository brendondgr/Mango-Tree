# Migration templates

The three structured artifacts the migration produces. Fill them in literally; they are
the paper trail that makes each migration reviewable and repeatable.

---

## 1. Diagnosis Report (output of Stage 0)

A read-only description of the source app. Produce this before writing any target code.

```markdown
# Diagnosis Report: {source app name}

## Framework
- Detected: Django | Flask | FastAPI | Express | other ({what})
- Signature evidence: {files/markers that identified it}
- Entry point: {path}

## Data layer
- ORM / data access: {Django ORM | SQLAlchemy | SQLModel | Prisma | raw SQL | ...}
- Database engine: {Postgres | MySQL | SQLite | ...}
- Connection config location: {path / env var}
- Tables / models inventory:
  | Model/Table | Purpose | Notable columns (type, null, default, unique, index) | Relationships |
  | --- | --- | --- | --- |
- Migrations present: {yes/no, tool, location}
- Live data present: {yes/no — affects DB strategy}

## Capabilities (business logic)
| Capability | Where it lives now | Entangled with web layer? | External I/O |
| --- | --- | --- | --- |

## HTTP surface
| Method | Route | Inputs | Output | Auth required |
| --- | --- | --- | --- | --- |

## Background jobs
| Job | Trigger | What it does | Tooling |
| --- | --- | --- | --- |

## External I/O (becomes permission scopes)
- Filesystem: {paths read/written}
- Network: {hosts/schemes called}
- Third-party SDKs / services: {list}
- Message queues / datasets: {list}

## Auth model
- How callers are identified and authorized today: {...}

## UI surface (to discard/rebuild)
- Templates/static/client routing: {locations}

## Entanglement findings (each becomes an "extract service" task)
- {file:function} mixes {parsing/validation/domain/persistence}
```

---

## 2. Migration Plan (output of Stage 1)

Follows the shape required by `docs/skills/plan/SKILL.md`. This sequences Stages 2–9
into commit-sized steps and is the contract the implementation is checked against.

```markdown
# Migration Plan: {source app} -> utils/apps/{name}/

## Summary
{1–3 sentences: what is being folded in and the end state.}

## Layers affected
| Layer | Scope |
| --- | --- |
| utils/apps/{name}/ | new app module |
| config/ | Django app registration, tools.yaml, permissions.yaml |
| api/ | route registration |
| utils/agents/ | tool registration |
| web/ | frontend fragments + tab (optional/deferred) |
| docs/ | api.md, platform.md, app README |
| utils/tests/ | service, API, tool, DB denial/success tests |

## Database strategy
- Chosen: A (bind) | B (inspect) | C (migrate)
- Rationale: {why}
- Verification method: {round-trip read | counts+checksums}

## Destination mapping
| Source item | Destination | Notes |
| --- | --- | --- |

## Implementation steps (by stage, each = one commit)
2. Scaffold module + register Django app
3. Preserve database ({strategy})
4. Port domain logic into services: {grouped list}
5. Expose DRF API: {endpoints}
6. Build agent framework: {tools}
7. Wire frontend tab {or: deferred to milestone N}
8. Test & verify
9. Decommission old surface

## API / schema changes
| Method | Endpoint | Service | Notes |
| --- | --- | --- | --- |

## Agent tool changes
| Tool | Input schema | Output | Service | Confirm? | Permission scope |
| --- | --- | --- | --- | --- | --- |

## Parity table (API vs agent)
| Capability | API endpoint | Agent tool | Same service? | Exception (if any) |
| --- | --- | --- | --- | --- |

## Test plan (must include denial cases)
- Service: {success + validation/denial}
- API: {round-trips + permission denials}
- Agent tools: {structured output + scope/confirm denials}
- Database: {existing rows read unchanged / counts+checksums}

## Migration notes
{framework-specific gotchas; what is kept vs discarded}

## Assumptions
{anything unverified that the plan depends on}
```

---

## 3. Verification checklist (Stage 8 / definition of done)

Tick every box before calling the app migrated.

```markdown
# Verification: utils/apps/{name}/

## Structure & registration
- [ ] Directory matches the standard app layout
- [ ] Registered as a Django app in config/django/settings
- [ ] utils/api/routes/{name}.py included in root URLconf
- [ ] README lists purpose, layout, endpoints, and tools

## Data preservation
- [ ] Database strategy implemented (A/B/C)
- [ ] Existing rows read back unchanged through new models
- [ ] (If migrated) counts and checksums match source
- [ ] Verification script lives in utils/tests/utils/apps/{name}/

## Architecture
- [ ] All business logic in services/ or shared/
- [ ] DRF views are thin (validate -> service -> serialize)
- [ ] Agent tools are thin and call the same services
- [ ] No duplicated domain logic across layers
- [ ] Typed errors map to the five platform error codes

## Parity & permissions
- [ ] Every non-exceptional capability has both an API endpoint and an agent tool
- [ ] Each pair calls the identical service function
- [ ] Tools registered in config/tools.yaml
- [ ] Scopes declared in config/permissions.yaml; out-of-scope access denied
- [ ] Destructive tools require explicit confirmation

## Docs
- [ ] Endpoints documented in docs/api.md (done before frontend)
- [ ] {name} registered in docs/platform.md and app-modules/SKILL.md

## Tests (success AND denial)
- [ ] Service tests pass (incl. validation/denial)
- [ ] API tests pass (incl. permission denials)
- [ ] Agent tool tests pass (incl. scope + missing-confirmation denials)
- [ ] Database binding/move test passes
- [ ] `uv run pytest` green
- [ ] `cd web && npm run build` green (if frontend done this milestone)

## Cleanup
- [ ] Legacy templates/static/client routing removed
- [ ] No references to removed files remain
```
