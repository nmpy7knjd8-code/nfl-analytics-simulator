# Kickoff / receive_2h_ko rule check (WP v0)

**Date:** 2026-10-11  
**Scope:** Read-only mapping for train window 2019–2022 (REG). No training in this note.

## Lake field

* `receive_2h_ko` is **derived** in ingest (`nfl_sim.ingest.derive.derive_receive_2h_ko`), not an observed nflverse Parquet column.
* Rule (nflfastR-compatible): for `qtr <= 2`, flag = 1 when `posteam` equals the first non-null first-half `defteam` (team that will receive the 2H kickoff); else 0. Outside first half → null in ingest; WP feature encode → **0**.

## NFL rule years in window

| Topic | 2019–2022 note for WP features |
| --- | --- |
| 2H kickoff receiver | Still determined by opening kickoff / coin-toss procedure; first-half possession of the opening kickoff team implies the other side receives 2H KO (nflfastR encoding). |
| OT | Sudden-death / modified OT variations affect late-game WP dynamics; v0 uses the same feature vector in `qtr==5` without a separate OT model. |
| Onside / surprise onside | Possession after onside is reflected in subsequent `posteam` / score / clock rows; no dedicated onside feature in v0. |
| Safety free kick | Rare; subsequent snaps carry updated possession/score. Not a separate WP feature. |

## WP v0 decision

Ship with derived `receive_2h_ko` + missing→0 outside first half. Revisit only if slice diagnostics show systematic 2H KO miscalibration.
