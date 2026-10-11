# Variance-aware punt + outcome-dependent clock

**Date:** 2026-10-11  
**Depends on:** PR #12 season-aware transitions (`18e4e1c`)  
**Branch:** `cursor/punt-variance-clock-c0ef` (PR open, **not merged**)

## What improved

| Piece | Legacy | Improved |
| --- | --- | --- |
| Punt | Mean opp `yardline_100` in yardline bin | Expectation over **q25 / q50 / q75** buckets (weights 0.25/0.50/0.25); TB→80 in fit |
| Clock | −6s every branch | REG train **median** Δ`game_seconds_remaining` to next play by outcome |

**Fit:** REG 2019–2021 only (never 2023+). Blocked punts excluded. Clock dt filter ∈[1,55]s.

### Clock medians (pooled train)

| Outcome | n | median s |
| --- | ---: | ---: |
| go_convert | 1067 | 29 |
| go_fail | 963 | 5 |
| fg_make | 2466 | 4 |
| fg_miss | 475 | 5 |
| punt | 6086 | 9 |

## Commands

```bash
cd backend

python3 -m nfl_sim.models decision-lab \
  --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368 \
  --compare-transitions --out ../reports/punt_clock_transitions

python3 -m nfl_sim.models decision-lab \
  --seasons 2022 --game-id 2022_18_LAC_DEN --play-id 3897 \
  --compare-transitions --out ../reports/punt_clock_transitions/flip_example
```

`--transition-mode legacy|improved` on the same freeze path.

## Harness results

### Anchor (early Q1) — values barely move

`2022_01_BAL_NYJ` / `368`:

| Config | go | FG | punt | rec |
| --- | ---: | ---: | ---: | --- |
| pooled + legacy | 0.5951 | 0.5082 | 0.5353 | go |
| season_aware + legacy | 0.6013 | 0.5386 | 0.5330 | go |
| pooled + improved | 0.5950 | 0.5082 | 0.5348 | go |

### Late-game flip (recommendation changes)

`2022_18_LAC_DEN` / `3897` — yl64 &14, sd=−3, gsec=207; historical **punt**:

* pooled + legacy → **inconclusive**  
* pooled + improved → **punt** (Δpunt ≈ +0.0016 WP)

Path A WP is only mildly sensitive to these transition refinements (~0.002 WP typical); flips concentrate near the 0.01 inconclusive band.

## Limitations

* Quantile buckets ≠ full return/block distribution; blocks still excluded as branches  
* Clock = median next-play delta (includes stoppages unevenly); half-clock uses same delta  
* Convert clock (29s) mixes long completions / runoff — coarse  
* No claim that matching coaches = correctness  

## Non-goals

Live/odds/fan-UI; Convention B; EP promote; isotonic persist; merge without approval.
