# Delta summary + next steps (feed evaluation)

**Date:** 2026-10-11  
**Main after PR #16:** `4ce96b1`  
**Branch:** `cursor/feed-evaluation-c0ef` (docs-only PR, **not merged**)

## What landed

* Evidence-only feed evaluation vs `pre_snap_snapshot.v1` / Situation Lab scorer fields  
* Candidates: Sportradar, Genius Sports, Stats Perform, SportsDataIO, ESPN unofficial, nflverse  
* Coverage matrix (present / partial / missing); fair measurement method; no live wiring  

## Recommendation (not implemented)

* **Best fit to evaluate next:** Sportradar (documented situation fields + simulations)  
* **Lower-cost path:** stay on recorded demo + nflverse; SportsDataIO as cheaper commercial backup  
* **Official/betting fallback:** Genius Sports if rights require it  
* **Do not use ESPN unofficial for product**

## Approval needed

Authorize Sportradar trial/quote + mapping spike? (**no live wiring without approval**)

## Single best next step

Sportradar trial → map Simulation frames → `pre_snap_snapshot.v1` → measure **our** E2E latency → go/no-go.
