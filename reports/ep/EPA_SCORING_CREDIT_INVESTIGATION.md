# EPA Scoring-Credit Investigation (Task A)

**Date:** 2026-10-11  
**Branch:** `cursor/epa-scoring-credit-0f5a` (local only — **no push, no merge**)  
**Starting SHA:** `15da234b900059ab2a8f36279112203d02cace37` (`origin/main`, Stage A merge)  
**Ending SHA (branch tip):** `4529196326a36d274ff184a7c5d49d6a1a72304d` · investigation commit `a7077d45336069719db38894f78470c1a77c068f`
**Scope:** Task A only. No era/retrain/CI/baselines/Task B. **2023 sealed** (not loaded).  
**Recon input:** [`docs/REFERENCE_IMPLEMENTATION_RECON.md`](../../docs/REFERENCE_IMPLEMENTATION_RECON.md) Addendum A (nflfastR cashes `R − ep` on scoring plays).

---

## 1. Starting state

| Item | Value | Verified |
| --- | --- | --- |
| Repo | `nmpy7knjd8-code/nfl-analytics-simulator` | clone |
| Base | `main` @ `15da234` (PR #3 merged; PR #2 superseded/merged; PR #4 docs OPEN) | `gh pr view` |
| Working branch | `cursor/epa-scoring-credit-0f5a` tracking `origin/main` at start | git |
| Working tree at start | clean @ `15da234` | git |
| Lake 2019–2022 | Present; sha256 match pins / `ep_model.meta.json` | ingest + manifests |
| Lake 2023 | Present on disk; **never loaded** in Task A scripts | `forbid_holdout` + season assert |
| `ep_model.joblib` | **MISSING** (gitignored; only `ep_model.meta.json`) | filesystem |
| Artifact meta | `selected_C=0.25`, era excluded, train 2019–2021, packages sklearn 1.9.1 / joblib 1.6.0 | meta JSON |
| API hardening | Trusted path only; `EpScoreRequest` + `extra=forbid`; no caller `model_path` | source |
| Half-boundary / XP | Q2→Q3 terminal; XP/2PT excluded from scoring events | tests |
| Fast tests (start) | Backend **54 passed** before Task A files | pytest |
| Fast tests (end) | Backend **67 passed** ( +13 scoring-credit ) | pytest |

**Blocker for model_epa tables:** saved `reports/ep/artifacts/ep_model.joblib` unavailable. Per hard constraint: **no retrain / no substitute model**. Historical Convention A/B diagnostics use **nflverse `ep` as EP surface** (comparison B isolation). Project-`model_epa` pre/post with the saved artifact is **not executed**.

**Holdout isolation:** diagnostic loads seasons `(2019,2020,2021,2022)` only; raises if 2023 appears; `holdout_2023_loaded: false` in results JSON.

---

## 2. Convention A vs Convention B (from code + reference)

Comparisons A/B/C kept separate (recon Addendum A3). This section is **comparison B** (EPA rules given an EP vector).

### Definitions used

| Symbol | Meaning |
| --- | --- |
| `ep_before` | EP for snap `posteam` (surface: lake `ep` here) |
| `ep_after_raw` | EP at **next same-half scrimmage** (Stage A constructor in `attach_post_state`) |
| `R` | Next-score **class value** on this row from snap `posteam` perspective ∈ {+7,+3,+2,0,−2,−3,−7}; **not** raw scoreboard (±6 TD). XP/2PT rows → `R=0`. Scorer from `td_team` / safety→defteam / FG→posteam (`scoring_event_team`). |
| Perspective | Always snap `posteam` for EPA |

### Convention A — production Stage A (`epa.py`)

| Case | Formula (actual code) |
| --- | --- |
| Timeout | `0` |
| Terminal (no same-half next scrimmage) | `−ep_before` |
| Same possession | `ep_after_raw − ep_before` |
| Possession change | `−ep_after_raw − ep_before` |
| Scoring | **No** separate overlay; score plays use PC/terminal path above |

Hypotheses confirmed in code: no `R` term; next state jumps to next scrimmage (skips XP/kickoff rows for linking); Q2→Q3 is terminal.

### Convention B — Reference-EPA-B (nflfastR overlays)

From `helper_add_ep_wp.R` (recon): non-score base matches Stage A ΔEP / PC sign-flip / end-half `−ep`; **scoring plays override** to:

| Event | Reference-EPA-B |
| --- | --- |
| TD for posteam | `7 − ep_before` |
| TD against posteam | `−7 − ep_before` |
| Made FG | `3 − ep_before` (opp FG `−3 − ep`) |
| Safety | `±2 − ep_before` via scoring team |
| XP / 2PT / kickoff | **Separate rows** (not folded into the TD/FG EPA) |

Implemented in `nfl_sim.models.scoring_credit.convention_b_epa`: non-score = A; if `|R|>0` → `R − ep_before` (**not** `A + R`, which would keep `−ep_after`).

### Comparison C

Predictive EP metrics / 2023 holdout — **not regenerated** in Task A.

---

## 3. Historical diagnostic (2019–2022, lake `ep` surface)

**Script:** `backend/scripts/epa_scoring_credit_diagnostic.py`  
**Results:** `reports/ep/scoring_credit/diagnostic_results.json`  
**Table CSV:** `reports/ep/scoring_credit/outcome_table_2019_2022.csv`  
**Row cache:** `reports/ep/scoring_credit/scored_conventions_2019_2022.parquet`

EP surface note: nflverse `ep` — isolates EPA transition convention. **Not** a substitute project model.

Eligible: REG, non-null `down`, finite lake `ep`/`epa`, Conventions A/B defined. **n = 155,920**. Seasons loaded: 2019–2022 only.

### Outcome table vs published `epa`

| Bucket | n | MAE A | MAE B | mean A | mean B | mean ref | %neg A | %neg B | %neg ref |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| td_offense | 5242 | **8.012** | **0.000** | −5.604 | 2.409 | 2.409 | **99.62** | **0.00** | 0.00 |
| td_defense_or_return | 271 | **8.030** | **0.000** | 0.150 | −7.879 | −7.879 | 45.39 | 100.00 | 100.00 |
| fg_made | 3391 | **3.926** | **0.000** | −3.283 | 0.632 | 0.632 | **99.44** | **0.00** | 0.00 |
| safety | 62 | 0.805 | 0.129 | −0.798 | −1.200 | −1.071 | 82.26 | 98.39 | 95.16 |
| punt | 8274 | 0.003 | 0.003 | −0.099 | −0.099 | −0.101 | 59.72 | 59.72 | 59.75 |
| turnover_non_score | 2266 | 0.006 | 0.006 | −4.462 | −4.462 | −4.466 | 99.78 | 99.78 | 99.91 |
| turnover_on_downs | 1280 | 0.020 | 0.020 | −2.946 | −2.946 | −2.955 | 99.38 | 99.38 | 99.61 |
| same_possession_other | 132697 | 0.002 | 0.002 | 0.032 | 0.032 | 0.032 | 56.93 | 56.93 | 56.95 |
| terminal_no_score | 1713 | 0.024 | 0.024 | −0.742 | −0.742 | −0.726 | 61.06 | 61.06 | 60.89 |
| possession_change_other | 724 | 0.866 | 0.866 | −3.405 | −3.405 | −2.561 | 99.72 | 99.72 | 89.92 |
| **overall** | **155920** | **0.375** | **0.0065** | −0.351 | −0.011 | −0.007 | 60.64 | 55.23 | 55.20 |

Exclusions: 38,401 rows (non-REG / null down / missing EPA). No invented metrics — all from the JSON/CSV above.

**Reading:** On TD/FG, Ref-B matches published `epa` to numerical noise; Stage A is ~`R` away and marks ~99.5% of offensive scores as **negative EPA**. Non-score PC/punt/TOD/same-poss: A≡B and ≈ reference. Residual gaps: safeties (attribution/`safety_team`), `possession_change_other` (next-scrimmage vs fill/lead — unresolved quantitatively, n=724).

---

## 4. Accounting identity (derived before test)

**Target EP** = E[next-score class value in half]. For an epoch from snap 0 through first score with realized `R_end` (or 0 if half ends):

\[
\sum \mathrm{EPA}_B = R_{\mathrm{end}} - \mathrm{EP}_0
\]

under Convention B (score overlay `R − ep` on the closing play; Stage A ΔEP on prior same-possession snaps).  
`R` ∈ {+7,+3,+2,0,−2,−3,−7}; XP/2PT not double-counted; defensive/return via scoring team.

**Convention A** does **not** satisfy this (documented exclusion); residual ≈ `−R` on score closes.

### Results (2019–2022, contiguous same-poss epochs)

| Check | Value |
| --- | --- |
| Intervals checked | 11,198 |
| Fail | **0** |
| Pass | **true** |
| max \|residual\| | **4.44×10⁻¹⁶** (< 1e-9) |
| frac \|resid\| < 1e-9 | **1.0** |

Skipped: timeouts, non-score PC chains, discontinuous `ep_after→ep_before`, admin-only starts, 2023.

---

## 5. Hand-checkable synthetic tests

File: `backend/tests/test_epa_scoring_credit.py` (**13 passed**).

| Case | Intended semantics |
| --- | --- |
| TD offense `R=+7` not scoreboard 6 | class values |
| Defensive/return TD `R=−7` | `td_team` |
| XP row `R=0` | no double-count |
| TD then KO: A = `−ea−eb`; B = `7−eb` | B ≠ A+R |
| FG then KO: B = `3−eb` | overlay |
| TD end of half: B = `7−eb` | score keeps cash |
| Punt / turnover non-score | A≡B sign-flip |
| Safety `R=−2` for posteam | B = `−2−eb` |
| Half end no score | `−eb` |
| Chain identity B | `Σ = R − EP0` |
| TD links past XP/KO to next scrimmage | constructor |
| 2023 rejected | holdout guard |

Existing audit tests (half-boundary, XP labels, API hardening) still pass in full suite.

---

## 6. Classification and fix decision

### Classification: **coherent but unsuitable** (comparison B)

| Lens | Verdict |
| --- | --- |
| Stage A vs its locked formulas | **Coherent** — code matches `EP_MODEL_SPEC` §6; PC sign-flip not broken |
| Stage A vs nflfastR / published `epa` on scores | **Unsuitable for agreement** — deliberate missing `R − ep` overlay; MAE≈8 on TDs explained |
| Stage A vs next-score identity `ΣEPA=R−EP0` | **Unsuitable** — fails by design; Convention B restores identity (residuals ~0) |
| Sign-flip / half-boundary / XP | **Not the B1 defect** — non-score slices already ≈ reference |

**Not** “unresolved” on the score-cash question: lake evidence + recon settle that public EPA cashes `R` on the scoring play.

**Not** labeled “confirmed defect” in the narrow sense of “implementation fails its own written Stage A rules.” It **is** a confirmed **semantic mismatch** if EPA is required to be next-score-consistent or reference-comparable on scoring plays.

### Production fix

**Not applied in this change set.**

Reasons:

1. Required pre/post `model_epa` tables need the **same saved** `ep_model.joblib` — **missing**; retrain forbidden.  
2. Adopting B is a **spec/product decision** (recon A7.2), not a silent bugfix.  
3. Smallest correct change would be: on scoring rows override EPA to `R − ep_before` (and document), after artifact restore + model-surface pre/post on 2019–2022.

Safe additions landed: diagnostic module/script, synthetic tests, this report, results under `reports/ep/scoring_credit/`.

---

## 7. Deliverables and gate

### Files (Task A)

| Path | Role |
| --- | --- |
| `reports/ep/EPA_SCORING_CREDIT_INVESTIGATION.md` | This report |
| `reports/ep/scoring_credit/diagnostic_results.json` | Full machine results |
| `reports/ep/scoring_credit/outcome_table_2019_2022.csv` | Bucket table |
| `reports/ep/scoring_credit/scored_conventions_2019_2022.parquet` | Row-level A/B/ref |
| `backend/src/nfl_sim/models/scoring_credit.py` | Conventions + diagnostics |
| `backend/scripts/epa_scoring_credit_diagnostic.py` | Runner (2019–2022 only) |
| `backend/tests/test_epa_scoring_credit.py` | Synthetics |

### Tests actually run

| Suite | Result |
| --- | --- |
| `pytest` (full backend) | **67 passed** |
| Diagnostic script 2019–2022 | Executed; JSON written |
| Project `model_epa` vs ref | **Not run** (joblib missing) |
| 2023 metrics | **Not run** (sealed) |

### Holdout

2023 not in diagnostic load; `forbid_holdout` guards; seasons assert `[2019,2020,2021,2022]`.

### EPA gate status (Task A)

| Gate | Status |
| --- | --- |
| Score-cash vs reference explained | **Yes** — Convention B / missing `R−ep` |
| PC sign-flip broken? | **No** (non-score ≈ ref) |
| Identity `ΣEPA_B = R−EP0` | **Pass** (11,198 intervals, resid ≪ 1e-9) |
| Production EPA changed? | **No** (await artifact + explicit adopt-B decision) |
| Task B / WP | **Blocked** until product decision on adopting B + artifact-backed model pre/post |

### Limitations

- No project-model EPA tables (joblib absent).  
- Ref-B oracle approximates nflfastR overlays on Stage A next-scrimmage links (not full tidyr fill/lead); residual `possession_change_other` / safety slices remain.  
- XP/2PT EPA rows not modeled in Stage A (by design).  
- Comparison C not re-run.

### Recommendation

1. Treat Stage A “no score cash” as **documented convention**, unsuitable if EPA must track next-score value or public `epa` on scores.  
2. **Do not merge a silent fix** without restoring `ep_model.joblib` and publishing model-surface pre/post on 2019–2022.  
3. If adopting B: one overlay on scoring plays (`R − ep_before`), update `EP_MODEL_SPEC` §6, keep try/KO separate, re-verify identities + outcome table.  
4. Task B stays blocked on that decision + artifact.

**No push. No merge.**
