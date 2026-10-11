# Sportradar Simulation — blocker-resolution report

**Date:** 2026-10-11  
**Depends on:** Execution checklist on `main` via PR #19 merge `2d4209bd81aee5890e1f854504884c8b3ad91f13`  
**Sources:** [`SPORTRADAR_SIMULATION_EXECUTION_CHECKLIST.md`](./SPORTRADAR_SIMULATION_EXECUTION_CHECKLIST.md), [`SPORTRADAR_SIMULATION_POC_PLAN.md`](./SPORTRADAR_SIMULATION_POC_PLAN.md), `contracts/pre_snap.py`  
**Mode:** Documentation / gate only — **no Simulation calls, no mapper code, no vendor contact**
**Docs PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/20  
**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/c70928688c5317cd1fefa08fdb3666fa68605fc4/docs/NEXT_STEPS_DELTA_SPORTRADAR_BLOCKERS.md

**No legal conclusions.** This report lists unanswered questions and what product/counsel documentation would need to answer them. It does not interpret Sportradar ToS or grant rights.

**Approval boundary:** **STOP** — do not run the trial, implement mapper code, create credentials, incur costs, or wire live/odds/betting until blockers below are resolved **and** explicit authorizations are given (trial and mapper are separate).

Preserve: recorded demo (`lac-den-q4-demo`) and historical Situation Lab mode.

---

## 1. Storage and licensing (questions only)

Public docs state Simulations need no API key; commercial live product is B2B / Order Form; marketplace notes no official NFL partnership for that product. **None of that is a clearance.**

| # | Unanswered question | What would resolve it (documentation / approval) |
| --- | --- | --- |
| L1 | May we call `playback.sportradar.com` NFL Simulations for an internal one-game mapper proof? | Product + counsel written OK citing current Simulations / B2B ToS pages (date-stamped) |
| L2 | May Simulation JSON be held **ephemerally** in memory/disk for the duration of the trial only? | Same OK, scoped to ephemeral processing |
| L3 | May we retain **raw** Simulation payloads (or redacted subsets) as CI golden fixtures in the repo? | Explicit store-to-repo decision; if no → trial must delete raw JSON and keep only redacted field matrix / metrics |
| L4 | May we retain **derived** `pre_snap_snapshot.v1` objects and Lab score artifacts from the trial? | Separate yes/no from L3 |
| L5 | Does keyless Simulations access still require a signed Order Form / account for our use case? | Counsel/product answer — do not assume “no key ⇒ free for any use” |
| L6 | Display vs analytics: is publishing derived fourth-down recommendations from Simulation data allowed under current terms? | Product/counsel scope note (non-betting product assumed; no odds) |
| L7 | Post-trial: retention / deletion SLA for any captured vendor JSON | Written retention rule before first capture |

**Do not:** contact Sportradar sales, create accounts, or spend until L1–L2 (and L3 if fixtures desired) are answered and trial authorization is separate (§5).

---

## 2. `receive_2h_ko` — fail-closed by default

**Fact from plan/checklist:** Boxscore `situation` does **not** document `receive_2h_ko`. It is a required **auto** field (`AUTO_SITUATION_FIELDS`); missing ≠ zero; never `user_fallback`.

### Recommendation

**Default policy = fail-closed (checklist option B).** Do not invent `0`/`1`. Do not score Lab when the bit cannot be established under an approved non-default path.

### Recommended fail-closed rule (copy into future mapper)

```text
RULE receive_2h_ko.fail_closed.v1

INPUT: mapped pre_snap situation in progress; Sportradar boxscore (+ optional pbp).

1. Never set receive_2h_ko from a silent default (including 0).
2. Never expose receive_2h_ko via user_fallback / allowlist prompt.
3. If no approved derive path (A) or session-config path (C) has produced an
   audited 0|1 for this game session:
     → emit unsupported-state for this snapshot
     → do not call Situation Lab scoring
     → log reason = "receive_2h_ko_unavailable"
4. If a scored frame would require receive_2h_ko and it is missing/None:
     → fail the emission (trial fail if this occurs on a scored path)
5. Evidence log MUST record path = "fail_closed" when this rule fires.
```

### Optional alternatives (not default — need separate product approval)

| Path | When allowed | Requirement |
| --- | --- | --- |
| **A — Derive** | Only if a **provider-supported** PBP/event sequence uniquely identifies the first-half kickoff receiving team for this recording | Document exact feed fields/play types used; assert 0/1; log `path=derive`; if ambiguous → fall back to fail-closed, do not guess |
| **C — Session config** | Only if product approves one-game harness config | Config supplies `receive_2h_ko` ∈ {0,1} with audit label `path=session_config`; still never a silent code default |

**Public-docs status:** No reliable Boxscore field for this bit is documented. Any derive (A) remains a **documentation gap** until trial inspection of PBP proves a deterministic rule — until then, fail-closed is mandatory.

---

## 3. Yardline → `yardline_100` — future unit-test cases

**Conventions (from plan/checklist / nflfastR-style):**

* Sportradar: `situation.location.yardline` = yards from the **named** team’s goal line (`location.alias`).
* Ours: `yardline_100` ∈ [1, 99] = yards from **opponent** end zone (possession view).
* Planned transform (for tests; not implemented this turn):

```text
if location.alias == possession.alias:
    yardline_100 = 100 - location.yardline   # own side of field
else:
    yardline_100 = location.yardline         # opponent's side
```

