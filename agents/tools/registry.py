import os
import json
from typing import Dict, Any, Callable, List, Optional
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
SKILLS_DIR = os.path.join(BASE_DIR, "agents", "skills")

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
def read_artifact(artifact_id: Optional[str] = None) -> ToolResult:
    if not artifact_id:
        return ToolResult(
            success=False,
            result={},
            summary="Error: 'artifact_id' is a required argument but was not provided.",
            artifact_ids=[]
        )
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
        
        # Look up artifact in list/dict by ID, artifactId, or filename
        artifacts = manifest.get("artifacts", []) if isinstance(manifest, dict) else manifest
        artifact = next((
            a for a in artifacts 
            if a.get("id") == artifact_id 
            or a.get("artifactId") == artifact_id
            or a.get("filename") == artifact_id
            or os.path.basename(a.get("filename", "")) == artifact_id
        ), None)
        
        if not artifact:
            return ToolResult(
                success=False,
                result={},
                summary=f"Artifact {artifact_id} not found in manifest.",
                artifact_ids=[]
            )
            
        filename = artifact.get("filename", "")
        # Resolve path using manifest's storage_path field
        storage_rel_path = artifact.get("storage_path", "")
        if not storage_rel_path:
            storage_rel_path = os.path.join("storage", artifact.get("id", ""))
            
        storage_path = os.path.join(ARTIFACTS_DIR, storage_rel_path)
        
        # Fallback to direct name if stored differently
        if not os.path.exists(storage_path):
            storage_path = os.path.join(ARTIFACTS_DIR, "storage", filename)
            
        if not os.path.exists(storage_path):
            return ToolResult(
                success=False,
                result={"metadata": artifact},
                summary=f"Artifact metadata found, but file content was missing on disk for {artifact_id}.",
                artifact_ids=[artifact.get("id", "")]
            )
            
        kind = artifact.get("kind", "")
        mime_type = artifact.get("mime_type", "")
        
        # Check by extension first to override broad octet-stream MIME types for text uploads
        ext = os.path.splitext(filename)[1].lower()
        is_text_ext = ext in [".md", ".txt", ".py", ".js", ".ts", ".tsx", ".json", ".yaml", ".yml", ".ini", ".conf", ".sh", ".bat", ".ps1", ".csv", ".xml", ".html", ".css"]
        
        is_binary = kind in ["video", "image", "pdf", "audio", "zip", "tar", "gz"]
        if is_text_ext:
            is_binary = False
        elif not is_binary and mime_type:
            is_binary = not (
                mime_type.startswith("text/") 
                or "json" in mime_type 
                or "xml" in mime_type 
                or "csv" in mime_type 
                or "javascript" in mime_type 
                or "typescript" in mime_type
            )
            
        if is_binary:
            return ToolResult(
                success=True,
                result={"metadata": artifact, "content": f"[Binary {kind} file - content omitted]"},
                summary=f"Successfully read metadata of binary artifact {filename} ({artifact_id}). Content omitted.",
                artifact_ids=[artifact.get("id", "")]
            )
            
        # Limit text reading size to prevent context overflow (e.g. 50 KB limit)
        file_size = os.path.getsize(storage_path)
        MAX_SIZE = 50 * 1024
        
        if file_size > MAX_SIZE:
            with open(storage_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(MAX_SIZE)
            content += "\n\n... [Content truncated due to size limit] ..."
            return ToolResult(
                success=True,
                result={"metadata": artifact, "content": content},
                summary=f"Successfully read truncated content of large artifact {filename} ({artifact_id}). Size: {file_size} bytes.",
                artifact_ids=[artifact.get("id", "")]
            )
            
        with open(storage_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        return ToolResult(
            success=True,
            result={"metadata": artifact, "content": content},
            summary=f"Successfully read content of artifact {filename} ({artifact_id}).",
            artifact_ids=[artifact.get("id", "")]
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

@registry.register("read_skill")
def read_skill(skill_name: Optional[str] = None) -> ToolResult:
    if not skill_name:
        return ToolResult(
            success=False,
            result={},
            summary="Error: 'skill_name' is a required argument but was not provided.",
            artifact_ids=[]
        )
    # Look for SKILL.md under agents/skills/{skill_name}/
    skill_path = os.path.join(SKILLS_DIR, skill_name, "SKILL.md")
    
    # Check if folder name has .md appended from listing
    if not os.path.exists(skill_path):
        normalized_name = skill_name
        if normalized_name.endswith(".md"):
            normalized_name = normalized_name[:-3]
        if normalized_name.endswith("/SKILL"):
            normalized_name = normalized_name[:-6]
            
        skill_path = os.path.join(SKILLS_DIR, normalized_name, "SKILL.md")
        
    if not os.path.exists(skill_path):
        return ToolResult(
            success=False,
            result={},
            summary=f"Skill '{skill_name}' not found. Searched path: agents/skills/{skill_name}/SKILL.md",
            artifact_ids=[]
        )
        
    try:
        with open(skill_path, "r", encoding="utf-8") as f:
            content = f.read()
        return ToolResult(
            success=True,
            result={"skill_name": skill_name, "content": content},
            summary=f"Successfully read content of skill '{skill_name}'.",
            artifact_ids=[]
        )
    except Exception as e:
        return ToolResult(
            success=False,
            result={"error": str(e)},
            summary=f"Failed to read skill '{skill_name}': {str(e)}",
            artifact_ids=[]
        )
