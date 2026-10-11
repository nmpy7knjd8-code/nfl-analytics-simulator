# Push when GitHub auth is available

Phase 1 local tree is ready under `/agent/nfl-analytics-simulator`.  
This environment had **no** `gh auth` / `GH_TOKEN` at scaffold time.

## Prerequisites

```bash
gh auth status
# or:
test -n "$GH_TOKEN" || test -n "$GITHUB_TOKEN"
```

If using a token: `export GH_TOKEN=...` (scopes: `repo`, and `read:org` if org).  
For Pages: `pages` write or enable via UI after first push.

## One-shot create + push (recommended)

From the repo root:

```bash
cd /agent/nfl-analytics-simulator

# Ensure commits exist
git status
git add -A
git commit -m "Phase 1: architecture, contracts, and docs (stop gate)" || true

# Create under the authenticated user (NFL-focused name/description)
gh repo create nfl-analytics-simulator \
  --public \
  --description "NFL analytics simulator: historical replay, EPA baselines, reproducible simulation (NFL-only)" \
  --source=. \
  --remote=origin \
  --push

# Record URLs
gh repo view --json url,nameWithOwner -q '"Repo: \(.url)\nSlug: \(.nameWithOwner)"'
```

If the repo already exists empty on GitHub:

```bash
git remote add origin "https://github.com/<OWNER>/nfl-analytics-simulator.git"
git branch -M main
git push -u origin main
```

## Optional: feature branch + PR

```bash
git checkout -b cursor/phase1-scaffold-93a9
git push -u origin cursor/phase1-scaffold-93a9
gh pr create --title "Phase 1: architecture and shared contracts" \
  --body "Stop-gate Phase 1 scaffold. No Phase 2 ingest/models/UI implementation."
```

## GitHub Pages (docs home)

Option A — publish `docs/` as Pages site:

```bash
gh api -X POST "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pages" \
  -f "build_type=legacy" \
  -f "source[branch]=main" \
  -f "source[path]=/docs" \
  || true

# Or enable in UI: Settings → Pages → Deploy from branch → main → /docs
```

Option B — README-only project page (no Pages): ensure README links to `/docs/ARCHITECTURE.md` (already planned).

After Pages is enabled, site URL is typically:

`https://<OWNER>.github.io/nfl-analytics-simulator/`

## Post-push checklist

1. Paste **repo URL** and **Pages URL** (or README URL) into Project store `internal/agent0-status.md`.
2. Confirm root `AGENTS.md` is visible on the default branch.
3. Do **not** start Phase 2 until user approves Phase 1 contracts.
