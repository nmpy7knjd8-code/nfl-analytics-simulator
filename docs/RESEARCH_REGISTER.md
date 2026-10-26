# RESEARCH REGISTER — Phase 1 (NFL only)

**Access date:** 2026-10-11  
**Aligned to:** `AGENTS.md` (repo root) fixed defaults  
**Claim level:** Literature + package docs + one verified Python install/load. **No model reproduction claimed.**

## Locked experiment window

| Split | Seasons |
| --- | --- |
| Train | 2019–2021 |
| Validate | 2022 |
| Test | 2023 |

Chronological only. No random row shuffles across seasons.

## Evidence classes (AGENTS.md)

| Status | Meaning |
| --- | --- |
| **reproduced** | This project trained/evaluated and matched a stated target under a pinned snapshot. **None yet.** |
| **approximated** | Public method exists; a scikit-learn (or other) reimplementation is planned/possible without claiming parity. |
| **unreproducible** | Public claim cannot be re-run from available materials alone (missing training extract, closed API, or not executed here). |
| **reference-only** | Published columns/models used as comparison targets, not as “our” trained model. |

---

## R1 — nflverse PBP via Python (`nflreadpy`)

| | |
| --- | --- |
| **What** | Batch historical NFL play-by-play from nflverse GitHub Releases |
| **Client** | `nflreadpy` **0.1.5** (PyPI; `License-Expression: MIT`; requires Python ≥3.10) |
| **Verified here** | `pip install nflreadpy==0.1.5`; `import nflreadpy as nfl`; `nfl.load_pbp([season])` returns Polars DataFrame; seasons **2019–2023** load successfully |
| **Observed row counts (this env)** | 2019: 47,260 · 2020: 47,705 · 2021: 49,922 · 2022: 49,434 · 2023: 49,665 |
| **Columns present (spot-check)** | `ep`, `epa`, `wp`, `vegas_wp`, situation fields (`down`, `ydstogo`, `yardline_100`, clocks, timeouts, `roof`, …) |
| **Data license** | nflverse-data **CC BY 4.0** (package DESCRIPTION); FTN/participation subsets **CC-BY-SA 4.0** with attribution — see `LICENSING_AND_DATA_SOURCES.md` |
| **Live?** | **No.** Scheduled/batch releases only. |
| **Status** | Load path **verified**; schema deep-dive owned by data workstream |

Install / usage (research-verified):

```bash
pip install nflreadpy==0.1.5
```

```python
import nflreadpy as nfl
pbp = nfl.load_pbp([2019, 2020, 2021, 2022, 2023])  # Polars
# optional: pbp.to_pandas()
```

Docs: https://nflreadpy.nflverse.com/ · https://pypi.org/project/nflreadpy/  
Releases: https://github.com/nflverse/nflverse-data/releases/tag/pbp

**Deprecated alternative:** `nfl_data_py` (MIT, archived; prefer `nflreadpy`).

---

## R2 — Expected Points (EP) literature & public impl

| | |
| --- | --- |
| **Estimates** | Expected points for possession team from next scoring event in the half (7 classes) |
| **Lineage** | Yurko et al. multinomial logit (nflscrapR) → nflfastR XGBoost `ep_model` in `fastrmodels` |
| **Public sources** | arXiv:1802.00998 · OSF post https://www.opensourcefootball.com/posts/2020-09-28-nflfastr-ep-wp-and-cp-models/ · https://nflfastr.com/reference/calculate_expected_points.html · `fastrmodels` (MIT, CRAN) |
| **Published PBP** | `ep` (+ event probs such as `td_prob`, …) already in nflverse files → **reference-only** |
| **MVP stance** | Prefer **scikit-learn** multinomial logistic (Yurko-style) on train 2019–2021; XGBoost only after documented identical held-out comparison (no preset “beat by X”) |
| **Betting features** | **Out of scope** for MVP |
| **Status** | Method **approximated** (not reproduced); OSF LOSO plots **unreproducible** until we re-run |

---

## R3 — EPA

| | |
| --- | --- |
| **Estimates** | Change in EP across a play (`epa` in nflverse PBP) |
| **Public impl** | Derived in nflfastR after EP scoring (possession flips, kickoffs, timeouts, etc.) |
| **MVP stance** | Stage A: use situation EP model → deterministic EPA derivation rules; compare to published `epa` as reference, without claiming bit-parity until tested |
| **Status** | Derivation **approximated**; published `epa` **reference-only** |

---

## R4 — Situation Win Probability (WP)

| | |
| --- | --- |
| **Estimates** | P(possession team wins \| pre-play state) |
| **Public impl** | nflfastR `wp_model` / `wp_model_spread` (XGBoost, MIT via fastrmodels); Yurko GAM lineage |
| **MVP stance** | Situation WP **without** spread/odds (`vegas_wp` / `spread_line` excluded from MVP features per AGENTS.md) |
| **Status** | Method **approximated**; published `wp` **reference-only** for calibration comparison |
| **Acceptance** | Canonical rules: [`/cursor/stores/bc-01a12bd3-e392-7ab5-8ff8-b4421b804d34/docs/MODEL_VALIDATION.md`](/cursor/stores/bc-01a12bd3-e392-7ab5-8ff8-b4421b804d34/docs/MODEL_VALIDATION.md) — fair baseline (documented exact inputs); identical held-out compare; **Brier + log loss + calibration + n** in **`/reports/`**; no leakage; **no** arbitrary “beat baseline by X” bar. |

---

## R5 — Fourth-down (Phase 6 design note only)

| | |
| --- | --- |
| **Estimates** | Win-prob of go / FG / punt |
| **Public impl** | `nfl4th` (MIT, CRAN 1.0.7) — https://www.nfl4th.com/ |
| **Phase 1 action** | Document only; **do not implement** until Phase 6 |
| **Depends on** | Credible EP + situation WP first |
| **Status** | Design **approximated** from docs; not reproduced |

---

## R6 — Empirical sampling & validation methods

| | |
| --- | --- |
| **Empirical sampling** | Matched historical situations → bootstrap/resample observed next-play or drive outcomes (non-parametric baseline for simulation) |
| **Validation (general)** | Chronological split (train 2019–2021, val 2022, test 2023); probabilistic models: log loss, Brier, calibration + **sample sizes**; EPA: MAE/RMSE vs realized next-score and/or reference `epa`. Artifacts under **`/reports/`**. Reading docs ≠ validation. |
| **WP-specific gate** | Per [`MODEL_VALIDATION.md`](/cursor/stores/bc-01a12bd3-e392-7ab5-8ff8-b4421b804d34/docs/MODEL_VALIDATION.md): fair baseline; Brier/log loss/calibration/n in `/reports/`; no leakage; no arbitrary beat-baseline bar |
| **Status** | Methods standard; **no metrics claimed** until computed |

---

## Honesty log

| Claim | Verdict |
| --- | --- |
| nflreadpy installs and loads 2019–2023 PBP on CPU | **Verified** (0.1.5, this env) |
| Free PBP is live | **False** |
| We reproduced nflfastR/nfl4th models | **Not claimed** |
| XGBoost required for MVP | **Not justified yet** — sklearn first |
| Paid data required for historical MVP | **No** |
| Repo mirror | Authoritative docs in Project store `docs/`; lead copies into GitHub when available |
