# Pre-snap adapter — Situation Lab payload contract

**Date:** 2026-10-11  
**Depends on:** PR #14 Situation Lab on `main` (`b0e6ea8`)  
**Branch:** `cursor/pre-snap-adapter-c0ef` @ `19b4c2b`  
**Stage 2 PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/15  
**Scope:** Thin **fixture/demo** pre-snap adapter → same Situation Lab payload shape.  
**Non-goals:** Real live vendor, odds, betting, fan-UI changes, silent lake fill.

**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/19b4c2bff93eb3436b78d9c85a6be4e8a7a0d184/docs/NEXT_STEPS_DELTA_PRE_SNAP_ADAPTER.md

This document locks the **payload contract first**. Implementation must conform; do not invent a second response shape.

---

## 1. Situation Lab response payload (locked)

Produced today by `build_situation_lab_payload(season, game_id, play_id)` and by the pre-snap adapter after validation. Top-level keys:

| Key | Type | Notes |
| --- | --- | --- |
| `truth_labels` | object | Epistemic labels — see §1.1 |
| `play` | object | Frozen play — see §1.2 |
| `configs` | object | Three scored configs — see §1.3 |
| `recommendation_changed_legacy_to_improved` | bool | Legacy vs improved rec differ |
| `value_deltas_legacy_to_improved` | object | `{go, fg, punt}` floats (improved − legacy) |
| `clock_deltas_improved` | object \| null | Outcome clock seconds used by improved |
| `wp_model` | string | Trusted artifact path |
| `offline` | bool | Always `true` for this stage |
| `live_feed` | bool | Always `false` — adapter **never** claims a live feed |
| `source` | object \| null | Present for pre-snap path only — see §1.4 |
| `field_sources` | object \| null | Pre-snap: each situation field → `snapshot` \| `user_fallback` (§2.6) |

Historical lake path may omit `source`, `live_feed`, and `field_sources` (treat missing `live_feed` as false). Pre-snap path **must** set `source` + `live_feed`; should set `field_sources`.

### 1.1 `truth_labels`

| Field | Historical path | Pre-snap fixture path |
| --- | --- | --- |
| `play` | `"historical"` | `"pre_snap_fixture"` |
| `action_values` | `"model_counterfactual"` | `"model_counterfactual"` |
| `disclaimer` | Offline estimate — not live odds… | Offline estimate from **pre-snap snapshot fixture** — **not a live feed**, not odds… |

### 1.2 `play`

| Field | Type | Notes |
| --- | --- | --- |
| `provenance` | object | Ids + teams (+ optional description). Pre-snap: no silent outcome fill |
| `situation` | object | `FourthDownSituation` fields (yardline_100, distance, clocks, timeouts, …) |
| `game_state` | object | Frozen pre-snap state (down=4, kick_distance_if_fg, …) |
| `historical_action` | `"go"` \| `"fg"` \| `"punt"` \| null | Observation only. Pre-snap fixture: usually `null` |
| `truth` | string | `"historical"` or `"pre_snap_fixture"` |

### 1.3 `configs`

Keys (exactly these three):

* `pooled_legacy`
* `season_aware_legacy`
* `pooled_improved`

Each value is a **summary** object (not raw analyzer dump):

| Field | Type |
| --- | --- |
| `recommendation` | string \| null |
| `inconclusive` | bool |
| `margin` | float |
| `values` | `{go, fg, punt}` |
| `p_convert` / `p_make` | float |
| `empirics_mode` / `transition_mode` | string |
| `clock_deltas_used` | object \| null |
| `empirics_seasons` / `empirics_n` | list / object |
| `assumptions` | list |
| `punt_method` / `punt_buckets` / `opp_yardline_100_mean` | punt meta |

Scoring **reuses** `compare_transition_modes` — adapter must not reimplement go/FG/punt math.

### 1.4 `source` (pre-snap only)

| Field | Type | Required |
| --- | --- | --- |
| `source_id` | string | yes |
| `provider` | `"fixture"` \| `"demo"` | yes — never `"live"` / vendor ids in this stage |
| `snapshot_id` | string | yes |
| `event_timestamp` | string (ISO-8601 UTC) | yes |
| `revision` | int (≥ 1) | yes |
| `freshness` | `"pre_snap"` \| `"in_play"` \| `"stale"` | yes — only `pre_snap` may score |

---

## 2. Input: `pre_snap_snapshot.v1`

Adapter input is a JSON object (file fixture or POST body). **Missing required field ≠ zero / default.** Reject with a clear error naming the field.

