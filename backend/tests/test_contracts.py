"""Minimal Phase 1 contract tests — schema validation only, no outcome logic."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from nfl_sim.contracts import (
    CanonicalPlay,
    GameSituation,
    GameSummary,
    League,
    ModelPrediction,
    PlayType,
    PredictionKind,
    Provenance,
    ReferenceModelColumns,
    SimulationRequest,
    SimulationResult,
    TruthLabel,
)


def _situation(**overrides) -> GameSituation:
    base = dict(
        game_id="2023_01_KC_DET",
        play_id="42",
        season=2023,
        week=1,
        season_type="REG",
        possession_team_id="KC",
        defense_team_id="DET",
        home_team_id="DET",
        away_team_id="KC",
        is_home_possession=False,
        down=3,
        distance=7,
        yardline_100=33,
        quarter=2,
        half_seconds_remaining=320,
        game_seconds_remaining=1220,
        score_differential=3,
        posteam_score=10,
        defteam_score=7,
        posteam_timeouts=2,
        defteam_timeouts=3,
        roof="outdoors",
        receive_2h_ko=1,
        reference_ep=2.1,
        reference_wp=0.55,
    )
    base.update(overrides)
    return GameSituation(**base)


def test_game_summary_defaults_to_nfl():
    g = GameSummary(
        game_id="2023_01_KC_DET",
        season=2023,
        week=1,
        season_type="REG",
        game_date="2023-09-07",
        home_team_id="DET",
        away_team_id="KC",
        roof="dome",
        home_opening_kickoff=1,
    )
    assert g.league is League.NFL
    assert g.season_type == "REG"


def test_pre_play_situation_mvp_fields():
    s = _situation()
    assert s.receive_2h_ko == 1
    assert s.is_home_possession is False
    assert s.half_seconds_remaining == 320
    assert s.reference_ep == 2.1


def test_reference_model_columns_namespaced_on_play():
    p = CanonicalPlay(
        play_id="p1",
        game_id="g1",
        play_index=0,
        quarter=1,
        play_type=PlayType.PASS,
        reference=ReferenceModelColumns(ep=1.5, epa=0.2, wp=0.6),
    )
    assert p.reference.ep == 1.5
    assert p.reference.vegas_wp is None


def test_simulation_request_requires_seed():
    situation = _situation()
    with pytest.raises(ValidationError):
        SimulationRequest(situation=situation)  # type: ignore[call-arg]

    req = SimulationRequest(situation=situation, seed=42, n_paths=10)
    assert req.seed == 42
    assert req.label is TruthLabel.COUNTERFACTUAL


def test_provenance_and_prediction_labels():
    prov = Provenance(
        truth_label=TruthLabel.PREDICTED,
        data_mode="historical",
        source_id="nflverse-pbp",
        source_version="nflreadpy==0.1.5+sha-pending",
        model_id="ep-sklearn-multinomial-v0",
        model_version="0.0.0",
        created_at=datetime.now(timezone.utc),
    )
    pred = ModelPrediction(
        prediction_id="pred-1",
        kind=PredictionKind.EP,
        model_id="ep-sklearn-multinomial-v0",
        model_version="0.0.0",
        game_id="g1",
        values={"ep": 1.2},
        provenance=prov,
    )
    assert pred.truth_label is TruthLabel.PREDICTED


def test_simulation_result_shape():
    req = SimulationRequest(situation=_situation(), seed=7, n_paths=5)
    prov = Provenance(
        truth_label=TruthLabel.COUNTERFACTUAL,
        data_mode="historical",
        source_id="fixture",
        source_version="phase1",
        seed=7,
        model_id="mc-play-transition-v1",
        model_version="unimplemented",
        notes=["Phase 1 contract fixture only — engine not implemented"],
    )
    result = SimulationResult(
        request=req,
        provenance=prov,
        summary={"mean_epa": 0.0},
        distributions={"terminal": []},
    )
    assert result.provenance.seed == 7
