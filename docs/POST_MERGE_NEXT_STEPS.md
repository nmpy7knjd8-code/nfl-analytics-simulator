# Post-Merge Next Steps Audit — NFL Analytics Simulator

**Date:** 2026-10-11  
**Mode:** Read-only (no merge/close/rebase, no promote, no install, no external bench, no retrain, no WP impl, no production/lockfile edits)  
**Repo:** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator  
**Inspected tip:** `main` @ `559e7dc51de8a661ab9708fe8454b812a3d164e2` (PR #7 merge commit)

---

## Five-line verdicts

- Repository: verified.
- PR #5: close.
- Artifact: promote later.
- External benchmark: blocked by a named prerequisite.
- WP: ready for planning.

| Line | Verdict | Named detail |
| --- | --- | --- |
| Repository | **verified** | `main` = `559e7dc…` = Merge PR #7; parents `15da234…` + `bd4c735…` |
| PR #5 | **close** | OPEN + `mergeable=false` / `dirty`; open-D015 text superseded by #7 brief on `main` |
| Artifact | **promote later** | Keep labeled rebuild isolated; not needed before external bench; promote only when enabling API/default path |
| External benchmark | **blocked by** `scratch-xgb-lake-2019-2022` | Scratch xgboost env + pinned lake 2019–2022 + explicit `--model` |
| WP | **ready for planning** | D015 + C2 cleared; kickoff still needs user authorize + artifact disposition |

---

## 1. Code-first inspection — loaders / `--model` / hard-coded paths

Verified on `main` @ `559e7dc`.

| Entry | Path behavior | Safe for labeled rebuild? |
| --- | --- | --- |
| `EPModel.load(path)` (`ep_model.py`) | Caller-supplied path → `joblib.load` | **Yes** if path = explicit joblib location |
| CLI `eval` / `score` | **`--model` required** | **Yes** with `--model <explicit_path>` |
| CLI `baselines` | `--model` optional; default `reports/ep/artifacts/ep_model.joblib` | Only if file exists or `--model` set |
| CLI `reconcile` | defaults to `reports/ep/artifacts/ep_model.joblib` | **Unsafe** if default used (file absent) |
| CLI `train --out` | default `reports/ep` (writes `artifacts/`) | **Unsafe for rebuild** — scratch `--out` only |
| API `_load_ep_model` (`api/app.py`) | **Hard-coded** `EP_MODEL_ARTIFACT = …/reports/ep/artifacts/ep_model.joblib`; never caller path (pickle RCE guard) | Never loads an unpromoted path; returns `None` → 503 |
| Diagnostic `epa_scoring_credit_diagnostic.py` | Checks hard path for status; lake-`ep` surface when missing | Isolation OK; does not load unpromoted joblib |

**On-disk at tip:** `reports/ep/artifacts/ep_model.meta.json` present; **`ep_model.joblib` absent** (gitignored).  
**Labeled rebuild (isolated, not promoted):** SHA-256 `1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e` — matches prior C2 / `ep_model.joblib.sha256`. Meta has `rebuild: labeled_new_artifact`, `selected_C: 0.25`, `train_n: 116218`.

**Convention B / C2 on main:** `docs/EPA_CONVENTION_B_ATTRIBUTION.md`, `reports/ep/model_surface/REBUILD_AND_MODEL_SURFACE.md`, scoring parquet present. C2 still records: not promoted.

---

## 2. Alternatives to promotion

Promotion (= copy joblib+meta into `reports/ep/artifacts/`) is **not** required for the next technical steps if path discipline holds.

| Goal | Without promotion | With promotion |
| --- | --- | --- |
| CLI eval/score/reconcile on labeled model | `--model` → explicit path or `/tmp` copy | Default paths work |
| External L1 vs lake / nfeloml | Explicit path + scratch env | Same; still must not use API hard path for scratch |
| API `/models/ep/score` | Stays unloaded (503) — intentional until promote | Loads default artifact |
| WP training/eval scripts | Prefer explicit artifact path arg | Convenience only |
| Provenance clarity | Isolated rebuild README + `rebuild:` fields stay separate | Must keep `rebuild:` in committed meta |

**Recommendation:** **promote later** — after (or independent of) external bench; only when deliberately enabling API/default CLI. Until then, treat the isolated labeled rebuild as the canonical labeled artifact (not on the default production path).

---

## 3. nfeloml / nflfastR — era & history limits (comparability)

Unchanged from the external-model reuse audit; reaffirmed as **hard limits** on any side-by-side EP surface.

| System | Train / calibration window | Era in production features |
| --- | --- | --- |
| **Ours (labeled rebuild)** | Fit **2019–2021**; C on **2022**; 2023 pinned but not fit/select | **Excluded** (`era_post_2020` ablation only) |
| **nflfastR / fastrmodels** | Long-history XGB (~2000+ LOSO lineage) | era0–4 **on** |
| **nfeloml EP bundled** | Metadata **1999–2025** | era0–4 **on** |

**Do not** treat val-2022 agreement as “same model.” Gaps can be era / capacity / family / history — not EPA bugs.  
**Policy:** nfeloml / nflfastR = **reference only**; no R runtime in Python service; nfeloml WP is a **spread** model (forbidden for core WP); never use 2023–2025 for our selection.

---

## 4. Promotion misrepresentation risk + safeguards

### Risk

Committed meta (`gate: stage_a_audit_pass`, `era_feature: excluded_from_production`) **lacks** rebuild keys. Labeled-rebuild meta has `rebuild` / `rebuild_date` / `rebuild_note` and **lacks** `gate` / `era_feature`. Shared binding fields (`selected_C`, `train_n`, season hashes, packages, feature_names) match.

If someone copies **only** the joblib onto the default path and leaves committed meta unchanged, readers can infer “original Stage A audit-pass artifact.” That is a **provenance lie** — the binary is `labeled_new_artifact`, not the lost original.

### Safeguards (when promotion is authorized)

1. Copy joblib **and** write meta that **retains** `rebuild: labeled_new_artifact` (+ date/note).  
2. Optionally keep `era_feature` / `gate` as additive fields; never drop `rebuild:`.  
3. Commit or record SHA-256 next to artifact; verify before API enablement.  
4. Do not rewrite C2 / rebuild docs to claim bit-identity with the lost original.  
5. Prefer a documented promotion step from the isolated labeled rebuild — not silent `train --out reports/ep`.

---

## 5. Feature-overlap table (with history/era flags)

### Expected Points

| Feature / encoding | Ours (Stage A) | nflfastR | nfeloml | Overlap |
| --- | --- | --- | --- | --- |
| `half_seconds_remaining` | ✓ | ✓ | ✓ | Exact |
| `yardline_100` | ✓ | ✓ | ✓ | Exact |
| distance / `ydstogo` | ✓ (`distance`) | ✓ | ✓ | Same quantity |
| Timeouts (pos/def) | ✓ | ✓ | ✓ | Exact |
| Home possession | ✓ | ✓ | ✓ | Exact |
| Down | numeric | dummies | dummies | Info-equivalent |
| Roof | open/closed/dome/outdoors/other | open/closed/NA→retractable | literal | Partial |
| **Era** | **excluded** | era0–4 **on** | era0–4 **on** | **Non-comparable** |
| **Train history** | **2019–2021** | long / ~2000+ | **1999–2025** | **Non-comparable** |
| Estimator | sklearn multinomial | XGB | XGB | Different family |

### EPA (post-#7)

| Rule | Ours A | Ours B (main) | nflfastR | nfeloml EPA |
| --- | --- | --- | --- | --- |
| Same-poss ΔEP / PC negate | ✓ | ✓ | ✓ | ✓ (approx.) |
| TD/FG/safety cash `R−ep` | ✗ | ✓ | ✓ | ✓ (approx.) |
| `safety_team` signed | — | via scorer | ✓ | ✗ (always −2) |
| XP/2PT overlays | R=0 | R=0 deliberate | scrapR specials | ✗ |

### WP / decisions

| Policy | Our plan | nflfastR | nfeloml bundled | nfl4th |
| --- | --- | --- | --- | --- |
| Situation WP | planned | ✓ | present | uses WP stack |
| Spread / vegas | **forbidden in core** | optional `vegas_wp` | **spread model** | **vegas_wp** |

---

## 6. `scratch-xgb-lake-2019-2022` plan (design only — not executed)

**Name:** `scratch-xgb-lake-2019-2022`  
**Purpose:** Smallest external EP surface bench without touching production lockfile or default artifact path.

| Step | Action | Forbidden |
| --- | --- | --- |
| 1 | Fresh scratch venv under `/tmp/…` with `xgboost` + project `[models]` deps | `pip` into project lockfile / committed env |
| 2 | Ensure pinned lake Parquet **2019–2022** (sha256 = `PINNED_SEASON_SHA256`); 2023 on disk OK but **not loaded** for bench selection | Repin / download into production claims without audit |
| 3 | Load labeled rebuild via `EPModel.load(<explicit_path>)` or CLI `eval --model <explicit_path> --split val` | Default `reconcile` / API hard path / `train --out reports/ep` |
| 4 | Optional L1b: nfeloml EP predict in **same scratch** → scratch CSV/Parquet | Overwrite labeled rebuild joblib/meta |
| 5 | Metrics: val-2022 MAE vs lake `ep` (descriptive); label era/history limits | Claim production parity or selection on 2023–2025 |
| 6 | Outputs under `/tmp/…` or local diagnostics only | Overwrite tracked `reports/ep/` baselines |

**Authorization gate:** human says run external bench **after** this prerequisite exists. This audit did **not** install xgboost or run the bench.

---

## 7. Data gates intact + WP kickoff trade-offs

### Data / leakage gates (still intact on `main`)

| Gate | Evidence |
| --- | --- |
| Train 2019–2021 / val 2022 / test 2023 | `constants.py`, `split.py` |
| Refuse train on 2023 | `ep_model.py` / `forbid_test_season_in_fit` |
| Era excluded from production features | `NUMERIC_FEATURES`; `FeatureBuilder` raises if era present |
| Forbidden ep/wp/vegas/spread features | `FORBIDDEN_*` + leakage asserts |
| Season pins 2019–2023 | `PINNED_SEASON_SHA256` matches committed + labeled-rebuild meta hashes |
| Scoring-credit / reconcile holdout | `scoring_credit.py` / `reconcile.py` forbid 2023 for convention tuning |
| Offline reliability gap (separate) | No `.github/workflows` on main; proposed YAML only; bare `pytest` still integration-fragile |

### WP kickoff — trade-offs

| Option | Pros | Cons |
| --- | --- | --- |
| **A. Plan now, implement after artifact disposition** | Matches preference “stop for approval”; C2 already PASS | API EP still 503 until promote |
| **B. Promote labeled artifact first, then WP kickoff** | Default CLI/API work; one clear production EP | Misrepresentation risk if `rebuild:` dropped |
| **C. Kickoff WP with explicit-path-only EP** | No promote; explicit paths | Easy footgun if someone uses reconcile/API defaults |
| **D. Wait for external bench before any WP** | Extra reference context | Over-gates: era/history limits mean bench won’t “prove” our EP; slows decision lab |

**Audit recommendation:** **A** — WP planning ready now; implementation kickoff after user chooses artifact disposition (promote later vs explicit-path-only) and authorizes WP. Prefer kickoff-rule check (`WP_PHASE_PLAN` §3) before feature freeze. Do **not** use nfeloml spread WP. Keep 2023 report-only; prefer later sealed season for final holdout when available.

### PR #5 disposition detail

| Fact | Value |
| --- | --- |
| URL | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/5 |
| State | OPEN, `mergeable=false`, `mergeable_state=dirty` |
| Head | `cursor/docs-decisions-forward-plan-0ea7` @ `03d03e3…` |
| Base still | `15da234…` (pre-#7) |
| Conflict | add/add on `docs/DECISIONS_AND_FORWARD_PLAN.md` — open-D015 vs accepted-D015 successor already on `main` via #7 |

**Close** (not rebase): #7 already published the successor brief. Rebase would fight superseded open-D015 prose. Optionally open a **new** docs PR later if `DECISIONS_AND_FORWARD_PLAN.md` on `main` needs a post-merge freshness pass (it still describes model-surface as blocked / pre-C2 in places).

### Open docs PRs (untouched this audit)

- #4 audit packet — leave open  
- #6 next-steps docs — leave open  

---

## Additional precision

1. **Repository pin:** Verified `559e7dc51de8a661ab9708fe8454b812a3d164e2`; no discrepancy vs assignment.  
2. **Labeled rebuild SHA:** Re-analyzed labeled joblib → `1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e` (exact match).  
3. **Promotion not a prerequisite for external bench** — explicit `--model` / `EPModel.load` suffice; API remains isolated.  
4. **Stale brief risk on main:** `docs/DECISIONS_AND_FORWARD_PLAN.md` still frames joblib restore / model-surface as hard blockers in executive summary; C2 PASS + labeled rebuild exist. Refresh in a **separate** docs PR when authorized — not via merging #5.  
5. **CI still absent** on tip (no workflow file); do not claim GitHub CI green.  
6. **Stop for approval** before: close #5, promote artifact, authorize `scratch-xgb-lake-2019-2022` bench, or start WP implementation.

### Approvals still needed from user

1. Close PR #5 (recommended) — or explicitly leave open.  
2. Artifact: keep labeled rebuild isolated for now (**promote later**) vs authorize promotion with `rebuild:` retained.  
3. Authorize external bench only after `scratch-xgb-lake-2019-2022` is provisioned.  
4. Authorize WP kickoff planning refinements / implementation when ready (gate A).

### Not needed now

Merge/rebase #5; promote joblib; install xgboost; run external bench; retrain; WP code; touch #4/#6; change provenance labels; force-push; lockfile edits.

---

## Evidence index

| Item | Location |
| --- | --- |
| Merge tip | `main` @ `559e7dc…` |
| Prior merge confirmation | project workspace (PR7 merge confirmation) |
| External reuse audit | project workspace (external model reuse audit) |
| C2 surface | repo `reports/ep/model_surface/…` (+ workspace C2 notes) |
| Clean-checkout | project workspace (clean-checkout reliability audit) |
| Labeled rebuild | isolated labeled-rebuild artifact (not promoted) |
| WP plan | project workspace (`WP_PHASE_PLAN`) |
| Loaders | `backend/src/nfl_sim/models/{ep_model,__main__}.py`, `api/app.py` |
