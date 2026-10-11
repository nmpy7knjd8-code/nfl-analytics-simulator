# CURRENT STATE AUDIT PACKET — NFL Analytics Simulator

> **External review copy (read-only snapshot).** Self-contained packet for independent Claude review of Stage A EP/EPA.  
> **Inspection window (UTC):** 2026-10-11T18:33:54Z → 2026-10-11T18:37:35Z (pre-merge).  
> **SHAs inspected then:** PR #3 head `a56ae617ac114a6c2253c39168945ea2b650dd1a`; PR #2 head `75183f648223ed4de85ad3ab2aa195fa7a97c6ab`; `main` then at `e5849cef8be5574d5cc5cbcd9410a8340485854f`.  
> **Post-merge note (not re-audited in this packet):** After this inspection window, Stage A landed on `main` via merge of PR #3 (~`15da234`). PR #2 was closed as superseded. For **current** post-merge gate status, see [`reports/ep/AUDIT.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/reports/ep/AUDIT.md) and [`docs/HANDOFF.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/docs/HANDOFF.md) on `main` — do not treat the body below as a fresh post-merge re-inspection.  
> **Evidence legend:** see table immediately below (VERIFIED / PRIOR-AGENT / DOC / UNRESOLVED).  
> **Does not overwrite:** `reports/ep/AUDIT.md`.

### Evidence legend (used throughout)

| Tag | Meaning |
| --- | --- |
| **VERIFIED** | Observed directly in this inspection (git/API/file contents/commands run here) |
| **PRIOR-AGENT** | Claim from prior agents or private project notes, or from `reports/ep/AUDIT.md` — cited, not re-trusted |
| **DOC** | Claim in repo docs/reports only |
| **UNRESOLVED** | Open question / not independently verified here |

---

## 1. Executive status

**Stage A EP/EPA exists on open PRs; `main` still stops at Phase 2.**  
**Do not merge PR #2 as-is.** PR #3 is a strict descendant of PR #2 and carries required correctness/safety fixes (half-boundary EPA terminal, XP/2PT label exclusion, API pickle-path removal + typed request). **VERIFIED**

| Item | State | Evidence class |
| --- | --- | --- |
| `main` | Phase 2 only @ `e5849ce` | **VERIFIED** |
| PR #2 Stage A | OPEN, MERGEABLE, head `75183f6` | **VERIFIED** |
| PR #3 audit fixes | OPEN, MERGEABLE, head `a56ae61`; contains all of #2 + 1 audit commit | **VERIFIED** |
| Parallel worker moved remotes? | No movement during this window (`updatedAt` unchanged) | **VERIFIED** (snapshot) |
| Backend tests on PR #3 head | **51 passed** (this run) | **VERIFIED** |
| Frontend tests/typecheck on PR #3 head | **2 passed** / typecheck pass (after `npm install`) | **VERIFIED** |
| GitHub Actions CI | No checks on either PR; workflow only proposed under `reports/ep/` | **VERIFIED** |
| EP joblib artifact in git | Absent (gitignored); meta/metrics committed | **VERIFIED** |
| Full train/eval reproduction this audit | **Not run** (2019–2022 lake not backfilled here) | **VERIFIED** limitation |
| Remaining EPA vs nflverse gap | Possession-change MAE ≈2.8 — convention / kickoff, not treated as silent bug | **DOC** + **PRIOR-AGENT**; slice JSON post-fix incomplete |

**Merge-readiness recommendation (this packet):** Land **PR #3** (or equivalent cherry-picks onto #2) before any Stage A merge. Hold WP / decision lab / live adapters until Stage A lands with audit fixes. See §10.

---

## 2. Exact Git state

### 2.1 Repository and inspection identity

