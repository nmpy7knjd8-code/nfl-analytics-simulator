from pydantic import BaseModel, Field

from .enums import League


class GameSummary(BaseModel):
    """Game metadata. Team IDs are nflverse abbreviations (MVP)."""

    game_id: str
    league: League = League.NFL
    season: int = Field(ge=1999, le=2100)
    week: int = Field(ge=0, le=30)
    season_type: str = Field(description="REG or POST")
    game_type: str | None = None
    game_date: str
    home_team_id: str
    away_team_id: str
    roof: str | None = None
    surface: str | None = None
    stadium: str | None = None
    home_opening_kickoff: int | None = Field(
        default=None,
        description="0/1 from source; used to derive receive_2h_ko",
    )
    home_score: int | None = None
    away_score: int | None = None
