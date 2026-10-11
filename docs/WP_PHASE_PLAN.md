# Situation WP Phase Plan (plan only — no implementation)

**Date:** 2026-10-11  
**Status:** Plan only. Do **not** start WP training/code until A.2 model-surface gate clears.  
**Branch context:** Convention B local (`cursor/convention-b-gate-8222`); `ep_model.joblib` still missing.

---

## 1. Preconditions (hard)

| Gate | Requirement |
| --- | --- |
| D015 | Convention B accepted in production code/spec (local done; merge when authorized) |
| Artifact | Restore **original** `reports/ep/artifacts/ep_model.joblib` matching `ep_model.meta.json` — or authorize explicit **new** artifact with new meta (never silent substitute) |
| Model-surface EPA | Pre/post Convention B on **project EP** for 2019–2022 only |
| Policy | No `spread_line` / moneylines / `vegas_wp` features; no live providers |

---

## 2. Data exposure & 2023+

| Question | Statement |
| --- | --- |
| Was Stage A / prior EP analysis influenced by 2023+? | **Held-out report only** for 2023 under Stage A gates; **no tuning** on 2023 (D014). This WP plan must **not** use 2023 for hyperparameter selection. |
| Preferred sealed later season | Prefer a **later sealed season** (e.g. 2024 once pinned and policy-approved under Milestone R) for final holdout over **reusing 2023** as a second tuning surface. Until then, keep 2023 sealed for WP selection. |
| Train / val window for WP | Propose train ≤2021, validate 2022, report-only sealed holdout (2023 or later) — **no 2024–2025 training into Stage A EP**. |
| Experiment window changes | **Out of scope** for this plan’s kickoff; no silent ingest pin changes. |

---

## 3. Kickoff-rule check (vs NFL sources)

Before WP feature freeze, verify against current NFL rules / nflverse fields:

* Who receives 2H kickoff after OT rule changes / coin-toss procedures (`receive_2h_ko` derivation — D009).
* Onside / surprise onside and safety free-kick possession implications for WP state.
* Confirm lake columns used for kickoff possession match post-rule seasons in the train window.

Deliverable: short `reports/wp/KICKOFF_RULE_CHECK.md` citing NFL rule year + lake field mapping (read-only audit).

---

## 4. Model scope (situation WP)

* Binary (or calibrated) win probability for **possession team** (or home, then map) from pre-play situation.
* Features: score differential, time, timeouts, `receive_2h_ko`, down/distance/yardline as justified — **forbid** odds/`vegas_wp`/reference WP leakage (mirror EP forbidden list).
* Outputs under `/reports/wp/`: Brier, log loss, calibration, n by slice; no “beat market” gate.

---

## 5. Sequencing

1. Artifact restore + project-EPA Convention B pre/post (2019–2022).  
2. Kickoff-rule check doc.  
3. WP fit on permitted seasons; sealed holdout report-only.  
4. **Analytical 4th-down** (Milestone C) **before** Monte Carlo sim expansion — use WP + EP for go/FG/punt value on historical 4th downs with disclosed simplifications.  
5. Sim transitions (Ph5) after analytical path has reports.  
6. Decision-engine validation (D) → live adapters last (E/F).

---

## 6. Explicit non-goals

* Live provider work, betting features, silent retrain of EP as “original,” merging without authorization, 2023+ tuning.
