# Delta summary + next steps (season-aware transitions)

**Date:** 2026-10-11  
**Main after decision-lab merge:** `aa19fea` (PR #11)  
**Branch:** `cursor/season-aware-transitions-c0ef` (PR open, **not merged**)

## What landed

* Per-train-season convert / FG / punt empirics alongside pooled defaults  
* `decision-lab --empirics-mode season_aware` and `--compare-modes` on the same freeze harness  
* Same-play measurement: `2022_01_BAL_NYJ` / `368` values shift (rec stays go); peers can flip (e.g. `/790` inconclusive→fg)

## Approval needed

Merge season-aware PR? (**do not merge without approval**)

## Single best next step toward real-time trading terminal

Replace mean-punt + toy clock with variance-aware punt / clock modules on this harness, still offline — then wire a minimal Situation Lab UI over the freeze path.
