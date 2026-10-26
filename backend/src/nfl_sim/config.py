from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Phase 1 config skeleton — ingest not run until Phase 2."""

    model_config = SettingsConfigDict(env_prefix="NFL_SIM_", env_file=".env", extra="ignore")

    data_dir: Path = REPO_ROOT / "data"
    duckdb_path: Path = REPO_ROOT / "data" / "canonical" / "nfl.duckdb"
    parquet_dir: Path = REPO_ROOT / "data" / "canonical" / "parquet"
    raw_dir: Path = REPO_ROOT / "data" / "raw"
    # nflreadpy 0.1.x requires Path (not str) for cache_dir
    nflreadpy_cache_dir: Path = REPO_ROOT / ".cache" / "nflreadpy"
    nflreadpy_version: str = "0.1.5"  # minimum supported; pin is >=0.1.5,<0.2
    train_seasons: tuple[int, ...] = (2019, 2020, 2021)
    validate_season: int = 2022
    test_season: int = 2023
    holdout_seasons: tuple[int, ...] = (2024, 2025)
    ingest_seasons: tuple[int, ...] = (2019, 2020, 2021, 2022, 2023, 2024, 2025)
    # Swing play: |delta home WP| >= this (env NFL_SIM_SWING_WP_THRESHOLD)
    swing_wp_threshold: float = 0.08
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    live_provider: str = "demo"


settings = Settings()
