import os
import json
import base64
import mimetypes
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
            is_image = kind == "image" or mime_type.startswith("image/") or ext in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]
            is_video = kind == "video" or mime_type.startswith("video/") or ext in [".mp4", ".webm", ".mov", ".avi", ".mkv"]
            
            if is_image:
                # Send image as-is via base64 — LLM servers accept image/* natively
                MAX_IMAGE_SIZE = 20 * 1024 * 1024  # 20 MB limit
                file_size = os.path.getsize(storage_path)
                if file_size > MAX_IMAGE_SIZE:
                    return ToolResult(
                        success=True,
                        result={"metadata": artifact, "content": f"[Image too large to analyze: {file_size} bytes]"},
                        summary=f"Image {filename} is too large to send to the model ({file_size} bytes).",
                        artifact_ids=[artifact.get("id", "")]
                    )
                with open(storage_path, "rb") as f:
                    img_bytes = f.read()
                b64_data = base64.b64encode(img_bytes).decode("utf-8")
                detected_mime = mimetypes.guess_type(filename)[0]
                img_mime = mime_type if mime_type and mime_type.startswith("image/") else (detected_mime or "image/png")
                return ToolResult(
                    success=True,
                    result={
                        "metadata": artifact,
                        "media_base64": b64_data,
                        "media_type": "image",
                        "mime_type": img_mime,
                        "content": f"[Image loaded: {filename} ({file_size} bytes)]"
                    },
                    summary=f"Successfully loaded image {filename} ({artifact_id}). The image has been sent to the model for analysis.",
                    artifact_ids=[artifact.get("id", "")]
                )
            
            if is_video:
                # Extract a mid-point JPEG poster frame from the video using cv2.
                # This mirrors what the frontend canvas does — the LLM receives a still image,
                # not raw video bytes (which most LLM servers cannot decode directly).
                try:
                    import cv2
                    import io
                    cap = cv2.VideoCapture(storage_path)
                    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    fps = cap.get(cv2.CAP_PROP_FPS) or 25
                    duration_sec = frame_count / fps if fps > 0 else 0
                    
                    # Seek to midpoint (or 1s in, whichever is earlier), same as frontend
                    target_sec = min(1.0, duration_sec / 2) if duration_sec > 0 else 0
                    cap.set(cv2.CAP_PROP_POS_MSEC, target_sec * 1000)
                    ok, frame = cap.read()
                    cap.release()
                    
                    if not ok or frame is None:
                        raise ValueError("Could not read video frame")
                    
                    # Encode frame as JPEG (same format as frontend canvas.toDataURL)
                    ok2, jpeg_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if not ok2:
                        raise ValueError("Failed to encode frame as JPEG")
                    
                    b64_data = base64.b64encode(jpeg_buf.tobytes()).decode("utf-8")
                    file_size = os.path.getsize(storage_path)
                    return ToolResult(
                        success=True,
                        result={
                            "metadata": artifact,
                            "media_base64": b64_data,
                            "media_type": "image",  # Sent as image/jpeg frame
                            "mime_type": "image/jpeg",
                            "content": f"[Video frame extracted from: {filename} ({file_size} bytes, {duration_sec:.1f}s at {fps:.0f}fps)]"
                        },
                        summary=f"Successfully extracted poster frame from video {filename} ({artifact_id}) at {target_sec:.1f}s. Frame sent as image for visual analysis.",
                        artifact_ids=[artifact.get("id", "")]
                    )
                except Exception as ve:
                    file_size = os.path.getsize(storage_path)
                    return ToolResult(
                        success=True,
                        result={
                            "metadata": artifact,
                            "content": f"[Video file: {filename} ({file_size} bytes) — frame extraction failed: {ve}. Use the chat attachment panel to view this video.]"
                        },
                        summary=f"Could not extract frame from video {filename}: {ve}. The file exists but cannot be analyzed automatically.",
                        artifact_ids=[artifact.get("id", "")]
                    )
            
            # Non-viewable binary (audio, pdf, zip, etc.) — truly cannot be analyzed
            return ToolResult(
                success=True,
                result={"metadata": artifact, "content": f"[Binary {kind} file - content cannot be displayed]"},
                summary=f"Binary {kind} file {filename} ({artifact_id}) cannot be analyzed. Only images, videos, and text files can be examined.",
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

import agents.tools.web_search  # noqa: F401, E402 — register search_web tool
