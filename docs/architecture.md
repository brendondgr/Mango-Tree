# Architecture

Mango Tree is organized around a constrained runtime:

```text
User
  -> Orchestrator
      -> General Agent
      -> repo_inspector workflow
      -> code_editor workflow
      -> test_runner workflow
      -> latex_builder workflow
      -> rag_indexer workflow
      -> model_evaluator workflow
```

## Runtime Responsibilities

- Orchestrator: classify requests, choose routes, assemble scoped task packages, validate results, and record events.
- General agent: broad reasoning, lightweight inspection, planning, and delegation.
- Specialists: constrained LangGraph workflows with narrow schemas, tool bundles, memory namespaces, datasets, and filesystem permissions.
- Tools: registered executable functions with schemas and permission metadata.
- Policies: code-enforced boundaries for tools, filesystem, shell, network, memory, and datasets.

## Frontend Mode

The frontend is an Astro app under `web/`, with Svelte and React islands and UnoCSS styling. The initial setup is structural only and does not assume live runtime endpoints.
