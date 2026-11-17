"""Rebuild every Data Builders lane output from the nflverse pbp parquets and compare bytes with the repo.

Each builder writes into a scratch copy of the committed output (so the frozen guard and the builtAt
stamp see the published file, exactly as a real rebuild would) and the result must be byte-identical.
Run one builder at a time (memory). Prints one line per output file plus its sha256.

Usage: python mining/verify_rebuild.py --pbp-dir DIR [--ref-dir DIR] [--games-dir DIR] [--engine-games-dir DIR] [--only NAME ...]
  DIR holds pbp_<season>.parquet; --ref-dir holds players.parquet, roster_weekly_*.parquet, players.csv.
Exit 1 if any file differs or any builder fails.
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / "mining"

# name -> (builder, [outputs relative to ROOT], extra-args builder(tmp, pbp, ref) -> argv)
SINGLE = {
    "calib": "data/site/calib.json", "comebacks": "data/site/comebacks.json", "era": "data/site/era.json",
    "fakes": "data/site/fakes.json", "fg_rates": "data/site/fg_rates.json",
    "firstdown": "data/site/firstdown.json", "goalline": "data/site/goalline.json",
    "gorates": "data/site/gorates.json", "onthisday": "data/site/onthisday.json",
    "outcomes": "data/site/outcomes.json", "swings": "data/site/swings.json",
    "team_garbage_time": "frontend/lib/teamGarbageTime.json", "team_redzone": "frontend/lib/teamRedzone.json",
    "twopoint": "data/site/twopoint.json", "weather": "data/site/weather.json",
}
DIRS = {"drives": "data/site/drives", "match_charts": "data/site/charts"}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(argv: list[str]) -> tuple[int, str]:
    r = subprocess.run([sys.executable, *argv], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip().splitlines()[-1:] and (r.stdout + r.stderr).strip().splitlines()[-1] or ""


def compare(pairs: list[tuple[Path, Path]], label: str) -> bool:
    ok = True
    for got, want in pairs:
        same = got.exists() and got.read_bytes() == want.read_bytes()
        ok &= same
        print(f"{'IDENTICAL' if same else 'DIFFERS  '} {want.relative_to(ROOT)} sha256={sha(want)[:16]} [{label}]")
    return ok


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbp-dir", required=True)
    ap.add_argument("--ref-dir", default=None)
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--games-dir", default=None, help="games-vN per-game json (swings desc, qb_profiles)")
    ap.add_argument("--engine-games-dir", default=None, help="game files the gorates engine layer was built from")
    ap.add_argument("--engine-games-tag", default="games-v7")
    a = ap.parse_args(argv)
    pbp = sorted(str(p) for p in Path(a.pbp_dir).glob("pbp_*.parquet"))
    want = lambda n: a.only is None or n in a.only  # noqa: E731
    ok = True
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for name, rel in SINGLE.items():
            if not want(name):
                continue
            out = tmp / name / Path(rel).name
            out.parent.mkdir(parents=True)
            shutil.copy(ROOT / rel, out)
            games = ["--games", a.games_dir] if a.games_dir and name == "swings" else []
            if name == "gorates":
                games = ["--games-dir", a.engine_games_dir or a.games_dir or "", "--games-tag", a.engine_games_tag]
            code, last = run([str(M / f"build_{name}.py"), *pbp, "--out", str(out), *games])
            print(f"-- build_{name}: exit {code}: {last}")
            ok &= code == 0 and compare([(out, ROOT / rel)], name)
        for name, rel in DIRS.items():
            if not want(name):
                continue
            out = tmp / name
            shutil.copytree(ROOT / rel, out)
            code, last = run([str(M / f"build_{name}.py"), *pbp, "--out-dir", str(out)])
            print(f"-- build_{name}: exit {code}: {last}")
            files = sorted((ROOT / rel).glob("*.json"))
            extra = sorted(set(p.name for p in out.glob("*.json")) - set(p.name for p in files))
            ok &= code == 0 and not extra and compare([(out / f.name, f) for f in files], name)
        if a.ref_dir and want("kickers"):
            ref = Path(a.ref_dir)
            out = tmp / "kickers.json"
            shutil.copy(ROOT / "data/site/kickers.json", out)
            code, last = run([str(M / "build_kickers.py"), str(ref / "players.parquet"), *pbp, "--out", str(out)])
            print(f"-- build_kickers: exit {code}: {last}")
            ok &= code == 0 and compare([(out, ROOT / "data/site/kickers.json")], "kickers")
        if a.ref_dir and want("player_names"):
            ref = Path(a.ref_dir)
            out = tmp / "player_names.json"
            code, last = run([str(M / "build_player_names.py"), str(ref / "players.parquet"), *pbp, "--out", str(out)])
            print(f"-- build_player_names: exit {code}: {last}")
            ok &= code == 0 and compare([(out, ROOT / "data/site/player_names.json")], "player_names")
        if a.ref_dir and want("qb_profiles"):
            ref = Path(a.ref_dir)
            idx, pdir = tmp / "qbIndex.json", tmp / "players"
            shutil.copy(ROOT / "frontend/lib/qbIndex.json", idx)
            shutil.copytree(ROOT / "frontend/public/data/players", pdir)
            code, last = run([str(M / "build_qb_profiles.py"), *pbp, "--rosters",
                              *sorted(str(p) for p in ref.glob("roster_weekly_*.parquet")),
                              "--players", str(ref / "players.csv"),
                              *(["--games", a.games_dir] if a.games_dir else []), "--index", str(idx), "--players-dir", str(pdir)])
            print(f"-- build_qb_profiles: exit {code}: {last}")
            files = sorted((ROOT / "frontend/public/data/players").glob("*.json"))
            ok &= code == 0 and compare([(idx, ROOT / "frontend/lib/qbIndex.json")], "qb_profiles") and compare(
                [(pdir / f.name, f) for f in files], "qb_profiles")
        if want("fakes_text"):
            code, last = run([str(M / "build_fakes_text.py"), "--check"])
            print(f"-- build_fakes_text --check: exit {code}: {last}")
            ok &= code == 0
    print("ALL IDENTICAL" if ok else "MISMATCH")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
