"""Build the home-perspective WP series + swing flags from canonical plays."""

from __future__ import annotations

from typing import Any

from nfl_sim.contracts.win_probability import (
    GameResult,
    WinProbabilityPoint,
    WinProbabilitySeries,
)

REGULATION_SECONDS = 3600


def game_result(home_score: int | None, away_score: int | None) -> GameResult | None:
    if home_score is None or away_score is None:
        return None
    if home_score > away_score:
        return "home_win"
    if home_score < away_score:
        return "away_win"
    return "tie"


_FINAL_HOME_WP = {"home_win": 1.0, "away_win": 0.0, "tie": 0.5}


def _ot_period_seconds(season_type: str | None) -> int:
    return 900 if (season_type or "").upper() == "POST" else 600


def game_seconds_elapsed(quarter: int, game_seconds_remaining: int | None, season_type: str | None) -> int:
    """Monotone clock: regulation 0–3600, then 3600 + seconds played in OT."""
    if game_seconds_remaining is None:
        return 0
    if quarter <= 4:
        return max(0, REGULATION_SECONDS - int(game_seconds_remaining))
    # nflverse resets game_seconds_remaining to the OT period length in qtr 5
    return REGULATION_SECONDS + max(0, _ot_period_seconds(season_type) - int(game_seconds_remaining))


LOW_CLOCK_SECONDS = 120
STORY_WEIGHT = {None: 1.0, "end_of_half": 0.0, "overtime": 0.5, "low_clock_before_half": 0.5}


def wp_quirk_reason(quarter: int, game_seconds_elapsed_: int) -> str | None:
    """Where nflverse WP is known to misbehave (see contracts.win_probability)."""
    if quarter >= 5:
        return "overtime"
    if quarter == 2 and 1800 - game_seconds_elapsed_ <= LOW_CLOCK_SECONDS:
        return "end_of_half"
    if quarter == 4 and REGULATION_SECONDS - game_seconds_elapsed_ <= LOW_CLOCK_SECONDS:
        return "low_clock_before_half"
    return None


def home_wp_of(play: dict[str, Any]) -> float | None:
    """Home-team pre-snap WP. Prefer reference.home_wp; fall back to the
    possession-team `wp` flipped when the away team has the ball."""
    ref = play.get("reference") or {}
    hw = ref.get("home_wp")
    if hw is not None:
        return float(hw)
    wp = ref.get("wp")
    home_poss = play.get("is_home_possession")
    if wp is None or home_poss is None:
        return None
    return float(wp) if home_poss else 1.0 - float(wp)


def build_wp_series(
    game: dict[str, Any],
    plays: list[dict[str, Any]],
    *,
    swing_threshold: float,
) -> WinProbabilitySeries:
    if not (0.0 < swing_threshold <= 1.0):
        raise ValueError("swing_threshold must be in (0, 1]")
    home_score = game.get("home_score")
    away_score = game.get("away_score")
    result = game_result(home_score, away_score)
    season_type = game.get("season_type")

    usable = []
    for p in sorted(plays, key=lambda r: r["play_index"]):
        hw = home_wp_of(p)
        if hw is None:
            continue
        usable.append((p, hw))

    points: list[WinProbabilityPoint] = []
    for i, (p, pre) in enumerate(usable):
        if i + 1 < len(usable):
            post = usable[i + 1][1]
        elif result is not None:
            post = _FINAL_HOME_WP[result]
        else:
            post = pre
        delta = post - pre
        q = int(p["quarter"])
        elapsed = game_seconds_elapsed(q, p.get("game_seconds_remaining"), season_type)
        reason = wp_quirk_reason(q, elapsed)
        points.append(
            WinProbabilityPoint(
                play_id=str(p["play_id"]),
                play_index=int(p["play_index"]),
                quarter=q,
                is_overtime=q >= 5,
                game_seconds_elapsed=elapsed,
                possession_team_id=p.get("possession_team_id"),
                description=p.get("description"),
                home_wp_pre=pre,
                home_wp_post=post,
                delta_home_wp=delta,
                is_swing=abs(delta) >= swing_threshold - 1e-12,
                is_end_of_half=reason == "end_of_half",
                is_low_clock_before_half=reason == "low_clock_before_half",
                wp_quirk_reason=reason,
                story_weight=STORY_WEIGHT[reason],
            )
        )
    return WinProbabilitySeries(
        game_id=str(game["game_id"]),
        home_team_id=str(game["home_team_id"]),
        away_team_id=str(game["away_team_id"]),
        home_score=home_score,
        away_score=away_score,
        result=result,
        swing_threshold=swing_threshold,
        has_overtime=any(pt.is_overtime for pt in points),
        points=points,
        swing_play_ids=[pt.play_id for pt in points if pt.is_swing],
        story_swing_play_ids=story_ranking(points),
    )


def story_ranking(points: list[WinProbabilityPoint]) -> list[str]:
    ranked = sorted((pt for pt in points if pt.is_swing and pt.story_weight > 0),
                    key=lambda pt: (-abs(pt.delta_home_wp) * pt.story_weight, pt.play_index))
    return [pt.play_id for pt in ranked]
