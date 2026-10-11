# Delta summary + next steps (punt variance + clock)

**Date:** 2026-10-11  
**Main after PR #12:** `18e4e1c`  
**Branch:** `cursor/punt-variance-clock-c0ef` (PR open, **not merged**)

## What landed

* Improved transitions: punt q25/q50/q75 expectation + outcome-dependent clock medians (REG 2019–2021)
* `decision-lab --transition-mode improved` and `--compare-transitions`
* Same freeze harness; pooled / season_aware / improved comparable

## Measured

* Anchor `2022_01_BAL_NYJ`/`368`: rec unchanged; tiny Δ  
* `2022_18_LAC_DEN`/`3897`: legacy **inconclusive** → improved **punt**

## Approval needed

Merge punt/clock PR? (**do not merge without approval**)

## Single best next step toward real-time terminal

Minimal Situation Lab UI over this freeze + transition compare path (still offline) so humans can inspect near-tie flips before any live adapter.