| Field | Value |
| --- | --- |
| Remote URL | `https://github.com/nmpy7knjd8-code/nfl-analytics-simulator.git` |
| Clone path used | `/tmp/nfl-analytics-simulator-audit` (fresh clone; workspace had no pre-existing checkout) |
| Inspected tip (detached HEAD) | `a56ae617ac114a6c2253c39168945ea2b650dd1a` (**PR #3 head**) |
| Also inspected | `main` / `e5849ce…`; PR #2 head `75183f6…` via `git show` / diffs |
| Working tree cleanliness (git-tracked) | Clean at clone; later **local-only** gitignored data appeared after integration tests (see §2.6) |
| Auth note | `GH_TOKEN` env empty; lowercase `gh_token` used for `gh` only (not printed) |

### 2.2 Branch / SHA map (final re-fetch 2026-10-11T18:37:35Z)

| Ref | Full SHA | Notes |
| --- | --- | --- |
| `origin/main` / `origin/HEAD` | `e5849cef8be5574d5cc5cbcd9410a8340485854f` | Merge of PR #1 |
| `origin/cursor/stage-a-ep-epa-0cca` (PR #2) | `75183f648223ed4de85ad3ab2aa195fa7a97c6ab` | Unchanged across re-fetches in this window |
| `origin/cursor/ep-epa-audit-d4ea` (PR #3) | `a56ae617ac114a6c2253c39168945ea2b650dd1a` | Unchanged across re-fetches in this window |

Ancestry (**VERIFIED**):

```text
main (e5849ce)
  └─ 5c6dc36  Phase 3 data gate: backfill 2019–2022 and lock chrono split
       └─ 75183f6  Phase 3 Stage A: leakage-safe EP model, EPA, and held-out reports   ← PR #2 head
            └─ a56ae61  Audit EP/EPA: half-boundary terminal, API safety, baselines   ← PR #3 head
```

- `git merge-base --is-ancestor 75183f6 a56ae61` → **YES** → **PR #3 depends on / includes PR #2**.
- Both PR bases = `main` @ `e5849ce…`.

### 2.3 Pull requests

| PR | URL | Title | State | Base | Head | Mergeable | Checks | updatedAt (API) |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| #2 | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/2 | Phase 3 Stage A: independent EP/EPA with held-out 2023 report | OPEN | `main` @ `e5849ce…` | `cursor/stage-a-ep-epa-0cca` @ `75183f6…` | MERGEABLE / CLEAN | none reported | 2026-10-11T18:00:45Z |
| #3 | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/3 | Audit: EP/EPA correctness gate (do not merge #2 without these fixes) | OPEN | `main` @ `e5849ce…` | `cursor/ep-epa-audit-d4ea` @ `a56ae61…` | MERGEABLE / CLEAN | none reported | 2026-10-11T18:20:55Z |

PR #2 commits: `5c6dc36…`, `75183f6…`.  
PR #3 commits: those two + `a56ae61…`.

### 2.4 Uncommitted / unpushed

| Item | Status |
| --- | --- |
| Remote branch movement mid-audit | **None observed** (SHAs stable on fetch at 18:34, 18:35, 18:36, 18:37 UTC) |
| This audit’s packet file | Written locally under clone `reports/CURRENT_STATE_AUDIT_PACKET.md` — **not pushed** |
| Speculative fixes / merges | **Not performed** |

### 2.5 Exact commands used (git / GitHub)

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
git clone https://github.com/nmpy7knjd8-code/nfl-analytics-simulator.git /tmp/nfl-analytics-simulator-audit
git checkout HEAD   # initially main @ e5849ce
git fetch --all --prune
git branch -avv
git rev-parse HEAD origin/main origin/cursor/stage-a-ep-epa-0cca origin/cursor/ep-epa-audit-d4ea
git merge-base --is-ancestor 75183f6 a56ae61
git log --oneline e5849ce..a56ae61
git diff --stat 75183f6..a56ae61
git checkout a56ae61
# Auth: export GH_TOKEN="$(printenv gh_token)"  # never printed
gh pr view 2 --repo nmpy7knjd8-code/nfl-analytics-simulator --json ...
gh pr view 3 --repo nmpy7knjd8-code/nfl-analytics-simulator --json ...
gh pr checks 2|3 --repo nmpy7knjd8-code/nfl-analytics-simulator
# Also used unauthenticated REST when gh initially failed (public repo)
curl -sS https://api.github.com/repos/nmpy7knjd8-code/nfl-analytics-simulator/pulls/{2,3}
```

### 2.6 Local side effects of verification (not remote)

Running `pytest` integration tests downloaded **2023** PBP into the local gitignored lake:

- File sha256 **VERIFIED** = `b8417df9501f7f966eaccfffe463425fc06153f7bd58e075f5fa8f900e67460d` (matches active pin)
- Size 20,624,417 bytes  
This did **not** push anything. 2019–2022 were **not** ingested in this audit.

---

## 3. Architecture and implementation inventory

Paths relative to repo root. Primary inspection tip: **PR #3** `a56ae61` unless noted.

### 3.1 Ingestion

| Path | Role |
| --- | --- |
| `backend/src/nfl_sim/ingest/pipeline.py` | Season ingest |
| `backend/src/nfl_sim/ingest/manifest.py` | Pins, sha256, row counts, URLs |
| `backend/src/nfl_sim/ingest/__main__.py` | CLI (`--season` / `--seasons`) |
| `backend/src/nfl_sim/ingest/project.py` | Play → API projection |
| `backend/src/nfl_sim/ingest/derive.py` | Derived fields (home possession, 2H KO, play types) |
| `backend/src/nfl_sim/ingest/play_types.py` | Play-type mapping |
| `data/raw/`, `data/canonical/` | Gitignored lake (`.gitkeep` only in git) |
| `reports/data/backfill_validation.json` | Committed backfill validation (**DOC**/artifact from Phase 3) |

**On `main`:** Phase 2 2023 ingest path exists; Stage A model package does **not**.

### 3.2 Validation / split gates

| Path | Role |
| --- | --- |
| `backend/src/nfl_sim/models/split.py` | Chrono split; `forbid_test_season_in_fit` |
| `backend/tests/test_split_gate.py` | Split integrity unit tests |
| `docs/DATA_PIN_NOTES.md` | Pin + drift narrative |
| `docs/DATA_EXPERIMENT.md` | Experiment counts (updated lightly on PR #2) |

### 3.3 EP model

| Path | Role |
| --- | --- |
| `docs/EP_MODEL_SPEC.md` | Locked Stage A target/features/EPA |
| `backend/src/nfl_sim/models/constants.py` | Classes, values, forbidden features, seasons |
| `backend/src/nfl_sim/models/labels.py` | Next-score-in-half labels (+ XP/2PT exclusion on PR #3) |
| `backend/src/nfl_sim/models/features.py` | Feature frame + leakage asserts |
| `backend/src/nfl_sim/models/ep_model.py` | Sklearn multinomial EP |
| `backend/src/nfl_sim/models/dataset.py` | Dataset load / hashing helpers |
| `backend/src/nfl_sim/models/baselines.py` | Empirical baselines (**PR #3 only**) |
| `backend/src/nfl_sim/models/__main__.py` | `train` / `eval` / `score` / `baselines` CLI |
| `reports/ep/artifacts/ep_model.meta.json` | Committed meta (joblib gitignored) |
| `reports/ep/metrics.json`, `EVALUATION.md`, `TARGETS.md` | Reported metrics |

### 3.4 EPA

| Path | Role |
| --- | --- |
| `backend/src/nfl_sim/models/epa.py` | `attach_post_state`, `compute_epa`, `score_model_epa` |
| `docs/EP_MODEL_SPEC.md` §6 | Possession-aware formulas |
| `reports/ep/DISCREPANCY_BACKLOG.md` | B1 possession-change gap |
| `reports/ep/AUDIT.md` | Prior independent audit report (**PRIOR-AGENT**; do not overwrite) |
| `reports/ep/audit_epa_slices_2022.json` | Partial post-fix slice counts/MAE overall |

### 3.5 FastAPI

| Path | Role |
| --- | --- |
| `backend/src/nfl_sim/api/app.py` | `/health`, `/games`, `/games/{id}`, `/games/{id}/plays`, `POST /models/ep/score` |
| `backend/src/nfl_sim/config.py` | CORS defaults `localhost:3000` |
| `backend/src/nfl_sim/store/duckdb_store.py` | Canonical store |

**PR #2 vs #3 API (critical):** PR #2 accepts caller `model_path` + silent defaults (**VERIFIED** via `git show 75183f6:…/app.py`). PR #3 removes path load; typed `EpScoreRequest` with `extra="forbid"` (**VERIFIED** on tip).

### 3.6 Frontend

| Path | Role |
| --- | --- |
| `frontend/app/page.tsx`, `games/page.tsx`, `games/[gameId]/page.tsx` | Historical Game Explorer |
| `frontend/lib/api.ts` | API client |
| `frontend/contracts/*` | Shared TS contracts + tests |
| Layout metadata | Still says “Phase 2 — replay only; no trained models yet” — **doc/UI drift vs Stage A API** |

Frontend shows **imported reference** EP/WP with disclaimer; does **not** call `POST /models/ep/score` in inspected pages (**VERIFIED** by grep of `frontend/`).

### 3.7 Tests / CI

| Path | Role |
| --- | --- |
| `backend/tests/test_*.py` | Contracts, API, derive, ingest integration, EP/EPA, audit, baselines, split |
| `frontend/contracts/contracts.test.ts` | Contract shapes |
| `reports/ep/ci-workflow-proposed.yml` | Proposed CI (**not** under `.github/workflows/`) |
| `.github/workflows/` | **Absent** on tip (**VERIFIED**) |

### 3.8 Docs / handoff

| Path | Role |
| --- | --- |
| `docs/HANDOFF.md`, `ROADMAP.md`, `MODEL_CATALOG.md` | Status / next phases |
| `docs/ARCHITECTURE.md`, `DECISIONS.md`, `DATA_DICTIONARY.md` | Phase 1 architecture |
| `docs/LICENSING_AND_DATA_SOURCES.md` | CC BY 4.0 nflverse; MIT clients |
| `docs/PHASE2_REVIEW.md` | Public review pack |
| `AGENTS.md`, `README.md` | Agent / repo entry |

### 3.9 Stubs / out of scope modules

| Path | State |
| --- | --- |
| `backend/src/nfl_sim/providers/__init__.py` | Empty stub (1 line) |
| `backend/src/nfl_sim/sim/__init__.py` | Empty stub (1 line) |

No WP trainer, decision lab, or live adapters on tip (**VERIFIED** inventory).

### 3.10 Notable doc/code discrepancies

| Issue | Detail | Class |
| --- | --- | --- |
| `reference_agreement.json` terminal / poss-change slices | Still pre–half-boundary-fix counts (e.g. test terminal `n=272`; val terminal `n=271`; val poss-change `n=5386`) while `audit_epa_slices_2022.json` has `terminal_n=542`, `poss_change_n=5263` | **VERIFIED** stale artifact vs post-fix counts |
| `DISCREPANCY_BACKLOG.md` B1 uses `n=5,386` | Matches **pre-fix** `reference_agreement` val slice, not post-fix `5263` | **VERIFIED** internal doc drift |
| `audit_epa_slices_2022.json` | Has overall MAE + counts; **lacks** per-slice MAE for same/poss/terminal claimed in `AUDIT.md` | **VERIFIED** incomplete JSON |
| Frontend layout copy | Still “no trained models yet” while API has EP score route on PR branches | **VERIFIED** |
| `baselines_2022.json` artifact path | Absolute host path `/agent/nfl-analytics-simulator/.../ep_model.joblib` committed | **VERIFIED** (env-specific; not a secret) |
| `backfill_validation.json` nested `manifest.pinned_sha256` | Shows Phase-1 digests while code `PINNED_SEASON_SHA256` = lake digests; field `sha256_matches_phase1_pin: false` documents drift | **VERIFIED** (naming confusing; intentional drift record) |
| HANDOFF “Phase 3 complete locally” | True for PR branches; **false for `main`** | **VERIFIED** |

---

## 4. Data provenance and integrity

### 4.1 Active pins (code — **VERIFIED** in `manifest.py`)

| Season | Active sha256 | Declared rows |
| ---: | --- | ---: |
| 2019 | `d14de5d1beebf2235040dec8f50f5cba0e4921bcf2b1a82e69c182abef16d56b` | 47,260 |
| 2020 | `324cef331f3c6b91726450ef2c55f1ec8a619f23a8c4c329191ec15cdfc43b76` | 47,705 |
| 2021 | `e4dd2e160522ed3534f58e788c03365ad436268605950e864663c6a5161718c8` | 49,922 |
| 2022 | `e7c1b53b14afd073c209e0a90f8593058fb77c38583c4bc9593885fa67d133c7` | 49,434 |
| 2023 | `b8417df9501f7f966eaccfffe463425fc06153f7bd58e075f5fa8f900e67460d` | 49,665 |

Phase-1 digests retained in `PREVIOUS_PINNED_SEASON_SHA256` (same row counts, different bytes) — **DOC** + code **VERIFIED**.

### 4.2 What this audit independently verified vs inherited

| Claim | Status |
| --- | --- |
| 2023 raw sha256 after local ingest integration | **VERIFIED** `b8417df9…` |
| 2019–2022 raw bytes present locally | **Not present** this audit (not re-downloaded) |
| Row counts / REG scrimmage n in `backfill_validation.json` | **DOC**/committed artifact — not re-counted from Parquet here |
| Modeling split n 116,218 / 39,704 / 40,031 | Present in `metrics.json` + docs — **DOC**/committed; matches DATA_EXPERIMENT narrative |
| Combined modeling hash `5df24dd0…6507b` | In committed `metrics.json` / meta — **DOC**; not recomputed |
| Artifact joblib sha256 `f2777f81…` | **PRIOR-AGENT** (`AUDIT.md` / status) — joblib absent here → **UNRESOLVED** this run |
| License: nflverse-data CC BY 4.0; nflreadpy MIT | **DOC** in `LICENSING_AND_DATA_SOURCES.md` |
| Upstream `pbp` tag mutable | **DOC** + pin policy in code |

### 4.3 Drift policy

Immutable raw refuse-overwrite when bytes ≠ pin (**DOC**/code). Phase-3 notes document digest drift at constant row counts (**DOC**).

---

## 5. EP model audit

### 5.1 Target (**VERIFIED** code + spec)

- Next score **in same half bucket** (Q1–Q2 vs Q3–Q5/OT), 7 classes from prediction-time `posteam`.
- Values: TD=+7, FG=+3, Safety=+2, NoScore=0, OppSafety=−2, OppFG=−3, OppTD=−7.
- XP/2PT rows excluded from scoring events on **PR #3** (`labels.py` `_TRY_PLAY_TYPES`); **absent on PR #2** (**VERIFIED** diff).

### 5.2 Features (**VERIFIED**)

Numeric: `down`, `distance`, `yardline_100`, `half_seconds_remaining`, `posteam_timeouts`, `defteam_timeouts`, `is_home_possession`, `era_post_2020` (season≥2021).  
Categorical: `roof` (unseen → `other`, `handle_unknown="ignore"`).  
Forbidden reference/odds columns guarded by `assert_no_leakage_columns`.

### 5.3 Era treatment

- Feature present in Stage A model (**VERIFIED**).
- Ablation without era on val 2022: log_loss **1.33610** vs multinomial **1.33717** in committed `baselines_2022.json` (**DOC** artifact).
- Era **not removed** in code — optional decision pending (**UNRESOLVED** product).

### 5.4 Splits / exposure

| Split | Seasons | Enforcement |
| --- | --- | --- |
| Train | 2019–2021 | `split.py` + tests **VERIFIED** |
| Val | 2022 | Hyperparam `C` selection only |
| Test | 2023 | Held out; `forbid_test_season_in_fit` |

Selected `C=0.25` on val log loss — committed in `metrics.json` / meta (**DOC**).

### 5.5 Baselines / metrics (committed artifacts — **DOC** unless noted)

Validate 2022 (from `baselines_2022.json` + `metrics.json`):

| Model | log_loss | Brier |
| --- | ---: | ---: |
| Constant prior | 1.528 | 0.758 |
| Yardline-bin empirical | 1.455 | 0.731 |
| Down×distance×yardline smoothed | 1.432 | 0.716 |
| Multinomial `C=0.25` | **1.337** | **0.687** |
| Multinomial w/o era (ablation) | **1.336** | 0.687 |

Held-out test 2023 headline (`EVALUATION.md` / `metrics.json`): log_loss **1.316**, Brier **0.678**, MAE vs ref ep **0.367**, vs ref epa **0.675** — **DOC** (not re-trained here).

### 5.6 Reproduction status (this audit)

| Step | Status |
| --- | --- |
| `pip install -e ".[dev,phase2,models]"` | **VERIFIED** ran |
| Unit/integration pytest | **VERIFIED** 51 passed |
| `nfl_sim.ingest --seasons 2019,2020,2021,2022` | **Not run** |
| `nfl_sim.models train --out ../reports/ep --include-test` | **Not run** |
| `nfl_sim.models baselines …` | **Not run** |
| Joblib present for live `POST /models/ep/score` | **Absent** on tip tree |

### 5.7 Artifacts

| Artifact | In git? |
| --- | --- |
| `reports/ep/artifacts/ep_model.meta.json` | Yes |
| `reports/ep/artifacts/ep_model.joblib` | No (gitignore `reports/ep/artifacts/*.joblib`) |
| `metrics.json`, `reference_agreement.json`, `calibration_touchdown.csv`, `baselines_2022.json`, `audit_epa_slices_2022.json` | Yes |

---

## 6. EPA correctness audit

### 6.1 Convention (**VERIFIED** `epa.py` + spec §6)

| Case | Detection | `model_epa` |
| --- | --- | --- |
| Timeout | `play_type ∈ {timeout, no_play_timeout}` | `0` |
| Terminal | no next **same-half** scrimmage (PR #3) | `-ep_before` |
| Same possession | next posteam == current | `ep_after_raw − ep_before` |
| Possession change | next posteam ≠ current | `-ep_after_raw − ep_before` |

`ep_after_raw` = **model** EP at next state, never reference `ep`.

### 6.2 Half boundary Q2→Q3

| Branch | Behavior |
| --- | --- |
| PR #2 `75183f6` | `groupby("game_id")` only — next scrimmage can cross half → false possession_change (**VERIFIED** `git show`) |
| PR #3 `a56ae61` | `groupby(["game_id","_half"])` — cross-half is terminal (**VERIFIED** source + passing `test_epa_end_of_half_is_terminal_not_cross_half_possession_change`) |

### 6.3 Scoring / kickoffs / punts / penalties / terminals

| Topic | Behavior | Class |
| --- | --- | --- |
| Labels: TD/`td_team`, safety→defteam, FG made→posteam | Implemented; audit tests pass | **VERIFIED** tests |
| XP/2PT not scoring events | PR #3 only | **VERIFIED** |
| Kickoffs / extras / no-down rows | Excluded from fit via `down` null eligibility | **VERIFIED** code |
| Punts / penalties / no_play | Not separate EPA cases; follow actual next pre-play state | **DOC** spec §6.3 + code |
| Score-cashing / ΣEPA = R − EP₀ | **Does not hold** under Stage A (scores jump to next scrimmage; no cash of R) — tested as expected non-identity | **VERIFIED** test name + **DOC** |

### 6.4 Accounting tests that exist (**VERIFIED** file list)

In `backend/tests/test_ep_epa.py` + `test_ep_epa_audit.py`:

- Same possession / possession change / timeout / terminal scalar + vectorized
- End-of-half terminal (not cross-half PC)
- Same-half next-scrimmage still links
- Same-possession chain identity; terminal-half identity
- Realized-points identity **does not hold** under Stage A (explicit)
- Label attribution / XP exclusion / API rejects `model_path`

### 6.5 nflverse discrepancy: convention vs defect

| Gap | Interpretation |
| --- | --- |
| Possession-change EPA MAE ≈2.76–2.83 vs same-poss ≈0.34 | **Convention / kickoff-post-score transition mismatch** vs nflfastR — documented backlog B1; **not** silently “fixed” toward reference |
| Overall val EPA MAE ≈0.678 post-fix | Close to prior ~0.682 | 

**Numbers:**

- Committed post-fix JSON: overall MAE `0.678373…`, `terminal_n=542`, `poss_change_n=5263` — **VERIFIED** file (no per-slice MAE in that JSON).
- Per-slice MAE 0.338 / 2.830 / 1.045 — **PRIOR-AGENT** in `AUDIT.md` only → treat as **unreproduced here**.
- Pre-fix `reference_agreement.json` val poss-change MAE `2.81775…` n=5386; test poss-change MAE `2.75659…` n=5507 — **VERIFIED** file (stale terminal n).

---

## 7. API security and reliability (current code behavior)

### 7.1 PR #3 tip (`a56ae61`) — **VERIFIED**

- Trusted artifact only: `reports/ep/artifacts/ep_model.joblib` (constant path).
- `EpScoreRequest`: all fields required; ranges; roof enum; `extra="forbid"` (rejects `model_path`).
- Missing artifact → **503**; validation errors → **422**; scoring failure → generic **400**.
- CORS: `settings.cors_origins` default localhost:3000; `allow_credentials=True`, methods/headers `*`.
- Replay routes namespace reference ep/epa/wp with disclaimer string.
- No authn/authz on endpoints (local MVP assumption).
- Health reports `phase: 2` even on Stage A branches (stale label).

### 7.2 PR #2 head (`75183f6`) — **VERIFIED unsafe**

- `model_path` from request body → `EPModel.load` / joblib pickle → **RCE risk**.
- Silent defaults for missing fields (`down` default 1, etc.) → empty-ish bodies still score.

### 7.3 Reliability notes

- EP score returns 503 when joblib missing (expected without train artifact).
- Play ordering invariant checked server-side (500 if violated).
- Store missing → 503 on game routes.

---

## 8. Test evidence

### 8.1 Independently run this audit (**VERIFIED**)

Environment: Python 3.12; `pip install -e ".[dev,phase2,models]"`; Node after `npm install`.

| Suite | Command | Result | Timestamp (UTC) |
| --- | --- | --- | --- |
| Backend unit (no ingest file) | `pytest -q --ignore=tests/test_ingest_integration.py` | **48 passed**, 1 warning | ~18:35:53Z |
| Backend ingest integration | `pytest -q tests/test_ingest_integration.py` | **3 passed** (downloaded 2023 pin) | ~18:36:27Z |
| Backend full | `pytest -q` | **51 passed**, 1 warning | ~18:37:11Z |
| Frontend | `npm test` | **2 passed** (after `npm install`) | ~18:37:09Z |
| Frontend typecheck | `npm run typecheck` | **pass** | ~18:37:09Z |

Warning observed: Starlette/`httpx` TestClient deprecation — non-blocking.

### 8.2 PR-or-prior-agent reported (not solely relied upon)

| Claim | Source | Cross-check |
| --- | --- | --- |
| Backend 51 / frontend 2 / typecheck pass on audit branch | Prior agent status notes + `reports/ep/AUDIT.md` | **Matches** this run on PR #3 |
| Backend 33 passed on PR #2 pre-audit | Prior Phase 3 report notes + `AUDIT.md` | **Not re-run** on `75183f6` this audit |
| Train metrics / 542 terminal rows / poss-change MAE 2.830 | `AUDIT.md`, status note | Partial: counts in `audit_epa_slices_2022.json`; slice MAEs **not** in that JSON |
| CI YAML blocked by missing `workflow` scope | `AUDIT.md` | Consistent with proposed file location + token scopes note (`repo` only via `gh auth status`) |

### 8.3 Not run / blocked

| Item | Reason |
| --- | --- |
| Full 2019–2022 ingest + retrain + baselines CLI | Not executed (time/network; read-only audit scope; lake empty for those seasons) |
| Joblib artifact hash verification | File gitignored / absent |
| GitHub Actions green | No workflow installed; `gh pr checks` → none |
| Public fastrmodels/XGB EP | Out of repo (R) — backlog |
| Merge / cherry-pick dry-run onto main | Intentionally not done |

---

## 9. Decisions and unresolved questions

### 9.1 Proposed decisions (from prior audit/roadmap — record only)

| # | Proposed decision | Implemented in repo tip? |
| --- | --- | --- |
| D1 | Merge order: land audit fixes (PR #3) before/instead of bare PR #2 | **Not implemented** as merge — both PRs still OPEN |
| D2 | EPA convention: keep Stage A (no score-cash to R) vs redesign telescoping EPA | **Keep Stage A** in code; redesign **not** done |
| D3 | Drop `era_post_2020` on val ablation evidence | **Not implemented** (feature still present) |
| D4 | Focused public-model reconciliation for possession-change / kickoff EPA | **Not implemented** (backlog only) |
| D5 | WP next after Stage A acceptance | **Not started** (Phase 4 on roadmap) |
| D6 | Live adapters deferred until after WP + decision lab | **Not started**; providers stub empty |

### 9.2 Unresolved questions

1. Exact post-fix per-slice EPA MAEs (same / PC / terminal) — claimed in `AUDIT.md` but not fully serialized in `audit_epa_slices_2022.json`.
2. Whether product requires nflfastR bit-parity or accepts documented approximation for Stage A merge.
3. When/how to install CI under `.github/workflows/` (needs `workflow`-scoped token).
4. Whether to regenerate `reference_agreement.json` before merge (stale terminal n).
5. A parallel implementation worker may still have changed #2/#3 after this snapshot — re-fetch before merge (superseded: #3 later merged; see post-merge note at top).

---

## 10. Prioritized action plan

| P | Action | Files / subsystem | Why | Acceptance criteria | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P0 | **Do not merge PR #2 as-is** | PR process | Unsafe API + EOH EPA bug + XP label hole | Reviewers block #2 without audit commits | Human |
| P0 | **Land PR #3** (or cherry-pick `a56ae61` onto #2 then merge one PR) | `epa.py`, `labels.py`, `app.py`, audit tests, baselines | Required correctness/safety | CI/local: backend 51 + frontend 2 + typecheck; API rejects `model_path`; EOH terminal test green | Human approval |
| P1 | Install real CI workflow | copy `reports/ep/ci-workflow-proposed.yml` → `.github/workflows/ci.yml` | No Actions today | Checks appear on PR; green on tip | Token with `workflow` scope |
| P1 | Regenerate stale agreement slices **or** clearly mark them pre-fix | `reference_agreement.json`, `DISCREPANCY_BACKLOG.md` B1 n | Avoid reviewer confusion | Terminal/PC counts consistent with half-boundary semantics | Lake + train artifact |
| P2 | Decide era feature keep/drop on **val-only** evidence | `features.py`, constants, retrain meta | Tiny LL gain without era | Written decision in DECISIONS/HANDOFF; 2023 untouched during choice | D3 |
| P2 | Focused reconciliation pass (kickoff/post-score EPA) | EPA transitions; backlog B1 | Largest ref gap is convention | Val-only agreement report; no silent tune on 2023 | D4 approval |
| P3 | Frontend truth copy for Stage A | `frontend/app/layout.tsx` etc. | UI still says no trained models | Copy matches shipped capabilities | After merge |
| P3 | Phase 4 situation WP | new model package | Roadmap | Spec + leakage gates + held-out report | Stage A merged |
| P4 | Decision lab / live adapters | `sim/`, `providers/` | Explicitly later | Only after WP + decision foundations | D5/D6 |

### Stage A merge-readiness recommendation

**Ready to merge only via the audit-fixed line (PR #3 tip `a56ae61` or equivalent), not PR #2 tip `75183f6`.**

**Evidence still required before calling Stage A “closed” operationally:**

1. Human merge of audit-fixed branch to `main`.
2. CI installed and green on the merge commit (**currently missing**).
3. Train artifact availability procedure documented for deploys (joblib gitignored — expected).
4. Optional but strongly recommended: refresh `reference_agreement.json` post–EOH-fix; serialize full EPA slice MAEs into JSON.
5. Explicit product call on D2 (keep Stage A EPA) and D4 timing (reconciliation vs WP-first).

**Not blocking merge of audit-fixed Stage A (per code+tests+docs):** remaining possession-change reference MAE; era ablation optional; XGB public model not run; live/WP/decision deferred.

---

## Appendix A — PR #2 → PR #3 file delta (stat)

```text
backend/src/nfl_sim/api/app.py
backend/src/nfl_sim/models/__main__.py
backend/src/nfl_sim/models/baselines.py          (new)
backend/src/nfl_sim/models/dataset.py
backend/src/nfl_sim/models/epa.py
backend/src/nfl_sim/models/labels.py
backend/tests/test_baselines.py                 (new)
backend/tests/test_ep_epa_audit.py              (new)
reports/ep/AUDIT.md                             (new; do not overwrite)
reports/ep/DISCREPANCY_BACKLOG.md
reports/ep/artifacts/ep_model.meta.json
reports/ep/audit_epa_slices_2022.json           (new)
reports/ep/baselines_2022.json                  (new)
reports/ep/ci-workflow-proposed.yml             (new)
reports/ep/metrics.json
```

(~1210 insertions / 37 deletions per `git diff --stat 75183f6..a56ae61`.)

## Appendix B — Prior materials consulted (claims, not authority)

Private Cursor Project store notes were consulted during the inspection (agent status / Phase 3 reports / coordinator notes). Those paths are **not** publicly readable; do not treat them as review inputs. Public anchors for the same themes:

- Repo [`reports/ep/AUDIT.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/reports/ep/AUDIT.md) (on PR #3 tip at inspection; now on `main`)
- Repo [`docs/HANDOFF.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/docs/HANDOFF.md) for post-merge handoff
- Open PR pages at inspection: [#2](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/2), [#3](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/3)

## Appendix C — Integrity statement

- No push, PR creation, merge, force-push, or model-behavior change by this auditor.
- No secrets/tokens printed.
- Metrics/hashes not fabricated; unreproduced items labeled **PRIOR-AGENT** / **DOC** / **UNRESOLVED**.
- Parallel worker remotes unchanged during inspection window; treat this as a **timestamped snapshot**.
