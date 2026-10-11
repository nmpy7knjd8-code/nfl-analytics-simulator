# WP Model Spec (v0 prototype)

**Status:** Locked for Path A prototype (no EP-as-feature)  
**Date:** 2026-10-11  
**Target:** \(P(\text{possession team wins} \mid \text{pre-play situation})\)  
**Estimator:** Binary logistic regression (`sklearn`)

---

## 1. Quantity and perspective

| Item | Definition |
| --- | --- |
| Quantity | Probability that the **current possession team** (`posteam`) wins the game |
| Moment | Pre-play freeze only — same information available at snap |
| Label | 1 if posteam is the eventual game winner; 0 if loser |
| Ties | Dropped from fit and metrics (not imputed) |

Home/away is encoded via `is_home_possession`; the model does **not** predict home WP then remap.

---

## 2. Features (Path A)

| Feature | Source | Notes |
| --- | --- | --- |
| `score_differential` | observed | posteam − defteam at snap |
| `game_seconds_remaining` | observed | full-game clock |
| `half_seconds_remaining` | observed | half clock |
| `down`, `distance`, `yardline_100` | observed | same as EP |
| `posteam_timeouts`, `defteam_timeouts` | observed | |
| `is_home_possession` | derived | `posteam == home_team` |
| `receive_2h_ko` | derived | first half only; second half / OT → 0 |

**Not used in v0:** roof, era, predicted EP / `model_ep`, spreads, odds, `vegas_wp`, lake `wp`.

Preprocess (impute/scale) fits on **train only**. Hyperparameter `C` selected on **validate 2022 only**. Season **2023** is report-only (never tune).

### Forbidden as features

Mirror EP leakage policy: `ep`/`epa`/`wp`/`wpa`/`vegas_*`/`spread_*`/`reference_*`, next-score probs, market lines, post-play fields (`*_post`, `yards_gained`, drive result as feature). Final game scores may appear **only** as the win label, never as features.

---

## 3. Eligibility, terminal plays, end-of-half

### Eligibility

REG scrimmage rows with valid pre-play WP fields:

* `season_type == REG`
* `down`, `ydstogo`, `yardline_100`, `half_seconds_remaining`, `game_seconds_remaining`, `score_differential` non-null
* `posteam`, `home_team`, `away_team` non-null
* Binary win label present (ties excluded)

Does **not** require an EP next-score label.

### Terminal / invalid game state

| Case | Handling |
| --- | --- |
| Game already decided at prediction time | Not separately filtered in v0; score+time features carry the signal. Rows still must be pre-play scrimmage. |
| Post-game / non-scrimmage | Excluded by eligibility (`down` null on kicks, etc.) |
| Missing final scores / unable to assign winner | Dropped (no label) |
| Tie games | Dropped from fit and metrics |
| Invalid score consistency | If `posteam_score`/`defteam_score` present and disagree with `score_differential` by >0 after integer coerce → drop |

**Terminal-play note:** WP is scored at the **start** of eligible plays. There is no WP target after the game clock and scoring are final; those rows never enter the modeling frame as prediction moments. When `game_seconds_remaining == 0` on a rare edge row, v0 still allows the row if other fields are valid (clock can read 0 on the final snap in some feeds) — the win label remains the eventual game outcome.

### End-of-half

* Half boundaries do **not** reset the WP target (unlike EP next-score-in-half).
* `half_seconds_remaining → 0` at end of half is a valid prediction moment if a scrimmage row exists; the game continues.
* `receive_2h_ko` is informative in Q1–Q2 only; outside first half the feature is encoded as **0** (explicit missing→0 policy).
* OT (`qtr == 5`) uses the same features; no separate OT model in v0.

---

## 4. Splits and metrics

| Split | Seasons | Role |
| --- | --- | --- |
| Train | 2019–2021 | Fit only |
| Validate | 2022 | Select `C`; calibration report |
| Report-only | 2023 | Exposed once; **no** selection |

Metrics (same rows for model vs baselines): log loss, Brier, calibration deciles, n, score/time slices.

Baselines:

1. Constant train-frequency \(P(\text{win})\).
2. Score+time logistic (`score_differential`, `game_seconds_remaining` only).

---

## 5. Artifacts and EP reuse

* Outputs under `reports/wp/` (metrics, meta, calibration CSV, evaluation markdown).
* Path A: **does not load** EP joblib for train/eval.
* Labeled EP rebuild (store copy, SHA verified) may be loaded later only via explicit `--ep-model` path; never promoted into `reports/ep/artifacts/` by this prototype.
* Convention B / EP production code is untouched.
