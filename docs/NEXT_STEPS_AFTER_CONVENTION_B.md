# Next Steps After Convention B

> **Purpose:** Short public brief — what you must do manually vs what you only need to approve, plus ordered next steps with acceptance criteria.  
> **Date:** 2026-10-11  
> **Kind:** Sendable snapshot (Claude-/externally-safe).  
> **Repo:** [nmpy7knjd8-code/nfl-analytics-simulator](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator)  
> **Verified `origin/main`:** `15da234b900059ab2a8f36279112203d02cace37` (PR #3)  
> **Convention B code:** local only on `cursor/convention-b-gate-8222` — **not yet on public GitHub** (pending push authorization).

---

## 1. Where things stand

D015 is **accepted: Convention B** (score-cash EPA on scoring plays) on a **local** review branch. Unit/integration tests are green; production model artifact and push are still open.

- **Local branch:** `cursor/convention-b-gate-8222` (unpushed; tip recorded in gate report)
- **D015:** Accepted 2026-10-11 — production EPA cashes \(R - \mathrm{ep\_before}\) on scoring plays; non-score paths unchanged
- **Tests:** **67 passed**, 1 skipped (full backend pytest)
- **Push / merge:** None yet
- **`ep_model.joblib`:** Missing (gitignored) — model-surface EPA pre/post **blocked**
- **PR #4 / PR #5:** Untouched by Convention B work (docs-only Pages packets; open-D015 text on PR #5 is a dated snapshot)

---

## 2. Manual vs approve

### You only need to approve (chat authorization is enough)

Agents / maintainers can execute once you say yes in chat:

- Push `cursor/convention-b-gate-8222` for review (**no merge** unless you also say merge)
- Open a Convention B PR against `main`
- Merge Convention B after your review
- Authorize an **auditable** rebuild of `ep_model.joblib` if the original artifact cannot be found (new artifact + new meta; never a silent substitute labeled “original”)
- Start the WP phase after hard gates clear (plan already written)

### You (or someone) must do manually

These need a human with access to backups, token settings, or the original host:

- **Restore** `ep_model.joblib` from backup if it exists (place beside `ep_model.meta.json` under `reports/ep/artifacts/`)
- **Ensure `GH_TOKEN` scopes:** `repo` (and `workflow` if pushing `.github/workflows/ci.yml` that already exists locally on the Convention B branch)
- **Optional:** Merge PR #4 / PR #5 for GitHub Pages docs (separate from Convention B code)
- **If known:** Locate the original Stage A training-host artifact so restore does not need a rebuild

---

## 3. Ordered next steps (with acceptance criteria)

| # | Step | Acceptance criteria |
| --- | --- | --- |
| 1 | **Authorize push** of Convention B branch | Branch visible on GitHub; PR open for review; **no merge** unless you explicitly authorize merge |
| 2 | **Joblib:** restore original **or** authorize labeled rebuild | `ep_model.joblib` present and either matches existing `ep_model.meta.json`, or a **new** meta is published with explicit rebuild provenance |
| 3 | **Model-surface validation** 2019–2022 | Project-EP Convention B pre/post report written; seasons limited to 2019–2022; no 2023 tuning |
| 4 | **Merge Convention B** | Spec §6 + production score-cash on `main`; remote no longer Convention A–only |
| 5 | **WP phase** | Kickoff only after gates above; follow [WP_PHASE_PLAN](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator) (plan lives on local Convention B branch until that branch is pushed) |
| 6 | **Deferred** | Decision lab → live adapters — not started in this gate |

---

## 4. What NOT to do yet

- Live providers / live decision terminal work
- 2023 (or later) hyperparameter tuning for EP or WP
- Silent retrain of EP presented as the “original” joblib
- Odds / `vegas_wp` / moneylines as model features
- Force-push or rewrite of Task A / safety history
- Treating PR #5’s open-D015 narrative as current (successor brief is the decisions doc below)

---

## 5. Links

| Resource | URL |
| --- | --- |
| Repo | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator |
| Decisions & forward plan (raw, PR #5 tip) | https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/03d03e3bb6b4290f38ac15205f273fabae663e79/docs/DECISIONS_AND_FORWARD_PLAN.md |
| Decisions PR | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/5 |
| Audit packet PR | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/4 |
| `main` after PR #3 | https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/commit/15da234b900059ab2a8f36279112203d02cace37 |

**Note:** Convention B code, `WP_PHASE_PLAN.md`, and the Convention B gate report are **local pending push** — not on public GitHub until step 1 is authorized.
