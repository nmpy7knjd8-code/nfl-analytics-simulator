# EP/EPA discrepancy backlog (Stage A)

**Policy:** nflverse/nflfastR `ep`/`epa` = **reference agreement**, not ground truth.  
**Diagnosis uses validate 2022** (and structural code review). Test 2023 is for reporting agreement only — **not** for tuning fixes.

## Material gaps (ordered)

### B1 — EPA on possession changes (largest)

| Evidence | Val n=5,386 MAE(ref epa)≈**2.82** · Test n=5,507 MAE≈**2.76** |
| --- | --- |
| Contrast | Same-possession non-terminal MAE≈**0.34** |
| Likely causes | (1) Post-score next state: we jump to next scrimmage snap; nflfastR uses kickoff/touchback EP conventions. (2) Turnover+score sequences. (3) Sign/ownership of `ep_after` on defensive scores. |
| Defensible Stage A action | **Documented, not “fixed”** — changing kickoff EP without a locked public formula risks silent wrongness. Unit tests cover the *stated* possession-change identity (`-ep_after - ep_before`). |
| Follow-on | Public-model reconciliation pass: port nflfastR EPA special cases against open source; re-measure on val only. |

### B2 — Fourth down EP level / bias

| Evidence | Test down=4 n=4,306 · MAE(ref ep)=0.485 · bias≈+0.26 |
| --- | --- |
| Likely causes | Linear multinomial underfits 4th-down decision mixture; no play-type / go-vs-punt feature (intentional Stage A simplicity). |
| Action | Leave for reconciliation / optional val-only feature trial later. Not blocking WP. |

### B3 — Red-zone and backed-up field-position bias

| Evidence | Red zone bias≈−0.36; backed-up bias≈−0.37 (test) |
| --- | --- |
| Likely causes | Era/roof interactions; TD=+7 vs nflfastR try modeling; limited capacity of linear model near EZ. |
| Action | Backlog; optional nonlinear sklearn later if val justifies (still no test tune). |

### B4 — Target definition mismatch vs nflfastR

| Evidence | MAE(model, our realized points)≈MAE(reference ep, our realized) (~3.6) |
| --- | --- |
| Likely causes | OT half-bucketing; safety/TD team inference edge cases; PAT folded into +7; rows nflfastR excludes/includes differently. |
| Action | Spec locked in `EP_MODEL_SPEC.md`. Reconciliation should diff label streams on val games. |

### B5 — Public XGB EP not reproduced

| Evidence | fastrmodels / nflfastR XGB not executed in this repo |
| --- | --- |
| Cause | R runtime + model artifacts out of Stage A Python sklearn scope |
| Action | Follow-on reconciliation pass may call published models for agreement tables only (still not features). |

## Explicitly deferred (out of Phase 3)

* Situation WP, Monte Carlo sim, live feeds, Strategy / decision lab  
* Drive-EP (Brill), catalytic priors, tracking EP  
* Bit-parity claim vs nflfastR  

## Fix log (Stage A)

| Change | Rationale | Tuned on |
| --- | --- | --- |
| Leakage bans + chrono split gates | Spec / user gate | n/a (invariants) |
| `C` selected among {0.25,1,4} | Val log loss | **2022 only** |
| StandardScaler on numeric features | Convergence | preprocess fit train only |
| No EPA rule change after seeing test slices | Avoid test leakage | — |

## Audit fix log (independent gate — branch `cursor/ep-epa-audit-d4ea`)

| Change | Evidence | Tuned on |
| --- | --- | --- |
| EPA next-scrimmage restricted to **same half bucket** | Demonstrated: Q2→Q3 was `possession_change` not `terminal`; after fix, all 542 last-in-half eligible rows on 2022 are terminal | n/a (spec §6.1–6.2) |
| Exclude XP/2PT play_types from scoring events | Spec §3.1; adversarial `touchdown=1` on `extra_point` would poison labels | n/a |
| API: remove caller `model_path`; require typed body | Pickle RCE + silent defaults | n/a |
| Empirical baselines + era ablation on **2022 only** | See `baselines_2022.json` | **2022 only** (no 2023) |

**Still open (not “fixed” to chase reference EPA):** possession-change / post-score kickoff conventions (B1); Stage A does not cash score points into `ep_after`, so ΣEPA ≠ R − EP₀ by design.
