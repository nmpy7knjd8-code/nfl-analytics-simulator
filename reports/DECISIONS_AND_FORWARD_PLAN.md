# Decisions & Forward Plan — NFL Analytics Simulator

> **Purpose:** Authoritative executive brief for external review (Claude / collaborators) — open decisions, verified state, evidence highlights, and gated forward plan. Docs-only; no implementation.  
> **Date:** 2026-10-11  
> **Kind:** Sendable snapshot (Claude-/externally-safe). Private Cursor store paths removed; links point at this public GitHub repo (or note when a workstream is still unpushed).  
> **Verified `origin/main` SHA:** `15da234b900059ab2a8f36279112203d02cace37` (merge of PR #3)  
> **Repo:** [nmpy7knjd8-code/nfl-analytics-simulator](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator)  
> **Destination product:** one simulator → validated EP/EPA/WP → historical decision analysis → validated decision engine → live decision terminal (adapters only; no second app).

---

## 1. One-page executive summary

| | |
| --- | --- |
| **Where we are** | Phase 1–2 complete. Stage A EP/EPA **merged** on `main` (PR #3). Historical Game Explorer works. Sklearn multinomial EP (era excluded) + Convention A EPA ship in code. |
| **What’s blocked** | **Milestone A.2 / D015:** adopt score-cash Convention B **or** keep A with documented consequences; restore missing `ep_model.joblib` for project-model pre/post. Until closed: **no** Task B, WP, decision lab, or live. |
| **Evidence status** | Task A investigation **complete** (local, unpushed): Stage A is **coherent vs its own spec** but **unsuitable** vs nflfastR / next-score identity on scoring plays. Production EPA **unchanged**. |
| **Destination** | Live decision terminal on a **validated** shared engine — historical lake first, live adapters last (Milestones E→F). |
| **This week’s job** | Decide D015; locate/restore saved joblib; push/merge the right docs and Task A evidence when ready. **Do not** start WP or live. |

**Bottom line:** The score-cash question is answered scientifically; it is **not** yet a product decision. Everything downstream waits on that call plus the missing artifact.

---

## 2. Open decisions

### D015 — EPA Convention A vs B (score-cash) — **OPEN · IMMEDIATE**

| | Convention A (current on `main`) | Convention B (nflfastR / reference) |
| --- | --- | --- |
| **Rule on scores** | No separate overlay; TD/FG/safety follow PC/terminal next-scrimmage path | Override: `EPA = R − ep_before` (`R` ∈ {±7, ±3, ±2}); try/KO separate rows |
| **Non-score** | ΔEP / PC sign-flip / terminal `−ep` | Same spirit (aligned) |
| **Identity `ΣEPA = R − EP₀`** | Fails by design (~`−R` residual on score closes) | **Passes** (Task A: 11,198 intervals, max residual ~4e−16) |
| **vs published `epa` on TD/FG** | MAE ≈ 8 / ≈ 4; ~99.5% of offense TDs **negative** EPA | MAE ≈ 0 (noise) |

**Options**

1. **Adopt B** — overlay on scoring plays; update `EP_MODEL_SPEC` §6; re-verify identities + outcome table on **project** EP surface (needs joblib).  
2. **Keep A** — leave production as-is; document that EPA is unsuitable for next-score / public-`epa` interpretation in decision lab; define alternate accounting for decisions.  
3. **Defer forever** — not viable if the product goal is decision analysis that uses EPA as next-score value.

**Recommendation (evidence-backed):** **Adopt Convention B** if EPA must be next-score-consistent or reference-comparable on scores — Task A + recon settle that public EPA cashes `R` on the scoring play, and A marks ~99.6% of offense TDs as negative EPA. Keep A only if the product explicitly accepts that EPA will **not** mean “change in expected next-score value” on scoring plays.

**Consequences**

| Choice | Unblocks | Cost / risk |
| --- | --- | --- |
| Adopt B | Model-surface pre/post → Task B → WP → decision path with coherent EPA | Spec + code change; must restore joblib first; not a silent “bugfix” |
| Keep A | Can document and proceed with **non-EPA** decision objectives only if defined | Decision-lab EPA objectives remain misleading vs public analytics |

**Blocked until decided:** Task B, Phase 4 WP, historical 4th-down (C), decision validation (D), live (E/F).

---

### Joblib restore — **OPEN · HARD PREREQUISITE**

| Item | State |
| --- | --- |
| `reports/ep/artifacts/ep_model.meta.json` | Present on `main` (`selected_C=0.25`, era excluded, train 2019–2021) |
| `reports/ep/artifacts/ep_model.joblib` | **Missing** (gitignored; absent on fresh clone) |
| Constraint | **No silent retrain substitute** for pre/post tables |

**Options:** (1) Restore the **same saved** artifact from secure backup / original host; (2) if truly lost, treat as new phase gate (retrain + new meta) — **not** Task A scope.

**Blocked until restored:** project-`model_epa` pre/post on 2019–2022; any production EPA change that claims model-surface validation.

---

### Other open / approval gates

| # | Decision | Options | Recommendation | Blocks |
| --- | --- | --- | --- | --- |
| O1 | Start Phase 4 WP after A.2 | Approve / hold | Approve **only after** A.2 closes | WP kickoff |
| O2 | Push Task A branch | Push now / after D015 | Push for review when ready; **merge production EPA only after D015 + joblib** | Sharing evidence on GitHub |
| O3 | Push roadmap docs branch | Push / hold | Push docs when ready; merge after review (docs-only) | Public ROADMAP/HANDOFF sync |
| O4 | Merge PR #4 (audit packet) | Merge / leave open | Merge when convenient — **dated pre-merge snapshot**; do not treat as current gate | Pages URL for packet |
| O5 | Install CI workflow | Copy proposed YAML → `.github/workflows/` | Do after A.2 or with Task B; needs `workflow` token scope | Automated checks |

**Already decided (D014, closed):** Stage A merge via PR #3; era excluded from production; non-score parity chase not required; 2023 not for tuning.

---

## 3. Verified current state

### Git / PRs (read-only check 2026-10-11)

| Ref | SHA / state |
| --- | --- |
| `origin/main` | **`15da234…`** — “Merge pull request #3 …” |
| PR #1 Phase 2 | Merged |
| PR #2 Stage A pre-audit | Merged via #3 stack (superseded as standalone) |
| PR #3 audit Stage A | **Merged** → `main` |
| PR #4 docs audit packet | **OPEN** — `cursor/docs-current-state-audit-packet-aa00` @ `8c536fc…` |

### Merged vs local-only

| Workstream | Location | On `main`? |
| --- | --- | --- |
| Stage A EP/EPA + audit fixes | `main` @ `15da234` | **Yes** |
| Task A scoring-credit (code, tests, reports) | Branch `cursor/epa-scoring-credit-0f5a` tip `a0356c33…` (investigation `a7077d45…`) | **No** (local / unpushed) |
| Live-decision roadmap docs | Branch `cursor/live-decision-roadmap-d344` | **No** (local / unpushed); project notes also hold mirrors |
| CURRENT_STATE_AUDIT_PACKET | PR #4 branch | **Not on `main`** |

### Capabilities

| Area | Status |
| --- | --- |
| Historical ingest + Game Explorer | ✓ on `main` |
| EP model code + meta | ✓; **joblib absent** |
| EPA Convention A | ✓ on `main` |
| EPA vs public score-cash | Unsuitable (Task A evidence; production unchanged) |
| WP model | Absent |
| Decision engine / 4th-down | Absent (specs/stubs only) |
| Live providers / sim | Stubs only |
| Backend tests on `main` | 54 `test_*` (Task A adds +13 → 67 locally) |
| CI under `.github/workflows/` | Absent (proposed YAML only) |
| 2024–2025 robustness | Not started |

### Snapshot caveat

[`CURRENT_STATE_AUDIT_PACKET.md`](https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/8c536fc20ec5a87ecb1608372d9666e4111012dc/docs/CURRENT_STATE_AUDIT_PACKET.md) is a **pre-merge** inspection (main then `e5849ce`; PRs #2/#3 open). **Superseded for merge status** by Stage A landing at `15da234`. Still useful for audit methodology and PR #2 vs #3 safety delta; use HANDOFF + this brief for “where we are now.”

---

## 4. Evidence highlights (do not invent beyond sources)

### Recon — keep A / B / C separate

| Comparison | Question | Status |
| --- | --- | --- |
| **A** EP model | Same inputs → similar `ep`? | Prior agreement metrics exist; not re-run in Task A |
| **B** EPA convention | Same EP vector → same score-cash / PC / half rules? | **Settled:** public cashes `R−ep` on scores; Stage A does not (deliberate convention) |
| **C** Predictive eval | Labels + model calibrate on permitted data? | Stage A metrics stand; not regenerated in Task A |

### Task A outcome table (lake `ep`, 2019–2022, n = 155,920)

| Bucket | n | MAE A | MAE B | Note |
| --- | ---: | ---: | ---: | --- |
| td_offense | 5,242 | **8.012** | **0.000** | A: 99.62% negative EPA |
| td_defense_or_return | 271 | 8.030 | 0.000 | |
| fg_made | 3,391 | **3.926** | **0.000** | A: 99.44% negative |
| safety | 62 | 0.805 | 0.129 | residual attribution |
| same_possession_other | 132,697 | 0.002 | 0.002 | A ≡ B ≈ ref |
| punt / TOD / non-score PC | (see full table) | ≈ A≡B | | Non-score OK |
| **overall** | **155,920** | **0.375** | **0.0065** | |

Identity under B: **11,198 / 11,198** pass. Project-`model_epa` tables: **not run** (joblib missing). 2023: **sealed / not loaded**.

### Classification

**Coherent but unsuitable** (comparison B): implements locked Stage A rules; unsuitable if EPA must track next-score value or match public `epa` on scores.

---

## 5. Forward plan / milestone sequence (with gates)

```
A.1 ✓ Stage A on main
  → A.2  D015 + joblib / model pre/post     ← YOU ARE HERE (blocker)
  → A.3  Task B hygiene (after A.2)
  → B    Situation WP (no odds)
  → Ph5  Sim transitions (counterfactual substrate)
  → C    Historical 4th-down analysis
  → D    Decision-engine validation (“ok for live”)
  → E    Provider-independent live → GameSituation
  → F    Live provider + decision terminal
  → R    2024–2025 robustness (report-only; not Stage A tune)
```

| Gate | Acceptance (short) |
| --- | --- |
| **A.2** | D015 recorded; if B: spec + overlay + identities/outcome on project EP 2019–2022; if A: documented decision-lab consequences |
| **A.3** | Hygiene only; no bit-parity chase |
| **B** | WP + `/reports/wp/` metrics; no spread/`vegas_wp` |
| **Ph5** | Seeded sim + truth chips |
| **C** | Historical 4th-down reports; disclosed simplifications |
| **D** | Validation report + “reliable enough for live” checklist |
| **E** | Demo/unconfigured live → `GameSituation` + tests |
| **F** | Authorized provider + terminal on **validated** engine |
| **R** | 2024–25 report-only drift audit |

**Constraints preserved:** 2019–2022 for EPA Task A window; no 2023 tuning; no 2024–25 training into Stage A; no live recs on unvalidated models; one `GameSituation` + one decision engine.

---

## 6. Work sitting unpushed — what to push/merge when

| Item | Branch / PR | Contents | When |
| --- | --- | --- | --- |
| **Task A** | `cursor/epa-scoring-credit-0f5a` (local; ahead of main by ~6) | Diagnostic module/script, +13 tests, scoring_credit reports, investigation MD | **Push** for review anytime; **do not merge a production EPA fix** until D015 + joblib + model pre/post |
| **Roadmap docs** | `cursor/live-decision-roadmap-d344` (local) | ROADMAP / HANDOFF / ARCHITECTURE / DECISIONS / index | **Push** when ready; merge as docs-only after review |
| **PR #4** | [#4](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/4) OPEN | CURRENT_STATE_AUDIT_PACKET (Claude-sendable) | Merge when convenient for Pages; **note superseded merge narrative** in packet header |

**This brief:** published on a docs-only PR branch for external paste (raw GitHub URL). **Do not** treat merge of this PR as closing D015 or restoring joblib.

---

## 7. Explicitly deferred

| Deferred | Until |
| --- | --- |
| Live provider adapters / credentials | After D (validation) → E → F |
| nfl4th / decision lab implementation | After WP + sim foundations (C/D); nfl4th = later MIT reference with license check, not a second runtime |
| 2024–2025 temporal robustness | Milestone R (separate; not Stage A tune) |
| Complex ML / XGB EP retrain / FG blend / kickoff EP layer | After core gates; only if justified |
| nfeloml as production dependency | Only after lake `ep`/`epa` parity on 2022 |
| Betting / odds / `vegas_wp` features | Out of MVP |
| Silent production EPA change without D015 | Never |

---

## 8. Links (sources)

### Companion docs (public where available)

| Doc | Public location |
| --- | --- |
| **This brief** | [`docs/DECISIONS_AND_FORWARD_PLAN.md`](./DECISIONS_AND_FORWARD_PLAN.md) (also mirrored under `reports/`) |
| Task A investigation | Not yet on public GitHub — local branch `cursor/epa-scoring-credit-0f5a` (tip `a0356c33…`; investigation `a7077d45…`) |
| Reference recon | Not yet on public GitHub (project notes only until a docs push) |
| Roadmap integration | Not yet on public GitHub — local branch `cursor/live-decision-roadmap-d344` |
| Audit packet (dated) | [raw @ `8c536fc…`](https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/8c536fc20ec5a87ecb1608372d9666e4111012dc/docs/CURRENT_STATE_AUDIT_PACKET.md) (PR #4) |
| ROADMAP / HANDOFF / ARCHITECTURE / DECISIONS | On `main` under [`docs/`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/tree/main/docs) (may lag unpushed roadmap branch) |
| Outcome CSV (Task A) | Not yet on public GitHub — ships with Task A branch when pushed (`reports` / scoring_credit path) |
| Internal agent statuses | Private project notes — not published |

### Public GitHub

| Resource | URL |
| --- | --- |
| Repo | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator |
| `main` @ `15da234` | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/commit/15da234b900059ab2a8f36279112203d02cace37 |
| Stage A audit (on main) | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/reports/ep/AUDIT.md |
| HANDOFF (on main — may lag) | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/docs/HANDOFF.md |
| PR #3 (merged) | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/3 |
| PR #4 (open, docs) | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/4 |
| Audit packet raw (PR tip) | https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/8c536fc20ec5a87ecb1608372d9666e4111012dc/docs/CURRENT_STATE_AUDIT_PACKET.md |
| Pages hub | https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/ |
| nflfastR EPA helper (reference) | https://github.com/nflverse/nflfastR/blob/master/R/helper_add_ep_wp.R |

---

## 9. Smallest next actions (this week)

Ordered checklist for the user:

1. **Decide D015** — Adopt Convention B (recommended if EPA = next-score value) **or** keep A with written decision-lab consequences; record in DECISIONS.  
2. **Locate / restore** `reports/ep/artifacts/ep_model.joblib` matching committed meta (same saved artifact; no silent retrain).  
3. **If adopt-B:** authorize a follow-on to apply scoring overlay + spec update + model-surface pre/post on **2019–2022 only** (after joblib).  
4. **Push** Task A branch `cursor/epa-scoring-credit-0f5a` so evidence is reviewable on GitHub (merge production EPA only after steps 1–3).  
5. **Push** roadmap branch `cursor/live-decision-roadmap-d344` (or equivalent) so ROADMAP/HANDOFF on GitHub match the A.2 gate.  
6. **Optionally merge PR #4** for the dated audit packet on Pages — with the understanding it is a pre-merge snapshot.  
7. **Do not** start WP, decision lab, live providers, 2024–25 training, or complex ML until A.2 closes.

---

*Synthesized from project investigations and status notes listed in §8. Uncertainties labeled in sources (fill/lead residual on some PC slices; nfeloml parity unmeasured; Task A SHAs not on `origin/main`) are preserved, not invented away.*
