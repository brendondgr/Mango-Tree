# Creates skill directory links for Cursor, Claude Code, and Codex.
# Run after clone on Windows when git checks out symlinks as plain text files
# (core.symlinks=false, the default on Windows).

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$Skills = @(
    "global",
    "plan",
    "repo-structure",
    "django-backend",
    "app-modules",
    "app-migration",
    "website-architecture",
    "ui-frontend"
)

$LinkRoots = @(
    ".cursor/skills",
    ".claude/skills",
    ".codex/skills"
)

function Ensure-SkillLink {
    param(
        [string]$LinkPath,
        [string]$TargetPath
    )

    $parent = Split-Path -Parent $LinkPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    if (Test-Path $LinkPath) {
        $item = Get-Item $LinkPath -Force
        if ($item.PSIsContainer -and (Test-Path (Join-Path $LinkPath "SKILL.md"))) {
            return
        }
        Remove-Item $LinkPath -Force -Recurse
    }

    $resolvedTarget = (Resolve-Path $TargetPath).Path
    New-Item -ItemType Junction -Path $LinkPath -Target $resolvedTarget | Out-Null
}

foreach ($root in $LinkRoots) {
    foreach ($skill in $Skills) {
        $target = Join-Path "docs/skills" $skill
        if (-not (Test-Path (Join-Path $target "SKILL.md"))) {
            Write-Warning "Skipping missing skill: $target"
            continue
        }

        $link = Join-Path $root $skill
        Ensure-SkillLink -LinkPath $link -TargetPath $target
        Write-Host "Linked $link -> $target"
    }
}

Write-Host "Skill links ready."
