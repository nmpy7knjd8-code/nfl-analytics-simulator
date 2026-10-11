# Model validation standards (MVP)

## Win Probability (WP)

Do not set a hard “must beat baseline by X” acceptance bar before the baseline and data are inspected.

When WP (and comparable probabilistic models) are implemented in a later phase:

1. Implement a simple baseline and document its exact inputs.
2. Evaluate the candidate model and the baseline on **identical** held-out games and eligible situations.
3. Report **Brier score**, **log loss**, **calibration plots**, and **sample sizes**.
4. Explain whether any improvement is statistically meaningful and robust across situation groups.
5. Save metrics and plots under `/reports/`.

### Fairness and leakage

Baseline comparison must be fair. A model must not “pass” by using information unavailable at the stated prediction time (no look-ahead / temporal leakage).

Use chronological splits (train 2019–2021, validate 2022, test 2023) unless Phase 1 data work documents a justified adjustment.

## Phase discipline

- Keep `AGENTS.md` as the process source of truth.
- Complete Phase 1 (audit, research, architecture, contracts) and obtain user approval before Phase 2.
- Reading documentation is not reproduction or validation.
