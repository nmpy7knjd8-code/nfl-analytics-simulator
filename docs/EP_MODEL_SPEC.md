# EP / EPA Model Spec (Stage A)

**Status:** Locked before training (Phase 3 Stage A)  
**Date:** 2026-10-11  
**Implementation status target:** approximated (not nflfastR bit-parity)  
**Reference columns:** nflverse `ep` / `epa` are **comparison only**, never features or ground truth.

This document defines prediction-time state, target construction, eligibility, and EPA transitions. Code must match these rules; if a rule here is wrong, change this doc first.

---

## 1. What EP predicts

| Item | Definition |
| --- | --- |
| Quantity | Expected points credited to the **current possession team** from the current pre-play state until the **next scoring play in the same half**, or end-of-half with no score |
| Unit | Points (NFL scoring units) |
| Estimator | Multinomial probabilities over 7 mutually exclusive next-score classes, then EP = Σ pₖ · vₖ |
| Class values vₖ | Touchdown=+7, FieldGoal=+3, Safety=+2, NoScore=0, OppSafety=−2, OppFieldGoal=−3, OppTouchdown=−7 |

TD value is **+7 / −7** (standard epoch-EP convention that folds the try into the TD event). We do **not** model PAT vs 2-point conversion as separate EP classes in Stage A.

---

## 2. State at prediction time

EP is scored from **pre-play** information only (start-of-play freeze).

### Features (allowed)

| Feature | Source | Notes |
| --- | --- | --- |
| `down` | `down` | 1–4 |
| `distance` | `ydstogo` | yards to go |
| `yardline_100` | `yardline_100` | yards from opponent end zone (1–99) |
| `half_seconds_remaining` | `half_seconds_remaining` | clock in current half |
| `posteam_timeouts` | `posteam_timeouts_remaining` | 0–3 |
| `defteam_timeouts` | `defteam_timeouts_remaining` | 0–3 |
| `is_home_possession` | derived (`posteam == home_team`) | 0/1 |
| `roof` | `roof` | categorical (`dome` / `outdoors` / `closed` / `open`; unknown → other) |

**Excluded from production Stage A model (gate decision 2026-10-11):**

| Feature | Encoding | Status |
| --- | --- | --- |
| `era_post_2020` | binary `season ≥ 2021` | Diagnostic/ablation only. Val 2022 ablation ΔLL≈0.001 vs with-era; **not** in production fit. Reconsider later only if gain is meaningful/stable across temporal validation with encoding documented. |

### Explicitly forbidden as features (leakage / policy)

* Any nflverse / nflfastR model output: `ep`, `epa`, `wp`, `wpa`, `vegas_wp`, `vegas_wpa`, `home_wp`, `away_wp`, `*_wp_post`, next-score probs (`td_prob`, `fg_prob`, …), `cp`, `cpoe`, `xpass`, `success`, xyac_*, etc.
* Betting / market inputs: `spread_line`, moneylines, totals.
* Post-play or future information: `yards_gained`, `*_post` scores, next-play state, drive result, eventual next-score label components beyond the training target itself.
* Player / tracking / participation fields.

Preprocess (impute/encode/scale) **fit on train only**. Hyperparameters chosen on **validate 2022 only**. Season **2023** is held out until final report.

---

## 3. Target construction (next score in half)

### Half definition

* First half: `qtr ∈ {1, 2}`
* Second half + OT bucket for labeling: `qtr ∈ {3, 4, 5}` treated as the “second half” epoch for next-score search (OT continues the second-half scoring epoch in this Stage A simplification).

### Looking forward

For each eligible pre-play row with possession team `posteam` at time t:

1. Scan subsequent rows in the **same `game_id`** with the **same half bucket**, in play order.
2. Find the first **scoring play** (see §3.1).
3. Assign the class from the scoring team relative to t’s `posteam` (§3.2).
4. If no scoring play occurs before half end → class `NoScore` (0).

### 3.1 What counts as a scoring play

A row is a scoring play when **exactly one** of these observed outcomes applies (priority order if multiple flags fire — rare):

| Priority | Outcome | Detection (nflverse columns) |
| ---: | --- | --- |
| 1 | Touchdown | `touchdown == 1` **or** (`sp == 1` and TD indicated via `touchdown`) |
| 2 | Safety | `safety == 1` |
| 3 | Field goal | `field_goal_result == "made"` (missed/blocked FG are **not** scores) |

