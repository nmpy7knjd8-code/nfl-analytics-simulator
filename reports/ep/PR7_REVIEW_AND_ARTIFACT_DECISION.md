# PR #7 Review Packet & EP Artifact Decision

**Date:** 2026-10-11  
**Reviewer agents:** `bc-dc4b2403-dca3-52e4-ab7f-94b0f67caa42` (initial packet); `bc-c5b52bb8-6e39-5b57-bc2f-4f462db93fd7` (C1 corrections)  
**Scope:** Convention B review + C1 docs-only rebuild-proposal corrections; no merge / no retrain / no WP implementation.

Evidence labels: **verified** · **previously reported** · **inferred** · **unresolved**

---

## 0. C1 delta (docs-only)

| Item | Outcome |
| --- | --- |
| Reported tip at C1 start | `4250d13f4a69a38ac20386e8e3cf8f9ba73db75b` — **verified** match |
| Rebuild proposal A–E | Corrected vs `cmd_train` / `ALL_MODEL_SEASONS` / meta write path |
| Artifact authorization | Proposal text **ready to present**; execution still **blocked** until user phrase + pinned lake host |
| WP plan | Minimal clarify: 2023 = prior-exposure report-only, not pristine holdout (§9) |
| Code / dataset / PR #5 | Untouched |

---

## 1. Repository / PR state

