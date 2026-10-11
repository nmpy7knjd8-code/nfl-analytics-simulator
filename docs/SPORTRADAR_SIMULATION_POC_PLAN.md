# Sportradar simulation POC plan (planning only)

**Date:** 2026-10-11  
**Depends on:** Feed evaluation on `main` via PR #17 (`fca789d`)  
**Mode:** Planning / documentation only  
**Docs PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/18  
**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/0278561f6425be650ad87e1975be63263bce3158/docs/NEXT_STEPS_DELTA_SPORTRADAR_POC_PLAN.md

**Approval boundary:** **STOP** — do not start trial, contact vendors, create accounts, incur costs, call Simulation or live APIs, or wire production until explicitly authorized.

Related: [`FEED_EVALUATION.md`](./FEED_EVALUATION.md), [`PRE_SNAP_ADAPTER.md`](./PRE_SNAP_ADAPTER.md), recorded demo on `main`.

---

## 1. Product / API / access tier (from public docs)

### Primary surface for this POC

**Sportradar API Simulations (NFL league replay)** — replay a recorded NFL game as if live, on demand.

| Item | Public doc |
| --- | --- |
| Simulations overview | https://developer.sportradar.com/getting-started/docs/simulations |
| NFL live game retrieval (Boxscore / PBP semantics) | https://developer.sportradar.com/football/docs/nfl-ig-live-game-retrieval |
| Game Boxscore `situation` fields | https://developer.sportradar.com/football/reference/nfl-game-boxscore |
| Game Statistics (timeouts) | https://developer.sportradar.com/football/reference/nfl-game-statistics |
| Push feeds + reconnect pattern | https://developer.sportradar.com/football/docs/nfl-ig-push |
| Push trial note | https://developer.sportradar.com/football/reference/nfl-push-feeds |

### How Simulations work (documented)

1. List recordings: GraphQL `https://playback.sportradar.com/graphql` with `league: "nfl"`  
2. Pick `recordingId` (sample title e.g. “Baltimore Ravens AT Kansas City Chiefs”)  
3. REST: create `sessionId`, poll  
   `https://playback.sportradar.com/replay/nfl/{recordingId}?feed={feed}&contentType=json&sessionId={sessionId}`  
4. Push (optional):  
   `https://playback.sportradar.com/subscribe/{feed}?recording_id={recordingId}`  

**Documented NFL simulation feeds include:** REST `boxscore`, `pbp` (play-by-play), `game` (statistics), `rosters`; Push `events`, `statistics`, `pulse`.

**Auth (Simulations):** public docs state Simulations **do not require an API key**.  
**Auth (live Push):** Push is an add-on; **unavailable in self-issued trial** — sales contact noted in docs. Simulations are the documented path to exercise Push without a Push trial.

### POC tier choice

| Tier | Use in POC |
| --- | --- |
| **Simulations (playback.sportradar.com)** | **In scope** for proof: REST `boxscore` (+ `pbp`/`game` as needed), optional Push `events` |
| Live NFL REST/Push (`api.sportradar.com`, trial/production keys) | **Out of scope** until separate approval after Simulation POC |

**Primary feed for situation mapping:** REST **`boxscore`** (documented `situation`: down, yfd, possession, location/yardline, clock; summary scores/timeouts).  
**Secondary:** REST **`pbp`** for play ids / upsert corrections; REST **`game`** if timeouts only appear there in a given payload shape.

---

## 2. Field map → `pre_snap_snapshot.v1` + adapter validation

Adapter rules (must not change for POC): missing ≠ zero; auto fields never user-fallback; allowlist only via explicit `user_fallback`; `freshness=pre_snap` to score; `in_play`/`stale` → reject; score consistency; down=4 for Lab path.

### 2.1 Source envelope

| Snapshot field | Validation | Sportradar Simulation source (documented) | Transform / gap |
| --- | --- | --- | --- |
| `schema_version` | must be `pre_snap_snapshot.v1` | n/a | Constant |
| `source.source_id` | required | e.g. `sportradar.nfl.simulation` | Constant for POC |
| `source.provider` | today enum `fixture`\|`demo` only | — | **Gap:** POC mapper must emit `demo` (or approved enum extension later); never claim live |
| `source.snapshot_id` | required | boxscore/event id + wall revision, or play `id` | Stable string per emission |
| `source.event_timestamp` | required ISO datetime | Prefer play/event clock stamp if present; else recording-relative time derived from session | Must not invent silent defaults |
| `source.revision` | ≥ 1 | Increment on upsert of same play/situation; or use SR `updated_at` hash | Monotonic per snapshot_id lineage |
| `source.freshness` | `pre_snap`\|`in_play`\|`stale` | Derive: scoreable between-plays → `pre_snap`; during active play entry → `in_play`; age > policy → `stale` | **Our policy**, not an SR field |

