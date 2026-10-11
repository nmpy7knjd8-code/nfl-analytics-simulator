"""DuckDB + Parquet canonical store."""

from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd

from nfl_sim.config import Settings, settings


def write_canonical_parquet(
    games: pd.DataFrame,
    plays: pd.DataFrame,
    *,
    season: int,
    parquet_dir: Path,
    overwrite: bool = True,
) -> tuple[Path, Path]:
    games_path = parquet_dir / "games" / f"season={season}" / "games.parquet"
    plays_path = parquet_dir / "plays" / f"season={season}" / "plays.parquet"
    games_path.parent.mkdir(parents=True, exist_ok=True)
    plays_path.parent.mkdir(parents=True, exist_ok=True)
    if overwrite or not games_path.exists():
        games.to_parquet(games_path, index=False)
    if overwrite or not plays_path.exists():
        plays.to_parquet(plays_path, index=False)
    return games_path, plays_path


def build_duckdb(
    *,
    games_glob: str,
    plays_glob: str,
    duckdb_path: Path,
    manifests_dir: Path | None = None,
) -> Path:
    duckdb_path.parent.mkdir(parents=True, exist_ok=True)
    if duckdb_path.exists():
        duckdb_path.unlink()
    wal = Path(str(duckdb_path) + ".wal")
    if wal.exists():
        wal.unlink()

    con = duckdb.connect(str(duckdb_path))
    try:
        con.execute(
            f"""
            CREATE OR REPLACE VIEW games AS
            SELECT * FROM read_parquet('{games_glob}')
            """
        )
        con.execute(
            f"""
            CREATE OR REPLACE VIEW plays AS
            SELECT * FROM read_parquet('{plays_glob}')
            """
        )
        # Materialize small summary for fast list endpoint
        con.execute(
            """
            CREATE OR REPLACE TABLE game_list AS
            SELECT
              game_id,
              season,
              week,
              season_type,
              game_date,
              home_team_id,
              away_team_id,
              home_score,
              away_score,
              roof,
              truth_label
            FROM games
            ORDER BY season, week, game_id
            """
        )
        con.execute("CHECKPOINT")
    finally:
        con.close()
    return duckdb_path


class CanonicalStore:
    """Read-only query helper over the DuckDB file."""

    def __init__(self, cfg: Settings | None = None):
        self.cfg = cfg or settings
        self._path = self.cfg.duckdb_path

    @property
    def path(self) -> Path:
        return self._path

    def connect(self) -> duckdb.DuckDBPyConnection:
        if not self._path.exists():
            raise FileNotFoundError(
                f"DuckDB store missing at {self._path}. Run: python -m nfl_sim.ingest"
            )
        return duckdb.connect(str(self._path), read_only=True)

    def list_games(
        self,
        *,
        season: int | None = None,
        week: int | None = None,
        season_type: str | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> list[dict]:
        clauses: list[str] = []
        params: list[object] = []
        if season is not None:
            clauses.append("season = ?")
            params.append(season)
        if week is not None:
            clauses.append("week = ?")
            params.append(week)
        if season_type is not None:
            clauses.append("season_type = ?")
            params.append(season_type)
        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = f"""
            SELECT *
            FROM game_list
            {where}
            ORDER BY season, week, game_id
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        with self.connect() as con:
            return con.execute(sql, params).fetchdf().to_dict(orient="records")

    def count_games(
        self,
        *,
        season: int | None = None,
        week: int | None = None,
        season_type: str | None = None,
    ) -> int:
        clauses: list[str] = []
        params: list[object] = []
        if season is not None:
            clauses.append("season = ?")
            params.append(season)
        if week is not None:
            clauses.append("week = ?")
            params.append(week)
        if season_type is not None:
            clauses.append("season_type = ?")
            params.append(season_type)
        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        with self.connect() as con:
            return int(con.execute(f"SELECT COUNT(*) FROM game_list{where}", params).fetchone()[0])

    def get_game(self, game_id: str) -> dict | None:
        with self.connect() as con:
            df = con.execute(
                "SELECT * FROM games WHERE game_id = ? LIMIT 1",
                [game_id],
            ).fetchdf()
        if df.empty:
            return None
        return df.iloc[0].to_dict()

    def list_plays(
        self,
        game_id: str,
        *,
        limit: int = 500,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        with self.connect() as con:
            total = int(
                con.execute(
                    "SELECT COUNT(*) FROM plays WHERE game_id = ?",
                    [game_id],
                ).fetchone()[0]
            )
            df = con.execute(
                """
                SELECT * FROM plays
                WHERE game_id = ?
                ORDER BY play_index ASC, play_id ASC
                LIMIT ? OFFSET ?
                """,
                [game_id, limit, offset],
            ).fetchdf()
        return df.to_dict(orient="records"), total
