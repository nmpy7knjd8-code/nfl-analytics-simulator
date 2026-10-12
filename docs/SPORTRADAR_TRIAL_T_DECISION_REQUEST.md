# Sportradar Simulation — decision request for authorize **T**

**Date:** 2026-10-12  
**Main tip at audit:** `b483ac0d45b6b06a17ab0f0a31fe46ba5e90d806`  
**Sources on main:** `SPORTRADAR_BLOCKER_TRACKER.md`, `SPORTRADAR_SIMULATION_EXECUTION_CHECKLIST.md`, `SPORTRADAR_BLOCKER_RESOLUTION.md`  
**Mode:** Prerequisites only — **no Simulation, HTTP, vendor contact, credentials, or costs**

**No legal conclusions.** Public “no API key” docs are not a clearance.

**Proposed trial shape (prefer minimal):** one NFL Simulation game → process in memory → emit redacted field-coverage / latency metrics only → **no persistent provider JSON** in repo, CI, or long-lived disk. Path A stays unsupported; `live_feed=false`; fail-closed `receive_2h_ko`; recorded-demo + historical unchanged.

---

## Part A note — PR #24

| Claim | Actual |
| --- | --- |
| “#24 merged on main” | **False** — PR #24 is **OPEN** @ `5ad06fc`; mergeCommit null |
| Main tip | `b483ac0` — offline mapper **not** on main |
| Mapper tests | Green on **PR branch** tip only (see status) |

Merge of #24 is a **separate** approval from authorize **T**.

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

**Also separate (not T):** Merge PR #24 offline mapper to main? Yes / No

---

**STOP** — do not run Simulation or call APIs until **L1 + L2** are Yes, persist choice is set (L7 if capture), and **Authorize T — Yes** is explicit.
