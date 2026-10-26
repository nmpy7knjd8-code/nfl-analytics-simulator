#!/usr/bin/env python3
"""Prebuild 1200x675 share cards (Open Graph / X summary_large_image) into frontend/public/og/.

  node --import tsx ../scripts/og/cards_data.ts > cards.json   (from frontend/)
  python3 scripts/og/make_cards.py cards.json

Style per redesign brief Phase 4: black background, white text, one blue line,
"Data: nflverse" and the exact page URL on every card. Nothing is posted anywhere.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "og"
SITE = "nmpy7knjd8-code.github.io/nfl-analytics-simulator"
W, H = 1200, 675
BLUE, WHITE, GREY = (31, 111, 235), (255, 255, 255), (160, 160, 160)
FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf"]
VERB = {"go": "went for it", "fg": "kicked", "punt": "punted"}


def font(size: int):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default(size)


def fit(draw, text, size, maxw=W - 160):
    while size > 20 and draw.textlength(text, font=font(size)) > maxw:
        size -= 2
    return font(size)


def card(name: str, headline: str, sub: str, path: str) -> None:
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((80, 70), "FOURTH & DAILY", font=font(30), fill=GREY)
    d.text((80, 220), headline, font=fit(d, headline, 76), fill=WHITE)
    d.line([(80, 340), (W - 80, 340)], fill=BLUE, width=6)
    if sub:
        d.text((80, 380), sub, font=fit(d, sub, 40), fill=WHITE)
    d.text((80, H - 110), "Data: nflverse", font=font(28), fill=WHITE)
    url = f"{SITE}{path}"
    d.text((80, H - 70), url, font=fit(d, url, 24), fill=GREY)
    out = OUT / f"{name}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, optimize=True)


def pct(x) -> str:
    return f"{round(x * 100)}%"


def main() -> None:
    data = json.load(open(sys.argv[1]))
    card("home", "Would you go for it?", "Real NFL fourth downs, one a day", "/")
    card("daily", "Go, kick, or punt?", "Today's real fourth downs. Make the call.", "/daily/")
    card("games", "Game stories", "Every play's swing in win chance", "/games/")

    sc = data["scenarios"][0]
    ch = {o["id"]: o["winChance"] for o in sc["options"]}
    alt = max((v for k, v in ch.items() if k != "go"), default=None)
    off = sc["situation"]["offense"]
    head = f"If {off} went for it: {pct(alt)} → {pct(ch['go'])}" if alt is not None and "go" in ch else sc["title"]
    card("fourth-down", head, "Win chance for each call", "/fourth-down/")

    for g in data["games"]:
        gid = g["game_id"]
        head = f"{g['away_team_id']} {g.get('away_score', '')} @ {g['home_team_id']} {g.get('home_score', '')}"
        card(f"games/{gid}", " ".join(head.split()), f"Week {g['week']}, {g['season']} · {g['game_date']}", f"/games/{gid}/")

    # Per-situation cards for the brief's /card/{id}/ route (page owned by Product UI).
    for it in data["quiz"]:
        s, v = it["situation"], (it.get("reveal") or {}).get("values") or {}
        hist, pos = it.get("historical_action"), s.get("posteam", "")
        if not v or hist not in v or v.get("go") is None:
            continue
        if hist == "go":
            head = f"{pos} went for it: {pct(v['go'])}"
        else:
            head = f"If {pos} went for it: {pct(v[hist])} → {pct(v['go'])}"
        sub = f"4th & {s.get('distance')} · Q{s.get('qtr')} · {pos} {VERB.get(hist, hist)}"
        card(f"card/{it['id']}", head, sub, f"/card/{it['id']}/")
    print(f"cards written to {OUT}")


if __name__ == "__main__":
    main()