### 2.1 Envelope

| Field | Type | Required |
| --- | --- | --- |
| `schema_version` | `"pre_snap_snapshot.v1"` | yes |
| `source` | object (§1.4 fields) | yes |
| `situation` | object (§2.2; auto fields required; user-fallbackable may be omitted if `user_fallback` supplies them — see §2.6) | yes |
| `user_fallback` | object | no — allowlisted time/down/field-position only (§2.6) |

### 2.2 `situation` required fields

| Field | Type | Constraints |
| --- | --- | --- |
| `season` | int | 1999–2100 |
| `season_type` | string | e.g. `REG` |
| `week` | int | ≥ 1 |
| `game_id` | string | non-empty |
| `play_id` | number \| string | present (identity) |
| `possession_team_id` | string | must equal `home_team_id` or `away_team_id` |
| `defense_team_id` | string | other side of possession |
| `home_team_id` / `away_team_id` | string | non-empty, distinct |
| `down` | int | must be `4` for Situation Lab fourth-down path |
| `distance` | int | 1–99 |
| `yardline_100` | int | 1–99 |
| `quarter` | int | 1–5 |
| `half_seconds_remaining` | int | ≥ 0 |
| `game_seconds_remaining` | int | ≥ 0 |
| `score_differential` | int | **must equal** `posteam_score − defteam_score` |
| `posteam_score` / `defteam_score` | int | ≥ 0 |
| `posteam_timeouts` / `defteam_timeouts` | int | 0–3 |
| `receive_2h_ko` | int | 0 or 1 — **required always** (never inferred silently) |

Optional: `roof` (string). **Forbidden** in this stage: odds, spreads, `vegas_wp`, vendor live payloads.

### 2.3 Consistency rejects (non-exhaustive)

* `score_differential != posteam_score - defteam_score`
* `possession_team_id` not in `{home, away}`
* `defense_team_id` equals possession or not the opposite team
* `home_team_id == away_team_id`
* `freshness` ∈ {`in_play`, `stale`} → reject scoring (clear error; do not score as if pre-snap)
* `provider` claiming live/vendor in this stage
* `schema_version` mismatch

### 2.4 Freshness semantics

| Value | Meaning | Adapter action |
| --- | --- | --- |
| `pre_snap` | Ball not yet snapped; state is decision-ready | Validate + score |
| `in_play` | Play underway / incomplete state | **Reject** — do not score |
| `stale` | Snapshot older than caller/policy allows | **Reject** — do not score |

Stale ≠ simulated. In-play ≠ pre-snap. Never coerce.

### 2.5 No silent historical fill

* Adapter **must not** open the lake to fill missing snapshot fields.
* Adapter **must not** copy `play_type` / conversion / kick results from history into a pre-snap snapshot.
* Sample fixtures may **mirror** a known lake situation’s *pre-snap state* for regression, but remain self-contained JSON.

### 2.6 Auto-from-feed vs user-fallback (live-path contract)

Real-time decisions need current game variables. **Most fields auto-populate from the snapshot/feed.** The user supplies only a small allowlist when the feed cannot. **Never silently invent** a missing live field — either apply an explicit `user_fallback` value or return a clear **unsupported-state** error naming the field.

#### Auto-from-snapshot (feed / fixture must supply — not user-invented)

| Field | Why auto |
| --- | --- |
| `season`, `season_type`, `week` | Game identity |
| `game_id`, `play_id` | Stable ids / revision keying |
| `possession_team_id`, `defense_team_id`, `home_team_id`, `away_team_id` | Roster / possession from feed |
| `posteam_score`, `defteam_score`, `score_differential` | Scoreboard (diff must match scores) |
| `posteam_timeouts`, `defteam_timeouts` | Official timeout clocks |
| `receive_2h_ko` | Derived once per half from feed rules — never guessed |
| `roof` (optional) | Venue from feed when known |
| Entire `source` block | Provider provenance / freshness |

Missing any auto field → **unsupported-state** (HTTP 400). Do **not** zero-fill, lake-fill, or ask the user to type team/score/timeout identity in the MVP live path.

#### User-fallback allowlist (only when feed omits)

These are the **only** situation fields a caller may supply via top-level `user_fallback` when absent from `situation`:

| Field | Group | Notes |
| --- | --- | --- |
| `down` | down | Lab path still requires final value `4` |
| `distance` | down / to-go | 1–99 |
| `yardline_100` | field position | 1–99, possession orientation |
| `quarter` | time | 1–5 |
| `half_seconds_remaining` | time | ≥ 0 |
| `game_seconds_remaining` | time | ≥ 0 |

