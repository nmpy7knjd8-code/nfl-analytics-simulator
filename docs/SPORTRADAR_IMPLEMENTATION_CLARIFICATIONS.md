# Sportradar Simulation — implementation clarifications

**Date:** 2026-10-11  
**Depends on:** Blocker resolution on `main` via PR #20 merge `fcd22a9ab767e2a44b88769c63eb54d5a5d61f07`  
**Sources:** [`SPORTRADAR_BLOCKER_RESOLUTION.md`](./SPORTRADAR_BLOCKER_RESOLUTION.md), [`SPORTRADAR_SIMULATION_EXECUTION_CHECKLIST.md`](./SPORTRADAR_SIMULATION_EXECUTION_CHECKLIST.md)  
**Mode:** Technical clarification only — **no mapper code, no Simulation/API calls, no vendor contact**

**Does not resolve:** L1–L7 legal/licensing (remain external). **T** (trial) and **M** (mapper) stay separate approvals.

Preserve: recorded demo (`lac-den-q4-demo`) and historical Situation Lab mode — clarifications must not change their contracts.

**Approval boundary:** **STOP for review** — do not implement mapper or run trial until product signs these rules **and** issues **M** / **T** separately.

---

## 1. Path-A derivation (`receive_2h_ko`) — status: **unsupported**

Prior decision (blocker report): **default = fail-closed** (`receive_2h_ko.fail_closed.v1`). Path A is optional and only if provider-supported.

### 1.1 Documented provider semantics (what we have)

| Surface | Documented for `receive_2h_ko`? |
| --- | --- |
| REST Boxscore `situation` | **No** — not listed |
| REST Boxscore summary / scores / timeouts | **No** |
| REST PBP (public live-retrieval docs referenced in POC plan) | **No** field named `receive_2h_ko` or equivalent “posteam will receive 2H kickoff” bit in our cited plan/checklist |

### 1.2 Path-A spec template (copy-ready — currently **not activatable**)

```text
RULE receive_2h_ko.path_a.v1  — STATUS: UNSUPPORTED (do not enable)

GOAL:
  Set situation.receive_2h_ko ∈ {0, 1} meaning:
    1 = possession team at this snap is the team that will receive the
        second-half kickoff (nflfastR / WP feature convention).
    0 = possession team will NOT receive the second-half kickoff.

REQUIRED INPUTS (all must be present and unambiguous):
  I1. home_team_id, away_team_id          — from game header / recording meta
  I2. possession_team_id                  — from situation.possession.alias
      (after alias.normalize.v1)
  I3. first_half_kickoff_receiving_team_id
      — MUST come from a single documented provider field or a
        documented deterministic play sequence that uniquely identifies
        the team that received the opening kickoff of the game
        (or the team designated to receive the 2H kickoff).

DERIVATION (only if I3 is established):
  if possession_team_id == first_half_kickoff_receiving_team_id:
      # Opening KO receiver typically KICKS off to start 2H → does NOT receive 2H KO
      receive_2h_ko = 0
  else:
      receive_2h_ko = 1
  # NOTE: The 0/1 polarity above follows common nflfastR receive_2h_ko
  # semantics (posteam receives 2H KO). If provider docs define the opposite
  # polarity, STOP — do not enable Path A until polarity is confirmed in
  # writing. Do not guess.

ASSUMPTIONS (must all hold or → fail_closed):
  A1. Exactly one opening-kickoff receiving team for the game.
  A2. No mid-game rule change / special OT coin-toss override applied
      without a documented provider signal.
  A3. I3 is not inferred from score, timeouts, or yardline.

EVIDENCE REQUIRED BEFORE ENABLING PATH A:
  E1. Citation of Sportradar public docs (URL + field path) OR an
      authorized trial capture showing the exact JSON paths used for I3.
  E2. At least one worked example (raw JSON excerpt + computed 0|1)
      reviewed by product.
  E3. Product written approval to enable path=derive for the POC.

IF ANY OF I1–I3 / A1–A3 / E1–E3 FAIL:
  → STATUS remains UNSUPPORTED
  → apply receive_2h_ko.fail_closed.v1 only
  → log reason = "receive_2h_ko_path_a_unsupported"
```

### 1.3 Current binding rule for any future mapper

Until Path A is explicitly enabled (E1–E3), mappers **must** use only:

* `receive_2h_ko.fail_closed.v1` (default), and/or  
* `path=session_config` if product separately approves Path C  

Do **not** implement Path A code paths that invent I3.

---

## 2. Alias normalization — copy-ready rule + tests

Applies to Sportradar `situation.possession.alias`, `situation.location.alias`, and game home/away aliases before any id compare or yardline transform.

