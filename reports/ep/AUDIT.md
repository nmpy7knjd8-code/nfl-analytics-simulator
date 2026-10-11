# EP/EPA Independent Correctness Audit

**Auditor:** independent gate agent (`bc-f4d529d6-c767-5ebc-aeaf-ce205e36d4ea`) — not the Stage A implementer  
**Date:** 2026-10-11  
**PR under audit:** [#2](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/2) — **not merged**  
**Recommendation:** **request targeted changes** (see §13)

---

## 1. Repository state and branch examined

| Item | Value | Confidence |
| --- | --- | --- |
| Remote PR #2 head | `cursor/stage-a-ep-epa-0cca` @ `75183f648223ed4de85ad3ab2aa195fa7a97c6ab` | Verified from GitHub API |
| Audit branch | `cursor/ep-epa-audit-d4ea` created from that head | Verified |
| Base | `main` @ `e5849ce` (PR #1 merge) | Verified from git log |
| Spec | `docs/EP_MODEL_SPEC.md` locked next-score-in-half / possession-aware EPA | Verified from source |
| Ingest CLI | `--season` (default 2023) and `--seasons` (comma list overrides) — **not** a duplicate-arg bug | Verified by executing `--help` |

Stale claims checked: Phase 3 report “33 passed” matched pre-audit baseline on PR head. `reports/ep/reference_agreement.json` situation slices still reflect **pre–half-boundary-fix** terminal counts (n=272 on test); post-fix counts are in `audit_epa_slices_2022.json` / regenerated `metrics.json`.

---

## 2. Baseline test output (before audit edits)

Commands (PR #2 head, pre-change):

```text
cd backend && python3 -m pip install -e ".[dev,phase2,models]"
python3 -m pytest -q
# 33 passed, 1 warning

cd frontend && npm install && npm test && npm run typecheck
# 2 passed / typecheck pass
```

After `npm install` (fresh clone lacked `node_modules`), frontend matched the Phase 3 claim.

---

## 3. Exact EP target and feature definitions

**Target (verified in `labels.py` + spec):** next score in the same half bucket (Q1–Q2 vs Q3–Q5/OT), 7 classes from the **prediction-time `posteam`** perspective:

| Class | Value |
| --- | ---: |
| Touchdown / FieldGoal / Safety / NoScore | +7 / +3 / +2 / 0 |
| OppSafety / OppFieldGoal / OppTouchdown | −2 / −3 / −7 |

**Features entering the model after transform:**  
`down`, `distance`, `yardline_100`, `half_seconds_remaining`, `posteam_timeouts`, `defteam_timeouts`, `is_home_possession`, `era_post_2020` (binary season≥2021), one-hot `roof`.  
**No raw `season` column.** Unseen roofs → `other` (`handle_unknown="ignore"`).  
Forbidden reference/odds columns guarded by `assert_no_leakage_columns`.

---

## 4. Label correctness findings

| Check | Result |
| --- | --- |
| Next-score-in-half (not drive EP) | **Pass** — half-bucket scan |
| TD uses `td_team` (not posteam alone) | **Pass** — regression `test_defensive_td_uses_td_team_not_posteam` |
| Safety → defteam | **Pass** |
| Made FG → posteam | **Pass** |
| Score-delta / perspective tests | **Pass** — added |
| XP/2PT as scoring events | **Bug fixed** — try `play_type`s excluded (spec §3.1); adversarial `touchdown=1` on XP no longer labels |
| Ambiguous scorer → NA drop | **Pass** (policy) |
| OT in second-half bucket | Documented Stage A simplification (locked) |

---

## 5. EPA transition convention and accounting-identity derivation

### Convention (code + spec §6)

| Case | Detection | `model_epa` |
| --- | --- | --- |
| Timeout | `play_type ∈ {timeout, no_play_timeout}` | `0` |
| Terminal | no next **same-half** scrimmage | `−ep_before` |
| Same possession | next posteam == current | `ep_after_raw − ep_before` |
| Possession change | next posteam ≠ current | `−ep_after_raw − ep_before` |

`ep_after_raw` = model EP at next same-half scrimmage pre-play state (never reference `ep`).

### Demonstrated bug (fixed)

`attach_post_state` previously searched next scrimmage by `game_id` only. Last play of Q2 linked to Q3 → false `possession_change`.  
**After fix:** next scrimmage must share `half_bucket`; Q2→Q3 is terminal. On 2022 eligible rows, all **542** last-in-half-bucket rows are terminal (0 violations).

### Accounting identity (derived)

Define \(V_i\) = model EP for the team about to snap at state \(i\), and Stage A EPA as above (sign-flip on possession change; timeouts 0; terminal → \(V=0\)).

1. **Same-possession contiguous chain (no timeout):**  
   \(\sum_i \mathrm{EPA}_i = \mathrm{ep\_after\_last} - \mathrm{ep\_before\_first}\).  
   Tested synthetically.

2. **Chain ending in terminal (same possession until end):**  
   \(\sum_i \mathrm{EPA}_i = -\mathrm{ep\_before\_first}\).  
   Tested synthetically.

3. **Realized next-score points identity \(\sum\mathrm{EPA}=R-\mathrm{EP}_0\):**  
   **Does not hold** under Stage A, because scoring plays do **not** cash \(R\) into `ep_after` (they jump to next scrimmage / kickoff state). Residual vs \(R-\mathrm{EP}_0\) is expected; documented in tests — not treated as an implementation bug relative to the locked spec.

---

## 6. Test results and discrepancy decomposition by event category

### Automated tests (post-fix)

```text
cd backend && python3 -m pytest -q
# 51 passed, 1 warning

cd frontend && npm test && npm run typecheck
# 2 passed / pass
```

### Validate 2022 EPA vs reference (diagnostic only; after half-boundary fix)

| Slice | n | MAE(model_epa, ref epa) | Notes |
| --- | ---: | ---: | --- |
| Overall | 39,704 | **0.678** | ≈ prior 0.682 |
| Same possession, non-terminal | 33,899 | **0.338** | Healthy |
| Possession change | 5,263 | **2.830** | Still dominant gap (B1) |
| Terminal | 542 | **1.045** | Count ↑ after EOH fix (was ~half that under old rule) |

Source: `reports/ep/audit_epa_slices_2022.json` + retrain `metrics.json`.  
Largest remaining gap is **spec/convention vs nflfastR** on post-score / possession-change transitions — not fixed in this audit (would require locked public kickoff EP rules).

---

## 7. Baseline metrics on 2022

All empirical baselines fit on **train 2019–2021 only**; evaluated on **validate 2022 only**. 2023 untouched (`baselines_2022.json`).

| Model | log_loss | Brier (multiclass) |
| --- | ---: | ---: |
| Constant class prior | 1.528 | 0.758 |
| Yardline-bin empirical | 1.455 | 0.731 |
| Down×distance×yardline smoothed (α=5) | 1.432 | 0.716 |
| Sklearn multinomial (`C=0.25`) | **1.337** | **0.687** |
| Ablation: multinomial **without `era_post_2020`** (C=0.25 fixed) | **1.336** | 0.687 |

**Era feature:** removing it slightly *improves* 2022 log loss (~0.001). Not removed in this gate (tiny delta; not a correctness bug). Optional follow-up: drop era on val-only evidence and freeze before any 2023 look.

Multinomial still beats strong empirical baselines on 2022 — target/features are informative; capacity/transitions remain the EPA agreement bottleneck.

---

## 8. API security findings and fixes

**Before (demonstrated unsafe):**

* `POST /models/ep/score` accepted `model_path` from the request and `joblib.load`’d it (pickle RCE).
* Missing fields filled with silent defaults → empty-ish bodies produced plausible EP.

**After (fixed on audit branch):**

* Trusted artifact only: `reports/ep/artifacts/ep_model.joblib`.
* `EpScoreRequest` Pydantic model: all fields required, ranges validated, `extra="forbid"` (rejects `model_path`).
* Response includes `model_meta.artifact_sha256`, `selected_C`, `train_seasons` when available.
* Errors: 422 validation / 503 missing artifact / 400 generic scoring failure (no path leakage).

Tests: `test_api_rejects_model_path_and_empty_body`.

---

## 9. Data provenance and hash findings

| Season | Raw file sha256 (manifest) | Rows | Pin match |
| ---: | --- | ---: | --- |
| 2019 | `d14de5d1…d56b` | 47,260 | yes (active pin) |
| 2020 | `324cef33…3b76` | 47,705 | yes |
| 2021 | `e4dd2e16…18c8` | 49,922 | yes |
| 2022 | `e7c1b53b…33c7` | 49,434 | yes |
| 2023 | `b8417df9…60d` | 49,665 | **Phase 2 pin preserved** |

* Row-count equality ≠ byte identity — Phase 1 digests drifted; documented in `docs/DATA_PIN_NOTES.md`.
* Combined modeling hash in `metrics.json`: `5df24dd0…6507b`.
* Artifact sha256 (local joblib, gitignored): `f2777f81f10618e6491717b9d31418227545628380fb2e6990e4000bf2e071fb`.
* Added `canonical_content_hash()` (column projection ≠ raw bytes) for future sealed-set work.
* Packages recorded: sklearn 1.9.1, numpy 2.5.4, pandas 3.0.6, joblib 1.6.0, nflreadpy 0.1.5, seed 42.

---

## 10. Files changed and reasons

| File | Reason |
| --- | --- |
| `backend/src/nfl_sim/models/epa.py` | Same-half next scrimmage / EOH terminal fix |
| `backend/src/nfl_sim/models/labels.py` | Exclude XP/2PT from scoring events |
| `backend/src/nfl_sim/api/app.py` | API path safety + typed request |
| `backend/src/nfl_sim/models/baselines.py` | 2022 empirical baselines |
| `backend/src/nfl_sim/models/__main__.py` | `baselines` CLI (+ era ablation on 2022) |
| `backend/src/nfl_sim/models/dataset.py` | Canonical content hash helper |
| `backend/tests/test_ep_epa_audit.py` | Label/EPA/API/identity regressions |
| `backend/tests/test_baselines.py` | Baseline unit tests |
| `reports/ep/ci-workflow-proposed.yml` (intended `.github/workflows/ci.yml`; push blocked without GitHub `workflow` token scope) | Backend + frontend CI workflow (**committed; not verified green on GitHub Actions in this run**) |
| `reports/ep/baselines_2022.json` | 2022 baseline numbers |
| `reports/ep/audit_epa_slices_2022.json` | Post-fix EPA slice MAEs |
| `reports/ep/metrics.json` / `artifacts/ep_model.meta.json` | Regenerated after fix (joblib gitignored) |
| `reports/ep/DISCREPANCY_BACKLOG.md` | Audit fix log |
| `reports/ep/AUDIT.md` | This report |

---

## 11. Commands run and actual test output

```text
# Audit branch from PR head
git fetch origin cursor/stage-a-ep-epa-0cca
git checkout -B cursor/ep-epa-audit-d4ea origin/cursor/stage-a-ep-epa-0cca
# HEAD 75183f648223ed4de85ad3ab2aa195fa7a97c6ab

python3 -m nfl_sim.ingest --seasons 2019,2020,2021,2022
# pins matched; 2023 pin b8417df9… present/preserved

python3 -m nfl_sim.models train --out ../reports/ep --include-test
# selected_C=0.25; n train/val/test = 116218 / 39704 / 40031

python3 -m nfl_sim.models baselines --ablate-era --out ../reports/ep/baselines_2022.json

cd backend && python3 -m pytest -q
# 51 passed, 1 warning

cd frontend && npm test && npm run typecheck
# 2 passed / pass
```

CI workflow authored as `reports/ep/ci-workflow-proposed.yml` — **not** installed under `.github/workflows/` in this push because the available `GH_TOKEN` lacks the `workflow` scope. Copy into `.github/workflows/ci.yml` with a properly scoped token. Not claimed Actions-green.

---

## 12. Unresolved issues and decisions requiring human approval

1. **Merge vs hold PR #2:** Audit branch has required safety/correctness fixes; PR #2 head alone should **not** merge without them (or equivalent).
2. **Possession-change / scoring EPA vs nflfastR (B1):** Still MAE≈2.8. Needs a locked public kickoff/post-score convention before “fixing” toward reference — **approval for reconciliation pass**.
3. **Score-cashing in EPA:** Stage A identity ≠ realized points. Keep (document) or redesign EPA to include \(R\) — **product decision**.
4. **Drop `era_post_2020`?** Tiny 2022 gain without it; optional val-only cleanup — **approval**.
5. **Regenerate `reference_agreement.json` slices** after EOH fix (stale terminal n) — mechanical follow-up.
6. **Future sealed test set (2024–2025):** propose freeze protocol; do **not** change 2023 holdout now.
7. **Do not start WP / sim / decision lab** until this gate is accepted.
8. **Live-game decision evaluation** is a confirmed eventual product goal, but **live adapters / live feeds are out of scope for this audit** and must wait until after WP + decision-lab foundations (later roadmap phases). This gate does not implement, scaffold, or schedule live ingestion.

---

## 13. Recommendation

### **Request targeted changes** (do not merge PR #2 as-is; do not redesign EP)

**Merge path:** land audit branch fixes (or cherry-pick onto PR #2) then merge once reviewed:

* Half-boundary EPA terminal semantics  
* XP/2PT label exclusion  
* API artifact-path safety + typed validation  
* New regressions + CI workflow  

**Not blocking merge of Stage A after those land:** remaining reference-EPA gap on possession changes (documented approximation), era ablation optional, public XGB reconciliation deferred.

**Redesign** only if product requires nflfastR bit-parity or score-cashed EPA telescoping to \(R\) — that is a spec change, not a silent code tweak.

---

## 14. 2023 evaluation protection and future sealed test set

| Control | Status |
| --- | --- |
| `forbid_test_season_in_fit` / split asserts | Present; baselines CLI loads 2019–2022 only |
| Hyperparam selection | 2022 only (`C=0.25`); 2023 scored once in train `--include-test` |
| Audit tuning | No 2023-based feature/convention selection |
| 2023 raw pin | `b8417df9…` preserved |
| Future sealed set | Need: pin raw+canonical content hashes for unused seasons (e.g. 2024–2025 when available), write freeze manifest, forbid ingest overwrite, evaluate once under change control |

**Existing 2023 evaluation remains protected** for model selection. Re-reported metrics after EOH fix are agreement diagnostics only.

### Later product path (not this milestone)

User-confirmed goal: eventual **live-game decision evaluation**. Sequence remains: accept EP/EPA correctness → situation WP → simulation / decision lab → **then** live adapters. No live feeds, streaming providers, or real-time score hooks belong in the EP/EPA audit or in a merge of Stage A.
