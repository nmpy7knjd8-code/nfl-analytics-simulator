# Sportradar Simulation trial **T** — report

**Date:** 2026-10-12  
**Main tip (docs):** `622bcdd9` (#25) · **Mapper tip:** `58d51a8a` (#24)  
**Authorization:** L1/L2/Persist/Authorize T recorded in [`SPORTRADAR_TRIAL_T_DECISION_REQUEST.md`](./SPORTRADAR_TRIAL_T_DECISION_REQUEST.md)  
**Constraints:** `live_feed=false` · Persist raw **No** · Path A unsupported · fail-closed `receive_2h_ko` · no odds/live/betting · no paid key

---

## 1. Free / trial preflight

| Check | Result |
| --- | --- |
| Public Simulations auth | Docs: **no API key** ([Simulations](https://developer.sportradar.com/getting-started/docs/simulations)) |
| Account / payment required before call | **Not observed** on GraphQL list or REST replay |
| Paid key / WWW-Authenticate | **Absent** |
| Paywall / billing language in bodies | **None** |
| Probe call | `POST playback.sportradar.com/graphql` list `league=nfl` → **HTTP 200**, 104 recordings |
| Preflight verdict | **PASS** — proceeded under free/keyless path |

**STOP rules:** would abort on 401/402/403 with auth, payment language, or paid-key prompts. None fired.

---

## 2. Rate / quota limits (research + observed)

### Documented

| Source | What it says about Simulations / keyless |
| --- | --- |
| Simulations docs | **No API key**; “continually” poll replay; **no QPS/quota numbers** for `playback.sportradar.com` |
| Changelog (API Simulations) | Confirms no API key; no numeric limits |
| Your Account (keyed products) | Trial defaults **1,000 req / rolling 30 days**, **1 QPS** — applies to **API keys / marketplace products**, **not** stated to apply to Simulations |
| Response codes | `429 Quota Exceeded`, `429 Throttled` exist globally; no Simulation-specific budget published |

### Observed this trial

| Signal | Result |
| --- | --- |
| `X-RateLimit-*` / `Retry-After` on list, createSession, boxscore | **Not present** |
| HTTP 429 | **Not seen** (7 calls total) |
| Conclusion | Simulation-specific quota **unknown**; treat as **unknown/low-risk only if sparse**. Cap used below. |

### Call budget used (minimum proof)

| Step | Calls |
| --- | --- |
| GraphQL list recordings (probe) | 1 |
| GraphQL `createSession` | 1 |
| REST `boxscore` polls (@ 3.0s spacing) | 5 |
| **Total** | **7** |
| Push / live / odds | **0** |
| Further bulk fetch | **Stopped** (sparse budget; natural-time clock had not advanced) |

---

## 3. Session executed

| Item | Value |
| --- | --- |
| Recording title | Baltimore Ravens AT Kansas City Chiefs |
| `recordingId` | `95aa13a0-6538-11ef-9287-d597687b4672` |
| `gameId` (recording meta) | `ebb5f3ac-bb13-4dc4-ab8b-6c65623eac13` |
| `sessionId` | `5ae4f683-c3f7-4390-a7f8-6a2c87283d9b_-66180988456` |
| Feed | REST `boxscore` only |
| Distinct situation signatures in 5 polls | **1** (early Q1; clock `14:53` unchanged over ~12s wall — natural pacing) |

### Redacted situation (as delivered)

| Field | Value / coverage |
| --- | --- |
| down / yfd | 2 / 8 — **present** |
| clock | `14:53` — **present** |
| possession.alias / location | BAL / BAL 32 — **present** |
| scores / timeouts | 0–0; 3/3 — **present** |
| `receive_2h_ko` | **missing** (expected) |
| `week` on boxscore | not confirmed in redacted extract (season inferred from scheduled for offline exercise only) |
| `live_feed` | **false** (never set true) |

**Persist:** no raw provider JSON written to repo, CI, or Project store. Process held payloads in memory only.

---

## 4. Offline mapper path (Y1–Y15 / fail-closed)

Used main mapper logic from #24 (`offline_mapper.py` + `pre_snap` contracts) against **in-memory reconstructed** frames from the redacted fields above (no durable vendor blobs).

| Metric | Count | Notes |
| --- | --- | --- |
| Mapper **ok** (full snapshot accept) | **0** | As-delivered frames lack `receive_2h_ko` |
| Mapper **fail-closed** | **6** | `receive_2h_ko_unavailable: fail_closed` (Path A unsupported) — **designed** |
| Other mapper failures | **0** | — |
| Yardline transform check | **PASS** | BAL ball at BAL 32 → `yardline_100=68` (own territory: `100 − yardline`) |

Non-4th-down Lab scoring is out of scope for Situation Lab (`down=4` required); trial did not invent downs or `receive_2h_ko`.

---

## 5. Acceptance vs checklist (honest)

| Criterion (abbrev.) | Status |
| --- | --- |
| Free/keyless session + boxscore | **Met** |
| Persist raw = No | **Met** |
| Fail-closed Path A / `receive_2h_ko` | **Met** (all as-delivered maps fail-closed) |
| ≥3 distinct situation changes | **Not met** under sparse 5×3s budget (natural time; stopped rather than long-poll) |
| ≥5 fourth-down yardline spot-checks vs raw | **Not met** (no 4th-down frames in sparse window; transform unit check on observed 2nd-down location **PASS**) |
| Full latency distributions | **Partial** — `T_recv` logged per poll; `T_event` clock-relative / wall E2E N/A for Simulations pace |
| Live / odds / paid key | **Not started** |

**Verdict:** Trial **T ran** on the free Simulation path with hard stop rules intact. Proof of **access + field coverage + fail-closed mapper** succeeded; full multi-situation / fourth-down acceptance matrix needs a longer natural-time session or denser sampling **only if** product raises the HTTP budget after reviewing unknown Simulation quotas.

---

## 6. Artifacts

| Path | Contents |
| --- | --- |
| This file | User-facing trial report (no raw vendor JSON) |
| Decision answers | [`SPORTRADAR_TRIAL_T_DECISION_REQUEST.md`](./SPORTRADAR_TRIAL_T_DECISION_REQUEST.md) |
| Sign-off L1/L2/T | [`SPORTRADAR_PRODUCT_SIGNOFF_CHECKLIST.md`](./SPORTRADAR_PRODUCT_SIGNOFF_CHECKLIST.md) |
| Tracker L1–L7/T | [`SPORTRADAR_BLOCKER_TRACKER.md`](./SPORTRADAR_BLOCKER_TRACKER.md) |

Published to this repo with the product next-steps decisions docs PR (sibling link for shareable review).
