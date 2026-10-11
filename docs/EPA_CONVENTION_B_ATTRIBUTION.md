# EPA Convention B — Score Attribution Table (pre-overlay)

**Date:** 2026-10-11  
**Status:** Locked before production overlay code on branch `cursor/convention-b-gate-8222`  
**Decision basis:** Product authorize Adopt Convention B when EPA = change in expected next-score value and nflfastR-comparable on score-cash (D015).  
**Sources:** Task A `reports/ep/EPA_SCORING_CREDIT_INVESTIGATION.md`; recon Addendum A (`docs/REFERENCE_IMPLEMENTATION_RECON.md` / store mirror); nflfastR `helper_add_ep_wp.R`.

**Convention B (project):** On non-timeout scoring rows with realized next-score class value \(R \in \{\pm7,\pm3,\pm2\}\), override EPA to \(R - \mathrm{ep\_before}\). Non-score rows keep Stage A ΔEP / PC sign-flip / terminal \(-\mathrm{ep}\). XP/2PT rows are **separate** and carry \(R=0\) under Stage A +7 TD folding (not nflfastR’s PAT \(1-\mathrm{ep}\) overlays).

Perspective: always snap `posteam`.

| Event | R (snap posteam) | Credit team rule | Overlay applies? | Possession / next-scrimmage | Identity \(\sum\mathrm{EPA}_B=R_\mathrm{end}-\mathrm{EP}_0\)? | Cite | Ambiguity |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| Offensive TD | **+7** | `td_team == posteam` (else infer scorer) | **Yes** → `7 − ep` | Usually PC to KO/XP then next scrimmage; Stage A linker skips try/KO to next scrimmage — overlay **replaces** PC/terminal on the TD row | Yes on closing score play | Task A §2–3; nflfastR TD overlay; recon A2 | Scoreboard shows +6 before XP; **R is class +7**, not 6 |
| Defensive / return TD | **−7** | `td_team != posteam` | **Yes** → `−7 − ep` | PC; next scrimmage usually scoring team | Yes | Task A defensive TD tests; nflfastR | Rare same-team edge cases if `td_team` missing |
| Made FG | **+3** / **−3** | FG for/against snap posteam (`field_goal_result==made` + scorer) | **Yes** → `±3 − ep` | PC to KO then next scrimmage | Yes | Task A FG; nflfastR made-FG overlay | Opp FG while posteam on offense is rare (special teams chaos) |
| Missed / blocked FG | **0** | No scoring event | **No** — Convention A path | Often same possession (miss) or PC (block/return no TD) | N/A as score close; non-score telescoping | Task A buckets exclude from score overlays; recon | Block-return TD → treat as return TD (−7/+7), not “missed FG” |
| Safety | **+2** / **−2** | Via `scoring_event_team` / defteam credit (posteam typically **−2**) | **Yes** → `±2 − ep` | PC / free kick | Yes (with attribution) | Task A safety; nflfastR `safety_team` | Task A residual vs published `epa` (MAE B 0.129); `safety_team` vs our scorer |
| Extra point (XP) | **0** | Try row; not a next-score epoch close under +7 TD fold | **No** (project B) | Separate row after TD | Do **not** double-count; identity uses TD’s +7 only | Task A XP \(R=0\); EP_MODEL_SPEC §1/§3 | **Differs from nflfastR** (`1 − ep` / `0 − ep` on XP rows) — documented; not bit-parity |
| Two-point attempt | **0** | Try row; folded into TD +7 for EP classes | **No** (project B) | Separate row | Same as XP | Task A; EP_MODEL_SPEC | **Differs from nflfastR** (`±2 − ep` on 2PT rows) |
| Kickoff (after score) | **0** | Not a scoring play | **No** | Own EP/EPA; Stage A may skip KO when linking prior score → next scrimmage | Prior score already cashed on score row | Task A constructor; recon A2 | nflfastR uses fill/lead (may land on KO); we use next-scrimmage — non-score residual risk |
| KO / return TD | **±7** | `td_team` vs kickoff `posteam` (receiving team) | **Yes** if row is the return-TD play | Scoring row cashes; ensuing KO/XP separate | Yes on that row | Same as return TD; recon INT/fumble return | Kickoff `posteam` conventions; ensure try exclusion still holds |

### Non-score controls (overlay must not fire)

| Event | Overlay | Path |
| --- | --- | --- |
| Punt / TOD / turnover (no score) | No | PC sign-flip (A≡B) — Task A |
| Same-possession scrimmage | No | ΔEP |
| Terminal no score | No | `−ep` |
| Timeout | No | EPA `0` (nflfastR often NA — deliberate) |

### Product notes

1. Adopting B is a **spec change** (was documented Stage A exclusion of score-cash), not an undocumented bugfix.  
2. Full nflfastR PAT/2PT row overlays are **out of Stage A B scope**; comparability target is next-score class cash on TD/FG/safety.  
3. Model-surface pre/post still requires restored `ep_model.joblib` (see provenance report).
