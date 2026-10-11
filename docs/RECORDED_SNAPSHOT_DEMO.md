# Recorded snapshot demo provider

**Date:** 2026-10-11  
**Depends on:** PR #15 pre-snap adapter on `main` (`17cfb4d`)  
**Branch:** `cursor/recorded-snapshot-demo-c0ef` @ `6b6b3fd`
**Stage 2 PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/16
**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/6b6b3fd7d4c5a85c34b53da82f603edd35995cd7/docs/NEXT_STEPS_DELTA_RECORDED_DEMO.md  
**Scope:** Offline deterministic sequence of `pre_snap_snapshot.v1` frames → existing adapter → Situation Lab.

## What it is

A **demo** provider that reads a committed recorded sequence and advances frame-by-frame (select/next). Same payload contract as a future live provider — labeled `recorded_demo` / `provider=demo`, **`live_feed=false`**.

Bundled sequence: `lac-den-q4-demo`

| Frame | Expected | Notes |
| --- | --- | --- |
| 0 | scoreable | Earlier Q4 4th&3, tied score |
| 1 | scoreable | Score/clock changed → flip state (inconclusive→punt) |
| 2 | needs `user_fallback` | Allowlist fields omitted |
| 3 | reject | `freshness=stale` |
| 4 | reject | Inconsistent `score_differential` |

Rejected frames return HTTP 400 with **no** prior decision payload. UI clears the decision surface on reject/advance.

## Run

```bash
cd backend && python3 -m nfl_sim.api
# open http://127.0.0.1:8000/situation-lab
# Mode → Recorded demo (offline) → Score / Next
```

API:

* `GET /situation-lab/api/recorded-demo/sequences`
* `GET /situation-lab/api/recorded-demo/{sequence_id}`
* `GET /situation-lab/api/recorded-demo/{sequence_id}/frame/{index}`
* `POST …/frame/{index}` with `{ "user_fallback": … }` or `{ "apply_suggested_fallback": true }`

Historical `GET /situation-lab/api/compare` unchanged and still selectable in the UI.

## Layman “why”

Payload includes `layman_why`: one plain-English line derived from existing improved-config recommendation / margin / values — **no new scorer logic**. Richer explainers are a follow-up, not this PR.

## Code

* `backend/src/nfl_sim/providers/recorded_demo.py`
* `backend/src/nfl_sim/providers/fixtures/recorded_demo/lac_den_q4_sequence.json`
* `backend/src/nfl_sim/api/situation_lab.py` + `static/situation_lab.html`
* Tests: `backend/tests/test_recorded_demo.py`

## Non-goals

Real feed/network, odds, betting, fan-UI, Convention B, EP promote, isotonic, merge without approval.

## Gap to a real live feed

Need a feed that reliably supplies auto fields (ids, teams, scores, timeouts, `receive_2h_ko`) with trustworthy timestamps/freshness at usable latency; allowlist prompts only when clock/down/yardline are missing. **Do not wire a vendor yet** — evaluate candidates first (coverage, cadence/latency, reliability, licensing, integration).
