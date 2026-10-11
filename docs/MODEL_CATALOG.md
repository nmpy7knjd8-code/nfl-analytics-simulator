# MODEL CATALOG — Phase 1 (six families)

**Scope:** NFL only · local CPU · no paid sources · no betting/odds features in MVP  
**Experiment:** train 2019–2021 · validate 2022 · test 2023  
**Stack default:** scikit-learn first; XGBoost only if justified on validate metrics  
**Status:** Catalog + baselines only. **No reproduction claimed. No invented benchmarks.**

Lead: copy this file into the GitHub repo `docs/` when the repo exists.

---

## Comparison (Stage A order)

| # | Family | Role | MVP baseline | Public reference | Implement when |
| --- | --- | --- | --- | --- | --- |
| 1 | EP | Pre-play expected points | sklearn multinomial logistic (7 next-score classes) | nflverse `ep` / nflfastR EP | **First** |
| 2 | EPA | Play value | EP_end − EP_start (+ documented special cases) | nflverse `epa` | Immediately after EP |
| 3 | Situation WP | P(win) | sklearn logistic / GBM-light without spread | nflverse `wp` (not `vegas_wp`) | After EPA validates |
| 4 | Fourth-down | Decision compare | Design only (nfl4th-inspired) | nfl4th | **Phase 6** |
| 5 | Empirical sampling | Non-parametric outcomes | Situation-matched historical resample | nflverse PBP itself | Parallel with EP/EPA for sim stub |
| 6 | Calibration / chrono validation | Quality gate | Brier, log loss, calibration; season holdouts | OSF/Yurko methods (cite, don’t claim) | Every model gate |

---

## 1. Expected Points (EP)

**Estimates:** Expected points for the possession team given pre-play state, from probabilities of the next scoring event in the half (TD, FG, safety, no-score, and opponent counterparts).

**Typical features (public docs):** `half_seconds_remaining`, `yardline_100`, `down`, `ydstogo`, home indicator, roof type, timeouts both sides; era indicators in nflfastR. **Exclude** spread/odds.

**Availability in nflverse PBP:** `ep` and score-event probability columns present on loaded 2019–2023 files (spot-checked via `nflreadpy`).

**Public impl / paper:** Yurko et al. (JQAS 2019 / arXiv:1802.00998) multinomial logit; Baldwin OSF nflfastR XGBoost write-up; `fastrmodels::ep_model` (MIT); `calculate_expected_points()`.

**License:** Methodology papers as published; fastrmodels/nflfastR MIT; our training data CC BY 4.0 with attribution.

**Reproducibility:** Published `ep` = **reference-only**. Our sklearn retrain = **approximated** until metrics are recorded. OSF LOSO figures = **unreproducible** here until re-run.

**Simplest baseline:** `sklearn.linear_model.LogisticRegression` (multinomial / one-vs-rest) on the 7-class next-score label constructed from chronological PBP; EP = Σ p_k · points_k with points ∈ {7,3,2,0,−2,−3,−7}.

**Tests (planned, not run):** Feature leakage check; class probs sum ≈ 1; val-2022 log loss / Brier / calibration vs constant and vs published `ep` as reference.

**Defer:** XGBoost EP, player-adjusted EP, weather beyond roof.

---

## 2. Expected Points Added (EPA)

**Estimates:** Value added on a play: typically EP after − EP before, with sign flips on possession change and special cases (kickoff touchback, timeout, end-of-half, penalties).

**Features:** Not a separate learner if EP exists — deterministic transform of pre/post EP (plus play-type flags).

**Availability:** `epa` column in nflverse PBP (non-null on vast majority of rows in 2019–2023 spot-check).

**Public impl:** nflfastR EPA processing after EP; sportsdataverse docs describe nflfastR-faithful rules (third-party; treat as guide, not authority).

**License:** Same as EP data/models used.

**Reproducibility:** Matching published `epa` bit-for-bit = not claimed. Rule port = **approximated**.

**Simplest baseline:** `epa = ep_end - ep_start` on non-special plays; document and unit-test each special case; compare distribution/MAE to reference `epa` on validate 2022.

**Tests (planned):** Possession-change sign; timeout → 0; no silent overwrite of historical `epa` column (store ours as `model_epa`).

**Defer:** Opponent-adjusted EPA, player EPA/WAR (Yurko nflWAR).

---

## 3. Situation-based Win Probability (WP)

**Estimates:** P(posteam wins | pre-play situation).

**Features (MVP):** score differential, game/half seconds, field position, down, distance, timeouts, home, receive-2H-KO if available. **Do not use** `spread_line`, moneyline, or `vegas_wp` as model inputs for MVP.

**Availability:** `wp` and `vegas_wp` both present in PBP; MVP models target/compare to **`wp` only**.

**Public impl:** nflfastR WP XGBoost (± spread variant); Yurko GAM using EP as input.

**License:** fastrmodels/nflfastR MIT; data CC BY 4.0.

**Reproducibility:** Published `wp` **reference-only**. Sklearn WP **approximated**.

