# Sportradar Simulation — blocker tracker

**Date:** 2026-10-11  
**Main:** clarifications via PR #21 merge `53c34c3df7018c6d253967f8d51aca2ddf14f095`  
**Sources on main:** `SPORTRADAR_IMPLEMENTATION_CLARIFICATIONS.md`, `SPORTRADAR_BLOCKER_RESOLUTION.md`, `SPORTRADAR_SIMULATION_EXECUTION_CHECKLIST.md`, `SPORTRADAR_SIMULATION_POC_PLAN.md`, `FEED_EVALUATION.md`, `LICENSING_AND_DATA_SOURCES.md`, `contracts/pre_snap.py`  
**Mode:** Tracker only — no Simulation/API/vendor/mapper/live/costs
**Docs PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/22  
**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/d72e7379ea7d28872d1683f45d3c7c95c4050b34/docs/NEXT_STEPS_DELTA_SPORTRADAR_TRACKER.md

**Locked:** Path A = **unsupported** (E1–E3 not in repo). `PreSnapProvider` = `fixture`\|`demo` closed. Unknown aliases/enums → reject. Preserve recorded-demo + historical.

---

## Closed from existing repo evidence (not new work)

| Item | Evidence | Effect |
| --- | --- | --- |
| Boxscore has no `receive_2h_ko` | Clarifications §1.1; POC plan §2.2; FEED_EVAL “M/∂” | Path A stays **unsupported**; fail-closed is the only default |
| No Path-A E1–E3 package in repo | No cited JSON path + worked example + product enablement | Do not enable derive |
| Enum closed set today | `contracts/pre_snap.py` `PreSnapProvider` = fixture\|demo | Mapper must emit `demo` until product approves extension |
| Game-scoped alias rule written | Clarifications `alias.normalize.v1` / `to_team_id.v1`; seed KC/DEN/LAC/BAL | One-game mapper can proceed with home/away only; nicknames still reject |
| Yardline transform + Y1–Y15 specified | Blocker resolution §3; clarifications §4.1 | Spec ready for **M**; not coded |
| Public doc URLs already inventoried | POC plan §1 (Simulations, Boxscore, PBP, Push) | No vendor contact needed to *read* those pages; still no clearance |

---

## 1. External evidence

| ID | Blocker | Owner / action | Evidence to close | Blocks | Without it |
| --- | --- | --- | --- | --- | --- |
| E-PA1 | Path-A **I3**: documented field or deterministic play sequence for first-half KO receiving team (or 2H-receive designation) | Product/docs: cite Sportradar public reference already linked in POC plan (`nfl-game-boxscore`, live-retrieval/PBP, Simulations) — **no vendor email**; or authorized **T** capture under L1–L2 | Clarifications E1: URL + JSON path; E2: one worked raw→0\|1 example | Path A only; not fail-closed POC | **Trial/mapper can proceed** on fail-closed (or Path C if approved). Path A cannot. |
| E-PA2 | Path-A **0/1 polarity** vs nflfastR `receive_2h_ko` | Same as E-PA1; confirm in writing before enable | Clarifications E3 + polarity note in `path_a.v1` | Path A only | Same as E-PA1 — **proceed without Path A** |
| E-AL1 | Fuller alias inventory beyond game home/away (nicknames, alternate codes) | Product: approve table PR rows only when sourced from provider docs or recording header — not invented | Explicit alias→id rows; unlisted → reject (already specified) | Multi-team / nickname robustness; not one-game if header aliases known | **One-game trial/mapper can proceed** with game-scoped home/away only |

**Authoritative sources already in repo (URLs/citations):** POC plan §1 table; FEED_EVAL Sportradar rows; clarifications §1.1 negative finding on Boxscore. No additional vendor contact required to keep Path A unsupported.

---

## 2. Product decisions

