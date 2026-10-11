# Decisions & Forward Plan — NFL Analytics Simulator

> **Purpose:** Authoritative executive brief for external review — decisions, verified state, evidence, gated forward plan.  
> **Date:** 2026-10-11 (D015 closed on Convention B review branch; supersedes open-D015 brief text on PR #5)  
> **Kind:** Sendable snapshot (Claude-/externally-safe).  
> **Verified `origin/main` SHA:** `15da234b900059ab2a8f36279112203d02cace37` (merge of PR #3)  
> **Convention B PR:** [#7](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/7) — branch `cursor/convention-b-gate-8222` (base review tip `d9165f49…`; see `reports/ep/PR7_REVIEW_AND_ARTIFACT_DECISION.md`)  
> **Repo:** [nmpy7knjd8-code/nfl-analytics-simulator](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator)  
> **Destination product:** one simulator → validated EP/EPA/WP → historical decision analysis → validated decision engine → live decision terminal.

**Note on PR #5:** The open-D015 narrative on PR #5 is a **dated public snapshot**. This file on the Convention B review branch is the **successor** brief after D015 adoption. Do not treat PR #5 merge state as current for D015.

---

## 1. One-page executive summary

| | |
| --- | --- |
| **Where we are** | Stage A EP merged on `main` (PR #3). **D015 accepted: Convention B** on local branch `cursor/convention-b-gate-8222` (code + `EP_MODEL_SPEC` §6). |
| **What’s blocked** | Restore original `ep_model.joblib` for project-model EPA pre/post (2019–2022). Until then: model-surface validation = **unverified / lake-EP only**. WP kickoff still gated on that restore + review merge authorization. |
| **Evidence status** | Task A (lake `ep`, 2019–2022): B matches published `epa` on TD/FG; identity \(\sum\mathrm{EPA}_B=R-\mathrm{EP}_0\) passes. Synthetics re-verified this session. Full lake diagnostic **not re-run** here (no lake on this VM). |
| **Destination** | Live decision terminal on a validated shared engine — historical first, live adapters last. |
| **This week’s job** | Review/merge Convention B when authorized; restore joblib; then WP plan execution. **No live.** |

**Bottom line:** Score-cash is a **deliberate spec change to Convention B**, not a silent bugfix. Artifact provenance remains the hard gate for model-surface claims.

---

## 2. Decisions

### D015 — EPA Convention B (score-cash) — **ACCEPTED** (2026-10-11)

| | |
| --- | --- |
| **Decision** | **Adopt Convention B** in production: on non-timeout scoring rows with \(\|R\|>0\), `EPA = R − ep_before` (`R` ∈ {±7,±3,±2}); XP/2PT \(R=0\) (TD +7 fold). Non-score paths unchanged. |
| **Date** | 2026-10-11 |
| **Evidence basis** | Task A investigation + recon Addendum A; attribution table `docs/EPA_CONVENTION_B_ATTRIBUTION.md`; synthetics `tests/test_epa_scoring_credit.py` |
| **Artifact provenance** | Production `ep_model.joblib` **missing**; meta present — see `reports/ep/ARTIFACT_PROVENANCE.md`. Model-surface pre/post **Blocked**. |
| **Spec** | `docs/EP_MODEL_SPEC.md` §6 updated on Convention B branch |
| **Not claimed** | nflfastR PAT/2PT row bit-parity; project-`model_epa` historical tables without restored joblib |

### Joblib restore — **OPEN · HARD PREREQUISITE** (model-surface only)

| Item | State |
| --- | --- |
| `ep_model.meta.json` | Present (`selected_C=0.25`, era excluded, train 2019–2021) |
| `ep_model.joblib` | **Missing** (gitignored) |
| Constraint | No silent retrain as “original” |

### Other gates

| # | Decision | Status |
| --- | --- | --- |
| O1 | Start Phase 4 WP | Hold until joblib restore + B review merge auth |
| O2 | Push Convention B / Task A branches | **Done** — PR #7 open (CI workflow still omitted: token lacks `workflow` scope) |
| O4/O5 | PR #4 / CI | Do not modify PR #4/#5 in this workstream; proposed CI at `reports/ep/ci-workflow-proposed.yml` |

**D014:** Still accepted for Stage A merge / era exclusion / no 2023 tuning. Score-cash stance **superseded by D015** (B adopted).

---

## 3. Verified current state (this gate)

| Ref | State |
| --- | --- |
| `origin/main` | `15da234…` — Convention A still on remote until B merges |
| Task A tip (safety) | `a0356c33…` — `pre-d015/epa-scoring-credit-20261011T1924Z` |
| Convention B branch | `cursor/convention-b-gate-8222` via PR #7 |
| WP model | Absent |
| Live | Stubs only |

---

## 4. Evidence highlights

| Claim | Label |
| --- | --- |
| Offense TD MAE A≈8.01 / B≈0 vs lake `epa` (n=5242) | **Reported** (Task A JSON/CSV; not re-run this VM) |
| Identity B: 11198/11198 pass | **Reported** (Task A) |
| Synthetics +13 scoring-credit | **Verified** this session (exit 0) |
| Production joblib present | **Blocked** / missing |

---

## 5. Forward plan

```
A.1 ✓ Stage A on main
A.2  D015 Convention B (code/spec local) → joblib restore → model pre/post
A.3  Task B hygiene
B    Situation WP (no odds)
… → C/D decision lab → E/F live → R 2024–25 robustness
```

---

## 6–9. Deferred / links / next actions

Deferred: live providers, nfl4th as runtime, 2024–25 training into Stage A, betting/`vegas_wp`.

**Smallest next actions:** (1) authorize push/review of Convention B branch; (2) restore original joblib; (3) run model-surface pre/post 2019–2022; (4) then WP per `docs/WP_PHASE_PLAN.md`.
