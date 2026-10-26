"""Win-probability series contract (Game Explorer chart + swing plays).

Conventions (also documented in frontend/contracts/index.ts):
- Perspective: always the HOME team. `home_wp` = P(home team wins). Never the
  possession team (nflverse `wp` is possession-team; we never chart it directly).
- Timing: `home_wp_pre` is BEFORE the snap of this play. `home_wp_post` is the
  next play's pre-snap value; for the last play it is the final result
  (1.0 home win, 0.0 home loss, 0.5 tie).
- `delta_home_wp` = post - pre. `is_swing` = |delta_home_wp| >= `swing_threshold`
  (default 0.08, configurable via ?swing_threshold= or NFL_SIM_SWING_WP_THRESHOLD).
- Overtime: quarter 5 is overtime (`is_overtime`). `game_seconds_elapsed` keeps
  counting past 3600 (3600 + seconds played in OT), so the x-axis never
  rewinds. Regular-season OT is 600 s, postseason OT periods 900 s. A regular-
  season tie ends at 0.5.
- WP quirk flags (Game Story ranking only; the chart still shows every point):
  nflverse `home_wp` is least trustworthy in overtime (it scores some OT
  possessions as sudden death even when the other team is guaranteed a
  possession; e.g. SB LVIII put KC at 1.1% before SF's OT field goal) and in
  the final 120 s before halftime. Each point carries `wp_quirk_reason`:
  "overtime" (quarter 5), "end_of_half" (Q2, ≤120 s left), or
  "low_clock_before_half" (Q4, ≤120 s left), else null. `story_weight` is
  0.0 for end_of_half, 0.5 for overtime and low_clock_before_half, else 1.0.
  `story_swing_play_ids` = swing plays with weight > 0, ranked by
  |delta_home_wp| × story_weight (desc, then play_index). `swing_play_ids` and
  `is_swing` are unchanged (raw, chart use).
- Source: nflverse/nflfastR published `home_wp` (truth_label "historical"
  reference), not this project's model.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

GameResult = Literal["home_win", "away_win", "tie"]
WpQuirkReason = Literal["overtime", "end_of_half", "low_clock_before_half"]


class WinProbabilityPoint(BaseModel):
    play_id: str
    play_index: int = Field(ge=0)
    quarter: int = Field(ge=1, le=5)
    is_overtime: bool
    game_seconds_elapsed: int = Field(ge=0)
    possession_team_id: str | None = None
    description: str | None = None
    home_wp_pre: float = Field(ge=0.0, le=1.0)
    home_wp_post: float = Field(ge=0.0, le=1.0)
    delta_home_wp: float = Field(ge=-1.0, le=1.0)
    is_swing: bool
    is_end_of_half: bool = False
    is_low_clock_before_half: bool = False
    wp_quirk_reason: WpQuirkReason | None = None
    story_weight: float = Field(default=1.0, ge=0.0, le=1.0)


class WinProbabilitySeries(BaseModel):
    game_id: str
    home_team_id: str
    away_team_id: str
    home_score: int | None = None
    away_score: int | None = None
    result: GameResult | None = None
    perspective: Literal["home"] = "home"
    timing: Literal["pre_snap"] = "pre_snap"
    swing_threshold: float = Field(gt=0.0, le=1.0)
    source: Literal["nflverse_reference_home_wp"] = "nflverse_reference_home_wp"
    truth_label: Literal["historical"] = "historical"
    has_overtime: bool
    points: list[WinProbabilityPoint]
    swing_play_ids: list[str]
    story_swing_play_ids: list[str] = Field(default_factory=list)
