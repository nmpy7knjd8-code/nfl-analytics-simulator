# Sportradar Simulation — execution checklist (authorization gate)

**Date:** 2026-10-11  
**Depends on:** POC plan on `main` via PR #18 merge `3737fe1d2991a8b795b5c9093f54e826f8f3ba04`  
**Source plan:** [`SPORTRADAR_SIMULATION_POC_PLAN.md`](./SPORTRADAR_SIMULATION_POC_PLAN.md)  
**Mode:** Checklist / gate only — **no Simulation calls, no mapper code, no vendor contact**

**Approval boundary:** **STOP** — do not run the trial, call `playback.sportradar.com`, create credentials, incur costs, implement mapper code, connect live feed, odds, or betting until explicitly authorized.

Related: feed evaluation on `main`, `pre_snap_snapshot.v1`, recorded demo + historical modes (must remain).

---

## Scope lock

| In | Out |
| --- | --- |
| One authorized NFL Simulation `recordingId` | Multi-game fan-out |
| REST `boxscore` (+ `pbp` / `game` as needed) | Production / live API keys |
| Map → existing `pre_snap_snapshot.v1` + Situation Lab | Odds, betting, Convention B / EP / WP recalibration |
| Capture evidence below | Replacing recorded-demo or historical lake |

---

## 1. Access and cost prerequisites

Complete **before** any HTTP to Simulations:

- [ ] Confirm product/counsel OK to use Sportradar **API Simulations** (public docs: no API key) for a **one-game** offline mapper proof
- [ ] Confirm ToS allows ephemeral use of Simulation JSON during the trial; separately decide whether derived snapshots / golden fixtures may be stored in repo/CI (**blocker if store-to-repo is desired**)
- [ ] Explicit written authorization for this one-game trial (no commercial Order Form assumption; no live Realtime/Push trial purchase)
- [ ] No production credentials created or requested; no sales outreach for Push add-on in this step
- [ ] Budget note: Simulations documented as keyless — still treat any unexpected paywall/rate-limit as **stop and report**, do not escalate spend
- [ ] Poll etiquette: start conservative (e.g. ≥ TTL-like spacing); if undocumented limits appear, stop load — do not retry-storm

**Blocking unknowns:** storage rights for Simulation payloads; whether counsel requires a signed path even for keyless Simulations.

---

## 2. Required fields and documented provider mappings

Mapper target: existing `pre_snap_snapshot.v1` (do not fork scorer). Missing ≠ zero; auto never `user_fallback`; allowlist only via explicit `user_fallback`.

### Envelope

| Field | Provider mapping (documented) | Gate |
| --- | --- | --- |
| `schema_version` | Constant `pre_snap_snapshot.v1` | Required |
| `source.source_id` | e.g. `sportradar.nfl.simulation` | Required |
| `source.provider` | Emit `demo` today (or approved enum later); never claim live | **Gap:** enum only `fixture`\|`demo` |
| `source.snapshot_id` | Boxscore/event/play id + revision | Required, stable |
| `source.event_timestamp` | Prefer play/event stamp; else recording-relative | No silent invent |
| `source.revision` | Monotonic on upsert / `updated_at` lineage | ≥ 1 |
| `source.freshness` | Our policy: `pre_snap` / `in_play` / `stale` | Not an SR field |

### Auto (fail closed if missing)

| Field | SR source | Gate |
| --- | --- | --- |
| `season`, `season_type`, `week` | Recording/game header; unknown season_type or missing week → unsupported-state | No invent |
| `game_id`, `play_id` | `meta.gameId` / PBP play `id` | Never blank |
| Teams + possession / defense | Game home/away + `situation.possession.alias` | Distinct ids |
| Scores + `score_differential` | Summary oriented to possession | Reject inconsistency |
| Timeouts | `remaining_timeouts` (summary/statistics) | Missing → unsupported-state |
| `receive_2h_ko` | **Not on Boxscore situation** | See §4 |

### Allowlist (prefer feed; else explicit fallback)

| Field | SR source | Gate |
| --- | --- | --- |
| `down`, `distance` | `situation.down`, `situation.yfd` | Lab scores only if `down=4` |
| `yardline_100` | `situation.location.yardline` + `location.alias` | See §3 |
| `quarter`, half/game seconds | Period + clock `MM:SS` | OT → 5; parse clocks |

- [ ] Field-coverage matrix filled for the chosen recording (present / derived / unsupported / fallback)
- [ ] `live_feed` never true; labeling remains simulation/demo

---

## 3. Yardline → `yardline_100` validation

SR yardline is from the **named team’s goal line**; nflfastR-style `yardline_100` is **yards from opponent end zone** (possession view).

- [ ] Document transform: given `location.alias` + `yardline` + `possession`, compute `yardline_100` ∈ [1, 99]
- [ ] Unit-test table (offline fixtures, no live call) covering: midfield, own territory, opponent territory, red zone both sides, possession flip, alias = home vs away
- [ ] During one-game trial: spot-check **≥5** fourth-down snaps against raw SR payload — fail on wrong orientation
- [ ] Never silently clamp or invert without logging the raw alias/yardline pair

**Blocking unknown:** confirmed transform unit tests must exist before trusting scored Lab output from Simulation.

