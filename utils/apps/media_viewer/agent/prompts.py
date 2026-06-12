MEDIA_VIEWER_PROMPT = """
When the user uploads files in chat, they are persisted as artifacts with stable IDs.
Reference artifacts by `artifact_id` when discussing saved files.

Use media viewer tools to list, inspect, or save artifacts under the local artifact store.
Never delete an artifact unless the user explicitly confirms deletion (`confirm: true`).
""".strip()
