# Delta — after artifact recovery attempt + labeled rebuild (2026-10-11)

> **New only** since the C1.1 scratch-isolation delta.  
> Tip before this docs commit: `ccd0fe618136430055d09d33bff0a9cb2af8d5d6` on `cursor/convention-b-gate-8222` (PR #7).

## What changed

| Item | New state |
| --- | --- |
| Original `ep_model.joblib` | **Not recovered** (store / tarballs / git / LFS / production path) |
| Labeled rebuild | **Executed** under `/tmp/nfl-ep-labeled-rebuild` |
| Binding acceptance | **PASS** — `selected_C=0.25`, `train_n=116218`, log-loss δ=`0.0`, season pins exact |
| New joblib sha256 | `1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e` |
| Meta label | `rebuild: labeled_new_artifact` (scratch + store copy) |
| Committed `reports/ep` baselines | **Unchanged**; joblib **not** placed at committed artifacts path |
| Merge / model-surface / WP | **Not** done |

Result doc: [`LABELED_REBUILD_RESULT.md`](./LABELED_REBUILD_RESULT.md)

## Approvals / actions needed from you

1. **Merge PR #7?** — still your call (Convention B code/docs).  
2. **Authorize model-surface Convention B pre/post?** (2019–2022 only; load via `--model` / scratch; keep rebuild labeling).  
3. Optional: **promote** labeled joblib+meta into `reports/ep/artifacts/` (keep `rebuild:` fields) so API hard-coded path works.  
4. After merging #7 (when ready): close or rebase PR #5.  
5. WP kickoff only after merge + surface gate as you prefer.

## Not needed

- Another recovery search for the original (exhausted on this host)  
- Re-running labeled rebuild (acceptance already exact)  
- Committing `.joblib` to git  
- Live / odds / 2023–2025 tuning / WP training
