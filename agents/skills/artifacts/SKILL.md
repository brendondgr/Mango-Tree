# Artifacts Skill

This skill explains how the Mango agent can work with artifacts in the workspace.

## Overview
Artifacts are files, documents, or data structures that are created, uploaded, or modified within the user's workspace (saved under `data/artifacts/`).
All artifacts are indexed in the workspace manifest.

## Available Tools
1. `list_artifacts`: Scans the workspace and returns the metadata of all existing artifacts. Use this to see what files are currently available to you.
2. `read_artifact(artifact_id)`: Retrieves the metadata and the text content of a specific artifact. Use this when the user asks you to analyze, display, or inspect the contents of an artifact.

## Guidelines for the Agent
- If the user references "my files", "my artifacts", or a specific file name, run `list_artifacts` first to locate the corresponding `artifact_id`.
- Once you have the `artifact_id`, invoke `read_artifact` to load the file's content.
- Do not attempt to use other tools (like reading files directly from system paths) to access user artifacts. Use only the designated artifact tools.
