# Season-aware fourth-down transitions

**Date:** 2026-10-11  
**Depends on:** decision lab on `main` (PR #11 merge `aa19fea`)  
**Branch:** `cursor/season-aware-transitions-c0ef` (PR open, **not merged**)

## What changed

Train empirics now keep **pooled** tables (default, backward compatible) **and** per-train-season convert / FG / punt tables (2019–2021 REG only; never 2023+).

`season_aware` mode:

* If play season ∈ fit set → use that season’s tables  
* Else (e.g. 2022 lake plays) → most recent train table ≤ play season (**2021**), disclosed in `empirics_resolve`

Same lake-row freeze path (`decision-lab`); only transition empirics selection changes. WP Path A unchanged; no isotonic persist.

## Commands

```bash
cd backend

# Same play, both modes
python3 -m nfl_sim.models decision-lab \
  --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368 \
  --convert-delta -0.35 --compare-modes \
  --out ../reports/season_aware_transitions

# Score with season_aware only
python3 -m nfl_sim.models decision-lab \
  --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368 \
  --empirics-mode season_aware --out ../reports/decision_lab
```

## Same-play before/after (anchor)

`2022_01_BAL_NYJ` / `368` — BAL 4th & 1 yl51 tied Q1; historical **punt**.

| Mode | go | FG | punt | rec | p_convert | table |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| pooled | 0.5951 | 0.5082 | 0.5353 | go | 0.6511 | pooled |
| season_aware | 0.6013 | 0.5386 | 0.5330 | go | 0.6792 | 2021 |

Recommendation **unchanged** (still go); values move (Δgo≈+0.006, Δfg≈+0.030).

## Peer where recommendation flips

`2022_01_BAL_NYJ` / `790` — yl6 &3; historical **fg**.

| Mode | rec |
| --- | --- |
| pooled | inconclusive |
| season_aware | fg |

## Limitations

* Still coarse distance/kick bins; toy clock; mean punt  
* Held-out seasons use latest train table (not a forecast model)  
* Some FG recommendation flips are sensitive to 60–80 yd make-rate season noise  

## Non-goals

Live/odds/betting/fan-UI; Convention B; EP promote; isotonic persist; merge without approval.
