import os
import json
from typing import Dict, Any, Callable, List
from agents.schemas.agent import ToolResult

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Callable] = {}
        
    def register(self, name: str):
        def decorator(func: Callable):
            self._tools[name] = func
            return func
        return decorator
        
    def execute(self, name: str, arguments: Dict[str, Any]) -> ToolResult:
        if name not in self._tools:
            return ToolResult(
                success=False,
                result={},
                summary=f"Tool '{name}' not found in registry.",
                artifact_ids=[]
            )
        try:
            return self._tools[name](**arguments)
        except Exception as e:
            import traceback
            return ToolResult(
                success=False,
                result={"error": str(e), "traceback": traceback.format_exc()},
                summary=f"Tool '{name}' failed with error: {str(e)}",
                artifact_ids=[]
            )

registry = ToolRegistry()

# Define project-relative paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "data", "artifacts")
SKILLS_DIR = os.path.join(BASE_DIR, "docs", "skills")

@registry.register("list_artifacts")
def list_artifacts() -> ToolResult:
    manifest_path = os.path.join(ARTIFACTS_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        return ToolResult(
            success=True,
            result={"artifacts": []},
            summary="Found 0 artifacts (manifest file does not exist).",
            artifact_ids=[]
        )
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        artifacts = data.get("artifacts", []) if isinstance(data, dict) else data
        return ToolResult(
            success=True,
            result={"artifacts": artifacts},
            summary=f"Successfully retrieved {len(artifacts)} artifacts from manifest.",
            artifact_ids=[]
        )
    except Exception as e:
        return ToolResult(
            success=False,
            result={"error": str(e)},
            summary=f"Failed to load manifest: {str(e)}",
            artifact_ids=[]
        )

@registry.register("read_artifact")
def read_artifact(artifact_id: str) -> ToolResult:
    manifest_path = os.path.join(ARTIFACTS_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        return ToolResult(
            success=False,
            result={},
            summary=f"Artifact {artifact_id} not found (manifest does not exist).",
            artifact_ids=[]
        )
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        
        # Look up artifact in list/dict
        artifacts = manifest.get("artifacts", []) if isinstance(manifest, dict) else manifest
        artifact = next((a for a in artifacts if a.get("id") == artifact_id or a.get("artifactId") == artifact_id), None)
        
        if not artifact:
            return ToolResult(
                success=False,
                result={},
                summary=f"Artifact {artifact_id} not found in manifest.",
                artifact_ids=[]
            )
            
        filename = artifact.get("filename", "")
        # Look in storage/
        storage_path = os.path.join(ARTIFACTS_DIR, "storage", artifact_id)
        # Fallback to direct name if stored differently
        if not os.path.exists(storage_path):
            storage_path = os.path.join(ARTIFACTS_DIR, "storage", filename)
            
        if not os.path.exists(storage_path):
            return ToolResult(
                success=False,
                result={"metadata": artifact},
                summary=f"Artifact metadata found, but file content was missing on disk for {artifact_id}.",
                artifact_ids=[artifact_id]
            )
            
        with open(storage_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        return ToolResult(
            success=True,
            result={"metadata": artifact, "content": content},
            summary=f"Successfully read content of artifact {filename} ({artifact_id}).",
            artifact_ids=[artifact_id]
        )
    except Exception as e:
        return ToolResult(
            success=False,
            result={"error": str(e)},
            summary=f"Failed to read artifact {artifact_id}: {str(e)}",
            artifact_ids=[]
        )

@registry.register("inspect_skills")
def inspect_skills() -> ToolResult:
    if not os.path.exists(SKILLS_DIR):
        return ToolResult(
            success=True,
            result={"skills": []},
            summary="Found 0 skills (skills folder does not exist).",
            artifact_ids=[]
        )
    
    skills = []
    try:
        for root, dirs, files in os.walk(SKILLS_DIR):
            for file in files:
                if file.endswith(".md"):
                    rel_path = os.path.relpath(os.path.join(root, file), SKILLS_DIR)
                    skills.append(rel_path.replace("\\", "/"))
        return ToolResult(
            success=True,
            result={"skills": skills},
            summary=f"Successfully scanned skills. Found {len(skills)} skill documents.",
            artifact_ids=[]
        )
    except Exception as e:
        return ToolResult(
            success=False,
            result={"error": str(e)},
            summary=f"Failed to inspect skills: {str(e)}",
            artifact_ids=[]
        )

@registry.register("inspect_chat_context")
def inspect_chat_context(state_messages: List[Dict[str, Any]]) -> ToolResult:
    # This tool simply inspects the currently provided state messages
    return ToolResult(
        success=True,
        result={"messages": state_messages},
        summary=f"Inspected chat context. Session contains {len(state_messages)} messages.",
        artifact_ids=[]
      )