Extra-point and two-point attempts are **not** next-score events for labeling; the preceding TD already closed the epoch under the +7 convention.

Return touchdowns / defensive scores: the **scoring team** is the team that gained points (use `td_team` when present; else infer from `posteam`/`defteam` and play flags). The label is always from the perspective of the **original** possession team at prediction time t.

### 3.2 Class from scoring team

Let `S` = scoring team, `P` = posteam at prediction time.

| Event | Condition | Class | Value |
| --- | --- | --- | ---: |
| TD for P | TD and S == P | `Touchdown` | +7 |
| FG for P | made FG and S == P | `FieldGoal` | +3 |
| Safety credited to P | safety and points to P (opponent sacked in EZ, etc.) | `Safety` | +2 |
| No score | half ends without score | `NoScore` | 0 |
| Safety against P | safety and points to opponent of P | `OppSafety` | −2 |
| FG against P | made FG and S != P | `OppFieldGoal` | −3 |
| TD against P | TD and S != P | `OppTouchdown` | −7 |

### 3.3 Turnovers, penalties, no-plays, misses (label path)

These affect **who eventually scores**, not a separate EP class:

| Situation | Label handling |
| --- | --- |
| Interception / fumble lost | Keep scanning; opponent score → Opp* class |
| Defensive / return TD | OppTouchdown (or Touchdown if returning team == P — unusual) |
| Penalty / `no_play` | Not a scoring event by itself; scan continues (unless the rare penalty awards a score — then §3.1) |
| Missed / blocked FG | Not a score; scan continues |
| Punt / downs / kneel | Not a score; scan continues |
| End of half / end of game | If no score found → `NoScore` |
| Missing / ambiguous scoring flags | Row excluded from **train/eval** (not imputed). Counted in missingness report |

### 3.4 Ambiguity policy

If `touchdown`/`safety`/`field_goal_result`/`td_team` are missing or contradictory on a candidate scoring row so class cannot be assigned, that **prediction row’s label is NA** and the row is dropped from fit/metrics. We do **not** fall back to nflverse `ep` to invent a label.

**Locked (not asking):** OT is bundled into the second-half epoch; TD = 7 points; labels constructed from observed score events, never from reference `ep`.

---

## 4. Eligible rows (train / validate / test)

Default modeling frame = **REG scrimmage**:

* `season_type == "REG"`
* `down` not null (scrimmage plays)
* Required pre-play features non-null: `down`, `ydstogo`, `yardline_100`, `half_seconds_remaining`, `posteam`, `home_team`
* Constructed next-score label non-null

**Excluded from fit/default eval:**

* Kickoffs, extras, two-point attempts, kneel/spike-only admin rows without down (already out via `down` null)
* POST season (kept in lake for reconstruction; not in default Stage A fit)
* Rows failing label construction

**Splits (locked):**

| Split | Seasons |
| --- | --- |
| Train | 2019–2021 |
| Validate | 2022 |
| Test | 2023 (held out; report once; no tuning) |

Expected REG scrimmage counts (DATA_EXPERIMENT; verify on load): train 116,218 · val 39,704 · test 40,031 before label drop. Report actual n after filters.

---

## 5. Model family (Stage A)

1. **Primary:** `sklearn.linear_model.LogisticRegression` multinomial (`multi_class="multinomial"`, `solver="lbfgs"`) on one-hot / numeric feature matrix.
2. **Simple baseline:** constant class-frequency predictor fit on **train** label frequencies only (same eval rows).
3. Optional compare (only if classes well-supported): same multinomial with different `C` chosen on val — still sklearn.

Seeds, package versions, feature list, train data hash, and config are written to `reports/ep/artifacts/ep_model.meta.json`.

---

## 6. Post-play state and EPA

EPA is a **deterministic** function of model EP at pre-play and post-play states. It is not a second learner.

### 6.1 Post-play EP state

For play i, `ep_before = EP(state_i_pre)`.

`ep_after` is EP evaluated at the **next meaningful football state** after play i, from the perspective of the team that will next snap (or 0 if half/game over):

