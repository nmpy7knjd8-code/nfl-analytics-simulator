# Stage A EP/EPA — evaluation report

**Spec:** [`docs/EP_MODEL_SPEC.md`](../../docs/EP_MODEL_SPEC.md)  
**Artifacts:** `metrics.json`, `reference_agreement.json`, `calibration_touchdown.csv`, `artifacts/ep_model.meta.json`  
**Status:** Approximated independent sklearn EP + deterministic EPA. **Not** nflfastR bit-parity.

## Target and filters

| Item | Value |
| --- | --- |
| Target | Next score in half (7 classes); EP = Σ pₖ vₖ with v ∈ {+7,+3,+2,0,−2,−3,−7} |
| Eligibility | REG scrimmage (`down` not null) + required pre-play fields + constructible label |
| Features | down, distance, yardline_100, half_seconds_remaining, timeouts, home, roof, era≥2021 |
| Forbidden | nflverse `ep`/`epa`/`wp`/…, spreads/odds, post-play / future fields |
| Split | train 2019–2021 · val 2022 · test 2023 (no test tuning) |
| Selected hyperparam | `LogisticRegression` `C=0.25` chosen on **val log loss only** |

### Sample sizes (after filters)

| Split | n | Matches DATA_EXPERIMENT REG scrimmage? |
| --- | ---: | --- |
| Train | 116,218 | yes |
| Validate | 39,704 | yes |
| Test | 40,031 | yes |

## Public baselines / references compared

| Comparator | Role | Notes |
| --- | --- | --- |
| Constant class-frequency (train) | Probabilistic baseline | Same eval rows |
| nflverse `ep` / `epa` columns | **Reference agreement only** | nflfastR/fastrmodels outputs in PBP — **not ground truth** |
| fastrmodels XGB EP (R) | Not run here | Requires R/`fastrmodels`; deferred to reconciliation backlog |

## Validate 2022 (model selection slice)

| Metric | Model | Constant baseline |
| --- | ---: | ---: |
| log_loss | **1.337** | 1.528 |
| Brier (multiclass) | **0.687** | 0.758 |
| Brier (touchdown) | 0.210 | — |
| MAE vs reference `ep` | 0.370 | — (agreement only) |
| MAE vs reference `epa` | 0.682 | — (agreement only) |

Bias vs reference `ep` ≈ −0.007 (near zero overall).

## Held-out test 2023 (reported once; not tuned)

| Metric | Model | Constant baseline |
| --- | ---: | ---: |
| log_loss | **1.316** | 1.539 |
| Brier (multiclass) | **0.678** | 0.761 |
| Brier (touchdown) | 0.203 | — |
| MAE vs reference `ep` | 0.367 | agreement only |
| MAE vs reference `epa` | 0.675 | agreement only |

## Reference agreement vs realized next-score points

Using **our** label construction as the realized next-score point value:

| Split | MAE(model EP, realized) | MAE(reference `ep`, realized) |
| --- | ---: | ---: |
| Val 2022 | 3.641 | 3.619 |
| Test 2023 | 3.614 | 3.599 |

Interpretation: model and nflverse `ep` are similarly distant from *our* realized labels. Residual EP↔reference disagreement (~0.37 MAE) is therefore **not** explained by a collapsed sklearn fit alone — target/transition conventions likely differ. See discrepancy backlog.

## Situation slices (test 2023) — reference EP MAE

| Slice | n | MAE vs ref `ep` | MAE vs ref `epa` | EP bias |
| --- | ---: | ---: | ---: | ---: |
| down=1 | 15,843 | 0.355 | 0.491 | +0.11 |
| down=2 | 11,996 | 0.337 | 0.549 | −0.12 |
| down=3 | 7,886 | 0.373 | 0.834 | −0.23 |
| down=4 | 4,306 | 0.485 | 1.413 | +0.26 |
| red zone (y100≤20) | 5,923 | 0.458 | 1.819 | −0.36 |
| backed up (y100≥80) | 3,961 | 0.446 | 0.395 | −0.37 |
| ≤2:00 half | 5,187 | 0.373 | 0.675 | −0.08 |
| same possession, non-terminal | 34,252 | 0.349 | **0.340** | −0.03 |
| possession change | 5,507 | 0.475 | **2.757** | +0.06 |
| terminal | 272 | 0.485 | 0.796 | +0.22 |

Full tables: `reference_agreement.json`.

## Justified to proceed?

**Yes, with limitations**, for Stage A → situation WP:

* Independent leakage-safe EP beats constant baseline on val and held-out test (log loss + Brier).
* Same-possession EPA tracks reference much better than possession-change EPA.
* Do **not** claim nflfastR parity. Close the EPA possession-change gap (or document sim impact) before decision-lab use.

## Reproduce

```bash
cd backend
python3 -m pip install -e ".[dev,phase2,models]"
# lake must include 2019–2023 raw (see docs/DATA_PIN_NOTES.md)
python3 -m nfl_sim.models train --out ../reports/ep --include-test
pytest -q
```