```text
RULE alias.normalize.v1

INPUT: raw_alias: str | null

STEPS:
  1. If raw_alias is null or empty after trim → REJECT
       reason = "alias_missing"
  2. s = raw_alias.strip()
  3. s = Unicode NFKC normalize (optional if ASCII-only feeds)
  4. s = s.upper()                     # case-fold to ASCII upper
  5. If s contains whitespace or characters outside [A-Z0-9] → REJECT
       reason = "alias_charset_invalid"
       (do not strip internal spaces; do not map "K C" → "KC")
  6. Return s

RULE alias.to_team_id.v1  (game-scoped)

INPUT: normalized_alias; home_alias_norm; away_alias_norm;
       home_team_id; away_team_id

  # For POC: team_id == normalized market alias (e.g. "KC", "DEN")
  # unless an explicit approved alias→id table row exists.

  1. If normalized_alias == home_alias_norm → return home_team_id
  2. If normalized_alias == away_alias_norm → return away_team_id
  3. Else → REJECT reason = "alias_not_in_game"
     (includes third-team aliases like "SEA" in a KC@DEN game)

FORBIDDEN:
  - Fuzzy match, Levenshtein, nickname tables ("Chiefs" → "KC")
    unless a row is explicitly listed in ALIAS_TABLE below
  - Silent fallback to possession or home
  - Accepting unknown values into yardline or possession fields
```

### 2.1 Explicit alias table (POC seed — extend only by approved PR)

Canonical ids match recorded-demo style short codes. Rows are **exact** after `alias.normalize.v1`.

| raw examples (pre-normalize) | normalized | team_id | notes |
| --- | --- | --- | --- |
| `KC`, `kc`, `Kc` | `KC` | `KC` | Y15 case |
| `DEN`, `den` | `DEN` | `DEN` | |
| `LAC`, `lac` | `LAC` | `LAC` | recorded demo away |
| `BAL`, `bal` | `BAL` | `BAL` | sample Simulations title market |
| `null` / `""` / `"  "` | — | **reject** | alias_missing |
| `SEA` in KC@DEN game | `SEA` | **reject** | alias_not_in_game |
| `Chiefs` | `CHIEFS` | **reject** | not in table; charset ok but no mapping |
| `K C` | — | **reject** | alias_charset_invalid (space) |

**Unlisted NFL aliases:** do **not** invent a full 32-team table in mapper code without a product-approved table PR. For a one-game POC, only home/away aliases from that recording’s game header need rows; any other alias → reject.

### 2.2 Alias unit cases (copy into future tests)

| ID | raw | home | away | expect |
| --- | --- | --- | --- | --- |
| A1 | `kc` | KC | DEN | team_id `KC` |
| A2 | `DEN` | KC | DEN | team_id `DEN` |
| A3 | `den` | KC | DEN | team_id `DEN` (Y15) |
| A4 | `""` | KC | DEN | reject alias_missing |
| A5 | `SEA` | KC | DEN | reject alias_not_in_game |
| A6 | `Chiefs` | KC | DEN | reject (unmapped) |
| A7 | `K C` | KC | DEN | reject alias_charset_invalid |
| A8 | `lac` | DEN | LAC | team_id `LAC` |

---

## 3. Provider enum extension — copy-ready policy

```text
POLICY PreSnapProvider.extension.v1

CURRENT CLOSED SET (contracts/pre_snap.py):
  fixture | demo

SIMULATION POC DEFAULT (no extension):
  Emit provider = demo
  source_id may be "sportradar.nfl.simulation" (string, not enum)
  live_feed = false always
  Do NOT add open-string acceptance

TO INTRODUCE A NEW VALUE (e.g. sportradar_simulation):
  1. Product approval for the new literal name and meaning
  2. Contract PR:
       - Add member to PreSnapProvider enum ONLY
       - Keep Enum strict (Pydantic rejects unknown strings)
       - Update PRE_SNAP_ADAPTER.md + tests
  3. Compatibility tests MUST pass (see §4.3):
       - existing fixture snapshots with provider=fixture still validate
       - existing demo / recorded-demo provider=demo still validate
       - provider="sportradar" / "live" / "" / "Sportradar" → ValidationError
  4. Mapper may emit the new value only AFTER the contract PR is on main
  5. Unknown values are NEVER coerced to demo/fixture

FORBIDDEN:
  - str provider field without enum
  - try/except that maps unknown → demo
  - accepting live vendor claims (api.sportradar.com) under demo
```

### 3.1 Related closed sets (unchanged semantics)

| Field | Allowed | Unknown |
| --- | --- | --- |
| `source.freshness` | `pre_snap` \| `in_play` \| `stale` | ValidationError / reject |
| `live_feed` | `false` for Simulation/demo/fixture | `true` → trial/mapper fail |
| `season_type` (string) | only when clearly `REG`/`POST`/`PRE` after an explicit map table | unsupported-state — do not default `REG` |

```text
RULE season_type.map.v1
  INPUT raw from game/recording header
  MAP (exact after upper/strip):
    "REG" | "REGULAR" | "REGULAR_SEASON" → "REG"   # only rows product approves
    "POST" | "POSTSEASON" | "PLAYOFFS" → "POST"     # only if listed when enabling
    "PRE" | "PRESEASON" → "PRE"
  DEFAULT TABLE FOR POC (minimal — copy exactly):
    "REG" → "REG"
    "POST" → "POST"
    "PRE" → "PRE"
  Any other value (including "regular", "Regular Season", missing) →
    unsupported-state reason = "season_type_unmapped"
  Do not expand the MAP without a docs+test PR.
```

