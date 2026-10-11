# Delta summary + next steps (4th-down prototype)

**Date:** 2026-10-11  
**Main after WP merge:** `2b70977` (PR #8)  
**Branch:** `cursor/fourth-down-prototype-8ade` (PR open, **not merged**)

## What landed

* Offline analytical go / FG / punt scorer using Path A **uncalibrated** WP + REG train 2019–2021 empirics
* Design doc, CLI `fourth-down --report`, tests, `reports/fourth_down/`
* Sensitivity: midfield 4th&1 **go → punt** when convert rate −35 pp
* Isotonic WP **not** persisted; Convention B / EP untouched

## Measured example (WP artifact Path A)

| Situation | go | FG | punt | rec |
| --- | ---: | ---: | ---: | --- |
| yl55 &1, tied, 6:00 | 0.520 | 0.440 | 0.471 | go |
| yl33 &4, −3, 2:00 | 0.395 | 0.394 | 0.341 | inconclusive |
| yl20 &8, tied, 1:30 | 0.543 | 0.580 | 0.480 | fg |

## Approval needed

1. Merge 4th-down PR? (**do not merge without approval**)  
2. Later: persist isotonic WP candidate? (still optional; not default)

## Single best next step toward real-time terminal

Replace toy clock / mean punt / bin FG with season-aware transition models + wire a read-only historical “decision lab” UI that freezes a lake 4th-down row and shows these three values — still offline, no live odds.
