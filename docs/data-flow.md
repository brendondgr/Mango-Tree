# Data Flow

The initial frontend uses static placeholder content only.

## Intended Runtime Flow

```text
User request
  -> Orchestrator route decision
  -> Scoped task package
  -> General agent or specialist workflow
  -> Tool registry with execution context
  -> Event, artifact, and result records
  -> Structured response
```

## Frontend Data Flow

Future UI views should consume documented runtime endpoints or generated static data. Until `docs/api-contract.md` defines an endpoint, frontend code should not assume one exists.

## Access Boundaries

Memory and dataset access must be namespace checked. Filesystem, shell, and network actions must be policy checked before side effects happen.
