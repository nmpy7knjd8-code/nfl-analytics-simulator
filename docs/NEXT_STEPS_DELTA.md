# Next Steps Delta (after Convention B publish)

> **Deltas only** since [`NEXT_STEPS_AFTER_CONVENTION_B.md`](./NEXT_STEPS_AFTER_CONVENTION_B.md).  
> **Date:** 2026-10-11

---

## Published

| Item | Value |
| --- | --- |
| **Convention B PR** | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/7 |
| **Source branch / SHA** | `cursor/convention-b-gate-8222` @ `d9165f49e249eede94f978f22901954bae88ef5f` |
| **Target** | `main` @ `15da234b900059ab2a8f36279112203d02cace37` |
| **Merge** | **Not** done |

Raw tip (docs on that branch): use PR #7 head for Convention B files.

## Tests actually run (this publish session)

| Command | Exit | Result |
| --- | ---: | --- |
| `cd backend && python3 -m pytest -q` (pre-push) | **0** | **67 passed**, 1 skipped |
| Same after CI-file drop commit | **0** | **67 passed**, 1 skipped |
| `python3 scripts/epa_scoring_credit_diagnostic.py` | **1** | Blocked — missing lake season 2019 |
| Identity from Task A parquet | **0** | 11198 intervals pass; max \|resid\| ~4.44e−16 |

## Artifact search outcome

- Production `reports/ep/artifacts/ep_model.joblib`: **still missing**
- Store / phase tarballs / git objects / Actions artifacts: **no** production joblib
- Only finds: pytest fixtures ~5502 B, sha256 `e2bd3446f8b15ee2792a81d0df88b2f2aef037447ee77133147a0a822d921c07` — **not** Stage A

## Rebuild proposal

- **Status:** Proposal ready — **not executed**
- Doc on PR #7 branch: `reports/ep/LABELED_REBUILD_PROPOSAL.md`
- **Gap:** pinned lake 2019–2022 not present on publish VM; needs host with matching sha256 pins + explicit “authorize labeled rebuild”

## CI note (new)

First push of `.github/workflows/ci.yml` was **rejected**: token lacks **`workflow`** scope. File removed from PR tip; proposed YAML remains at `reports/ep/ci-workflow-proposed.yml`. To install CI later: refresh token with `workflow` (and `repo`) scope, then add the file in a follow-up commit.

## Approvals still needed from you

1. **Review / merge PR #7** (or request changes) — merge **not** authorized yet  
2. **Restore original joblib** from backup **or** **authorize labeled rebuild** (proposal ready)  
3. After artifact: authorize model-surface Convention B pre/post (2019–2022)  
4. Optional: grant `workflow` scope so CI YAML can be pushed  
5. WP kickoff only after the above gates

## What is NOT needed from you