**Simplest baseline:** `sklearn` logistic regression (or `HistGradientBoostingClassifier` if linear fails calibration on val — still sklearn). Optional: include predicted EP as a feature (Yurko-style), fit only on train seasons. **Document the baseline’s exact inputs** in the eval write-up.

**Acceptance / validation (from `MODEL_VALIDATION.md`):** Do **not** set a hard “must beat baseline by X” bar before baseline and data are inspected. Evaluate candidate and baseline on **identical** held-out games and eligible situations. Report **Brier score**, **log loss**, **calibration plots**, and **sample sizes (n)**; explain whether any improvement is statistically meaningful and robust across situation groups. Save metrics and plots under **`/reports/`**. Fairness: no look-ahead / temporal leakage (information only available at prediction time). Chronological splits unless data work documents a justified change.

**Tests (planned):** Above metrics on val 2022 / test 2023; calibration by score/time buckets; odds-feature and leakage audits; `/reports/` artifact check.

**Defer:** Spread-adjusted WP, in-game market calibration, live WP.

---

## 4. Fourth-down decision evaluation (Phase 6 design)

**Estimates:** Expected win probability for go-for-it vs field goal vs punt; recommendation = argmax WP (nfl4th `go_boost` style).

**Depends on:** Stable situation WP + transition models (yards on go, FG make by distance/roof, punt outcomes).

**Public impl:** `nfl4th` (MIT) — https://www.nfl4th.com/ — documented limitations (no return-TD on go; simplified FG/punt).

**Phase 1 deliverable:** This design note only.

**Phase 6 simplest baseline:** Empirical first-down rate by distance + FG make curve by `yardline_100`/`roof` + punt net-yard bootstrap; feed resulting states through situation WP. Disclose simplifications. Do not require R runtime if Python ports suffice.

**Tests (later):** Decision tables on held-out 4th downs; sensitivity to WP model; never claim coach “correctness” as causal.

**Defer:** Full nfl4th parity, bot/live scrape (`get_4th_plays`), 2-pt charts until WP solid.

---

## 5. Historical empirical sampling

**Estimates:** Outcome distributions for a situation (next play yards/type, or drive end) by sampling matched historical plays — nonparametric simulation prior.

**Features / match keys (MVP suggestion):** down, distance bucket, yardline bucket, score-diff bucket, time bucket; optional roof. Train-window only when estimating “policy” for counterfactuals that must not peek at test.

**Availability:** Entire nflverse PBP via `nflreadpy`; no extra license beyond CC BY 4.0 attribution.

**Public impl:** Common practice in open football analytics; not a single package. Complements parametric EP/WP.

**Reproducibility:** Fully **reproducible** once match keys, seed, and snapshot ID are fixed.

**Simplest baseline:** Uniform sample from plays matching keys within train 2019–2021; report support size; fall back to coarser buckets if n is small.

**Tests:** Seed stability; no test-season rows in the sampling frame for locked experiments; empty-match handling.

**Defer:** Continuous distance kernels, opponent strength weighting, player-specific filters.

---

## 6. Calibration and chronological validation

**Purpose:** Quality gate for EP class probs, WP, and (later) fourth-down transition probs. Canonical WP rules live in `docs/MODEL_VALIDATION.md`.

**Methods (cite, then implement):** Chronological season split (locked above); leave-one-season-out only as stretch goal. For probabilistic models: **Brier**, **log loss**, **calibration plots**, and **n** on identical held-out slices for every candidate vs its documented baseline. For EPA: MAE/RMSE vs realized next-score and/or reference `epa`. Accuracy alone is insufficient (AGENTS.md). Persist artifacts under **`/reports/`**.

**WP acceptance:** Not “beat baseline by X” a priori. Require documented baseline inputs, identical held-out comparison, the metrics above, a short robustness/meaningfulness write-up, `/reports/` outputs, and an explicit leakage prohibition.

**Public references:** Yurko et al. calibration approach; Baldwin OSF LOSO plots (cite only — **not reproduced here**).

**Simplest baseline checks:** Constant-frequency (or other simple) baseline with exact inputs listed; isotonic/Platt on validate only if used (never fit on test).

**Tests:** Leakage audit script; frozen split config in repo; metrics + plots in `/reports/` alongside model version/provenance.

**Defer:** Formal decision-utility scoring, betting CLV (out of scope).

---

## Recommended Stage A sequence

1. **EP** (sklearn multinomial) → validate 2022  
2. **EPA** derivation + compare to reference `epa`  
3. **Situation WP** (no odds) → fair baseline comparison per `MODEL_VALIDATION.md` (not a preset Δ threshold)  
4. Wire **empirical sampling** for early simulation stubs  
5. Freeze test-2023 evaluation once val reporting is complete and reviewed  
6. **Fourth-down** only in Phase 6  

XGBoost: only after a written `/reports/` comparison vs the documented sklearn baseline on identical held-out data (Brier, log loss, calibration, n)—no preset “must beat by X” gate; justify adoption from that evidence.