---

## 4. Test plan before mapper approval (**M** gate)

All tests are **offline** (hand-written JSON fixtures). No Simulation HTTP. Recorded-demo and historical suites must remain green unchanged.

### 4.1 Yardline unit tests (mandatory)

Implement transform from blocker report §3; assert cases **Y1–Y15** exactly (home=`KC`, away=`DEN` unless noted).

```text
FUNCTION yardline_100_from_sr(possession_alias, location_alias, location_yardline,
                              home_alias, away_alias) → int | Reject

  poss = alias.to_team_id(alias.normalize(possession_alias), ...)
  loc  = alias.to_team_id(alias.normalize(location_alias), ...)
  # both must succeed
  if loc == poss:
      y = 100 - location_yardline
  else:
      y = location_yardline
  if y not in 1..99: Reject
  return y
```

| ID | assertion |
| --- | --- |
| Y1–Y10 | exact expected ints from blocker table |
| Y11–Y14 | Reject |
| Y15 | `den` → same as `DEN` → 25 |

### 4.2 Known-state spot-check harness (trial evidence shape — run under **T**)

Not required to pass **M**, but mapper must expose a pure function so **T** can log:

| ID | requirement |
| --- | --- |
| S1–S5+ | ≥5 fourth-down snaps: raw `(location.alias, location.yardline, possession.alias)` + mapped `yardline_100` + recomputed expected; fail on mismatch |
| S-mix | Prefer ≥1 own-side, ≥1 opp-side, ≥1 red-zone when recording allows |

### 4.3 Contract / adapter tests (mandatory before **M** merge)

| ID | Scenario | Expect |
| --- | --- | --- |
| C1 | Snapshot missing `receive_2h_ko` | unsupported-state / adapter reject; **not** zero-fill; reason includes `receive_2h_ko` |
| C2 | Snapshot with `receive_2h_ko` omitted + Path A disabled | fail_closed; no Lab `configs` |
| C3 | `freshness=stale` | reject; no prior `configs` reuse |
| C4 | `freshness=in_play` | reject; no prior `configs` reuse |
| C5 | `score_differential != posteam_score - defteam_score` | reject |
| C6 | `provider="live"` / `"sportradar"` / `"Sportradar"` / `""` | ValidationError (unknown enum) |
| C7 | `provider="fixture"` existing fixture | still validates + scores when otherwise valid |
| C8 | `provider="demo"` recorded-demo frame 0 | still validates + scores (regression) |
| C9 | After enum extension (only if approved): `provider="sportradar_simulation"` | validates; `live_feed` must still be false |
| C10 | `live_feed=true` on Simulation-shaped payload | reject / trial fail |
| C11 | Allowlist field stripped (e.g. no `down`) | reject or require `user_fallback` (existing behavior) |
| C12 | Auto field missing (e.g. no `week`) | unsupported-state; not user_fallback |
| C13 | Alias A4–A7 | reject paths |
| C14 | Historical lake Situation Lab path | unchanged green |
| C15 | Recorded-demo sequence `lac-den-q4-demo` full suite | unchanged green |

### 4.4 Mapper approval checklist (**M**)

- [ ] Y1–Y15 unit tests green  
- [ ] C1–C8, C10–C15 green (C9 only if enum extended)  
- [ ] Path A code **absent** or hard-disabled with `UNSUPPORTED` guard  
- [ ] `receive_2h_ko.fail_closed.v1` implemented and covered by C1–C2  
- [ ] No dependency on live HTTP / credentials  
- [ ] Recorded-demo + historical preserved  

**T** remains a separate authorize step after **M** (or after offline **M** + counsel L1–L2).

---

## Still blocked on external input

### Needs provider documentation (or authorized trial capture under **T**)

| Item | Why |
| --- | --- |
| Path-A I3 field/play sequence | Not established in cited public Boxscore/PBP semantics → **unsupported** until E1–E2 |
| Path-A 0/1 polarity vs nflfastR | Must be confirmed in writing before enabling derive |
| Full SR alias inventory beyond game home/away | Unlisted nicknames/ids → reject until approved table rows |

### Needs product approval (human — not closable by this doc)

| Item | Why |
| --- | --- |
| Accept clarifications as binding for **M** | Sign-off |
| Enable Path A or Path C | Optional; default remains fail-closed |
| Expand `season_type.map.v1` or alias table | Docs+test PR approval |
| Add `PreSnapProvider.sportradar_simulation` | Contract PR approval |
| L1–L7 licensing/storage | External counsel/product — **not** resolved here |
| Authorize **M** (mapper code) | Separate from **T** |
| Authorize **T** (one-game Simulation) | Separate from **M** |
| Merge this clarifications docs PR | Separate approval |

---

**STOP for review.**
