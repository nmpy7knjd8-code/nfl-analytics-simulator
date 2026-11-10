"""QA H5/M9: every swing / chart / OT play in frontend/lib/swingPlays.json is a real nflverse pbp row.

Uses the committed pbp slice backend/tests/fixtures/swing_pbp_rows.json, so CI needs no raw data.
"""
import json
from pathlib import Path

from nfl_sim.swing_examples import GAME_IDS, SWING_PLAY_TYPES, build_export

ROOT = Path(__file__).resolve().parents[2]
ROWS = json.loads((ROOT / "backend/tests/fixtures/swing_pbp_rows.json").read_text())
EXPORT = json.loads((ROOT / "frontend/lib/swingPlays.json").read_text())
BY_KEY = {(r["game_id"], r["play_id"]): r for r in ROWS}


def _all_plays():
    for g in EXPORT["games"].values():
        yield from g["swings"]
        yield from g["overtime_plays"]
        yield from g["chart"]


def test_every_exported_play_matches_a_pbp_row():
    n = 0
    for p in _all_plays():
        r = BY_KEY.get((p["game_id"], p["play_id"]))
        assert r, f"{p['game_id']} {p['play_id']} not a pbp row"
        assert (int(r["qtr"]), r["time"], r["desc"]) == (p["qtr"], p["clock"], p["description"]), p
        n += 1
    assert n > 400


def test_export_is_reproducible_from_pbp():
    assert build_export(ROWS) == EXPORT


def test_swings_follow_shared_filter():
    assert set(EXPORT["games"]) == set(GAME_IDS)
    for g in EXPORT["games"].values():
        assert g["swings"]
        for s in g["swings"]:
            assert 1 <= s["qtr"] <= 4 and s["play_type"] in SWING_PLAY_TYPES
            assert "kneels" not in s["description"]


def test_m9_gipson_ot_punt_return_at_9_21():
    ot = EXPORT["games"]["2023_01_BUF_NYJ"]["overtime_plays"]
    assert len(ot) == 1 and ot[0]["qtr"] == 5 and ot[0]["clock"] == "09:21"
    assert "Gipson" in ot[0]["description"] and "TOUCHDOWN" in ot[0]["description"]
    assert ot[0]["home_score_after"] == 22 and ot[0]["away_score_after"] == 16


import re  # noqa: E402

from nfl_sim.play_text import MAX_WORDS  # noqa: E402
from nfl_sim.swing_examples import build_play_lists  # noqa: E402

PLAY_LISTS = {gid: json.loads((ROOT / f"frontend/lib/plays/{gid}.json").read_text()) for gid in GAME_IDS}
BAD_TEXT = re.compile(r"\(Shotgun\)|\(No Huddle|\b\d{1,2}:\d\d\b|\b\d{1,2}-[A-Z]")


def _every_play():
    yield from _all_plays()
    for pl in PLAY_LISTS.values():
        yield from pl["plays"]


def test_play_lists_rebuild_and_match_pbp():
    built = build_play_lists(ROWS)
    for gid, pl in PLAY_LISTS.items():
        assert pl == {"game_id": gid, "plays": built[gid]}
        assert len(pl["plays"]) > 100
        for p in pl["plays"]:
            assert not p["raw_desc"].startswith(("Timeout", "END "))


def test_every_play_fields_match_pbp_and_display_text_is_clean():
    for p in _every_play():
        r = BY_KEY[(p["game_id"], p["play_id"])]
        assert (int(r["qtr"]), r["time"], r["desc"]) == (p["qtr"], p["clock"], p["raw_desc"]), p
        assert p["raw_desc"] == p["description"]
        assert p["down"] == (None if r["down"] is None else int(r["down"]))
        assert p["distance"] == (None if r["ydstogo"] is None else int(r["ydstogo"]))
        t = p["display_text"]
        main = re.sub(r"\s*Penalty on [^:]+: [^.]+\.", "", t) if not t.startswith("Penalty") else t.split(". No play.")[0]
        assert t and len(main.split()) <= MAX_WORDS, t
        assert not BAD_TEXT.search(t), t
        assert p["event"] in ("turnover_on_downs", "interception", "fumble_lost", "touchdown", "field_goal", "punt", "other")


