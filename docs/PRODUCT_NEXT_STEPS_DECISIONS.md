# Product next steps — decisions needed for a **full finished product**

**Date:** 2026-10-12  
**Mode:** Answers recorded 2026-10-12 — Phase P authorized only (demo polish / PR hygiene). No Sportradar/vendor calls, no live feed, no paid keys; no Phase A/F/L model/feed/live work.  
**Sources:** Project notes (Cursor Agent Store — not public); [`sportradar/SPORTRADAR_TRIAL_T_DECISION_REQUEST.md`](sportradar/SPORTRADAR_TRIAL_T_DECISION_REQUEST.md), [`sportradar/SPORTRADAR_TRIAL_T_REPORT.md`](sportradar/SPORTRADAR_TRIAL_T_REPORT.md), [`OFFLINE_PRE_SNAP_MAPPER.md`](./OFFLINE_PRE_SNAP_MAPPER.md), [`FEED_EVALUATION.md`](./FEED_EVALUATION.md), [`DECISIONS.md`](./DECISIONS.md); open PR context in Project notes  
**Prior decision pattern:** Same shape as the Sportradar **T** request — answer prompts, then work proceeds only under what you authorize

**No legal conclusions.** Free/keyless Simulations access is not clearance for production live, commercial licensing, or persistent vendor data.

---

## 1. Where we are