1. Prefer the next row j in the same game with a valid scrimmage pre-play state (`down` not null), using j’s pre-play features.
2. If play i ends the half or game (no such j in-half / game over) → terminal (§6.2).
3. If the next scrimmage state belongs to a **different possession team** than i’s `posteam`, record `possession_change = True`.

When scoring EPA for historical rows, `ep_after` uses the **model** EP (same artifact), never reference `ep`.

### 6.2 EPA formulas (possession-aware)

Let `ep_before` be EP for possession team at snap. Let `ep_after_raw` be model EP for the team possessing at the post state (0 if terminal with no offense).

| Case | Detection | `model_epa` |
| --- | --- | --- |
| Timeout / clock-only no play | `play_type == timeout` (or equivalent) | **0** |
| End of half / end of game | no next scrimmage state in half/game | **0 − ep_before** (= `-ep_before`) |
| Same possession continues | next posteam == current posteam | `ep_after_raw − ep_before` |
| Possession change | next posteam ≠ current posteam | `(-ep_after_raw) − ep_before` |
| Scoring play that ends possession epoch | next state is kickoff/other; treat via possession change / terminal rules above | as above |

**Rationale for possession change:** EP is always “for the team about to snap.” After a change, the next EP is an opponent quantity; the play’s value for the original team is `-ep_after_raw - ep_before`.

### 6.3 Penalties and no-plays

* If the row is a penalty/`no_play` but yardline/down/clock change and the same or new posteam faces a next snap, apply the same same-possession / change / terminal rules using the **actual next pre-play state** (nflverse already encodes enforcement in subsequent pre-play fields).
* Do **not** naïve-subtract EP across a possession meaning change.
* Simplification (documented): we do not re-implement full NFL penalty replay logic beyond observed next state.

### 6.4 Accounting identities (Stage A convention)

Define \(V_i\) = model EP for the team about to snap. EPA cases as in §6.2.

| Identity | Holds under Stage A? | Coverage |
| --- | --- | --- |
| Same-possession contiguous chain (no timeout): \(\sum\mathrm{EPA}=V_{\mathrm{after\,last}}-V_{\mathrm{before\,first}}\) | **Yes** | Synthetic + train-season historical sample |
| Chain ending terminal (same possession): \(\sum\mathrm{EPA}=-V_{\mathrm{before\,first}}\) | **Yes** | Synthetic + train-season sample |
| Possession change: \(\mathrm{EPA}=-V_{\mathrm{after}}-V_{\mathrm{before}}\) | **Yes** (by definition) | Unit tests |
| Realized next-score cashing: \(\sum\mathrm{EPA}=R-V_0\) | **No** — scoring does not cash \(R\) into `ep_after` | Documented exclusion |

**Exclusions from telescoping checks:** timeouts (EPA≡0), possession-change plays (sign-flip space), score-cash residual, and **2023 holdout** (never used to tune conventions).

### 6.5 Invariants

* Probabilities for the 7 classes sum to 1 (±1e-6).
* EP ∈ [−7, 7] for any valid probability vector with the Stage A values.
* Timeout EPA == 0.
* Terminal EPA == `-ep_before`.
* Possession-change EPA == `-ep_after - ep_before` (not `ep_after - ep_before`).
* Feature matrix contains none of the forbidden names/columns (§2).
* XP / two-point tries are **not** independent next-score labels.

---

## 7. Evaluation and reports

Under `reports/ep/`:

* Target definition summary + filter counts + missingness
* Feature list and split sizes
* Baseline + model metrics on **validate** and **held-out test**
* Log loss, multiclass Brier, per-class support, situation slices with **n**
* MAE vs reference `ep` / `epa` labeled **reference agreement only**
* Limitations and whether Stage A is justified to proceed to WP
* No test-set tuning; no “superiority” claim from a single metric

---

## 8. Out of scope (this phase)

Situation WP, Monte Carlo simulation, live providers, Strategy / decision lab (4th down, clock).

---

## 9. Acceptance checklist

- [x] This spec committed before (or with) first training code path used for reported metrics
- [x] Leakage tests forbid reference/odds features
- [x] Chronological split integrity tests
- [x] EPA unit tests: possession change, terminal, timeout (+ vectorized); penalty/no-play via next-state rule
- [x] Held-out 2023 report written without retuning
- [x] Phase 2 replay tests still pass
