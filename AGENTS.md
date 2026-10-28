# AGENTS.md — NFL Analytics Simulator

## Mission

Build a research-grounded American football analytics and simulation platform, starting with NFL historical play-by-play. The initial product must reconstruct real games, calculate validated analytics, and simulate football situations. Real-time feeds and advanced models come later.

## Fixed defaults

* Backend: Python and FastAPI.
* Historical data and analytical storage: DuckDB and Parquet.
* Modeling: scikit-learn; use XGBoost only when justified.
* Frontend: Next.js and TypeScript.
* Initial source candidate: nflverse play-by-play through a maintained Python client, subject to verification.
* Initial experiment: seasons 2019–2023; train 2019–2021, validate 2022, test 2023.
* Local-first, CPU-only development.
* No paid services or credentials required for the historical MVP.
* Sports betting and odds are out of scope for the MVP.
* Preserve the existing repository’s working architecture unless a documented reason justifies changing it.

If an existing project conflicts with these defaults, inspect it and document the least disruptive option before changing the stack.

## Project rules

1. Inspect before modifying. Preserve functioning code and existing conventions.
2. Define and version shared schemas before parallel implementation.
3. Give each agent or workstream explicit file ownership and deliverables. Avoid concurrent edits to shared files.
4. Research the sources and licenses actually used. Do not assume publicly accessible means unrestricted commercial use or redistribution.
5. Keep observed data, derived features, model predictions, and simulated outcomes separate.
6. Preserve source provenance, timestamps, data versions, and model versions.
7. Prevent temporal leakage. A historical prediction may only use information available at its stated prediction time.
8. Never fabricate missing observations, live updates, model benchmarks, or validation results.
9. Make randomness reproducible with explicit seeds. Save the inputs and configuration needed to reproduce a simulation.
10. Keep football rules separate from statistical outcome models.
11. Expose model assumptions, limitations, training periods, and validation metrics.
12. Prefer a small, tested, end-to-end implementation over many unfinished subsystems.
13. Avoid unnecessary infrastructure, dependencies, abstractions, and paid services.
14. Do not silently change a public interface or canonical schema. Document and test changes.
15. After every phase, run the relevant tests, report actual results, document limitations, and stop for user approval before starting the next phase.

## Fan-site house rules (checked by scripts/acceptance)

* No EPA, WPA or xpass on fan screens; no odds, lines or betting text.
* No field goal offered over 64 yards; no overtime win chance; CHECKER_ENABLED stays false until approved.
* No agent or worker may write an "Approved by" line in a PR body unless it quotes HGIC's actual approval message for that exact PR (with time). A later rejection overrides an earlier approval; check HGIC's latest message on the PR right before merging.
* Team colors and logos: self-hosted nflverse team logos and wordmarks are allowed. Never hotlink external images (logo files must be self-hosted under /teams/ and listed in teams/manifest.json). The footer carries "Team names and logos are trademarks of the NFL and its teams. Not affiliated."

## Core domain invariants

* Every game, team, player, play, model, and simulation has a stable identifier where applicable.
* Game state uses documented field-position and clock conventions.
* Pre-play and post-play states are distinct.
* Missing data remain missing unless a documented method handles them.
* Probabilities are in [0, 1]; mutually exclusive outcomes must sum to 1 within a documented tolerance.
* Score, possession, down, distance, clock, timeouts, and ruleset remain consistent with supported football rules.
* Historical observations are never overwritten by simulated counterfactuals.
* Live data, if introduced, retain provider provenance, timestamps, revisions, and freshness status.
* Every model has explicit input requirements and output definitions.
* Unsupported states and rules are reported rather than silently misrepresented.

## Research and model standards

Use primary papers, official documentation, maintained public implementations, and inspectable source code where possible.

For every implemented model, record:

* Source and license.
* Target and feature definitions.
* Training period and data requirements.
* Implementation status: reproduced, approximated, or original.
* Evaluation method and held-out performance.
* Known limitations.

Compare probabilistic predictions using suitable metrics, including Brier score, log loss, and calibration. Compare numerical predictions using suitable error metrics. Include simple baselines and chronological evaluation. Accuracy alone does not establish decision quality or causality.

## Workstream ownership

One agent edits a shared file at a time; the lead integrator resolves conflicts.

| Workstream | Owns | Must not edit casually |
| --- | --- | --- |
| Architecture / integrator | `docs/ARCHITECTURE.md`, `DECISIONS.md`, `DATA_DICTIONARY.md`, `ROADMAP.md`, `HANDOFF.md`, `CHANGELOG.md`, `REPO_AUDIT.md`, contracts, `AGENTS.md` | Research narrative without reconciliation |
| Research | `RESEARCH_REGISTER.md`, `MODEL_CATALOG.md`, `LICENSING_AND_DATA_SOURCES.md`, `MODEL_VALIDATION.md` | Canonical field names (architect) |
| Data | `backend/src/nfl_sim/ingest`, `DATA_EXPERIMENT.md`, `DATA_PIN_NOTES.md` | Contract Python/TS without architect PR |
| Models | `backend/src/nfl_sim/models`, `reports/` | Canonical schemas |
| Frontend / Pages | `frontend/`, `docs/demo/`, `docs/index.html`, `README.md` | Backend contracts without sync |
| Live feeds | Feed evaluation + Sportradar docs, pre-snap adapter/mapper | Historical ingest path; no raw vendor persistence |
| CI | `.github/workflows/` | — |

## Agent workflow

Agents are bounded workstreams, not assumed to be persistent autonomous workers.

Before parallel work:

* Agree on shared interfaces.
* Assign file ownership.
* Specify deliverables and tests.
* Identify dependencies.

At each checkpoint, report:

* Files changed.
* Decisions made.
* Tests run and actual results.
* Known limitations.
* Any interface changes.

Use background agents or separate worktrees only if supported and useful. The lead integrator resolves conflicts and verifies the combined application.

## Definition of done

A feature is complete only when it works in the integrated application, has appropriate tests, has documented assumptions, and does not misrepresent missing functionality as implemented.

Do not start the next project phase until the current phase’s acceptance criteria have been evaluated and the user has approved continuation.