def test_score_before_matches_pbp():
    for p in _every_play():
        r = BY_KEY[(p["game_id"], p["play_id"])]
        if r.get("posteam") and r.get("posteam_score") is not None:
            home_is_pos = r["posteam"] == r["home_team"]
            assert p["home_score_before"] == int(r["posteam_score" if home_is_pos else "defteam_score"]), p
            assert p["away_score_before"] == int(r["defteam_score" if home_is_pos else "posteam_score"]), p
        assert p["home_score_before"] <= p["home_score_after"] and p["away_score_before"] <= p["away_score_after"]


def test_branch_pick_six_display_text():
    sw = {s["play_id"]: s for s in EXPORT["games"]["2023_01_DET_KC"]["swings"]}
    texts = [s["display_text"] for s in sw.values()]
    assert "Brian Branch intercepts Patrick Mahomes and returns it 50 yards for a touchdown." in texts


def test_fourth_down_failed_matches_pbp():
    n = 0
    for p in _every_play():
        r = BY_KEY[(p["game_id"], p["play_id"])]
        want = r.get("down") == 4 and bool(r.get("fourth_down_failed"))
        assert p["fourth_down_failed"] is want, p
        n += want
    assert n >= 3  # Goff 2:33, Mahomes 2:09, Gainwell 9:14 at least


def test_opening_win_chance_is_nflverse_first_real_play():
    # nflverse's published spread-aware pre-snap WP at the opening kickoff (was the no-spread
    # 0.5668 / 0.5668 / 0.5463 before real past plays switched to it).
    expected = {"2023_01_BUF_NYJ": 0.4112, "2023_01_DET_KC": 0.6449, "2023_03_PHI_TB": 0.2754}
    for gid, g in EXPORT["games"].items():
        first = next(r for r in ROWS if r["game_id"] == gid and r.get("play_type") and r.get("time"))
        assert g["opening_home_wp"] == round(first["home_wp"], 4) == expected[gid]
        assert abs(g["opening_home_wp"] + g["opening_away_wp"] - 1) < 1e-9
    # QA H7: BUF (away) opens at 59%, PHI (away) at 72%
    assert round(EXPORT["games"]["2023_01_BUF_NYJ"]["opening_away_wp"] * 100) == 59
    assert round(EXPORT["games"]["2023_03_PHI_TB"]["opening_away_wp"] * 100) == 72


def test_yards_gained_and_return_td_match_pbp():
    for p in _every_play():
        r = BY_KEY[(p["game_id"], p["play_id"])]
        assert p["yards_gained"] == (None if r.get("yards_gained") is None else int(r["yards_gained"])), p
        turnover = bool(r.get("interception") or r.get("fumble_lost"))
        td_by_def = bool(r.get("return_touchdown")) or bool(r.get("td_team") and r.get("posteam") and r["td_team"] != r["posteam"])
        assert p["return_td"] is (turnover and td_by_def), p


def test_branch_pick_six_return_td_and_hall_83_yards():
    def find(gid, qtr, clock):
        return next(p for p in PLAY_LISTS[gid]["plays"] if p["qtr"] == qtr and p["clock"] == clock and p["play_type"] != "no_play")
    assert find("2023_01_DET_KC", 3, "11:04")["return_td"] is True
    assert find("2023_01_BUF_NYJ", 2, "13:02")["yards_gained"] == 83
    gipson = EXPORT["games"]["2023_01_BUF_NYJ"]["overtime_plays"][0]
    assert gipson["return_td"] is False  # punt return, not a turnover


FEED_SHORTHAND = re.compile(r"for -\d|\b-\d+ yards?\b|\byds?\b|\bob\b|Touchback|\b[A-Z]\.[A-Z][a-z]|\bto [A-Z]{2,3} -?\d+\b|from [A-Z]{2,3} \d+")


def _all_exported_plays():
    for g in EXPORT["games"].values():
        yield from g["swings"]
        yield from g["overtime_plays"]
        yield from g["chart"]
    for pl in PLAY_LISTS.values():
        yield from pl["plays"]


