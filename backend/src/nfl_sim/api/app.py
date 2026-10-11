"""Minimal FastAPI app — historical games + ordered plays (Phase 2)."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from nfl_sim.config import settings
from nfl_sim.ingest.project import play_row_to_api_dict
from nfl_sim.store import CanonicalStore


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
            "Reference ep/epa/wp are nflverse/nflfastR columns — not models trained here."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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

    return app


app = create_app()
