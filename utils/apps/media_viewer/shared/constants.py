from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

ArtifactKind = Literal[
    "image",
    "video",
    "pdf",
    "markdown",
    "latex",
    "text",
    "unknown",
]

ArtifactSource = Literal["chat_upload", "agent", "manual"]

MANIFEST_VERSION = 1
DEFAULT_PAGE_SIZE = 25

STORAGE_DIR = "storage"
THUMBNAILS_DIR = "thumbnails"
MANIFEST_FILENAME = "manifest.json"

TEXT_EXTENSIONS = frozenset(
    {
        ".py",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".json",
        ".yaml",
        ".yml",
        ".txt",
        ".csv",
        ".xml",
        ".html",
        ".htm",
        ".css",
        ".scss",
        ".sh",
        ".bash",
        ".zsh",
        ".toml",
        ".ini",
        ".env",
        ".sql",
        ".rs",
        ".go",
        ".java",
        ".kt",
        ".rb",
        ".php",
        ".c",
        ".cpp",
        ".h",
        ".hpp",
        ".cs",
        ".swift",
        ".lua",
        ".r",
        ".dockerfile",
    }
)

EXTENSION_LANGUAGE: dict[str, str] = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".txt": "text",
    ".csv": "csv",
    ".xml": "xml",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "zsh",
    ".toml": "toml",
    ".ini": "ini",
    ".sql": "sql",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".rb": "ruby",
    ".php": "php",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".swift": "swift",
    ".lua": "lua",
    ".r": "r",
    ".dockerfile": "dockerfile",
    ".pdf": "pdf",
    ".tex": "latex",
}


@dataclass(frozen=True)
class ArtifactsConfig:
    root: Path
    max_file_size_bytes: int
    max_image_size_bytes: int
    max_pdf_size_bytes: int
    allowed_kinds: frozenset[str]