### 2.2 Auto situation fields

| Snapshot field | Validation | SR documented field(s) | Transform / gap |
| --- | --- | --- | --- |
| `season` | required | schedule/recording meta / game header | Parse year from recording `scheduled` / game |
| `season_type` | required | game season type if present | Map REG/POST/PRE; default unknown → **unsupported-state** (do not invent) |
| `week` | required | schedule week if present | If absent in simulation payload → **gap** (unsupported-state or session config file — not silent zero) |
| `game_id` | required | `meta.gameId` / game UUID | Map SR UUID → string; optional alias table to nflverse ids later |
| `play_id` | required | PBP play `id` or synthetic sequence from last event | Prefer SR play id; never blank |
| `home_team_id` / `away_team_id` | required, distinct | game home/away alias or id | Normalize to short codes (e.g. `KC`) |
| `possession_team_id` | = home or away | `situation.possession.alias` | Map alias → id |
| `defense_team_id` | other team | derived | `away` if poss=home else `home` |
| `posteam_score` / `defteam_score` | ≥ 0 | summary / score by possession | Orient to possession team |
| `score_differential` | = posteam − defteam | derived | Reject if inconsistent |
| `posteam_timeouts` / `defteam_timeouts` | 0–3 | `remaining_timeouts` in summary/statistics | Orient to possession; if missing → **unsupported-state** (auto, not allowlist) |
| `receive_2h_ko` | 0/1 required auto | **Not documented** on Boxscore situation | **Gap:** derive from first-half kickoff receiver via PBP rules, or fail closed — never invent |

### 2.3 Allowlist fields (prefer feed; else explicit user_fallback)

| Snapshot field | Validation | SR documented field(s) | Transform / gap |
| --- | --- | --- | --- |
| `down` | 1–4; Lab requires 4 to score | `situation.down` | Non-4 → do not score Lab path (expected) |
| `distance` | 1–99 | `situation.yfd` | Direct map |
| `yardline_100` | 1–99, **yards from opponent EZ** | `situation.location.yardline` + `location.alias` | **∂ Critical:** SR yardline is from named team’s goal line; convert to nflfastR-style `yardline_100` |
| `quarter` | 1–5 | game/period / header | Map OT → 5 |
| `half_seconds_remaining` | ≥ 0 | clock string + quarter | Parse `MM:SS` → seconds; compute half remaining |
| `game_seconds_remaining` | ≥ 0 | clock + quarter | Parse → game remaining |

**Adapter alignment:** If SR omits an allowlist field → HTTP/mapper must surface allowlist prompt / `user_fallback` (same as recorded demo). If SR omits an **auto** field → **unsupported-state**, never zero-fill.

### 2.4 Optional

| Field | Notes |
| --- | --- |
| `roof` | Optional in contract; omit unless venue known |

---

## 3. Timestamp capture and E2E delay methodology

Define four clocks (all UTC, ms precision):

| Symbol | Meaning | Capture point |
| --- | --- | --- |
| `T_event` | Provider event time | Prefer SR play/event timestamp or situation clock mapped to absolute time via recording timeline; if only game clock, document as **clock-relative** (not wall E2E) |
| `T_pub` | Provider publication time | SR `updated_at` / message envelope time if present; else **unknown** |
| `T_recv` | Our receipt time | Wall clock when Simulation HTTP/Push chunk arrives in POC harness |
| `T_adapt` | Adapter done | Wall clock after `build_situation_lab_payload_from_snapshot` returns (or reject) |

**Latency metrics (pass/fail inputs):**

* `L_recv = T_recv − T_event` (or vs recording schedule offset if event is relative)  
* `L_e2e = T_adapt − T_event`  
* `L_proc = T_adapt − T_recv`  

**Rules:** Never treat Sportradar’s “2–3s TTL” or “5–10s behind broadcast” as measured E2E. Label vendor claims separately. For Simulations, primary ground truth is the **recording timeline** (playback pace), not TV broadcast.

---

## 4. One-game test scope (small / explicit)

**Game:** one NFL Simulation `recordingId` (choose a recording that lists REST `boxscore` + `pbp`; prefer a game with multiple 4th downs if identifiable from meta/title).

