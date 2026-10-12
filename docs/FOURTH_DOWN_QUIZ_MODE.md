# Fourth-Down Decision Game — Quiz Mode (MVP)

**Date:** 2026-10-12  
**Product pivot:** Offline quiz first — no live feed.

## What shipped

- Fan demo route: `/quiz` (GitHub Pages: `/demo/quiz/`)
- Auto-start: open → first curated situation + **Go / FG / Punt** on the card (no start gate)
- Scoreboard + SVG field track card (see store reference) over CGI night-field atmosphere
- Scoring reuses Situation Lab / `compare_transition_modes` baked reveals — no duplicated WP math
- Curated pack ≥5 (includes documented LAC@DEN flip)
- Historical Situation Lab + recorded-demo paths unchanged; live feed not enabled

## Play 5 situations

1. Open the quiz URL (or `npm run dev` → `/quiz`)
2. Read the scoreboard / field track
3. Tap **Go**, **Field Goal**, or **Punt** → **Lock in**
4. See Correct / Incorrect / Near-tie + the three model values
5. **Next situation** — repeat through the pack (6 items)

## API (offline FastAPI)

- `GET /situation-lab/api/quiz/pack` — situations without reveal
- `GET /situation-lab/api/quiz/pack/full` — full pack for static clients
- `POST /situation-lab/api/quiz/score` — `{situation_id, choice, session?}`

## Spec

Authoritative product + visual spec lives in the Project store: `docs/FOURTH_DOWN_QUIZ_MODE.md` (includes scoreboard reference image).
