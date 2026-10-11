from datetime import datetime, timezone

from pydantic import BaseModel, Field

from .enums import DataMode, TruthLabel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Provenance(BaseModel):
    truth_label: TruthLabel
    data_mode: DataMode
    source_id: str
    source_version: str
    model_id: str | None = None
    model_version: str | None = None
    ruleset_id: str = "nfl-standard-v1"
    seed: int | None = None
    snapshot_id: str | None = None
    created_at: datetime = Field(default_factory=_utc_now)
    notes: list[str] = Field(default_factory=list)