| Item | Value | Label |
| --- | --- | --- |
| Branch | `cursor/convention-b-gate-8222` | **verified** |
| HEAD (C1 start / base_review_sha) | `4250d13f4a69a38ac20386e8e3cf8f9ba73db75b` | **verified** (matches reported tip) |
| Prior packet base | `d9165f49e249eede94f978f22901954bae88ef5f` | **previously reported** |
| Working tree (C1 start) | clean | **verified** |
| PR | [#7](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/7) OPEN → `main` | **verified** |
| Base | `main` @ `15da234b900059ab2a8f36279112203d02cace37` | **verified** |
| Ahead / behind (C1 start) | **12** ahead / **0** behind `main` | **verified** |
| Mergeable | MERGEABLE / CLEAN | **verified** |
| CI checks on tip | **none reported** (no workflow on branch) | **verified** |
| Comments / reviews | 0 / 0 | **verified** |
| Safety refs `pre-d015/*` | **absent on remote clone** | **unresolved** here; **previously reported** on publish VM |
| PR #4 / #5 | inspected only; not edited | **verified** |

### Changed files (17) — purpose & review

| File | Purpose | Review |
| --- | --- | --- |
| `backend/src/nfl_sim/models/epa.py` | Convention B overlay (`realized_r`); vectorized override | **OK** — scoring before terminal (scalar); override after base (vector) |
| `backend/src/nfl_sim/models/scoring_credit.py` | A/B conventions, R attribution, diagnostics | **OK** — 2023 forbidden; try/KO R=0 |
| `backend/scripts/epa_scoring_credit_diagnostic.py` | Lake-`ep` A/B runner 2019–2022 | **OK** — blocked without lake |
| `backend/tests/test_epa_scoring_credit.py` | Scoring-credit synthetics | **OK** — 13 tests |
| `backend/tests/test_ep_epa_audit.py` | Audit updates for B + lake skip | **OK** — see §3 skip |
| `docs/EP_MODEL_SPEC.md` | §6 Convention B + identities | **OK** |
| `docs/DECISIONS.md` | D015 pointer | **OK** |
| `docs/DECISIONS_AND_FORWARD_PLAN.md` | Successor brief (D015 accepted) | **OK** (stale “unpushed” note → narrow fix in packet commit) |
| `docs/EPA_CONVENTION_B_ATTRIBUTION.md` | Event attribution table | **OK** |
| `docs/WP_PHASE_PLAN.md` | WP plan only | **OK** — C1 minimal 2023 clarify (§9) |
| `reports/ep/ARTIFACT_PROVENANCE.md` | joblib search / rebuild constraints | **OK** — C1 aligned lake years with CLI |
| `reports/ep/EPA_SCORING_CREDIT_INVESTIGATION.md` | Task A report | **previously reported** evidence |
| `reports/ep/LABELED_REBUILD_PROPOSAL.md` | Rebuild protocol (not executed) | **Corrected (C1)** — §7 |
| `reports/ep/scoring_credit/*` | JSON/CSV/parquet diagnostic cache | See §5 |
| *(absent)* `.github/workflows/ci.yml` | Dropped for token scope | **verified** absent; proposed YAML present |

---

## 2. Convention B findings

### Implementation correctness — **pass (verified)**

Code matches documented Convention B:

* Timeout → EPA `0` before any score logic (**verified** `compute_epa` / `model_epa_from_eps`).
* Scoring `|R|>0` (non-timeout) → `R − ep_before`, **overrides** PC/terminal/same-poss (**verified** scalar order + vector `out[scored]`).
* Non-score: ΔEP / PC `−ea−eb` / terminal `−eb` unchanged when `R=0` (**verified** tests).
* TD +7 / def TD −7 / FG ±3 / safety −2; XP/2PT `R=0`; try exclusion (**verified** synthetics).
* `attach_post_state` skips XP/KO to next scrimmage; half-bucket terminal (**verified** linker test + code).
* `score_model_epa` always passes `realized_next_score_value` (**verified**).
* Spec §6 + attribution table align with code (**verified**).
* Documented **non**-parity: no nflfastR PAT `1−ep` / 2PT overlays (**verified** docs).

Focused tests (initial packet + C1 reconfirm):

```text
cd backend && python3 -m pytest -q tests/test_epa_scoring_credit.py tests/test_ep_epa.py tests/test_ep_epa_audit.py
→ 42 passed, 1 skipped  (exit 0)  # skip: test_accounting_identity_on_training_season_sample — lake not present
```

### Accounting identity — **pass on available data; lake reload blocked**

| Surface | Result | Label |
| --- | --- | --- |
| Synthetics (epoch ΣEPA = R − EP₀) | pass | **verified** |
| Task A lake-`ep` identity | 11198/11198; max \|resid\| ~4.44e−16 | **previously reported** (`diagnostic_results.json`) |
| Parquet re-verify JSON on branch | same class of result; n_eligible 163235 | **previously reported** / re-read this session |
| Fresh lake diagnostic | missing `data/raw` 2019 | **unresolved** / blocked |

Cannot re-run `epa_scoring_credit_diagnostic.py` without pinned lake.

### Project model-surface — **blocked**

No production `ep_model.joblib`. Only meta present. Pytest tmp joblibs are stubs — **forbidden** as substitutes (**verified** gitignore + absent file; fixture size claim **previously reported**).

**Cannot verify without artifact + lake:** project-EP pre/post Convention B tables, event-type MAE on `model_epa`, calibration under B with production EP.

Agreement with nflverse `ep`/`epa` is **not** proof of project-model correctness.

---

## 3. Skipped test & CI

### Skipped test

| Field | Value |
| --- | --- |
| Test | `tests/test_ep_epa_audit.py::test_accounting_identity_on_training_season_sample` |
| Marker | `pytest.skip("lake not present")` when `raw_season_path(2019)` missing |
| Hides? | **Partial** — lake-backed identity sample; synthetics/unit paths still cover formulas. Does **not** hide score-cash overlay unit coverage. |
| Focused exercise (when lake present) | `cd backend && python3 -m pytest -q tests/test_ep_epa_audit.py::test_accounting_identity_on_training_season_sample -rs` |

### Proposed CI (`reports/ep/ci-workflow-proposed.yml`)

| Check | Finding |
| --- | --- |
| Clean checkout | Uses `actions/checkout@v4` — **no** lake / joblib restore steps |
| Lake / ignored artifacts | Pytest will skip lake test; no joblib needed for unit suite |
| Python | 3.12; `pip install -e ".[dev,phase2,models]"` — matches this VM packages (sklearn 1.9.1, joblib 1.6.0, numpy 2.5.4, pandas 3.0.6) **verified** |
| Secrets / permissions | Default GITHUB_TOKEN only; **no** secrets referenced |
| Leakage | No data upload; standard pytest/npm |
| Actual GitHub CI | **Not green / not run** — workflow file **not** on PR tip (`workflow` scope) |

Do **not** claim CI green. Installing workflow later needs token with `workflow` + `repo` (set in UI — never paste).

---

## 4. PR #5 overlap

| | PR #5 | PR #7 |
| --- | --- | --- |
| Branch | `cursor/docs-decisions-forward-plan-0ea7` @ `03d03e3…` | `cursor/convention-b-gate-8222` |
| Shared path | `docs/DECISIONS_AND_FORWARD_PLAN.md` | same path (successor content) |
| PR #5 only | `docs/index.md`, `reports/DECISIONS_AND_FORWARD_PLAN.md` | — |

**Conflict:** real **add/add** on `docs/DECISIONS_AND_FORWARD_PLAN.md` (`git merge-tree` CONFLICT). Not theoretical.

| PR #5 content | PR #7 content |
| --- | --- |
| D015 **OPEN**; recommends Adopt B | D015 **ACCEPTED**; production B on branch |

**Smallest safe resolution (do not merge either here):**

1. Review/merge **PR #7** when ready (successor brief).  
2. **Close or rebase PR #5** afterward — do not merge PR #5 as-is; its open-D015 narrative is superseded.  
3. If index links from PR #5 are still wanted, re-add on a tiny docs follow-up after #7.

PR #4 overlaps only `docs/index.md` (not on #7) — no file conflict with #7 code.

---

## 5. Task A parquet

| Field | Value | Label |
| --- | --- | --- |
| Path | `reports/ep/scoring_credit/scored_conventions_2019_2022.parquet` | **verified** |
| Size | 8,610,583 bytes | **verified** |
| Rows / cols | 194,321 × 26 | **verified** |
| Seasons | 2019–2022 only | **verified** |
| Columns | ids, flags, `ep_*_surface`, `realized_r`, `convention_{a,b}_epa`, `reference_epa`, linker flags | **verified** |
| Source | Derived by `backend/scripts/epa_scoring_credit_diagnostic.py` from pinned nflverse PBP (`ep`/`epa` surface) | **previously reported** + script **verified** |
| License | Upstream PBP **CC BY 4.0** (nflverse); derived diagnostic table | **previously reported** (`DATA_EXPERIMENT.md`) |
| Documented | Investigation §3 + script `keep` list | **verified** |
| Reproducible | Yes, with pinned lake 2019–2022 matching meta pins | **verified** command; lake **absent** here |
| Policy | Raw lake gitignored; derived `reports/ep/` historically committed | **inferred** from `.gitignore` + tree |

**Recommendation: (1) Keep** with attribution — add/retain CC BY nflverse note in investigation/provenance (already partially covered). Do not delete. Optional later: slim to summary JSON/CSV only if repo size becomes an issue; not required for this review.

---

## 6. SHA / reporting convention

**Recommend (stable, non-self-referential):**

Record as a frozen tuple at publish time:

1. **Data:** `ep_model.meta.json` → `data_hash.season_sha256` (and combined).  
2. **Model:** joblib sha256 (when present) + meta `selected_C` / `train_n` / packages.  
3. **Code:** PR head SHA **or** `merge-base(main, head)` + “files under review”; do **not** rewrite prior reports to chase tip after docs-only commits.  
4. **Env:** Python + package versions from `importlib.metadata`.

Avoid embedding “this report’s own commit” as a field that must be updated every amend. Packet commits may note `base_review_sha` = tip before the packet commit.

---

## 7. Artifact status & rebuild proposal

### Artifact

| Candidate | Outcome | Label |
| --- | --- | --- |
| `reports/ep/artifacts/ep_model.joblib` | **Missing**; gitignored | **verified** |
| Meta | Present; `selected_C=0.25`, `train_n=116218`, seed 42, era excluded, packages match | **verified** |
| Store / git history joblib | Not in this clone; never committed | **previously reported** / **verified** `git log -- **/ep_model.joblib` empty |
| Pytest stubs | Not Stage A | **previously reported** |

### Proposal audit (`LABELED_REBUILD_PROPOSAL.md`) — C1 closed

| Claim | Check | Label |
| --- | --- | --- |
| Seed 42 | `RANDOM_SEED` + meta | **verified** |
| Train 2019–2021 / val 2022 | `split.py` + meta | **verified** |
| `selected_C=0.25` / era excluded | meta + feature builder | **verified** |
| `train_n=116218` | meta; matches DATA_EXPERIMENT REG scrimmage | **verified** / **previously reported** |
| val log loss ≈ 1.3360995567698928 | meta exact | **verified** (source = committed meta, not re-trained) |
| Train `--out` | **Binding procedure is scratch-only** — see `LABELED_REBUILD_PROPOSAL.md` §B (`--out "$SCRATCH"`). Old `--out ../reports/ep` is **superseded / non-executable** for labeled rebuild | **verified** — proposal corrected |
| Not claiming original | Explicit | **verified** |
| **2023 on disk for train** | `cmd_train` → `build_modeling_frame(ALL_MODEL_SEASONS)` → `FileNotFoundError` if 2023 missing; `--include-test` only gates scoring | **verified** — proposal corrected |
| `rebuild:` meta label | Train does **not** auto-write; proposal documents required post-train JSON patch | **verified** — proposal corrected |
| Lake pins | Required; empty here | **verified** blocked (host gap, not doc gap) |

**Decision rule outcome (C1):** Proposal text is **ready for the user authorization decision**. Still **do not execute** until:

1. Host has pinned **2019–2023** matching meta `season_sha256` (2023 sealed — no tuning / no selection).  
2. User says **“authorize labeled rebuild”** (or equivalent).  
3. Operator follows **`reports/ep/LABELED_REBUILD_PROPOSAL.md`** (binding procedure): scratch `--out`, post-train `rebuild: labeled_new_artifact` (+ date), record new joblib sha256.

Prefer **restore original** if a trustworthy copy exists.

### Checklist: restore vs labeled rebuild

| Prefer restore if… | Authorize labeled rebuild if… |
| --- | --- |
| Backup/joblib sha can be paired with current meta | Original confirmed lost |
| Bit-identity with Stage A gate desired | Accept **new** artifact + new meta |
| Host can place file beside meta only | Host has pinned lake + packages; corrections above applied |

**Blocked command environment (rebuild):** repo checkout; `data/raw/pbp/season={2019..2023}/` matching meta pins; Python 3.12; packages per meta. **Binding train procedure:** `reports/ep/LABELED_REBUILD_PROPOSAL.md` §B only. Example (scratch-only — do not execute until authorized):

```bash
cd backend
SCRATCH="${SCRATCH:-/tmp/nfl-ep-labeled-rebuild}"
mkdir -p "$SCRATCH"
python3 -m nfl_sim.models train --out "$SCRATCH"
# then patch $SCRATCH/artifacts/ep_model.meta.json with rebuild provenance; record joblib sha256
# SUPERSEDED / non-executable for labeled rebuild: train --out ../reports/ep
```

Do **not** pass `--include-test` for selection. Do **not** use `--out ../reports/ep` (would overwrite committed baselines). Do not execute until authorized.

---

## 8. Model-surface validation gate (procedure only — not run)

**Prerequisites:** restored original **or** completed labeled rebuild; pinned lake 2019–2022; Convention B code (this PR).

**Procedure (2019–2022 only):**

1. Place artifact at `reports/ep/artifacts/ep_model.joblib` matching chosen meta.  
2. Score `model_epa` with current `score_model_epa` (B).  
3. Optionally score Convention A diagnostic (`realized_r=None` / `convention_a_epa`) on **same** EP predictions.  
4. Report pre/post (A vs B) by event bucket + possession-transition; identity separately from MAE-vs-reference.  
5. Provenance: data sha256, joblib sha256, code SHA, packages.  
6. **No** 2023–2025 tuning.

| Possible now | Blocked |
| --- | --- |
| Unit/synthetic B correctness | Project-EP historical pre/post |
| Read Task A lake-`ep` tables | Fresh lake reload / model_epa tables |

**Gate status: not passed.**

---

## 9. WP plan status

`docs/WP_PHASE_PLAN.md`: **ready as plan** — consistent with merge auth + artifact + model-surface gates; forbids odds/`vegas_wp`; sealed holdout; kickoff-rule check; analytical 4th-down before sim; no 2023+ tuning.

**C1 clarify (applied):** **2023 is prior-exposure report-only, not a pristine holdout** (Stage A already produced a held-out 2023 report). Prefer **2024** (once pinned + untouched audit) as the sealed WP test season; until then keep 2023 sealed for WP selection (no hyperparameter use). No WP code/training started (**verified**).

---

## 10. Human decisions required

1. **PR #7 review/merge** — Approve / request changes / leave open.  
   - *Consequence:* Merge lands Convention B on `main`; then close/rebase PR #5 (conflict).  
2. **Artifact path (ready to decide)** — Prefer restore original `ep_model.joblib` if available; **else** authorize labeled rebuild using corrected proposal (§7) on a host with pinned 2019–2023 by saying **“authorize labeled rebuild”**.  
   - *Consequence:* Unblocks model-surface gate; WP stays gated until that passes.  
   - *Not ready:* executing train on this review VM (no lake).  
3. **Parquet policy** — Accept keep+CC BY attribution (recommended) or request slim later.  
4. **CI workflow push** — Optional: grant `workflow` scope so proposed YAML can be committed.  
5. **WP kickoff** — Only after (1)+(2)+model-surface — not requested now.

---

## Non-actions (C1 + prior review)

No merge; no force-push; no retrain; no WP/sim/4th/live; no PR #4/#5 edits; no data ingest/repin; no full pytest 67/1 reconfirm required; no secrets printed.