- **Checkable fan demo is on main** via PR [#26](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/26) (merged); Pages source pinned to `main` `/docs`; [demo](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/demo/) remains the checkable v1 URL.
- **Offline pre-snap mapper is on main** (PR #24); adapter + recorded-demo + mapper tests green (**63** passed). Path A stays **unsupported**; missing `receive_2h_ko` → fail-closed.
- **Sportradar Simulation trial T completed** under free/keyless + Persist **No** — see [`sportradar/SPORTRADAR_TRIAL_T_REPORT.md`](sportradar/SPORTRADAR_TRIAL_T_REPORT.md): 7 HTTP calls, BAL@KC sim, mapper **0 ok / 6 fail-closed** (designed), **no** raw persist, **`live_feed=false`**, no odds/live/betting.
- **T acceptance matrix incomplete under sparse budget:** ≥3 situation changes and ≥5 fourth-down yardline spot-checks **not met** (natural-time clock; stopped rather than long-poll). Longer session remains unauthorized (recorded-only).
- **PR hygiene (P2):** #26 merged; #10 merged with #26 packaging (superseded content on main); #5 closed; #4 and #6 kept open.
- **Hard gates remain locked (P6–P8):** Convention B land / EP promote / isotonic WP persist / 4th-decision-lab polish all **No**; live/paid/commercial **hard defer**; persist **no raw vendor data**. Fan UI constraints remain: B&W + sparse blue accent; short layman **Why** on recommendations.

---

## 2. Path to finished product

Phased checklist for **this** project (simulation + analytics engine → situational decision support → optional live adapters). Stop after each phase for approval (project preference). Betting terminal detail is **out of MVP** unless you expand scope.

### Phase P — Demo polish (checkable v1)

- [x] Merge [#26](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/26) so Pages stays pinned to `main`
- [x] [#10](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/10) resolved with #26 (merged/superseded on main); close [#5](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/5) (stale open-D015 snapshot)
- [x] Keep [#4](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/4) and [#6](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/6) open
- [x] Accept current Pages demo as **checkable v1** (no polish pass)

### Phase A — Analytics depth (historical engine)

- [ ] Explicit authorize any remaining model work still gated: Convention B land/promote, EP `joblib` promote vs explicit-path-only, WP isotonic persist, further 4th-down / decision-lab hardening
- [ ] Keep nfeloml / nflfastR **reference-only**; no market/odds features in core WP
- [ ] Historical Situation Lab / decision surfaces stay labeled model/counterfactual, not historical fact

### Phase F — Feed integration (still not production live)

- [ ] Mapper strategy: stay fail-closed on missing `receive_2h_ko` **or** invest in more situation coverage (Path A remains unsupported unless separately approved)
- [ ] Optional: longer Simulation **T** with higher HTTP budget (unknown Sim quota) for multi-situation + 4th-down spot-checks — **or** stay recorded-demo-only
- [ ] Persist policy for any future provider data (default remains **no raw vendor JSON**)

### Phase L — Live (last; separate authorize)

- [ ] Explicit authorize (or hard defer) paid keys / commercial terms / production live feed
- [ ] Thin live adapter only after feed evaluation gates and D-validation style readiness — see [`FEED_EVALUATION.md`](./FEED_EVALUATION.md)
- [ ] Odds / betting / sportsbook UI: **out unless you expand scope**

---

## 3. Decisions needed from you

Answer each **P** prompt. Recommended defaults are suggestions only — your written answer controls.

### P1 — Merge Pages demo PR #26?

| | |
| --- | --- |
| **Question** | Merge [#26](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/26) so the live Pages demo is pinned to `main`? |
| **Why it blocks** | Without merge, the checkable demo stays on a PR branch tip; `main` and public Pages can drift. |
| **Recommended default** | **Yes — Merge #26** |
| **Options** | **Yes** (merge) / **No** (leave open) / **Defer** (name a condition) |

### P2 — PR hygiene: #10, #5, #4, #6?

| | |
| --- | --- |
| **Question** | Close #10 after #26; close #5; keep or merge #4 and #6? |
| **Why it blocks** | Stale/superseded PRs confuse “what is current”; #5’s open-D015 narrative is superseded on main lineage. |
| **Recommended default** | **Close #10** after #26 · **Close #5** · **Keep #4 open** · **#6: keep open or merge only if you want next-steps docs on main** |
| **Options** | For each PR: **Close** / **Merge** / **Keep open** / **Defer** |

### P3 — Accept current demo as checkable v1?

| | |
| --- | --- |
| **Question** | Is the live Pages demo enough as **checkable v1**, or do you want more fan-UI polish before calling the UI “done”? |
| **Why it blocks** | Sets whether next work is polish vs analytics/feed depth. |
| **Recommended default** | **Accept as checkable v1**; defer polish unless a specific UX gap blocks review |
| **Options** | **Accept v1** / **Polish pass** (list must-haves; keep B&W + layman Why) / **Defer** |

### P4 — Mapper / Path A: coverage vs fail-closed?

| | |
| --- | --- |
| **Question** | Invest in more situation coverage for Simulation/offline frames, or stay fail-closed when `receive_2h_ko` (and peers) are missing? |
| **Why it blocks** | Trial T showed **all as-delivered maps fail-closed** — expected with Path A unsupported. Coverage work does not silently invent Path A. |
| **Recommended default** | **Stay fail-closed**; Path A remains **unsupported** unless a separate Path A authorize appears later |
| **Options** | **Stay fail-closed** / **Invest in coverage** (still no Path A unless authorized) / **Defer** |

### P5 — Longer Simulation T vs recorded-only?

| | |
| --- | --- |
| **Question** | Raise HTTP budget for a longer natural-time Simulation session (≥3 situation changes / 4th-down spot-checks), or stay on recorded-demo + historical only? |
| **Why it blocks** | Sparse T did not meet multi-situation / 4th-down acceptance; Simulation quota is **unknown** — longer runs need explicit budget + STOP rules. |
| **Recommended default** | **Defer longer T** until feed/product priority is clear; recorded-demo remains the checkable path |
| **Options** | **Authorize longer T** (state max HTTP / wall time; Persist default **No**; abort on paywall/paid key) / **Recorded-only** / **Defer** |

### P6 — Authorize remaining model work?

| | |
| --- | --- |
| **Question** | Authorize any still-gated model work (Convention B land/merge if not on main path you want, EP artifact **promote**, WP isotonic **persist**, further EP/EPA/WP/4th hardening)? |
| **Why it blocks** | Preferences and history keep promote / isotonic / Convention B production changes behind explicit auth. Analytics depth cannot honestly claim “finished engine” without your gate calls. |
| **Recommended default** | **Authorize only named items**; leave promote + isotonic persist **No** until you say otherwise |
| **Options** | Per item: **Yes** / **No** / **Defer** — list: Convention B production land · EP promote · isotonic WP persist · 4th-down / decision-lab polish |

### P7 — Live feed / paid keys / commercial terms?

| | |
| --- | --- |
| **Question** | Authorize production live feed work and any paid keys / commercial terms outreach, or **hard defer**? |
| **Why it blocks** | Live is last in the roadmap; trial T was Simulation-only with `live_feed=false`. Paid keys and commercial terms need counsel/product OK — not inventable from free Simulations docs. |
| **Recommended default** | **Hard defer** live + paid keys + commercial terms |
| **Options** | **Authorize** (scope: vendor, key source, what may be stored) / **Hard defer** / **Defer with date/trigger** |

### P8 — Persist policy for production?

| | |
| --- | --- |
| **Question** | For any future provider/game-state data beyond ephemeral trial: what may be persisted? |
| **Why it blocks** | Trial Persist was **No** (L7 N/A). Production cannot invent retention; L7-style SLA is required before first durable vendor write. |
| **Recommended default** | **No raw vendor JSON** to repo/CI/long-lived disk; derived redacted metrics OK in Project docs only if you allow |
| **Options** | **No raw persist** (default) / **Ephemeral only** / **Derived artifacts OK** (specify) / **Raw allowed** → must state retention/deletion SLA before first write |

### P9 — Definition of “full finished product” for THIS project?

| | |
| --- | --- |
| **Question** | What must be **in** vs **out** for you to call this Project finished? |
| **Why it blocks** | Without a written definition, agents will keep expanding scope (live, odds, polish) instead of closing a coherent product. |
| **Recommended default (proposed “finished” bar)** | **In:** Pages demo on `main`; fan UI (B&W + Why); historical replay; offline/recorded pre-snap → Situation Lab path; documented EP/EPA/WP/4th prototypes with explicit artifact rules; fail-closed mapper; feed eval docs; **no** requirement for production live. **Out unless you expand:** paid live feed, odds/betting terminal, Path A, college/other leagues, sportsbook UI. |
| **Options** | **Accept recommended bar** / **Edit must-in / must-out** (write your list) / **Defer** |

---

## 4. What you can ignore for now

- Re-running sparse Simulation T with the same 7-call budget (won’t clear the multi-situation matrix).
- Path A derive / inventing `receive_2h_ko` (unsupported by product sign-off).
- Odds, betting, sportsbook layouts, college football.
- Counsel deep-dive on Simulations ToS unless you choose P7 authorize or change Persist from No.
- Re-opening Phase A/F/L or model/feed/live work without a new product authorize (Phase P only).

---

## 5. Reply template (filled 2026-10-12)

```text
PRODUCT NEXT STEPS — answers (2026-10-12)

P1 Merge #26: Yes
P2 PR hygiene:
  #10: Close after #26
  #5:  Close
  #4:  Keep open
  #6:  Keep open
P3 Demo v1: Accept checkable v1 (no polish pass)
P4 Mapper: Stay fail-closed (Path A unsupported)
P5 Simulation: Recorded-only for now
P6 Model gates:
  Convention B production land: No
  EP artifact promote: No
  Isotonic WP persist: No
  4th-down / decision-lab polish: No
P7 Live / paid keys / commercial: Hard defer
P8 Persist production: No raw vendor data
P9 Finished-product definition: Accept recommended bar

Explicit authorize next phase:
  [x] Phase P only (demo polish / PR hygiene)
```

---

## Recorded answers

**Recorded:** 2026-10-12 (product owner). Authoritative for Phase P execution.

| Gate | Answer | Notes |
| --- | --- | --- |
| P1 | **Yes — Merge #26** | Merged; Pages → `main` `/docs` |
| P2 | **#10** Close after #26 · **#5** Close · **#4** Keep open · **#6** Keep open | #10 landed via #26 packaging (merged); #5 closed |
| P3 | **Accept checkable v1** | No polish pass |
| P4 | **Stay fail-closed** | Path A unsupported |
| P5 | **Recorded-only** | No longer Simulation T / HTTP budget raise |
| P6 | **All No** | Convention B land / EP promote / isotonic WP persist / 4th-decision-lab polish |
| P7 | **Hard defer** | Live / paid keys / commercial |
| P8 | **No raw vendor data** | Persist policy for production |
| P9 | **Accept recommended finished-product bar** | Live/odds/Path A remain out unless expanded |
| Next phase | **Phase P only** | Demo polish / PR hygiene — do **not** start A/F/L model, feed, or live work |
