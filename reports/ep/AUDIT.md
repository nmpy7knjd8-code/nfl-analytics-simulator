# EP/EPA Independent Correctness Audit — Stage A gate

**Date:** 2026-10-11  
**Gate status:** **PASS — Stage A merge-ready** (internal invariants + documented convention diffs)  
**Recommendation:** Merge audited Stage A as **one unit** via [PR #3](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/3); **do not** merge [PR #2](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/2) as-is.

Passing tests establish transition/label/API invariants under the project’s locked conventions. They do **not** by themselves prove model correctness vs an external oracle.

---

## 1. Branch and merge status (actual)

| Item | Value | Verified |
| --- | --- | --- |
| `main` | `e5849ce` (PR #1) | GitHub API |
| PR #2 head | `cursor/stage-a-ep-epa-0cca` @ `75183f6` — Stage A only | API |
| PR #3 head | `cursor/ep-epa-audit-d4ea` — **stacked on #2** (+ audit + gate commits) | compare API: #3 = #2 + audit commits |
| Stacking | **Not independent** — #3 contains all of #2 | `stage-a…audit` ahead_by ≥ 1 |
| Merge sequencing | Land **one audited unit** (#3 → `main`); close #2 as superseded | Decision |
| Era in production | **Excluded** (`era_post_2020` not in `NUMERIC_FEATURES`) | Source + artifact feature names |
| nflfastR bit-parity | **Not required** to close gate | Decision |

---

## 2. Precise EP target and EPA conventions

### EP target

| Item | Definition |
| --- | --- |
| Quantity | Next score in the **same half bucket** (Q1–Q2 vs Q3–Q5/OT), from prediction-time `posteam` |
| Classes / values | TD=+7, FG=+3, Safety=+2, NoScore=0, OppSafety=−2, OppFG=−3, OppTD=−7 |
| Tries | XP and two-point attempts are **not** independent next-score labels; TD = +7 folds the try |
| Scoring attribution | `td_team` / score flags; defensive scores use scoring team, not posteam alone |
| Kickoffs / extras | Not eligible modeling rows (`down` null); EPA next-state jumps to next **same-half scrimmage** |
| Penalties / no-plays | Not scoring events; EPA uses observed next pre-play state |
| Period boundaries | Next scrimmage must share half bucket; Q2→Q3 is **terminal** (`−ep_before`) |
| Holdout | 2023 never used to tune conventions or features |

### EPA (possession-aware, Stage A)

| Case | `model_epa` |
| --- | --- |
| Timeout | `0` |
| Terminal (no same-half next scrimmage) | `−ep_before` |
| Same possession | `ep_after_raw − ep_before` |
| Possession change | `−ep_after_raw − ep_before` |

`ep_after_raw` = model EP at next same-half scrimmage (never reference `ep`). Scoring does **not** cash realized points \(R\) into `ep_after`, so \(\sum\mathrm{EPA}=R-\mathrm{EP}_0\) does **not** hold by design.

Full lock: [`docs/EP_MODEL_SPEC.md`](../../docs/EP_MODEL_SPEC.md).

---

## 3. Accounting-invariant coverage and exclusions

| Identity | Result | Coverage |
| --- | --- | --- |
| Same-possession contiguous next-scrimmage: \(\sum\mathrm{EPA}=V_{\mathrm{after\,last}}-V_0\) | **Pass** | Synthetic + 776 train-season chains (40 games, 2019–2021) |
| Terminal telescoping: \(\sum\mathrm{EPA}=-V_0\) | **Pass** | Synthetic + 80 train-season terminals |
| Possession-change sign flip | **Pass** | Unit tests |
| \(\sum\mathrm{EPA}=R-V_0\) | **Excluded** (not Stage A) | Documented |

**Exclusions:** timeouts; possession-change plays; null-down admin rows; discontinuous next-scrimmage intervals; score-cash residual; **2023**.

Source: `reports/ep/reconciliation_2022.json` · tests in `backend/tests/test_ep_epa_audit.py`.

---

## 4. nflverse discrepancy explanation (focused reconciliation)

Validate **2022** only (post era-exclusion retrain):

| Slice | n | MAE(model_epa, ref epa) | Classification |
| --- | ---: | ---: | --- |
| Overall | 39,704 | **0.676** | — |
| Same possession, non-terminal | 33,899 | **0.337** | Healthy agreement band |
| Possession change (all) | 5,263 | **2.824** | Mixed |
| → after score | 2,030 | **6.475** | **Intentional convention** (no kickoff/touchback EP layer; no score cash) |
| → non-score | 3,233 | **0.532** | Residual EP-level / transition mix — not identity defect |
| Terminal | 542 | **1.013** | Half-end conventions vs reference |

**Gate reading:** Exact nflfastR parity is **not** required. Internal identities pass; dominant gap is explained post-score convention. Reopen only if a likely defect appears (identity failure or unexplained same-possession collapse). Details: `reconciliation_2022.json`, `DISCREPANCY_BACKLOG.md`.

---

## 5. Era-feature decision

| Item | Value |
| --- | --- |
| Production | **Exclude** `era_post_2020` |
| Ablation preserved | without-era val LL **1.336** vs with-era **1.337** (`baselines_2022.json`) |
| Encoding (if reconsidered) | binary `season ≥ 2021`; no raw `season` column |
| Reconsider when | Meaningful + stable gain across temporal validation; encoding documented |
| 2023 | Not used for this decision |

---

## 6. Tests actually run (final merge shape)

Branch `cursor/ep-epa-audit-d4ea` after gate commits; lake pins matched (2019–2023).

```text
cd backend && python3 -m pip install -e ".[dev,phase2,models]"
python3 -m nfl_sim.ingest --seasons 2019,2020,2021,2022,2023
# pins matched; 2023 sha256 b8417df9… preserved

python3 -m nfl_sim.models train --out ../reports/ep --include-test
# selected_C=0.25; n=116218/39704/40031; era excluded

python3 -m nfl_sim.models baselines --ablate-era --out ../reports/ep/baselines_2022.json
python3 -m nfl_sim.models reconcile --out ../reports/ep/reconciliation_2022.json
# identity_pass=true

python3 -m pytest -q
# 54 passed, 1 warning

cd frontend && npm test && npm run typecheck
# 2 passed / pass
```

CI workflow remains proposed at `reports/ep/ci-workflow-proposed.yml` (token lacks `workflow` scope for `.github/workflows/`).

### Headline metrics (era excluded; 2023 report-only)

| Split | log_loss | Brier | MAE vs ref ep | MAE vs ref epa |
| --- | ---: | ---: | ---: | ---: |
| Val 2022 | 1.336 | 0.687 | 0.370 | 0.676 |
| Test 2023 | 1.314 | 0.677 | 0.368 | 0.669 |

---

## 7. Bugs fixed on audit path (still required)

1. EPA end-of-half: next scrimmage same-half only (Q2→Q3 terminal).  
2. XP/2PT excluded from scoring events.  
3. API: no caller `model_path`; typed required `EpScoreRequest`; `extra=forbid`.

---

## 8. Remaining risks and explicit WP gate

### Remaining risks

* Possession-change / post-score EPA ≠ nflfastR (documented approximation).  
* Linear multinomial capacity (4th down / red zone bias vs reference).  
* OT half-bucket simplification.  
* Joblib artifact gitignored — regenerate via train CLI after clone.  
* CI workflow not installed on GitHub Actions yet.

### Explicit gate to begin WP (Phase 4)

**Allowed to start WP when all are true:**

1. Audited Stage A merged to `main` (this PR unit).  
2. Accounting identities pass under Stage A conventions (current: **yes**).  
3. Remaining nflverse EPA gaps classified as convention vs defect (current: **yes** — post-score convention).  
4. User/phase approval still required per project stop-gates before expanding scope.  
5. **Do not** start live adapters, decision lab, or new providers in WP.

**WP is not blocked** on open-ended nflfastR parity. Reopen EP/EPA only if a likely defect is identified.

### Next milestones (document only — not implemented here)

1. Merge audited Stage A.  
2. Situation WP.  
3. Historical decision lab (4th down first).  
4. Live adapters **last** (no new providers now).

---

## 9. Files touched for gate closure (this iteration)

| Area | Files |
| --- | --- |
| Era exclusion | `constants.py`, `features.py`, baselines CLI, tests |
| Reconciliation | `models/reconcile.py`, `reconciliation_2022.json`, slice JSON |
| Spec / handoff | `EP_MODEL_SPEC.md`, `HANDOFF.md`, `ROADMAP.md`, `EVALUATION.md`, this `AUDIT.md` |
| Prior audit fixes | `epa.py`, `labels.py`, `api/app.py` (already on branch) |