---

## 4. Explicit `receive_2h_ko` gap handling

Required auto field; **not documented** on Boxscore `situation`.

Choose **one** approved policy before trial (do not invent at runtime):

| Option | Rule |
| --- | --- |
| **A — Derive** | From first-half kickoff receiver via PBP rules; document exact plays used; assert 0/1 |
| **B — Fail closed** | If not derivable → `unsupported-state` (no zero-fill, no allowlist prompt) |
| **C — Session config** | One-game harness config supplies the bit with audit label (only if product approves; still not silent default) |

- [ ] Policy A/B/C written and approved
- [ ] Evidence log shows which path fired for every scored frame
- [ ] Fail the trial if any scored frame used an invented/default `receive_2h_ko`

---

## 5. Timestamps — event, publication, receipt, adapter

Capture all four clocks in UTC at ms precision (or explicitly mark unavailable):

| Symbol | Meaning | If unavailable |
| --- | --- | --- |
| `T_event` | Provider event time | Prefer SR play/event timestamp; else recording-timeline offset; if only game clock → label **clock-relative** and do **not** report wall E2E |
| `T_pub` | Provider publication | Use SR `updated_at` / envelope time; else set **`unknown`** — never fabricate |
| `T_recv` | Our receipt | Wall clock when Simulation HTTP/Push chunk arrives |
| `T_adapt` | Adapter done | Wall clock after `build_situation_lab_payload_from_snapshot` returns or rejects |

Metrics (only when `T_event` is wall- or recording-absolute):

* `L_recv = T_recv − T_event`
* `L_e2e = T_adapt − T_event`
* `L_proc = T_adapt − T_recv`

- [ ] Harness logs all four fields per emission (with `unknown` / `clock-relative` allowed)
- [ ] Vendor marketing latency (TTL / “behind broadcast”) logged **separately** — never as measured E2E
- [ ] Primary ground truth for Simulations = **recording timeline**, not TV

---

## 6. One-game acceptance criteria and exact evidence to capture

**Game:** exactly one NFL Simulation `recordingId` with REST `boxscore` + `pbp` (prefer multiple 4th downs if identifiable).

| # | Criterion | Evidence to capture |
| --- | --- | --- |
| 0 | Session created; feeds listed | `recordingId`, `sessionId`, feed list, wall start time |
| 1 | First boxscore → valid snapshot | Raw JSON path/hash, mapped snapshot, adapter accept log; `provider`/`live_feed` labels |
| 2 | ≥3 distinct situation changes | Snapshot ids + diffs (score/clock/down-distance); Lab score artifacts when `down=4` + `pre_snap` |
| 3 | Allowlist stress (fixture copy) | Strip one allowlist field → reject or `user_fallback` (existing behavior) |
| 4 | Stale / in_play | Reject without prior `configs` reuse |
| 5 | Score inconsistency | Reject when differential ≠ score diff |
| 6 | Interruption + REST catch-up | Pause/resume log; gap filled; no silent stale score |
| 7 | Non-4th down | Clear Lab refusal (mapper may still emit snapshot) |
| 8 | Field coverage + state correctness | Matrix + ≥5 fourth-down spot-checks (incl. yardline_100) |
| 9 | Latency | Distributions of `L_recv` / `L_e2e` / `L_proc` for scored frames (or explicit N/A if event clock-relative) |
| 10 | Contract | Every scored payload validates through existing adapter |

**Pass:** all rows pass with evidence artifacts attached.  
**Fail:** any auto zero-fill, invented `receive_2h_ko`, wrong yardline orientation, stale/in_play scoring, missing latency instrumentation, or `live_feed=true`.

---

## 7. Failure handling and preservation of recorded-demo / historical modes

- [ ] On any mapper/adapter reject: clear error; **no** silent fill from previous frame; **no** reuse of prior Lab `configs`
- [ ] On Simulation disconnect/pause: REST catch-up from `boxscore`/`pbp`; do not leave a scored stale decision on screen
- [ ] On unexpected auth/paywall/ToS block: **stop**, preserve logs, do not create accounts or contact sales in-band
- [ ] **Recorded-demo** (`lac-den-q4-demo` and routes) remains unchanged and green
- [ ] **Historical** Situation Lab path remains unchanged and green
- [ ] No odds, live feed wire, or production key material in the harness
- [ ] Post-trial: if license forbids storing vendor JSON, keep only derived metrics/redacted field matrix — delete raw payloads

---

## Blocking unknowns (resolve before authorize-to-execute)

1. Counsel/product OK on Simulation use **and** on storing/redacting payloads  
2. Approved `receive_2h_ko` policy (A/B/C)  
3. Yardline transform unit-test table signed off  
4. Whether `source.provider` stays `demo` or gains an approved enum value  
5. Explicit authorization to run the one-game Simulation harness (and separately, later, any mapper code PR)

---

## Approval boundary

| Allowed now | Requires explicit approval |
| --- | --- |
| This checklist + unmerged docs PR | Any Simulation or live HTTP call |
| | Vendor email / account / subscription / spend |
| | Mapper / harness implementation PR |
| | Storing vendor payloads in repo |

**STOP and wait.**