- Re-deciding D015 / Convention B (already accepted; on PR #7)  
- Re-running the 67 pytest suite for publish confidence (already green twice this session)  
- Touching PR #4 / PR #5 for this delta  
- Providing a token in chat (set scopes in GitHub/Cursor secrets UI if CI push desired)  
- Live / odds / 2023–2025 tuning work

---

# Delta — after PR #7 review packet (2026-10-11)

> **New only** since the Convention B publish delta above.  
> Full packet: [`reports/ep/PR7_REVIEW_AND_ARTIFACT_DECISION.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/cursor/convention-b-gate-8222/reports/ep/PR7_REVIEW_AND_ARTIFACT_DECISION.md) on PR #7 @ `4250d13…`.

## What changed

| Item | New state |
| --- | --- |
| Review packet | On PR #7 tip `4250d13f4a69a38ac20386e8e3cf8f9ba73db75b` |
| Focused tests (review session) | `test_epa_scoring_credit` + `test_ep_epa` + `test_ep_epa_audit` → **42 passed**, 1 skipped (`lake not present`) |
| GitHub CI | Still **no checks** (workflow not on branch) |
| Rebuild proposal | **Needs two corrections before authorize** (now on PR #7): (1) CLI requires pinned **2019–2023** on disk even without `--include-test`; (2) post-train meta must add `rebuild: labeled_new_artifact` (train does not write it) |
| PR #5 | **Real add/add conflict** on `docs/DECISIONS_AND_FORWARD_PLAN.md` — do not merge #5 as-is after #7 |
| Task A parquet | Keep (CC BY nflverse attribution); 194321×26; reproducible with lake |

## Approvals / actions needed from you (updated)

1. **Review PR #7** — approve / request changes / leave open (**do not merge** until you decide).  
2. **Artifact:** restore original `ep_model.joblib` **or**, after acknowledging the corrected proposal, say **“authorize labeled rebuild”** on a host with pinned 2019–2023.  
3. After artifact: authorize **model-surface** Convention B pre/post (2019–2022 only).  
4. After merging #7 (when ready): **close or rebase PR #5** (open-D015 text superseded; conflict).  
5. Optional: `workflow` scope for CI YAML push.  
6. WP kickoff only after 1–3.

## Not needed

- Re-hashing D015 / full pytest 67/1 / lake re-download for this delta  
- Editing PR #4 for this step  
- Live / odds / WP training

---

# Delta — after C1 rebuild-proposal corrections (2026-10-11)

> **New only** since the PR #7 review-packet delta above.  
> Corrected proposal: [`reports/ep/LABELED_REBUILD_PROPOSAL.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/cursor/convention-b-gate-8222/reports/ep/LABELED_REBUILD_PROPOSAL.md) on PR #7 @ `c962883…`.

## What changed

| Item | New state |
| --- | --- |
| PR #7 tip | `c96288306924e185f0f281be19e5a037411e80df` on `cursor/convention-b-gate-8222` (docs-only C1 commit) |
| C1 start tip verified | `4250d13f4a69a38ac20386e8e3cf8f9ba73db75b` matched reported tip |
| Rebuild proposal A–E | **Corrected vs code** — 2019–2023 on-disk required by CLI; post-train `rebuild:` meta patch documented; **not executed** |
| Artifact authorization | Proposal text **ready to decide**; prefer restore original; else say **“authorize labeled rebuild”** on host with pinned 2019–2023 |
| WP plan | Minimal clarify: **2023 = prior-exposure report-only, not pristine holdout**; prefer 2024 sealed test when available |
| Focused tests (C1) | `test_epa_scoring_credit` + `test_ep_epa` + `test_ep_epa_audit` → **42 passed**, 1 skipped (`lake not present`) |
| Merge / rebuild / train / WP / repin / PR #5 | **None** performed |

## Approvals / actions needed from you (updated)

1. **Review PR #7** — approve / request changes / leave open (**do not merge** until you decide).  
2. **Artifact (ready):** restore original joblib **or** say **“authorize labeled rebuild”** on a host with pinned 2019–2023 (use corrected proposal).  
3. After artifact: authorize **model-surface** Convention B pre/post (2019–2022 only).  
4. After merging #7 (when ready): **close or rebase PR #5**.  
5. Optional: `workflow` scope for CI YAML.  
6. WP kickoff only after 1–3.

## Not needed

- Re-deciding D015 / full pytest 67/1 / lake download for this delta  
- Editing PR #4 / merging anything  
- Live / odds / WP training / data repin

---

# Delta — after C1.1 rebuild output isolation (2026-10-11)

> **New only** since the C1 rebuild-proposal corrections delta above.  
> Updated proposal: [`reports/ep/LABELED_REBUILD_PROPOSAL.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/cursor/convention-b-gate-8222/reports/ep/LABELED_REBUILD_PROPOSAL.md) on PR #7 @ `506b2dc…`.

## What changed

| Item | New state |
| --- | --- |
| PR #7 tip | `506b2dcf64eb375a6dfb54f6a0f00151752074a0` on `cursor/convention-b-gate-8222` (docs-only C1.1) |
| C1.1 start tip verified | `c96288306924e185f0f281be19e5a037411e80df` matched reported tip |
| Rebuild `--out` | **Must** use scratch (e.g. `/tmp/nfl-ep-labeled-rebuild`); default/`../reports/ep` would overwrite committed meta/metrics/calibration/TARGETS |
| CLI isolation (code inspect) | Train writes only under `Path(args.out)` — joblib, meta, metrics, calibration CSV, TARGETS.md; no hard-coded `reports/ep` writes in train path |
| Binding acceptance | `selected_C==0.25`, `train_n==116218` exact; log-loss ≤1e-6 **only if** lake+packages match else **stop** (no auto-relax); season hashes 2019–2023 exact |
| 2023 | Disk required for frame/hash; **not** for fit/select/eval/tune (omit `--include-test`) |
| Model load from scratch | `eval`/`reconcile`/`baselines`/`EPModel.load` accept explicit `--model`; diagnostic/API hard-code `reports/ep` — **stop** if check would misrepresent new artifact as original |
| Gates | **Rebuild ≠ model-surface B**; 2019–2022 surface separate; 2023 prior-exposure; 2024 unsealed until audited |
| Tests this session | **Not run** (docs + inspection only per C1.1) |
| Merge / rebuild / train / WP / repin / PR #5 | **None** |

## Approvals / actions needed from you (updated)

1. **Review PR #7** — leave open or request changes (**do not merge** until you decide).  
2. **Artifact:** prefer restore original joblib; **else** say **“authorize labeled rebuild”** on a host with pinned 2019–2023 using scratch `--out` + binding acceptance in the C1.1 proposal.  
3. After artifact: separately authorize **model-surface** Convention B pre/post (2019–2022 only).  
4. After merging #7 (when ready): **close or rebase PR #5**.  
5. Optional: `workflow` scope for CI YAML.  
6. WP kickoff only after 1–3.

## Not needed

- Training-code changes for isolation (scratch `--out` already sufficient)  
- Auto-relaxing log-loss / re-pinning data / full pytest for this docs task  
- Editing PR #4 / merging / WP / live / odds

---

# Delta — after PR #7 merge (2026-10-11)

> **New only** since the C1.1 delta above (rebuild / C2 / merge happened after).  
> Source confirmation facts verified via `gh` on this publish.

## What changed

| Item | New state |
| --- | --- |
| PR #7 | **MERGED** to `main` @ `559e7dc51de8a661ab9708fe8454b812a3d164e2` |
| Pre-merge tip (PR head) | `bd4c7350d4f7b7c290903bf9b074de0edb033578` |
| Merge method | GitHub merge commit; parents `15da234b…` + `bd4c7350…` |
| On `main` now | Convention B docs + C2 report `reports/ep/model_surface/REBUILD_AND_MODEL_SURFACE.md` + scoring parquet |
| Artifact promotion | **Not done** — no `ep_model.joblib` under `reports/ep/artifacts/`; rebuild label stays `labeled_new_artifact` |
| External bench | **Deferred** until after `scratch-xgb-lake-2019-2022`; load labeled model by **explicit path**; nfeloml/nflfastR reference-only |
| PR #5 | Still **OPEN / CONFLICTING** (`DIRTY`); **untouched** |
| PR #4 / #6 | Left open; this docs append only |

C2 raw (merge tip):  
https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/559e7dc51de8a661ab9708fe8454b812a3d164e2/reports/ep/model_surface/REBUILD_AND_MODEL_SURFACE.md

## Approvals / actions needed from you (updated)

1. **Promote labeled artifact?** — separate decision; keep `rebuild: labeled_new_artifact` if promoted.  
2. **Run external bench?** — after `scratch-xgb-lake-2019-2022`; explicit model path only.  
3. **Resolve PR #5?** — still open + CONFLICTING after #7; leave until authorized.  
4. **WP kickoff?** — after merge settles + gates you choose.

## Not needed

- Force-push / xgboost install / promote to `reports/ep/artifacts/` now  
- Rebase or close PR #5 / touch PR #4  
- Retrain / change provenance labels / live / odds
