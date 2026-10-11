# Rebuild + model-surface Convention B validation (C2)

**Date:** 2026-10-11  
**Branch:** `cursor/convention-b-gate-8222` @ `a82908c53e3b39ca73210b7e3717b5ecca34c5f3`  
**Scope:** Project-model EP surface only (labeled rebuild). Seasons **2019–2022**. No merge, no artifact promotion, no WP, no scoring-code edits.

---

## Plain-English verdict

On the **labeled rebuild** EP model, Convention **B** (score-cash \(R - \mathrm{ep}\)) behaves as designed:

1. **Accounting identity passes** — on contiguous same-possession epochs, \(\sum\mathrm{EPA}_B = R_{\mathrm{end}} - \mathrm{EP}_0\) with 11,198 checks and **0 failures**.
2. **A and B differ only on scoring plays** — non-score rows are bit-equal (mean \(|B-A|=0\)); scoring rows move by ~\(R\) as expected.
3. **TD/FG sign story matches the lake-EP diagnostic** — under A, ~99.5% of offensive TDs look like *negative* EPA; under B, **0%** of offensive TDs are negative.
4. **MAE vs nflverse `epa` is a separate question** — B cuts overall MAE roughly in half vs A (0.35 vs 0.69), but does **not** collapse to ~0 like the lake-`ep` surface, because project EP ≠ nflverse `ep`. That gap is model-fit / surface disagreement, not a Convention B bug.

This artifact is **`rebuild: labeled_new_artifact`**, not claimed bit-identical to the lost original. It was loaded from the store path via `EPModel.load` and was **not** placed at `reports/ep/artifacts/ep_model.joblib`.

---

## 1. Prerequisites (all PASS — would STOP otherwise)

| Check | Result |
| --- | --- |
| Joblib SHA-256 | `1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e` **match** |
| Meta `rebuild` | `labeled_new_artifact` |
| `selected_C` / `train_n` | `0.25` / `116218` |
| Packages | sklearn 1.9.1, joblib 1.6.0, numpy 2.5.4, pandas 3.0.6 |
| Lake 2019–2022 pins | all `sha256_matches_pin: true` (same pins as committed meta) |
| 2023 loaded in diagnostic | **No** |
| Promoted to default artifact path | **No** |
| Code SHA | `a82908c53e3b39ca73210b7e3717b5ecca34c5f3` |

Store model path:  
`/cursor/stores/bc-01a12bd3-e392-7ab5-8ff8-b4421b804d34/internal/ep-labeled-rebuild/ep_model.joblib`

Combined lake hash (2019–2022): `7e765adb53c3451322e57237d525ac2d633534ca29cf2b4bf3e40037c836f148`

Method: predict project `model_ep` / next-scrimmage EP with the labeled joblib; apply `convention_a_epa` and `convention_b_epa` to that **identical** EP pair (existing helpers; no scoring changes).

---

## 2. Accounting identity (Convention B only — separate from MAE)

Identity: \(\sum \mathrm{EPA}_B = R_{\mathrm{end}} - \mathrm{EP}_0\) on contiguous same-possession epochs (timeouts / non-score PC / discontinuous EP links excluded).

| Split | epochs ok | fail | pass? | max \|residual\| |
| --- | ---: | ---: | --- | ---: |
| 2019–2022 | 11198 | 0 | **PASS** | \(3.55\times10^{-15}\) |
| 2019–2021 | 8400 | 0 | **PASS** | \(3.55\times10^{-15}\) |
| 2022 | 2798 | 0 | **PASS** | \(1.78\times10^{-15}\) |

---

## 3. A vs B on identical project EP (not vs reference)

Row-level (eligible REG scrimmage with finite A/B):

| Split | n | frac \(A=B\) | mean \|B−A\| non-score | mean \|B−A\| scoring | n scoring |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2019–2022 | 155922 | 0.942 | **0.0** | 6.533 | 8966 |
| 2019–2021 | 116218 | 0.942 | **0.0** | 6.556 | 6741 |
| 2022 | 39704 | 0.944 | **0.0** | 6.461 | 2225 |

Reading: Convention B is an overlay on scoring rows only; non-score paths are unchanged from A.

### Event buckets — 2019–2022 (means / negativity)

| Bucket | n | mean A | mean B | %neg A | %neg B |
| --- | ---: | ---: | ---: | ---: | ---: |
| td_offense | 5242 | −5.277 | **+2.862** | **99.54** | **0.00** |
| td_defense_or_return | 271 | +0.325 | −7.775 | 43.54 | 100.00 |
| fg_made | 3391 | −3.657 | +0.358 | 99.38 | 34.27 |
| safety | 62 | −0.720 | −0.859 | 80.65 | 80.65 |
| punt | 8274 | −0.355 | −0.355 | 68.88 | 68.88 |
| turnover_non_score | 2266 | −4.530 | −4.530 | 99.74 | 99.74 |
| turnover_on_downs | 1280 | −3.515 | −3.515 | 99.53 | 99.53 |
| same_possession_other | 132697 | +0.024 | +0.024 | 58.53 | 58.53 |
| terminal_no_score | 1713 | −0.996 | −0.996 | 93.81 | 93.81 |
| possession_change_other | 724 | −3.912 | −3.912 | 99.59 | 99.59 |
| **overall** | **155920** | −0.379 | −0.032 | 62.84 | 58.17 |

