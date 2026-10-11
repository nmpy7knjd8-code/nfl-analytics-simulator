# Sportradar — product sign-off checklist (P-CL / P-FC / P-YL)

**Date:** 2026-10-11  
**Main tip:** `1158eeae4dcb376f23c25cfed9c2f495abcd23a9` (PR #22 tracker)  
**Sources:** [`SPORTRADAR_BLOCKER_TRACKER.md`](./SPORTRADAR_BLOCKER_TRACKER.md), [`SPORTRADAR_IMPLEMENTATION_CLARIFICATIONS.md`](./SPORTRADAR_IMPLEMENTATION_CLARIFICATIONS.md), [`SPORTRADAR_BLOCKER_RESOLUTION.md`](./SPORTRADAR_BLOCKER_RESOLUTION.md)  
**Mode:** Sign-off checklist only — no mapper, Simulation, API, vendor, or **T**/**M** authorization
**Docs PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/23  
**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/78f24ca586bb71bcf4bc895b01d68023a1dd3ec6/docs/NEXT_STEPS_DELTA_SPORTRADAR_SIGNOFF.md

**Locked (unchanged):** Path A **unsupported** (E1–E3 absent). `PreSnapProvider` = `fixture`\|`demo` closed. Alias matching = `alias.normalize.v1` + game-scoped `to_team_id` (reject unknown). Fail-closed binding until Path C/A approved. Preserve recorded-demo + historical.

---

## P-CL — Accept clarifications as binding for **M**

* **Decision:** Product written accept that `SPORTRADAR_IMPLEMENTATION_CLARIFICATIONS.md` on main is the binding quality bar for any future mapper (**M**), including Path A unsupported, alias rules, enum extension policy, and §4 test plan (Y1–Y15, C1–C15).
* **Existing contract / spec / tests:** Clarifications (full doc); tracker row P-CL; `contracts/pre_snap.py` (`PreSnapProvider`, `Freshness`, `AUTO_SITUATION_FIELDS`); `PRE_SNAP_ADAPTER.md`; regression suites `test_pre_snap_adapter.py`, `test_recorded_demo.py` (C7/C8/C14/C15 shape — already green for fixture/demo/historical). **No** Sportradar mapper tests exist yet.
* **Evidence to sign off:** Explicit product accept (or waive) naming that clarifications file + main SHA.
* **Unresolved ambiguity:** None in the written rules; sign-off itself is missing. Expanding `season_type.map.v1` / alias table / enum still needs separate PRs (not part of P-CL).
* **Unblocks:** **M offline only** (prerequisite for authorize **M**). Does not authorize **T** or HTTP.

---

## P-FC — Accept `receive_2h_ko.fail_closed.v1` as default

* **Decision:** Product written accept of clarifications §1.3 / blocker-resolution rule: never silent-default `receive_2h_ko` (including 0); never allowlist/`user_fallback`; if no approved Path A/C bit → unsupported-state, no Lab scoring, log `receive_2h_ko_unavailable` / fail_closed. Path A stays **unsupported**; Path C not enabled unless separate P-PC.
* **Existing contract / spec / tests:** Rule text in `SPORTRADAR_BLOCKER_RESOLUTION.md` (`receive_2h_ko.fail_closed.v1`); clarifications §1; `receive_2h_ko` ∈ `AUTO_SITUATION_FIELDS` (`contracts/pre_snap.py`); adapter test deletes `receive_2h_ko` → reject (`test_pre_snap_adapter.py` — supports C1 shape). Clarifications C2 (fail_closed + no Lab `configs` for Simulation mapper) **not implemented** (no mapper yet).
* **Evidence to sign off:** Written accept that fail-closed is the POC default; Path A/C remain off unless later approved.
* **Unresolved ambiguity:** None for the fail-closed rule text. Path A I3/polarity still unsupported (E-PA1/E-PA2) — does not block accepting fail-closed.
* **Unblocks:** **M offline** (required before **M**). Also required for any future **T** scoring path that lacks the bit — sign-off does **not** start **T**.

---

## P-YL — Sign off yardline transform + Y1–Y15

* **Decision:** Product written accept that the planned transform and table Y1–Y15 (blocker resolution §3; clarifications §4.1) are the acceptance definition for SR `location.alias` + `location.yardline` + possession → `yardline_100` ∈ [1,99]; reject missing/out-of-range/alias-not-in-game; case-normalize via `alias.normalize.v1` (Y15); never silent clamp/invert.
* **Existing contract / spec / tests:** Transform + Y1–Y15 table in `SPORTRADAR_BLOCKER_RESOLUTION.md` §3; function sketch `yardline_100_from_sr` in clarifications §4.1; `yardline_100` allowlist field in `contracts/pre_snap.py` / `PRE_SNAP_ADAPTER.md`. Adapter tests cover allowlist omit/`user_fallback` for `yardline_100`, **not** SR→`yardline_100` conversion. **Y1–Y15 unit tests: not coded.**
* **Evidence to sign off:** Written accept of transform + Y1–Y15 as the **M** acceptance table (coding comes after authorize **M**).
* **Unresolved ambiguity:** Spec assumes SR yardline = yards from named team’s goal line (POC/checklist). No in-repo raw SR payload to re-verify that convention without **T**. Nickname aliases remain reject (E-AL1) — out of P-YL scope for one-game home/away.
* **Unblocks:** **M offline** (required before merging a scoring mapper). Affects **T** later only as the spot-check oracle (S1–S5+); sign-off alone does not authorize **T**.

---

## Remaining **T** prerequisites (separate — do not start trial)

Not closed by P-CL / P-FC / P-YL. No vendor contact / Simulation / credentials in this step.

| ID | Needed before authorize **T** | Status |
| --- | --- | --- |
| L1 | Written OK to call `playback.sportradar.com` for one-game proof | Open |
| L2 | Written OK for ephemeral Simulation JSON during trial | Open |
| L7 | Retention/deletion SLA **if** capturing vendor JSON (required before first capture when L2 applies) | Open if capture; N/A if purely ephemeral with no persist |
| **T** | Explicit authorize-to-run one-game Simulation | Not issued |

Also still separate: authorize **M** (after P-CL/P-FC/P-YL). L3–L6 remain product/counsel items but are not the minimum **T** gate per tracker (L1–L2 + L7 if capture).

**STOP** — awaiting product sign-off on P-CL / P-FC / P-YL. Do not authorize **T** or **M** from this document alone.
