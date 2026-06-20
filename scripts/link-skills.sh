#!/usr/bin/env bash
# Creates skill directory symlinks for Cursor, Claude Code, and Codex.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

skills=(
  global
  plan
  repo-structure
  django-backend
  app-modules
  app-migration
  website-architecture
  ui-frontend
)

link_roots=(
  .cursor/skills
  .claude/skills
  .codex/skills
)

ensure_skill_link() {
  local link_path="$1"
  local target_path="$2"
  local parent

  parent="$(dirname "$link_path")"
  mkdir -p "$parent"

  if [[ -L "$link_path" || -d "$link_path" ]] && [[ -f "$link_path/SKILL.md" ]]; then
    return 0
  fi

  rm -rf "$link_path"
  ln -s "$target_path" "$link_path"
}

for root in "${link_roots[@]}"; do
  for skill in "${skills[@]}"; do
    target="../../docs/skills/$skill"
    if [[ ! -f "docs/skills/$skill/SKILL.md" ]]; then
      echo "Skipping missing skill: docs/skills/$skill" >&2
      continue
    fi

    link="$root/$skill"
    ensure_skill_link "$link" "$target"
    echo "Linked $link -> $target"
  done
done

echo "Skill links ready."
