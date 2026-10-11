"""Minimal FastAPI app — historical games + ordered plays (Phase 2)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator

from nfl_sim.api.situation_lab import create_situation_lab_router
from nfl_sim.config import REPO_ROOT, settings
from nfl_sim.ingest.project import play_row_to_api_dict
from nfl_sim.store import CanonicalStore

# Trusted EP artifact only — never load caller-supplied paths (pickle RCE).
EP_MODEL_ARTIFACT = REPO_ROOT / "reports" / "ep" / "artifacts" / "ep_model.joblib"
ALLOWED_ROOFS = frozenset({"dome", "outdoors", "closed", "open", "other", "unknown"})


class EpScoreRequest(BaseModel):
    """Pre-play situation for Stage A EP scoring — all fields required, no silent defaults."""

    model_config = ConfigDict(extra="forbid")

    down: int = Field(..., ge=1, le=4)
    distance: int = Field(..., ge=1, le=99)
    yardline_100: int = Field(..., ge=1, le=99)
    half_seconds_remaining: int = Field(..., ge=0, le=3600)
    posteam_timeouts: int = Field(..., ge=0, le=3)
    defteam_timeouts: int = Field(..., ge=0, le=3)
    is_home_possession: bool
    season: int = Field(..., ge=1999, le=2100)
    roof: Literal["dome", "outdoors", "closed", "open", "other", "unknown"]

    @field_validator("roof", mode="before")
    @classmethod
    def normalize_roof(cls, v: object) -> str:
        if v is None:
            raise ValueError("roof is required")
        s = str(v).lower().strip()
        if s not in ALLOWED_ROOFS:
            raise ValueError(f"roof must be one of {sorted(ALLOWED_ROOFS)}")
        return s


@lru_cache(maxsize=1)
def _load_ep_model():
    """Load the configured EP artifact once; never from request input."""
    from nfl_sim.models.ep_model import EPModel

    if not EP_MODEL_ARTIFACT.exists():
        return None
    return EPModel.load(EP_MODEL_ARTIFACT)


def _clean_game(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize pandas/DuckDB nulls for JSON."""
    out: dict[str, Any] = {}
    for k, v in row.items():
        if v is None:
            out[k] = None
        elif hasattr(v, "item"):
            try:
                out[k] = v.item()
            except Exception:
                out[k] = v
        else:
            # pandas NA
            try:
                import pandas as pd

                if pd.isna(v):
                    out[k] = None
                    continue
            except Exception:
                pass
            out[k] = v
    if "league" not in out:
        out["league"] = "NFL"
    if "truth_label" not in out:
        out["truth_label"] = "historical"
    return out


def create_app(store: CanonicalStore | None = None) -> FastAPI:
    app = FastAPI(
        title="NFL Analytics Simulator API",
        version="0.2.0",
        description=(
            "Phase 2: historical 2023 game list and ordered play-by-play replay. "
            "Reference ep/epa/wp are nflverse/nflfastR columns — not models trained here. "
            "Situation Lab (/situation-lab) is an offline analyst UI over fourth-down "
            "compare-transitions — separate from the fan-facing frontend."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(create_situation_lab_router())

    def get_store() -> CanonicalStore:
        return store if store is not None else CanonicalStore()

    @app.get("/health")
    def health() -> dict[str, Any]:
        st = get_store()
        ready = st.path.exists()
        return {
            "status": "ok" if ready else "degraded",
            "duckdb_path": str(st.path),
            "store_ready": ready,
            "phase": 2,
            "scope": "historical_replay_only",
        }

    @app.get("/games")
    def list_games(
        season: int | None = Query(default=2023),
        week: int | None = None,
        season_type: str | None = None,
        limit: int = Query(default=500, ge=1, le=2000),
        offset: int = Query(default=0, ge=0),
    ) -> dict[str, Any]:
        st = get_store()
        try:
            items = st.list_games(
                season=season,
                week=week,
                season_type=season_type,
                limit=limit,
                offset=offset,
            )
            total = st.count_games(season=season, week=week, season_type=season_type)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return {
            "items": [_clean_game(g) for g in items],
            "total": total,
            "limit": limit,
            "offset": offset,
            "truth_label": "historical",
        }

    @app.get("/games/{game_id}")
    def get_game(game_id: str) -> dict[str, Any]:
        st = get_store()
        try:
            game = st.get_game(game_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if game is None:
            raise HTTPException(status_code=404, detail=f"game not found: {game_id}")
        payload = _clean_game(game)
        payload["truth_label"] = "historical"
        return payload

    @app.get("/games/{game_id}/plays")
    def list_plays(
        game_id: str,
        limit: int = Query(default=500, ge=1, le=2000),
        offset: int = Query(default=0, ge=0),
    ) -> dict[str, Any]:
        st = get_store()
        try:
            game = st.get_game(game_id)
            if game is None:
                raise HTTPException(status_code=404, detail=f"game not found: {game_id}")
            rows, total = st.list_plays(game_id, limit=limit, offset=offset)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        plays = [play_row_to_api_dict(r) for r in rows]
        # Ordering guard for clients
        indexes = [p["play_index"] for p in plays]
        if indexes != sorted(indexes):
            raise HTTPException(status_code=500, detail="play ordering invariant violated")
        return {
            "game_id": game_id,
            "items": plays,
            "total": total,
            "limit": limit,
            "offset": offset,
            "truth_label": "historical",
            "reference_disclaimer": (
                "reference.ep / reference.epa / reference.wp are imported nflverse/"
                "nflfastR historical model columns — not predictions from this project."
            ),
        }

    @app.post("/models/ep/score")
    def score_ep(body: EpScoreRequest) -> dict[str, Any]:
        """Score Stage A model EP for a pre-play situation (503 if artifact missing)."""
        import pandas as pd

        from nfl_sim.models.constants import EP_CLASSES

        model = _load_ep_model()
        if model is None:
            raise HTTPException(
                status_code=503,
                detail="EP model artifact missing; run python -m nfl_sim.models train --out ../reports/ep",
            )

        row = pd.DataFrame(
            [
                {
                    "down": body.down,
                    "ydstogo": body.distance,
                    "yardline_100": body.yardline_100,
                    "half_seconds_remaining": body.half_seconds_remaining,
                    "posteam_timeouts_remaining": body.posteam_timeouts,
                    "defteam_timeouts_remaining": body.defteam_timeouts,
                    "posteam": "HOME" if body.is_home_possession else "AWAY",
                    "home_team": "HOME",
                    "season": body.season,
                    "roof": body.roof,
                }
            ]
        )
        try:
            proba = model.predict_proba(row)[0]
            ep = float(model.predict_ep(row)[0])
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="invalid situation for EP scoring") from exc

        meta = getattr(model, "meta", {}) or {}
        artifact_hash = None
        if EP_MODEL_ARTIFACT.exists():
            import hashlib

            artifact_hash = hashlib.sha256(EP_MODEL_ARTIFACT.read_bytes()).hexdigest()

        return {
            "model_ep": ep,
            "proba": {c: float(p) for c, p in zip(EP_CLASSES, proba)},
            "truth_label": "predicted",
            "model_id": "stage_a_sklearn_multinomial_ep",
            "model_meta": {
                "artifact_sha256": artifact_hash,
                "selected_C": meta.get("selected_C", meta.get("C")),
                "train_seasons": meta.get("train_seasons"),
                "train_n": meta.get("train_n"),
                "seed": meta.get("seed"),
            },
        }

    return app


app = create_app()