Reject if alias missing, yardline missing, result not in [1, 99], or alias not in {home, away}. Log raw `(alias, yardline, possession)` on every conversion. Never silent clamp/invert.

### Unit-test table (offline fixtures — writeable now; run when mapper exists)

Assume home=`KC`, away=`DEN`. Columns: possession, loc.alias, loc.yardline → expected `yardline_100` / outcome.

| # | poss | alias | yrd | expected | notes |
| --- | --- | --- | --- | --- | --- |
| Y1 | KC | KC | 25 | 75 | Own territory |
| Y2 | KC | DEN | 25 | 25 | Opponent territory |
| Y3 | KC | KC | 50 | 50 | Midfield (own-side label) |
| Y4 | KC | DEN | 50 | 50 | Midfield (opp-side label) |
| Y5 | KC | DEN | 1 | 1 | Opp goal-line / inch |
| Y6 | KC | KC | 1 | 99 | Own goal-line |
| Y7 | KC | DEN | 20 | 20 | Red zone offense |
| Y8 | KC | KC | 20 | 80 | Red zone defense (backed up) |
| Y9 | DEN | DEN | 30 | 70 | Possession flip, own side |
| Y10 | DEN | KC | 30 | 30 | Possession flip, opp side |
| Y11 | KC | KC | 0 | reject | Out of range / EZ |
| Y12 | KC | DEN | 100 | reject | Out of range |
| Y13 | KC | — | 25 | reject | Missing alias |
| Y14 | KC | SEA | 25 | reject | Alias not home/away |
| Y15 | KC | den | 25 | 25 | Case-normalize alias before compare (document normalization) |

### Known-state spot-checks (during future one-game trial)

For **≥5** fourth-down snaps: record raw SR `location` + possession + mapped `yardline_100`; independently recompute with the table rule; **fail trial** on any mismatch. Prefer mix of own-side, opp-side, and ≥1 red-zone snap when the recording allows.

---

## 4. Provider enums and documented values

Do **not** invent provider semantics or fill missing data with guesses. Unmapped → unsupported-state or reject per field class.

### 4.1 `source.provider` — `PreSnapProvider`

| Documented values (code today) | Meaning |
| --- | --- |
| `fixture` | Offline fixture path |
| `demo` | Recorded-demo / non-live demo path |

| Case | Resolution |
| --- | --- |
| Simulation POC mapper | **Until enum extension approved:** emit `demo` only; never claim live |
| Proposed `sportradar_simulation` | **Not in enum** — requires separate contract change approval |
| Any live vendor string | **Forbidden** for this stage |

### 4.2 `source.freshness` — `Freshness`

| Value | Documented use |
| --- | --- |
| `pre_snap` | Only value that may score |
| `in_play` | Reject scoring; no prior `configs` reuse |
| `stale` | Reject scoring; no prior `configs` reuse |

Freshness is **our policy**, not a Sportradar field. Ambiguous between-play vs in-play → prefer fail-closed (`in_play` or reject) over scoring.

### 4.3 `live_feed` (response bool, not enum)

| Value | Rule |
| --- | --- |
| `false` | Required for Simulation/demo/fixture paths |
| `true` | **Forbidden** — trial fail |

### 4.4 `season_type` (string, not a closed enum in contract)

| Documented map targets (POC plan) | Action |
| --- | --- |
| `REG` / `POST` / `PRE` | Accept when provider header clearly maps |
| Unknown / absent / ambiguous SR value | **unsupported-state** — do not invent `REG` |

### 4.5 Other required strings / ids

| Field | Unmapped / ambiguous |
| --- | --- |
| `week` | Absent in simulation payload → unsupported-state or approved session config — **not** zero |
| Team aliases → ids | Unknown alias → reject/unsupported; no silent nflverse invent |
| `play_id` / `game_id` | Blank → reject |

---

## 5. Trial and mapper authorization (separate)

| Approval | Covers | Does **not** cover |
| --- | --- | --- |
| **T — Trial execution** | One authorized Simulation game; HTTP to playback Simulations; evidence capture per checklist | Mapper merged to main; enum extension; storing fixtures; live API; sales outreach |
| **M — Mapper implementation** | Harness/mapper code PR implementing maps + fail-closed rules | Running against Simulations (needs **T**); production keys; odds/live |

Order may be **M then T** (implement against offline fixtures first) or **T then M** only if counsel allows capture before code — default recommendation: resolve L1–L3 and yardline/`receive_2h_ko` docs → **M** (offline tests) → **T** (one-game). Either way, **T ≠ M**; each needs an explicit authorize message.

---

## Still unresolved

### Documentation gaps (can close with docs / offline fixtures — still no API)

* Deterministic PBP derive for `receive_2h_ko` (path A) — **not** documented on Boxscore; unproven until inspected under trial auth
* Alias case-normalization table for SR team strings (Y15)
* Whether `PreSnapProvider` gains `sportradar_simulation` vs stay on `demo`
* Yardline unit tests exist as **spec** above; not yet coded (needs mapper auth **M**)

### Approvals still required (human / counsel — not closable by this report)

* L1–L7 storage/licensing answers (**no legal conclusions here**)
* Product accept of **fail-closed default** for `receive_2h_ko` (and optional A/C if desired)
* Sign-off that yardline test table (§3) is the acceptance transform
* **T** — authorize one-game Simulation trial  
* **M** — authorize mapper/harness code  
* Merge of this blocker-report docs PR (separate from T/M)

---

**STOP and wait** for blockers resolved + explicit **T** / **M** before any execution or mapper code.
