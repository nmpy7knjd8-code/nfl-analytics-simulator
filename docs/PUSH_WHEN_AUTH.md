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

## Phase 2 branch + PR (ready locally)

Branch `cursor/phase2-historical-ingest-a4c3` is committed locally (`d4c102e`) but **not pushed** — this environment had no `gh auth` / `GH_TOKEN` (do not use chat-pasted tokens).

```bash
cd /agent/nfl-analytics-simulator
git checkout cursor/phase2-historical-ingest-a4c3
git push -u origin cursor/phase2-historical-ingest-a4c3
gh pr create --title "Phase 2: 2023 historical ingest + Game Explorer replay" --body "$(cat <<'EOF'
## Summary
- Restores Phase 1 `backend/` (missing on `main`) and implements 2023-only nflreadpy==0.1.5 ingest → immutable raw + canonical Parquet/DuckDB.
- FastAPI: list/get games + ordered plays. Next.js Game Explorer with Historical truth labels.
- **Scope:** historical replay only. No model training. No decision lab (Phase 6).

## Schema ownership
Phase 2 owns ingest/canonical contracts on this branch. Parallel EP/EPA or research agents should use separate branches/PRs and **document any shared schema changes in their PR description** — do not silently rewrite ingest contracts mid-flight.

## Test plan
- [x] `cd backend && pip install -e ".[dev,phase2]" && pytest -q` → 16 passed
- [x] `cd frontend && npm run typecheck && npm test && npm run build`
- [x] `python -m nfl_sim.ingest --season 2023` + API smoke on `2023_01_DET_KC`
EOF
)"
```

## Optional: feature branch + PR (Phase 1 historical)

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