| ID | Decision | Owner / action | Evidence to close | Blocks | Without it |
| --- | --- | --- | --- | --- | --- |
| P-CL | Accept clarifications as binding for future **M** | Product sign-off on `SPORTRADAR_IMPLEMENTATION_CLARIFICATIONS.md` | Written accept | **M** quality bar | **Do not start M** until signed (or explicit waive) |
| P-FC | Accept `receive_2h_ko.fail_closed.v1` as default | Product | Written accept | Scoring frames without the bit | **Mapper/trial can proceed** only if fail-closed accepted (recommended default) |
| P-PA | Enable Path A? (default **no**) | Product — only after E-PA1/E-PA2 | E1–E3 complete | Path A | **Proceed without** — keep unsupported |
| P-PC | Enable Path C session-config for `receive_2h_ko`? | Product | Written accept + audit label rule | Optional scored frames when bit not in feed | **Proceed without** using fail-closed only |
| P-ENUM | Expand `PreSnapProvider` with e.g. `sportradar_simulation`? | Product + contract PR | Signed name/meaning; tests C6–C9 | Labeling clarity only | **Proceed without** — emit `demo`, `live_feed=false` |
| P-YL | Sign off yardline transform + Y1–Y15 as acceptance | Product | Written accept | Trust in scored Lab from SR yardline | **M should not merge** scoring path without this (or equivalent) |

---

## 3. Access and implementation approvals

| ID | Approval | Owner / action | Evidence to close | Blocks | Without it |
| --- | --- | --- | --- | --- | --- |
| L1 | Call Simulations (`playback.sportradar.com`) for one-game proof? | Counsel/product | Written OK (date-stamped ToS/Simulations pages) | **T** | **T blocked**; **M** offline fixtures OK |
| L2 | Ephemeral hold of Simulation JSON during trial? | Counsel/product | Written OK | **T** processing | **T blocked** if capture needed; **M** OK |
| L3 | Retain raw Simulation JSON in repo/CI? | Counsel/product | Explicit yes/no | Fixture golden files from vendor | **T/M proceed** if no — delete raw; redacted matrix only |
| L4 | Retain derived snapshots / Lab artifacts? | Counsel/product | Explicit yes/no | Keeping trial outputs | **T proceed** with ephemeral-only if no |
| L5 | Keyless Simulations still need Order Form/account? | Counsel/product | Written answer | **T** if yes and unsigned | **T blocked** until answered; **M** OK |
| L6 | Derived fourth-down analytics display rights? | Counsel/product | Scope note (non-betting) | Publishing Lab recs from Simulation | **Internal T/M** may proceed if scoped internal-only |
| L7 | Retention/deletion SLA for vendor JSON | Counsel/product | Written rule before first capture | Post-trial hygiene | **T blocked** before first capture if L2 yes without L7 |
| **T** | Authorize one-game Simulation trial | Product (explicit) | Authorize message; L1–L2 (+ L7 if capturing) | Live Simulation HTTP | **No T** without it; **M** separate |
| **M** | Authorize mapper/harness code | Product (explicit) | Authorize message; P-CL, P-FC, P-YL | Mapper PR | **No M** without it; **T** separate |

**T ≠ M.** Recommended order after P-CL/P-FC/P-YL: **M** (offline Y1–Y15 + fail-closed) → L1–L2/L7 → **T**.

---

## Quick readiness

| Path | Ready now? |
| --- | --- |
| Offline **M** (fixtures, fail-closed, `provider=demo`, game-scoped aliases, no HTTP) | After **P-CL, P-FC, P-YL** + authorize **M** |
| One-game **T** | After L1–L2 (+L7 if capture), authorize **T**; Path A not required |
| Path A derive | **Blocked** on E-PA1, E-PA2, P-PA (E1–E3) |
| Production / live | Out of scope — needs separate live keys, licensing, ops (POC plan §7) |

**STOP** — waiting on product/counsel decisions and separate **T**/**M** authorizations. Do not merge this tracker to main without approval.