FG under B can still be negative when model \(\mathrm{ep\_before} > 3\) (made FG worth less than expected) — expected for \(R-\mathrm{ep}\), not an A/B wiring bug.

### Same buckets — 2022 only (validate-like)

| Bucket | n | mean A | mean B | %neg A | %neg B |
| --- | ---: | ---: | ---: | ---: | ---: |
| td_offense | 1241 | −5.301 | +2.875 | 99.60 | 0.00 |
| fg_made | 903 | −3.662 | +0.394 | 99.78 | 33.55 |
| overall | 39704 | −0.377 | −0.043 | 63.16 | 58.64 |

Train-like 2019–2021 mirrors the full window (overall mean B −0.028; TD offense %neg B = 0).

---

## 4. MAE vs nflverse reference `epa` (separate from identity / A-vs-B)

Eligible for MAE tables: REG, non-null down, finite reference `epa`, finite A/B. **n = 155,920** (matches Task A lake-EP diagnostic eligibility).

| Split | MAE A vs ref | MAE B vs ref |
| --- | ---: | ---: |
| 2019–2022 | 0.689 | **0.354** |
| 2019–2021 | 0.694 | **0.354** |
| 2022 | 0.676 | **0.352** |

### Focus scoring buckets — MAE vs ref (2019–2022)

| Bucket | n | MAE A | MAE B |
| --- | ---: | ---: | ---: |
| td_offense | 5242 | 7.686 | **0.565** |
| td_defense_or_return | 271 | 8.204 | **0.392** |
| fg_made | 3391 | 4.298 | **0.501** |
| safety | 62 | 0.879 | 0.611 |
| non-score buckets (punt/TO/TOD/same/terminal/PC) | — | A ≡ B | A ≡ B |

Contrast (context only): lake-`ep` surface Task A had TD/FG MAE B ≈ 0 and overall MAE B ≈ 0.0065. Residual MAE here is **project EP ≠ reference EP**, not Convention B failing to cash \(R\).

---

## 5. Missing counts (separate from MAE)

| Split | rows | missing model ep_before | missing A | missing B | missing ref `epa` (all rows) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2019–2022 | 194321 | 0 | 0 | 0 | 2221 |
| 2019–2021 | 144887 | 0 | 0 | 0 | 1653 |
| 2022 | 49434 | 0 | 0 | 0 | 568 |

Among A/B-eligible rows, only **2** lack reference `epa` (both in 2019–2021); they are excluded from MAE tables but included in A-vs-B row stats.

---

## 6. Focused tests (this VM)

| Command | Result |
| --- | --- |
| `pytest -q tests/test_epa_scoring_credit.py tests/test_ep_epa.py` | **25 passed** |
| `pytest -q tests/test_ep_epa_audit.py` | **18 passed** |

No scoring-code modifications were required or made.

---

## 7. Provenance ledger

| Item | Value |
| --- | --- |
| Joblib SHA-256 | `1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e` |
| Meta rebuild | `labeled_new_artifact` (2026-10-11) |
| Code SHA | `a82908c53e3b39ca73210b7e3717b5ecca34c5f3` |
| Season sha256 | 2019 `d14de5d1…`, 2020 `324cef33…`, 2021 `e4dd2e16…`, 2022 `e7c1b53b…` |
| Packages | sklearn 1.9.1 / joblib 1.6.0 / numpy 2.5.4 / pandas 3.0.6 |
| Default `reports/ep/artifacts/ep_model.joblib` | **absent** (not promoted) |
| 2023 | not loaded |

Prior rebuild report: [`ARTIFACT_RECOVERY_OR_REBUILD.md`](../../../docs/ARTIFACT_RECOVERY_OR_REBUILD.md) (store) / [`LABELED_REBUILD_RESULT.md`](../LABELED_REBUILD_RESULT.md).

---

## 8. Remaining blockers / user decisions

1. **Merge PR #7?** — still your call (Convention B code + this validation report).  
2. **Promote** labeled joblib+meta into `reports/ep/artifacts/` (keep `rebuild:` fields)? — separate; API defaults still point there.  
3. **WP kickoff** — still gated on merge + your review of this surface; not started.  
4. Optional: accept that project-EP MAE vs nflverse will remain non-zero after B (surface disagreement), or pursue fit/recon work later — **not** required to accept Convention B wiring.

**Gate status:** model-surface Convention B on labeled rebuild — **PASS** (identity + A/B scoring overlay). Artifact remains labeled, unpromoted, unmerged.
