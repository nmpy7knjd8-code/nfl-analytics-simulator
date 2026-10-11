# Analytical 4th-down design (offline prototype)

**Status:** Design + minimal offline impl  
**Date:** 2026-10-11  
**Depends on:** Path A uncalibrated WP (`WPModel`) — isotonic not used  
**Non-goals:** Live, odds, betting, EP promotion, Convention B changes

## Decision value

For a frozen pre-snap 4th-down situation \(s\):

\[
\begin{align*}
V_{\mathrm{go}} &= p_{\mathrm{conv}}\, WP(s_{\mathrm{conv}}) + (1-p_{\mathrm{conv}})\, WP(s_{\mathrm{fail}}) \\
V_{\mathrm{fg}} &= p_{\mathrm{make}}\, WP(s_{\mathrm{make}}) + (1-p_{\mathrm{make}})\, WP(s_{\mathrm{miss}}) \\
V_{\mathrm{punt}} &= WP(s_{\mathrm{punt}})
\end{align*}
\]

Recommendation = \(\arg\max\{V_{\mathrm{go}}, V_{\mathrm{fg}}, V_{\mathrm{punt}}\}\). If top two differ by \(< 0.01\) WP → **inconclusive**.

## What WP supplies vs does not

| Needed | Source |
| --- | --- |
| \(WP(\cdot)\) at resulting states | Path A `WPModel.predict_wp` |
| \(p_{\mathrm{conv}}\) | Empirical 4th-down go convert rate by distance bin (train 2019–2021) |
| \(p_{\mathrm{make}}\) | Empirical FG make rate by kick-distance bin (train 2019–2021) |
| Punt resulting field position | Empirical mean opponent `yardline_100` after non-blocked REG punts by pre-punt yardline bin (train 2019–2021) |

## Transition assumptions (disclosed)

1. **Go convert:** new `yardline_100' = max(1, yardline_100 − distance)`; 1st & 10. If `distance ≥ yardline_100` → **TD** (+7), possession flip, opponent ball at 75 (kickoff touchback proxy), score_diff flipped then −7 from new posteam view handled via absolute scores.
2. **Go fail:** turnover on downs; opponent at `100 − yardline_100`; 1st & 10; score_diff sign flip; possession flip.
3. **FG distance:** `yardline_100 + 17`.
4. **FG make:** +3, possession flip, opponent at 75 (TB kickoff proxy).
5. **FG miss:** opponent at `100 − yardline_100` (spot ≈ previous LOS).
6. **Punt:** possession flip to empirical mean opponent yardline; 1st & 10; score_diff flip. Blocked punts excluded from empirics; not modeled as a separate branch in v0.
7. **Clock:** subtract 6 game/half seconds per branch (toy); no play clock / timeout strategy.
8. **Timeouts / roof / receive_2h_ko:** carried from input; `receive_2h_ko` forced 0 outside first half.

## Empirics policy

* Fit on **REG train seasons 2019–2021 only**.  
* Never fit/tune on 2023–2025.  
* Report n and filters alongside rates.

## Sensitivity

Re-score with alternate \(p_{\mathrm{conv}}\) / \(p_{\mathrm{make}}\) (e.g. ±10 pp clipped) and show when the recommendation flips.
