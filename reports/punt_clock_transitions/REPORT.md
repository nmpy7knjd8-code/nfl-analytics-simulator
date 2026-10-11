# Punt variance + outcome clock — harness report

**Command:** `python3 -m nfl_sim.models decision-lab --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368 --compare-transitions --out ../reports/punt_clock_transitions`

See `COMPARE_TRANSITIONS.md` for the three-way table (pooled+legacy / season_aware+legacy / pooled+improved).

**Flip example:** `2022_18_LAC_DEN` / `3897` — see `2022_18_LAC_DEN_3897/COMPARE_TRANSITIONS.md` (inconclusive → punt).

Empirics seasons `[2019,2020,2021]` REG; clock n and punt bucket filters in analyzer assumptions / `compare_transitions.json`.