def test_no_exported_play_has_empty_display_text():
    plays = list(_all_exported_plays())
    assert plays and all((p.get("display_text") or "").strip() for p in plays)
    ot = EXPORT["games"]["2023_01_BUF_NYJ"]["overtime_plays"]
    assert ot and all(p["display_text"].strip() for p in ot)


def test_no_display_text_uses_feed_shorthand():
    for p in _all_exported_plays():
        assert not FEED_SHORTHAND.search(p["display_text"]), (p["play_type"], p["display_text"])


def _texts(gid):
    return {p["display_text"] for p in PLAY_LISTS[gid]["plays"]}


def test_kickoff_kneel_penalty_text_reads_plainly():
    bn, dk = _texts("2023_01_BUF_NYJ"), _texts("2023_01_DET_KC")
    assert "Harrison Butker kicks off for a touchback." in dk
    assert "Tyler Bass kicks off 61 yards, and Xavier Gipson returns it 18 yards." in bn
    assert "Zach Wilson kneels for a loss of 1 yard." in bn
    assert "Jared Goff kneels for a loss of 1 yard." in dk
    assert "Penalty on Spencer Brown (BUF): false start, 5 yards. No play." in bn
    assert "Josh Allen spikes the ball to stop the clock." in bn
    assert "Zach Wilson completes a pass to Garrett Wilson for a loss of 2 yards." in bn


def _both(p):
    return " ".join(x for x in (p["display_text"], p.get("penalty_text")) if x)


def test_every_penalty_in_raw_desc_is_mentioned():
    from nfl_sim.play_text import penalty_clauses
    for p in _all_exported_plays():
        if re.search(r"penalty on", p["raw_desc"], re.I):
            clauses = penalty_clauses({"desc": p["raw_desc"]})
            assert clauses, p["raw_desc"]
            for _t, _n, foul, _res in clauses:
                assert foul in _both(p), (p["raw_desc"], _both(p))
        else:
            assert p.get("penalty_text") is None


def test_penalty_text_is_separate_except_on_no_play_rows():
    for p in _all_exported_plays():
        if p["display_text"].endswith("No play.") or " No play. " in p["display_text"]:
            assert p["penalty_text"] is None
        if p["penalty_text"]:
            assert not FEED_SHORTHAND.search(p["penalty_text"]), p["penalty_text"]
            assert "Penalty on" not in p["display_text"] and "offsetting" not in p["display_text"]


def _pen(gid):
    return {(p["display_text"], p["penalty_text"]) for p in PLAY_LISTS[gid]["plays"]}


def test_phi_tb_kickoff_offside_penalty_sentence():
    assert ("Jake Camarda kicks off 78 yards, and Britain Covey returns it 30 yards.",
            "Penalty on Derrek Pitts (TB): offside on kickoff, 5 yards against TB.") in _pen("2023_03_PHI_TB")


def test_every_real_play_carries_the_chart_wp_and_a_fallback_flag():
    for gid, g in EXPORT["games"].items():
        chart = {c["play_id"]: c for c in g["chart"]}
        plays = json.loads((ROOT / "frontend/lib/plays" / f"{gid}.json").read_text())["plays"]
        for p in plays:
            if p["play_id"] in chart:
                c = chart[p["play_id"]]
                assert (p["home_wp_pre"], p["home_wp_post"], p["wp_fallback"]) == (
                    c["home_wp_pre"], c["home_wp_post"], c["wp_fallback"])


def test_exports_never_name_the_odds_source():
    import re
    for f in [ROOT / "frontend/lib/swingPlays.json", *sorted((ROOT / "frontend/lib/plays").glob("*.json"))]:
        assert not re.search(r"vegas|spread|odds|betting|moneyline", f.read_text(), re.I), f


