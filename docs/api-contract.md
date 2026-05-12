# API Contract

No backend API is implemented yet. This document reserves the contract boundary between the future Astro frontend and the local agent runtime.

## Future Endpoint Groups

- Tasks: create, list, inspect, and cancel task runs.
- Agents: list orchestrator, general agent, and specialist definitions.
- Workflows: inspect manifests, schemas, and execution status.
- Tools: list tool registry entries and capability bundles.
- Memory: inspect visible namespaces and dataset manifests.
- Traces: read task events, artifacts, logs, and structured results.

## Contract Rules

- Responses should be structured and schema validated.
- Errors should include a stable code, human-readable message, and optional details.
- Frontend code must not assume an endpoint exists until it is listed here.
