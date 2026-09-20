# XCAPE Protocol Extraction — audit findings and document delivery

Read-only audit is complete. No code, data, prompts or configuration were changed. Below are the confirmed core findings; the deliverable is a full written extraction document.

## What the live path actually is

```text
Public scan            Staff assessment
  images                 images
    |                      |
 public-analysis-run    analyze-skin-image      (AI: scores + observations only)
    |                      |
 buildEnginePayload  <-----+                    (deterministic, skinEngine.ts)
    |                                            4 health scores, 0 = worst, 100 = best
    +--> interpretation  xcapeReportLanguage.ts + reportConcernFormatter.ts
    |                    (+ byte-identical edge mirrors)
    +--> reasoning       protocol.ts rankConcerns / reasonProtocol
    +--> customization   protocol.ts resolveProtocol + deriveBodyProtocol
    +--> usage plan      protocolPlan.ts (hard-coded roles, AM/PM, frequency)
    +--> snapshot        xcape_formula_snapshots (immutable) -> report -> cart
```

## Confirmed rules (A = implemented in code/data)

Four metrics only: `pigmentation_stability`, `barrier_surface_hydration`, `firmness_skin_support`, `oil_congestion_balance`. Direction 100 = healthiest, 0 = weakest; `concern_burden = 100 - score`.

Dose tiers (face), `CONFIRMED_FACE_DOSE_TIERS` in `src/lib/xcapeRules/protocol.ts`, inclusive bands:
75-100 → 0.5 ml, 50-74 → 1.0 ml, 25-49 → 1.5 ml, 0-24 → 2.0 ml. Invalid or out-of-range score → null, category skipped (never clamped).

Actives: pigmentation → DS Tyrosinase Inhibitor; oil/congestion → DS P Bacterium; firmness → DS Anti-Aging; hydration → DS Sebum Control. DS Anti-Inflammatory is a mandatory 1:1 companion on pigmentation and oil/congestion only, never standalone.

Customizable bases only: Face Cream, Body Milk, Advanced Serum (body path). All other products are addon-only with no dose.

Body protocol, both implemented: pigmentation < 75 → Advanced Serum body line at the same tier dose plus companion; firmness < 75 → Body Milk anti-aging line at exactly 5x the face dose (`ELASTICITY_BODY_MULTIPLIER = 5`).

Communication bands (`COMM_BANDS`): 0-20 Priority concern, 21-40 Active concern, 41-60 Needs correction, 61-80 Visible concern / watch area, 81-89 Maintenance concern, 90-100 Healthy (only inactive band).

Live DB reality: `xcape_product_alignments` 12 rows, `xcape_activation_rules` 27, `xcape_interaction_rules` 8, `xcape_severity_bands` 8, published config v2. `xcape_category_customization`, `xcape_kit_components` and `xcape_formula_snapshots` are all empty, so the admin category-mapping path is present but unused; the live engine path is `protocol.ts`.

Worked example (20 / 50 / 70 / 78) per live rules: pigmentation 1.5 ml tyrosinase + 1.5 ml anti-inflammatory in Face Cream; hydration 1.0 ml sebum control; oil 1.0 ml P Bacterium + 1.0 ml anti-inflammatory; firmness 0.5 ml anti-aging. Body: pigmentation 20 < 75 → Advanced Serum 1.5 ml + companion; firmness 78 is not < 75 → no Body Milk line. Ranking: pigmentation > hydration > oil > firmness.

## Known gaps to flag (D / C)

- Two divergent stage tables: `skinEngine.UNIVERSAL` uses very_strong 81-90 / optimal 91-100; `xcapeReportLanguage.LANGUAGE_STAGES` uses 81-89 / 90-100. One-point discrepancy.
- Two independent calibrations: the staff AI prompt doubles visible concern burden; `skinEngine.calibratedBandScoreFor` caps oil at 70, hydration and firmness at 80 before band selection.
- `overallStability` returns 0, not null, when no scores exist.
- `stabilityLabel` duplicates the band table by hand instead of importing it.
- `src/lib/skinFramework.ts` is dead (zero call-sites).
- No total-dose cap, no maximum active count, no conflict resolution beyond product-level compatibility rules.
- Admin rule-builder tables and `customization.ts` `resolveFormula` duplicate the dose logic with a configurable companion ratio, and are unused live.

## Deliverable

Write `XCAPE Prototype Skin Analysis and Customization Protocol Extraction` to Files (`/mnt/documents`) as a single markdown document covering all 13 requested sections: executive summary, text architecture diagram, input/annotation model, thresholds with exact boundary operators, visible-sign language, condition to DS mapping, the customization decision engine, product recommendation engine, usage protocol, body protocol, end-to-end deterministic algorithm, JSON data contract, test vectors including the 20/50/70/78 case and boundary cases at 24/25, 49/50, 74/75, 80/81, 89/90, source traceability with file and function citations, and gaps/risks for the production rebuild. Every rule tagged A (code/data), B (prompt/AI), C (inferred) or D (dead code).

No code, database, prompt or configuration changes are part of this work.