def test_qa_m14_at_kickoff_is_nflverse_vegas_home_wp():
    # QA M14: 'At kickoff' = nflverse vegas_home_wp on the first real play (NYJ 41.1%, KC 64.5%, TB 27.5%).
    want = {"2023_01_BUF_NYJ": 41.1, "2023_01_DET_KC": 64.5, "2023_03_PHI_TB": 27.5}
    for gid, pct in want.items():
        g = EXPORT["games"][gid]
        assert round(g["opening_home_wp"] * 100, 1) == pct
        first = next(r for r in ROWS if r["game_id"] == gid and r.get("play_type") and r.get("time"))
        assert first["wp_fallback"] is False  # nflverse value, not our model
        assert not any(k for k in g if "spread" in k or "odds" in k or "line" in k.split("_"))


def test_offsetting_declined_and_accepted_penalty_wording():
    assert ("David Montgomery is stopped for no gain.", "Offsetting penalties: unnecessary roughness on "
            "Halapoulivaati Vaitai (DET) and Matt Dickerson (KC).") in _pen("2023_01_DET_KC")
    assert ("Zach Wilson pass incomplete.", "Two NYJ flags declined: offensive pass interference (Jeremy Ruckert) "
            "and ineligible downfield pass (Connor McGovern).") in _pen("2023_01_BUF_NYJ")
    assert ("Jared Goff completes a pass to Sam LaPorta for 12 yards.",
            "Flag on L'Jarius Sneed (KC) for defensive holding, declined.") in _pen("2023_01_DET_KC")
    assert ("Matt Milano intercepts Zach Wilson and returns it 13 yards.",
            "Penalty on Matt Milano (BUF): taunting, 15 yards against BUF.") in _pen("2023_01_BUF_NYJ")


def test_mixed_offsetting_fouls_named_separately():
    from nfl_sim.play_text import penalty_sentences
    assert penalty_sentences([("DET", "A B", "holding", "offsetting"), ("KC", None, "face mask", "offsetting")]) == (
        "Offsetting penalties: holding on A B (DET) and face mask on KC. The down is replayed.")


def _by_id(gid, pid):
    return next(p for p in PLAY_LISTS[gid]["plays"] if p["play_id"] == pid)


def test_qa_2315_sentences():
    assert _by_id("2023_03_PHI_TB", "2938")["display_text"] == "Rachaad White is tackled in the end zone for a safety."
    assert _by_id("2023_03_PHI_TB", "3507")["display_text"] == (
        "Two-point try: Baker Mayfield passes to Chris Godwin Jr., and it's good.")
    assert _by_id("2023_01_BUF_NYJ", "2151")["display_text"] == (
        "Breece Hall is stopped for a loss of 4 yards. He fumbles out of bounds; NYJ keeps the ball.")
    assert _by_id("2023_01_DET_KC", "1273")["display_text"] == (
        "Botched snap: Frank Ragnow fumbles, and Jared Goff recovers at KC 27, a loss of 10 yards.")
    assert _by_id("2023_03_PHI_TB", "1987")["display_text"] == (
        "Baker Mayfield is sacked for a loss of 11 yards. He fumbles, and Robert Hainsey recovers.")


def test_two_point_failure_reads_as_failed_try():
    from nfl_sim.play_text import display_text
    r = {"play_type": "pass", "two_point_conv_result": "failure", "desc": "TWO-POINT CONVERSION ATTEMPT. x",
         "names": {"passer": "Jalen Hurts", "receiver": "A.J. Brown"}}
    assert display_text(r) == "Two-point try: Jalen Hurts passes to A.J. Brown, and it fails."


def test_kick_return_td_separate_from_turnover_return_td():
    ot = _by_id("2023_01_BUF_NYJ", "4010")
    assert ot["kick_return_td"] is True and ot["return_td"] is False
    # Overtime cards carry no WP fields (home_wp_pre/post, wp_fallback live only in the play lists).
    assert any(o.items() <= ot.items() and o["play_id"] == "4010"
               for o in EXPORT["games"]["2023_01_BUF_NYJ"]["overtime_plays"])
    assert _by_id("2023_01_DET_KC", "2364")["return_td"] is True and _by_id("2023_01_DET_KC", "2364")["kick_return_td"] is False
    for p in _all_exported_plays():
        assert not (p["return_td"] and p["kick_return_td"])
        if p["kick_return_td"]:
            assert p["play_type"] in ("punt", "kickoff")
