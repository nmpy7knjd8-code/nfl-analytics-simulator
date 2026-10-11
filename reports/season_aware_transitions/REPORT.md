# Season-aware transitions — harness comparison

**Command:** `python3 -m nfl_sim.models decision-lab --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368 --compare-modes --out ../reports/season_aware_transitions`

See `COMPARE.md` for the anchor play table. Empirics still fit REG 2019–2021 only (never 2023+).

## Anchor (values move, rec stable)

`2022_01_BAL_NYJ` / `368`: pooled **go** → season_aware **go**; p_convert 0.6511 → 0.6792 (2021 table).

## Flip peer

`2022_01_BAL_NYJ` / `790`: pooled **inconclusive** → season_aware **fg**.

Artifacts: `compare_modes.json`, `COMPARE.md`, `peers.json`, `flips.json`.
