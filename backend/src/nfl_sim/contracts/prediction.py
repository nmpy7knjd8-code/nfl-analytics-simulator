from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from .enums import TruthLabel
from .provenance import Provenance, _utc_now


class PredictionKind(str, Enum):
    EP = "ep"
    EPA = "epa"
    WP = "wp"
    CP = "cp"
    FOURTH_DOWN = "fourth_down"
    OTHER = "other"


class ModelPrediction(BaseModel):
    """A single model output attached to a situation or play — not an observation."""

    prediction_id: str
    kind: PredictionKind
    model_id: str
    model_version: str
    game_id: str
    play_id: str | None = None
    truth_label: TruthLabel = TruthLabel.PREDICTED
    values: dict[str, float | None] = Field(default_factory=dict)
    provenance: Provenance
    created_at: datetime = Field(default_factory=_utc_now)
