# Roadmap

Phase gates: tests + report + **user approval** before next phase.

## Phase 1 — Audit, research, architecture, contracts ✓

* Repo audit, AGENTS.md, architecture/decisions/dictionary
* Research + data docs adopted; contracts + tests
* GitHub docs + Pages hub

## Phase 2 — Historical ingest + API + minimal replay UI ✓

**Scope: historical replay only.** Merged to `main` (PR #1).

* `nflreadpy==0.1.5`; pinned 2023 raw + canonical lake + DuckDB
* FastAPI games/plays; Next.js Game Explorer; reference columns labeled

## Phase 3 — Stage A EP → EPA ✓

* `EP_MODEL_SPEC.md` → leakage-safe sklearn multinomial EP (era feature **excluded**) → deterministic EPA
* Backfill 2019–2022; chrono split enforced; held-out 2023 report under `/reports/ep/`
* Audit fixes: half-boundary terminal EPA, XP/2PT label exclusion, API safety
* Focused nflverse reconciliation on val 2022 — post-score EPA gap = **convention** (parity not required)
* Merged via [PR #3](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/3); EPA Convention B overlay (D015) via PR #7
* Report: [`reports/ep/AUDIT.md`](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/reports/ep/AUDIT.md)

### Public-model comparison (closed for Stage A)

Focused reconciliation complete for target definition, scoring attribution, terminals, possession changes, error decomposition. Exact nflfastR bit-parity **deferred**; reopen only if a likely defect appears. Does **not** block WP.

## Phase 4 — Situation WP + empirical sampling stubs — prototype on main (PR #8)

* WP without odds; MODEL_VALIDATION reporting
* Empirical resample stubs for sim paths
* No live adapters; no decision-lab recommendations in this phase

## Phase 5 — Simulation engine + UI workflow

* Seeded MC; game → situation → baseline → distributions
* Freeze a historical (or later live) play and explore alternate paths

## Phase 6 — Strategy / decision lab (user priority) — offline prototypes on main

On main: offline fourth-down analyzer (#9), historical decision lab (#11), season-aware transitions (#12), punt variance + clock (#13), Situation Lab UI (#14), pre-snap fixture adapter (#15), recorded-frame demo (#16), fourth-down quiz MVP (#28). Promotion/hardening is gated (P6–P8).

Situational decision support on top of validated EP/EPA/WP and the rules engine — **not** Phase 2/3 work.

* Fourth-down: go vs punt vs field goal (nfl4th-inspired; disclose simplifications)
* Clock management: timeout use, spike/kneel, end-of-half / two-minute choices
* Compare options under EP vs win-probability objectives (they can disagree)
* Label outputs clearly: historical observation vs model prediction vs counterfactual simulation
* UI: Strategy Lab + Situation Lab decision panels per UI_SCREEN_SPECS

## Later — Live adapters (deferred; planning only)

On main: feed evaluation (#17), Sportradar POC plan → execution checklist → blockers → clarifications → tracker → product sign-off (#18–#23), offline pre-snap mapper (#24), trial T decision + report (#25). No live wiring; no raw vendor persistence.

* After WP + decision lab foundations only
* Separate from finalized historical lake; no new providers in Stage A/WP start

## Product phases (P1–P9 answers, PR #27)

Current authorization: **Phase P only** (demo polish / PR hygiene). See [PRODUCT_NEXT_STEPS_DECISIONS.md](PRODUCT_NEXT_STEPS_DECISIONS.md).

* **P — Demo polish:** Pages fan demo (#26), quiz (#28), landing page (#29). Accepted as checkable v1.
* **A — Analytics depth:** Convention B promote, EP/WP artifact promotion, decision-lab hardening. Needs explicit authorization.
* **F — Feed integration:** mapper coverage, optional longer Simulation trial, persist policy. Needs explicit authorization.
* **L — Live:** paid keys / commercial terms / production feed. Hard defer.
* Betting / odds: out of scope.
