"""Pre-snap snapshot contract (fixture/demo). Missing field ≠ zero."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Situation fields the feed/fixture must supply — never invented, never user-fallback.
AUTO_SITUATION_FIELDS: frozenset[str] = frozenset(
    {
        "season",
        "season_type",
        "week",
        "game_id",
        "play_id",
        "possession_team_id",
        "defense_team_id",
        "home_team_id",
        "away_team_id",
        "score_differential",
        "posteam_score",
        "defteam_score",
        "posteam_timeouts",
        "defteam_timeouts",
        "receive_2h_ko",
    }
)

# Only these may be supplied via user_fallback when the feed omits them.
USER_FALLBACK_FIELDS: frozenset[str] = frozenset(
    {
        "down",
        "distance",
        "yardline_100",
        "quarter",
        "half_seconds_remaining",
        "game_seconds_remaining",
    }
)

# Optional auto field — may be absent without unsupported-state.
OPTIONAL_SITUATION_FIELDS: frozenset[str] = frozenset({"roof"})


class Freshness(str, Enum):
    PRE_SNAP = "pre_snap"
    IN_PLAY = "in_play"
    STALE = "stale"


class PreSnapProvider(str, Enum):
    """Allowed providers for this stage — never a live vendor claim."""

    FIXTURE = "fixture"
    DEMO = "demo"


class PreSnapSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str = Field(..., min_length=1)
    provider: PreSnapProvider
    snapshot_id: str = Field(..., min_length=1)
    event_timestamp: datetime
    revision: int = Field(..., ge=1)
    freshness: Freshness

    @field_validator("event_timestamp", mode="before")
    @classmethod
    def require_timestamp(cls, v: Any) -> Any:
        if v is None or v == "":
            raise ValueError("event_timestamp is required (missing ≠ default)")
        return v


class PreSnapSituation(BaseModel):
    """Resolved pre-snap fourth-down state after auto + optional user_fallback merge."""

    model_config = ConfigDict(extra="forbid")

    season: int = Field(..., ge=1999, le=2100)
    season_type: str = Field(..., min_length=1)
    week: int = Field(..., ge=1)
    game_id: str = Field(..., min_length=1)
    play_id: float | int | str
    possession_team_id: str = Field(..., min_length=1)
    defense_team_id: str = Field(..., min_length=1)
    home_team_id: str = Field(..., min_length=1)
    away_team_id: str = Field(..., min_length=1)
    down: int = Field(..., ge=1, le=4)
    distance: int = Field(..., ge=1, le=99)
    yardline_100: int = Field(..., ge=1, le=99)
    quarter: int = Field(..., ge=1, le=5)
    half_seconds_remaining: int = Field(..., ge=0)
    game_seconds_remaining: int = Field(..., ge=0)
    score_differential: int
    posteam_score: int = Field(..., ge=0)
    defteam_score: int = Field(..., ge=0)
    posteam_timeouts: int = Field(..., ge=0, le=3)
    defteam_timeouts: int = Field(..., ge=0, le=3)
    receive_2h_ko: int = Field(..., ge=0, le=1)
    roof: str | None = None

    @model_validator(mode="after")
    def check_consistency(self) -> PreSnapSituation:
        if self.home_team_id == self.away_team_id:
            raise ValueError("home_team_id and away_team_id must differ")
        poss = self.possession_team_id
        home = self.home_team_id
        away = self.away_team_id
        if poss not in {home, away}:
            raise ValueError(
                "possession_team_id must equal home_team_id or away_team_id"
            )
        expected_def = away if poss == home else home
        if self.defense_team_id != expected_def:
            raise ValueError(
                f"defense_team_id inconsistent with possession "
                f"(expected {expected_def!r}, got {self.defense_team_id!r})"
            )
        expected_sd = int(self.posteam_score) - int(self.defteam_score)
        if int(self.score_differential) != expected_sd:
            raise ValueError(
                "score_differential must equal posteam_score - defteam_score "
                f"(got {self.score_differential}, expected {expected_sd})"
            )
        if int(self.down) != 4:
            raise ValueError(
                "Situation Lab pre-snap path requires down=4 "
                f"(got {self.down})"
            )
        return self


class UserFallback(BaseModel):
    """Allowlisted time / down / field-position overrides when feed omits them."""

    model_config = ConfigDict(extra="forbid")

    down: int | None = Field(default=None, ge=1, le=4)
    distance: int | None = Field(default=None, ge=1, le=99)
    yardline_100: int | None = Field(default=None, ge=1, le=99)
    quarter: int | None = Field(default=None, ge=1, le=5)
    half_seconds_remaining: int | None = Field(default=None, ge=0)
    game_seconds_remaining: int | None = Field(default=None, ge=0)

    def provided(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key in USER_FALLBACK_FIELDS:
            val = getattr(self, key)
            if val is not None:
                out[key] = val
        return out


class PreSnapSnapshot(BaseModel):
    """Envelope after merge — situation is fully resolved."""

    model_config = ConfigDict(extra="forbid")

    schema_version: str = Field(..., min_length=1)
    source: PreSnapSource
    situation: PreSnapSituation
    field_sources: dict[str, str] = Field(default_factory=dict)

    @field_validator("schema_version")
    @classmethod
    def check_schema(cls, v: str) -> str:
        if v != "pre_snap_snapshot.v1":
            raise ValueError(
                f"unsupported schema_version {v!r}; expected 'pre_snap_snapshot.v1'"
            )
        return v