| Step | Action | Expected |
| --- | --- | --- |
| 0 | List recordings (`league=nfl`); select one; create REST session | Session id; feeds listed |
| 1 | Init: first `boxscore` poll → map → snapshot | Valid envelope; `live_feed=false` / provider labeled simulation-demo |
| 2 | Advance: poll until **≥3** distinct situation changes (score and/or clock and/or down-distance) | Snapshots differ; Situation Lab scores when `down=4` + `freshness=pre_snap` |
| 3 | Allowlist stress: strip one allowlist field in a fixture copy of a mapped snapshot | Adapter rejects or requires `user_fallback` (existing behavior) |
| 4 | Stale: emit snapshot with `freshness=stale` (policy) or age past threshold | Reject; **no** prior decision reuse |
| 5 | Invalid: force score_differential ≠ score diff | Reject |
| 6 | Interruption: drop Push (if used) or pause polling; resume + REST catch-up per SR push docs | Gap filled from REST `pbp`/`boxscore`; no silent stale score |
| 7 | Non-4th down situations | Mapper may produce snapshot but Lab path refuses down≠4 (clear error) |

**Out of scope for this one-game POC:** multi-game fan-out, production keys, odds, fan-UI, replacing recorded demo, historical lake changes.

---

## 5. Measurable pass/fail

| Criterion | Pass | Fail |
| --- | --- | --- |
| **Field coverage** | All auto fields populated from SR or documented derive (`receive_2h_ko`); allowlist from SR or explicit fallback | Any auto missing/zero-filled; inventing `receive_2h_ko` |
| **State correctness** | Spot-check ≥5 4th-down snaps: down, yfd, yardline_100 transform, scores, timeouts match SR payload | Wrong orientation of yardline or possession score |
| **Freshness** | Only `pre_snap` scores; `in_play`/`stale` → 400-class reject without `configs` | Scoring stale/in_play; reusing prior configs |
| **Update cadence** | Log inter-update times for situation changes during playback | No meaningful updates after init |
| **Error handling** | Inconsistent/stale/missing auto → clear errors | Silent fill from previous frame |
| **Latency** | Report `L_recv`, `L_e2e`, `L_proc` distributions for scored frames | Missing instrumentation |
| **Contract** | Every scored payload validates as `pre_snap_snapshot.v1` through existing adapter | Forked scorer or second payload shape |
| **Labeling** | Never `live_feed=true`; simulation/demo labeling | Claiming live feed |

---

## 6. Trial access, licensing, pricing, open questions

| Topic | Public evidence | Open question |
| --- | --- | --- |
| **Simulation access** | Docs: no API key for Simulations | Confirm ToS still allows our offline mapper storage of derived snapshots |
| **Live trial key** | Self-issued trial exists for REST; Push not in self-issued trial | Needed only after Simulation POC? |
| **Rate limits** | Live REST TTLs (~2–3s in-progress); Push heartbeats 5s | Simulation poll etiquette / limits undocumented — confirm before load |
| **Licensing** | B2B ToS; marketplace: not official NFL partner | Display vs store vs **derived decision analytics** rights for Simulation + later live |
| **Pricing** | Quote / Order Form; ToS overages | Cost for Realtime NFL if we proceed past Simulation |
| **Storage** | Unknown for Simulation payloads | May we keep golden fixtures from Simulation for CI? |

**Unresolved before any execution:** counsel/product OK on storing Simulation JSON; yardline transform unit tests; `receive_2h_ko` derive spec; whether `provider` enum needs a `sportradar_simulation` value (today only `fixture`/`demo`).

---

## 7. Still missing after a **successful** Simulation trial

Even if §5 all pass:

1. **Production / live access** — Realtime keys, Push add-on, SLA  
2. **Commercial licensing** — signed Order Form for product use (esp. if betting-adjacent later → may force Genius instead)  
3. **Unmeasured live latency/reliability** — Simulation pace ≠ broadcast E2E under load, multi-game Sundays, correction storms  
4. **Official-data gap** — Sportradar is not official NFL; rights risk remains  
5. **Ops** — monitoring, key rotation, reconnect runbooks in production  
6. **Scale** — rate limits / cost at full slate  

---

## 8. Implementation sketch (for later approval — not this turn)

1. Harness (dev-only): Simulation client → mapper → existing `parse_pre_snap_snapshot` / Situation Lab  
2. Do **not** remove recorded demo or historical mode  
3. No odds; no Convention B / EP / WP calibration changes  
4. Ship fixtures captured from Simulation only if license allows  

---

## 9. Approval boundary

| Allowed now | Requires explicit approval later |
| --- | --- |
| This plan + unmerged docs PR | Any Simulation or live HTTP call |
| | Vendor email / account / subscription |
| | Mapper code PR |
| | Storing vendor payloads in repo |

**STOP and wait.**
