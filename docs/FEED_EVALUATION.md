# Feed evaluation — NFL game-state sources

**Date:** 2026-10-11  
**Main after PR #16:** `4ce96b14496a64fba97e610b2b9b6226090cc7c0` (tip merged: `dc05f6df`)  
**Mode:** Evidence review only — **no live source connected**, no paid API calls, no credentials, no odds automation  
**Branch (docs-only, unmerged if opened):** `cursor/feed-evaluation-c0ef`

---

## 1. Requirements from existing code (not invented)

Inspected: `contracts/pre_snap.py`, `providers/pre_snap.py`, `api/situation_lab.py`, `providers/recorded_demo.py`, `models/fourth_down.py` (`FourthDownSituation`).

### 1.1 Required for Situation Lab fourth-down scoring (scorer inputs)

`FourthDownAnalyzer` / `FourthDownSituation` uses **only**:

| Field | Role |
| --- | --- |
| `yardline_100` | Field position (1–99, **yards from opponent end zone**, possession view) |
| `distance` | Yards to gain |
| `score_differential` | posteam − defteam |
| `game_seconds_remaining` | Game clock |
| `half_seconds_remaining` | Half clock |
| `qtr` / `quarter` | Period |
| `posteam_timeouts` / `defteam_timeouts` | Timeouts |
| `is_home_possession` | Derived from poss vs home |
| `receive_2h_ko` | WP feature (0/1) |
| `season` | Empirics / features |

No odds, spread, vegas_wp, or player tracking are used.

### 1.2 Required by `pre_snap_snapshot.v1` validation (adapter)

**Source (all required):** `source_id`, `provider`, `snapshot_id`, `event_timestamp`, `revision` (≥1), `freshness` ∈ {`pre_snap`,`in_play`,`stale`} — only `pre_snap` scores.

**Auto situation (must come from feed; never user-fallback, never invent):**  
`season`, `season_type`, `week`, `game_id`, `play_id`, `possession_team_id`, `defense_team_id`, `home_team_id`, `away_team_id`, `posteam_score`, `defteam_score`, `score_differential` (= score diff), `posteam_timeouts`, `defteam_timeouts`, `receive_2h_ko`.

**Allowlist (feed preferred; else explicit `user_fallback` only):**  
`down`, `distance`, `yardline_100`, `quarter`, `half_seconds_remaining`, `game_seconds_remaining`.

**Optional:** `roof` (not required for unsupported-state; scorer does not need it for WP path used here).

**Consistency:** possession ∈ {home, away}; defense = other; down must be **4** for this Lab path.

### 1.3 Required vs optional enhancements

| Class | Fields |
| --- | --- |
| **Required for a useful live decision today** | Everything in §1.1 + §1.2 (source + auto + allowlist resolved) |
| **Optional enhancements (not used by current scorer)** | Player tracking, formations, NGS, win-prob overlays, odds, weather beyond `roof`, broadcast graphics packages |

---

## 2. Candidates researched (primary docs)

Sources checked this turn (public docs / ToS / product pages only — **no live paid API calls**):

| Candidate | Docs / pages reviewed |
| --- | --- |
| **Sportradar NFL API** | Live game retrieval; Game Boxscore situation; Game Statistics; marketplace NFL API; ToS |
| **Genius Sports (official NFL)** | NFL.com exclusive partnership notice; Match State / auth docs |
| **Stats Perform / Opta** | Opta Live American Football; APIs FAQ; Pricing FAQ; MLA Dec 2025 (API call base) |
| **SportsDataIO** | Developers access tiers; NFL PBP coverage / workflow |
| **ESPN unofficial JSON** | Community endpoint docs; Disney ToU; espn.com robots.txt |
| **nflverse / nflfastR** | nflreadr data schedule (historical / delayed) |

---

## 3. Fair evaluation method (before wiring)

| Metric | Definition | Before purchase | Needs trial / auth |
| --- | --- | --- | --- |
| **Required-field coverage** | present / partial / missing vs §1.2 | Schema docs + sample payloads | Confirm live payload parity |
| **Update frequency** | Time between meaningful situation changes | Vendor TTL / poll guidance | Count updates on one game |
| **E2E delay** | `T_end − T_start` where `T_start` = wall clock of snap/play event (broadcast or official stamp) and `T_end` = time our adapter emits scored payload | **Cannot verify from marketing alone** | Instrumented trial |
| **Quality** | Missing, stale, duplicate, corrected, out-of-order rates | Doc’d correction model | Log during trial |
| **Recovery** | Behavior after disconnect / restart | Doc’d reconnect | Chaos test in trial |
| **Cost + license** | Quote + permitted uses (display, store, derived analytics, betting-adjacent) | Public ToS fragments | Order Form / counsel |

**Rule:** Vendor “sub-second” / “real-time” claims are **advertised**, not independently measured E2E for this product.

---

## 4. Coverage vs required snapshot fields

Legend: **P** = present in public schema/docs · **∂** = partial (needs transform/derive) · **M** = missing / not evidenced · **?** = unknown from public docs

Grouped columns = contract fields needed for a scored decision.

