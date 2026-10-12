# Sportradar Simulation — decision request for authorize **T**

**Date:** 2026-10-12  
**Main tip (post #24 merge):** `58d51a8ac0f39faa595f5051b501589ae7b378ee`  
**Sources on main:** `SPORTRADAR_BLOCKER_TRACKER.md`, `SPORTRADAR_SIMULATION_EXECUTION_CHECKLIST.md`, `SPORTRADAR_BLOCKER_RESOLUTION.md`, `OFFLINE_PRE_SNAP_MAPPER.md`  
**Mode:** Prerequisites only — **no Simulation, HTTP, vendor contact, credentials, or costs**
**Docs PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/25  
**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/7a95daede73491ab5bd4e3680e35e130f419412b/docs/NEXT_STEPS_DELTA_SPORTRADAR_T_DECISION.md

**No legal conclusions.** Public “no API key” docs are not a clearance.

**Proposed trial shape (prefer minimal):** one NFL Simulation game → process in memory → emit redacted field-coverage / latency metrics only → **no persistent provider JSON** in repo, CI, or long-lived disk. Path A stays unsupported; `live_feed=false`; fail-closed `receive_2h_ko`; recorded-demo + historical unchanged. Offline mapper is on main (PR #24).

---

## Part A — PR #24 (resolved)

| Item | Actual |
| --- | --- |
| PR #24 | **MERGED** — merge SHA `58d51a8ac0f39faa595f5051b501589ae7b378ee` (tip was `5ad06fc`) |
| Main tip | `58d51a8ac0f39faa595f5051b501589ae7b378ee` |
| Offline mapper on main | **Yes** |
| Pytest on main | `test_offline_mapper` + `test_pre_snap_adapter` + `test_recorded_demo` → **63 passed**, exit 0 |

Authorize **T** remains a **separate** decision from the #24 merge.

---

## L1 / L2 / L7 — exact tracker wording + status

| ID | Tracker wording (exact) | Closed from repo evidence? | Still needs |
| --- | --- | --- | --- |
| **L1** | Call Simulations (`playback.sportradar.com`) for one-game proof? | **No** — POC plan cites public Simulations docs (keyless); that is **not** product/counsel OK | Written product + counsel OK (date-stamped ToS/Simulations pages) |
| **L2** | Ephemeral hold of Simulation JSON during trial? | **No** — checklist asks ToS ephemeral use; unanswered | Written OK scoped to in-process / trial-duration only |
| **L7** | Retention/deletion SLA for vendor JSON | **N/A if no persistent capture** (recommended). Tracker: “**T blocked** before first capture if L2 yes without L7” | Only if any capture/persist is approved — then written retention/deletion rule **before** first write |

**Related (not in minimum T gate if no persist):** L3 retain raw in repo/CI → propose **No**; L4 retain derived artifacts → propose **No** (metrics/redacted matrix only); L5 Order Form? → still open but ask counsel in same pass; L6 display rights → internal trial only.

Authoritative in-repo citations (not clearances): tracker §3; execution checklist §1; blocker resolution L1–L7 questions; POC plan §1 Simulations URLs.

---

## Smallest decision request (product owner / counsel)

Please answer **yes/no** (or N/A) and then authorize **T** explicitly:

1. **L1:** Approve calling `playback.sportradar.com` for **one** internal NFL Simulation game (no production keys, no sales outreach)?  
   - [ ] Yes - [ ] No

2. **L2:** Approve **ephemeral** (memory / trial-temp only) hold of Simulation JSON while mapping — deleted when the trial process exits?  
   - [ ] Yes - [ ] No

3. **Persist provider data?** (recommended default **No**)  
   - [ ] **No persistent capture** (no raw JSON to repo/CI/disk after exit) → **L7 = N/A**  
   - [ ] Yes, capture allowed → answer **L7** retention/deletion SLA: _______________

4. **L3 raw fixtures in repo:** No (default) / Yes  
5. **L4 keep derived snapshots/Lab artifacts:** No (default; redacted metrics OK) / Yes  

6. **Authorize T:** Explicitly authorize the one-game Simulation trial under the answers above (still **not** production live feed, odds, or betting)?  
   - [ ] **Authorize T — Yes** - [ ] No

---

**STOP** — do not run Simulation or call APIs until **L1 + L2** are Yes, persist choice is set (L7 if capture), and **Authorize T — Yes** is explicit.
