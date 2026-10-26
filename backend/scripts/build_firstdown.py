"""Build frontend/lib/firstDownPack.json for the weekly 1st-and-10 "pass or run?" round.

Source: nflverse play-by-play parquet (2019-2025), one file per season:
  python backend/scripts/build_firstdown.py --data <dir with pbp_YYYY.parquet>

Filters: regular season, quarters 1-4, 1st & 10, offense win chance 10%-90%,
a called pass or run (scrambles count as passes), no penalty, kneel, spike or aborted snap.
Plays are picked deterministically (sha1 of game_id-play_id) so the build is repeatable.
"On schedule" is nflverse `success` (the play gained enough to stay ahead of the chains).
"""
import argparse, hashlib, json, pathlib
import pandas as pd

COLS = ["game_id", "play_id", "season", "week", "season_type", "qtr", "time", "down", "ydstogo", "yardline_100",
        "wp", "penalty", "qb_kneel", "qb_spike", "aborted_play", "pass", "rush", "play_type", "success",
        "yards_gained", "posteam", "defteam", "home_team", "away_team", "posteam_score", "defteam_score",
        "touchdown", "interception", "fumble_lost", "first_down", "desc"]
PER_WEEK = 5
WEEKS = 104  # two years of Mondays before any play repeats


def zone(y):
    return "own_deep" if y > 80 else "own" if y > 50 else "opp" if y > 20 else "red_zone"


def score_state(diff):
    return "behind" if diff <= -9 else "ahead" if diff >= 9 else "close"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parents[2] / "frontend/lib/firstDownPack.json"))
    a = ap.parse_args()
    frames = []
    for f in sorted(pathlib.Path(a.data).glob("pbp_20*.parquet")):
        frames.append(pd.read_parquet(f, columns=COLS))
    d = pd.concat(frames)
    d = d[(d.season_type == "REG") & (d.qtr <= 4) & (d.down == 1) & (d.ydstogo == 10)
          & d.wp.between(0.10, 0.90) & (d.penalty != 1) & (d.qb_kneel != 1) & (d.qb_spike != 1)
          & (d.aborted_play != 1) & d.play_type.isin(["pass", "run"]) & d.success.notna()]
    d = d.assign(call=d.play_type, zone=d.yardline_100.map(zone),
                 score=(d.posteam_score - d.defteam_score).map(score_state))
    buckets = {}
    for (z, s, c), g in d.groupby(["zone", "score", "call"]):
        buckets.setdefault(f"{z}|{s}", {})[c] = {"plays": int(len(g)), "on_schedule": round(float(g.success.mean()), 4)}
    league = {c: {"plays": int(len(g)), "on_schedule": round(float(g.success.mean()), 4)} for c, g in d.groupby("call")}
    d = d.assign(key=[hashlib.sha1(f"{g}-{int(p)}".encode()).hexdigest() for g, p in zip(d.game_id, d.play_id)])
    pick = d.sort_values("key").head(PER_WEEK * WEEKS)

    def result(r):
        if r.interception == 1: return "intercepted"
        if r.fumble_lost == 1: return "fumble lost"
        if r.touchdown == 1: return "touchdown"
        if r.call == "pass" and r.yards_gained == 0 and "incomplete" in str(r.desc): return "incomplete"
        y = int(r.yards_gained)
        return f"{'gain' if y >= 0 else 'loss'} of {abs(y)}" + (" and a first down" if r.first_down == 1 else "")

    plays = [{
        "id": f"{r.game_id}-{int(r.play_id)}", "game_id": r.game_id, "season": int(r.season), "week": int(r.week),
        "qtr": int(r.qtr), "clock": str(r.time).lstrip("0") if str(r.time)[:2] != "00" else str(r.time)[1:],
        "yardline_100": int(r.yardline_100), "posteam": r.posteam, "defteam": r.defteam,
        "home_team": r.home_team, "away_team": r.away_team,
        "posteam_score": int(r.posteam_score), "defteam_score": int(r.defteam_score),
        "call": r.call, "on_schedule": bool(r.success == 1), "result": result(r), "desc": r.desc,
        "bucket": f"{r.zone}|{r.score}",
    } for r in pick.itertuples()]
    out = {"schema_version": "firstdown.v1", "source": "nflverse play-by-play 2019-2025 (CC BY 4.0)",
           "filters": "REG, Q1-Q4, 1st & 10, win chance 10-90%, pass or run, no penalty/kneel/spike",
           "per_week": PER_WEEK, "eligible_plays": int(len(d)), "league": league, "buckets": buckets, "plays": plays}
    pathlib.Path(a.out).write_text(json.dumps(out, separators=(",", ":")))
    print(len(d), "eligible;", len(plays), "picked;", league)


if __name__ == "__main__":
    main()