| Candidate | Identity (`season/week/game_id/play_id`) | Teams (poss/def/home/away) | Score + diff | Timeouts | `receive_2h_ko` | Down / distance | `yardline_100` convention | Quarter + clocks | Source ts / revision / freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Sportradar** | P / ∂ (map SR ids → our ids) | P | P | P (`remaining_timeouts`) | M/∂ (derive) | P (`down`,`yfd`) | ∂ (yardline + side/alias → `yardline_100`) | P (quarter + clock string → seconds) | ∂ (timestamps; revision via play `id` upsert; freshness = our policy) | Boxscore `situation`; REST TTL claimed ~2–3s in-progress |
| **Genius Sports** | P (fixture/play ids — ?) | P (expected) | P (expected) | ? | ? | P (expected match-state) | ? | P (expected) | P (stream timestamps expected) | Official; field-level NFL schema **not fully public** without onboarding |
| **Stats Perform** | ? | ? | P (claimed live AF) | ? | M/? | ? | ? | ? | ? | Marketing-rich; **NFL field dictionary not public** here |
| **SportsDataIO** | P | P | P | ? | M/? | P (start/end game state) | ∂ (confirm orientation) | P | ∂ | Live PBP; vendor lag **15–20s behind TV** (advertised) |
| **ESPN unofficial** | ∂ | P | P | ? | M | ∂/P (often in plays) | ∂ | ∂/P | M (no contract freshness) | Unofficial; ToU risk |
| **nflverse** | P | P | P | P | ∂/P (lake derive) | P | P | P | n/a live | **Not live** — historical lake only |

---

## 5. Cadence, reliability, license, price, integration

| Candidate | Cadence / latency (as published) | Reliability / corrections | Licensing | Pricing / limits | Delivery / complexity |
| --- | --- | --- | --- | --- | --- |
| **Sportradar** | REST TTL ~2–3s in-progress (**vendor**); initial play detail often 5–10s behind broadcast (**vendor**); Push for Realtime | Upsert by play `id`; Daily Change Log; `complete`→`closed` | B2B commercial; **not** official NFL partner (marketplace) | Quote / Order Form; ToS overages | REST + Push; Simulations for offline — **medium** |
| **Genius** | Stream / Ably match-state; “official” low-latency positioning (**advertised**) | Enterprise (assumed under contract) | **Exclusive official** NFL PBP + official betting data through 2027–28 | Enterprise / sales | OAuth2 + API key + Ably — **high**; not self-serve |
| **Stats Perform** | “Sub-second” live feeds (**advertised FAQ**) | Enterprise ops claimed | Enterprise MLA; betting clients cited in FAQ | Quote; MLA cites 2M API calls/mo base, $1500/M overage, 20 calls/s | REST / WS / push / S3 — **high** until docs unlocked |
| **SportsDataIO** | Live PBP ~15–20s behind TV (**vendor workflow**); Discovery Lab = next-day | Commercial SLA on Leagues API | Discovery Lab **not** commercial redistribution; live needs agreement | Discovery ~$99–149/mo delayed; live = sales | REST + Replay — **medium** |
| **ESPN unofficial** | Practically fast for fans apps | No SLA; schema drift | Disney ToU: no automated/commercial scrape without permission | “Free” ≠ licensed | Easy tech / **poor legal** |
| **nflverse** | Nightly / post-game (minutes–hours) | Strong for research corrections | Open research use | Free | Already integrated — **historical only** |

---

## 6. Ranked recommendation

### Best fit for current product (media / analytics Situation Lab)

**Sportradar NFL API** — public docs show the closest **explicit** mapping to required situation fields (down, yfd, possession, location/yardline, clock, scores, timeouts), a documented correction/upsert model, and **Simulations** to extend recorded-demo testing **without** a live game. Yardline→`yardline_100` and `receive_2h_ko` remain transform/derive work. License is commercial B2B but **not** official NFL — acceptable if product stays non-betting.

**Do not wire yet.** Next step is quote + authorized trial + mapping spike + **our** E2E measurement.

### Best lower-cost / accessible alternative

**Keep recorded demo + nflverse historical** for development (already shipped). For a cheaper commercial live path: **SportsDataIO** if Sportradar quote is out of reach — accepting slower advertised lag and confirming field orientation/timeouts/`receive_2h_ko` in trial. ESPN unofficial is **not** a licensed alternative.

### Potential fallback (if justified)

**Genius Sports** if/when the product requires **official** NFL data or regulated betting-adjacent distribution — licensing wins over Sportradar’s non-official collection, at higher cost/complexity. **Stats Perform** remains a peer enterprise option once NFL field dictionary is obtained under NDA; not rankable on coverage until then.

### Unresolved risks / vendor questions

1. Exact license for **derived decision analytics** (display vs store vs recommend) on each Order Form  
2. Our measured E2E latency (none yet)  
3. `receive_2h_ko` availability or approved derive rule  
4. Yardline side/alias → `yardline_100` correctness under all red-zone / possession flips  
5. Genius / Stats Perform field-level schemas (not fully public)  
6. Betting: if UI ever becomes betting-adjacent, official feed rights may become mandatory  

---

## 7. What was **not** verified this turn

- No live calls to Sportradar / Genius / Stats Perform / SportsDataIO  
- No independently measured E2E latency  
- No signed quotes  
- Stats Perform & Genius: incomplete public field dictionaries → many `?` in the matrix  

---

## 8. Stop

**No live source selected for wiring.** Await approval before any trial account, paid call, or adapter implementation.

### Single next action (when authorized)

Request Sportradar NFL trial/quote → map one Simulation game into `pre_snap_snapshot.v1` → measure E2E → decide go/no-go vs Genius/SportsDataIO backup.
