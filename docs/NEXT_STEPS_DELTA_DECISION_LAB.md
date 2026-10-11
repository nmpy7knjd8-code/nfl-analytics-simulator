# Delta summary + next steps (historical decision lab)

**Date:** 2026-10-11  
**Main after PR #9:** `d34100cd`  
**Branch:** `cursor/historical-decision-lab-c0ef` (PR open, **not merged**)

## What landed

* CLI `decision-lab`: select a real lake 4th-down row → freeze state → reuse `FourthDownAnalyzer`
* Provenance (season, game_id, play_id, …), three WP values, rec/inconclusive, assumptions, empirics n + seasons
* Sensitivity on a disclosed convert-rate shift; offline disclaimer + limitations
* Tests: `tests/test_decision_lab.py`
* Example report: `reports/decision_lab/` (lake row `2022_01_BAL_NYJ` / `368`)

## Measured lake example

| | go | FG | punt | rec |
| --- | ---: | ---: | ---: | --- |
| Baseline (yl51 &1, tied Q1) | 0.595 | 0.508 | 0.535 | **go** |
| Convert −35 pp | 0.517 | 0.508 | 0.535 | **punt** |

Historical action that snap: **punt**. Empirics: 2019–2021 REG; n_go=2041, n_fg=2970, n_punt=6102.

## Approval needed

1. Merge decision-lab PR? (**do not merge without approval**)

## Single best next step toward real-time trading terminal

Season-aware convert / FG / punt transition models (replace coarse bins + mean punt + toy clock) while keeping this lake-row freeze path as the offline acceptance harness — still no live odds.