Rules:

1. If the snapshot already has the field → **use snapshot** (user_fallback for that key ignored or rejected as conflict — prefer reject on conflict).  
2. If missing from snapshot and present in `user_fallback` → use user value; record `field_sources[field]="user_fallback"`.  
3. If missing from both → **unsupported-state** naming the field (not a silent default).  
4. Fixture stage may still ship **complete** snapshots (all fields auto); `user_fallback` is optional and used for partial-feed tests / future live UX.  
5. `user_fallback` must not contain auto-only keys (teams, scores, timeouts, ids, …).

#### Response `field_sources` (pre-snap path)

Optional object mapping each scored situation field → `"snapshot"` \| `"user_fallback"`. Fixtures with full situation → all `"snapshot"`.

Envelope with fallback:

```json
{
  "schema_version": "pre_snap_snapshot.v1",
  "source": { "...": "..." },
  "situation": { "...auto fields...": "..." },
  "user_fallback": {
    "down": 4,
    "distance": 14,
    "yardline_100": 64,
    "quarter": 4,
    "half_seconds_remaining": 207,
    "game_seconds_remaining": 207
  }
}
```

---

## 3. Determinism

Same validated snapshot bytes → same `configs` recommendations/values (given same WP artifact + empirics). Provenance/`source` echo the snapshot; they do not float with wall clock except where `event_timestamp` is supplied by the fixture.

---

## 4. API surface (implemented)

* `GET /situation-lab/api/compare` — historical lake path unchanged.
* `GET /situation-lab/api/fixtures` — list bundled pre-snap fixtures.
* `POST /situation-lab/api/compare-pre-snap` — body = `pre_snap_snapshot.v1`.
* `GET /situation-lab/api/compare-pre-snap?fixture_id=…` — load bundled fixture.

### Code

* `backend/src/nfl_sim/contracts/pre_snap.py` — pydantic snapshot contract  
* `backend/src/nfl_sim/providers/pre_snap.py` — validate / map / load fixtures  
* `backend/src/nfl_sim/providers/fixtures/pre_snap/flip_lac_den_pre_snap.json`  
* `backend/src/nfl_sim/api/situation_lab.py` — `build_situation_lab_payload_from_snapshot`  
* Tests: `backend/tests/test_pre_snap_adapter.py`

HTML fixture picker deferred; **no** fan-UI changes.

---

## 5. Sample fixture

Bundled: `flip-lac-den-pre-snap` — LAC@DEN 2022 W18 4th & 14 @ 64 (same pre-snap state as documented Situation Lab flip). Expect:

* `recommendation_changed_legacy_to_improved == true`
* pooled_legacy → inconclusive; pooled_improved → punt  
* `truth_labels.play == "pre_snap_fixture"`; `live_feed == false`

---

## 6. Tests (acceptance)

1. Valid fixture → deterministic payload (configs + flip assertions).  
2. Missing required field → reject; not zero-filled.  
3. Inconsistent score differential → reject.  
4. `freshness=in_play` → reject.  
5. `freshness=stale` → reject.  
6. Response never sets `live_feed=true` / never labels play as live.  
7. Historical `/compare` still returns flip for lake ids.  
8. E2E: fixture_id → Situation Lab payload via API.  
9. Partial situation + `user_fallback` for time/down/yardline → scores; `field_sources` marks user keys.  
10. Missing auto field (e.g. timeouts) → unsupported-state even if user_fallback tries to supply it.  
11. Conflict: snapshot and user_fallback both set same allowlist key → reject.

---

## 7. What still blocks a real live feed

* Authorized provider + credentials / ToS  
* Freshness policy clock + revision handling under churn  
* Milestone D-style decision validation gate before live recommendations  
* Mapping every vendor field → this snapshot (see §8)  
* No odds features in WP path  

**Single best next step after this PR:** wire a **demo** provider descriptor that emits `pre_snap_snapshot.v1` from recorded frames (still offline), then expand flip-coverage — still no paid vendor.

---

## 8. Fields a real feed must supply

Everything in §2.2 plus durable `source_id` / `snapshot_id` / `event_timestamp` / `revision` / `freshness`. Especially easy to get wrong: timeouts, `receive_2h_ko`, score differential sign (possession view), yardline_100 orientation, and not emitting in-play frames as pre-snap.
