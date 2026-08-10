# XCAPE Customization Protocol — Formula-Driven Kit Recommendation & Order Flow

Make approved, versioned XCAPE rules determine the exact kit and customization formula from the four analysis scores, then carry a snapshotted formula through the existing report → cart → order workflow. No new engine; everything plugs into the current assessment, rules, report, and checkout system.

## A. Canonical components/routes that remain (do not replace)

- Assessment save: `client_visit_assessments` + `useSaveVisitAssessment` (shared by wizard and legacy visit modal)
- Analysis: `SkinAnalysisEngine` (4 scores), `SkinAnalysisAiPanel` + `analyze-skin-image` (findings/quality only)
- Rules layer (Phase 3): `xcape_recommendation_rules`, `xcape_rule_versions`, `xcape_protocols`, `xcape_contraindications`, `xcape_recommendation_proposals`, `xcape_rule_audit`, evaluator in `src/lib/xcapeRules/evaluate.ts`
- Wizard: `XcapeAnalysisWizard` at `/xcape/analysis` (steps already exist)
- Report: `public-report-fetch`, `PersonalReportView` at `/report/:token`, `ShareReportDialog`, `public-report-download-pdf`
- Purchase: `cartStore` → `Checkout.tsx` → `submit_public_cart_order` RPC → `pending_outreach_orders` → staff confirmation
- Catalogue: `products` (has `usage_instructions`, `warnings`, `ingredients_summary` — reusable for formula display), `services`

## B. Recent /xcape components — integrate / redirect / retire

- **Integrate:** `XcapeProposalsPanel` + `StepRecommendations` become the single place formulas are proposed/decided; `StepReport` gating (share blocked until proposals decided) already fits.
- **Keep as-is:** admin pages `/xcape/admin/rules`, `/rule-versions`, `/protocol-library`, `/contraindications` — extended, not rebuilt.
- **Retire from journey (code intact):** nothing new; legacy manual-slider prototype already out of nav; `VisitAssessmentModal` stays canonical for visit/treatment contexts only.
- No parallel mock workflow is added.

## C. Data-model extensions (all additive; nothing deleted)

1. `xcape_kit_components` — kit mapping without duplicating catalogue: `kit_product_id → products`, `component_product_id → products`, `role` (`base`/`cleanser`/`toner`/`serum`/…), `is_customizable` bool, `sort_order`. A product is a "kit" iff it has component rows.
2. `xcape_category_customization` — one row per score category: `category` (4 score keys), `kit_product_id`, `base_product_id` (component to customize), `active_product_id`, `aggressiveness` (`mild`/`aggressive`), `companion_product_id` (nullable), `companion_ratio` (default 1.0), `status` (`draft`/`active`/`archived`), `is_demo`. Actives/companions are `products` rows (non-public, not separately sellable).
3. `RuleOutputs.customization` (typescript + jsonb, versioned via existing `xcape_rule_versions`): `category`, `dose_tiers: [{score_min, score_max, dose_ml}]`, `instructions`, `warnings`. Dose tiers live inside the rule so they inherit draft/publish/version/audit and stay draft until Doc confirms.
4. `xcape_formula_snapshots` — created on practitioner approval: `assessment_id`, `proposal_id`, `category`, `score`, kit/base/active/companion product IDs **plus name + unit price copies**, `dose_ml`, `companion_dose_ml`, `rule_id`, `rule_version_id`, dose tier applied, `instructions`, `warnings`, `status` (`proposed`/`approved`/`superseded`), practitioner override fields + reason, `approved_by`, `approved_at`. Later catalogue/rule changes never rewrite it.
5. `pending_outreach_orders` += nullable `formula_snapshot_id uuid`, `formula_summary jsonb` (denormalized: base product, active, ml, companion, instructions) for fulfilment.
6. `submit_public_cart_order` / `create_pending_outreach_order` accept optional per-item `formula_snapshot_id`; RPC copies the snapshot into `formula_summary` server-side (client can never inject a formula).
7. All new tables: GRANTs (authenticated + service_role, no anon), RLS: admin manage, practitioner read active + insert snapshots for own assessments; order-line columns follow existing order policies.

## D. Kit/catalogue relation

Kits, bases, actives, companions all remain `products` rows (one catalogue, existing pricing/inventory). `xcape_kit_components` gives kit structure; `xcape_category_customization` binds category → kit + customizable base + active + companion. Admin mapping UI added under `/xcape/admin/products` (new "Kits & Customization" tab). Until Doc supplies real items, only clearly labelled DEMO placeholder products are used, `is_demo`/draft, excluded from real reports.

## E. Evaluation sequence

1. Practitioner approves scores (Review & Scores, existing).
2. Recommendations step: evaluator runs published rules; a customization rule match resolves `dose_ml` from its versioned tiers via the approved score; category mapping supplies kit/base/active/companion; contraindication check (existing `xcape_contraindications` + intake flags) blocks or warns.
3. Proposal shown "Proposed by XCAPE" with matched reasons + full formula; practitioner accept/edit/reject with reason (existing flow). Accept/approve writes `xcape_formula_snapshots` row; practitioner may adjust dose with mandatory reason (override recorded).
4. Report sharing stays gated on decided proposals; report + PDF render from the snapshot only.
5. Report kit card "Add to cart" → cart item carries `formula_snapshot_id` → checkout RPC → order line stores snapshot ref + summary → staff fulfilment view shows formula. Client never sees or constructs doses beyond the approved display.

## F. Keeping generic AI out of recommendations

`analyze-skin-image` continues to output only findings/quality/suggested scores. Product/kit/formula content originates solely from published rule outputs referencing catalogue IDs; the evaluator validates referenced products exist and are active, else the proposal is blocked with "invalid reference". Report renders only snapshot/accepted data — no AI text reaches products, doses, or formulas.

## G. Report UI (preserve premium design)

One new section in `PersonalReportView`, styled with existing report tokens (bronze/cocoa, white/85 cards): "Your customized XCAPE formula" — kit name/image/price (from snapshot), the specific product customized, active solution + ml, companion + ml, usage instructions, warnings, existing Add-to-cart + WhatsApp actions. `public-report-fetch` and the PDF function include the formula block from `xcape_formula_snapshots`; non-customized reports render exactly as today.

## H. Order-line formula retention

`pending_outreach_orders.formula_summary` (immutable after insert) shown in the staff pending-orders view and included in the WhatsApp order message: e.g. "Hydrating Moisturizer + DEMO Hydration Active 2.0 ml". Fulfilment never depends on live catalogue or rules.

## I. Admin rule workflow

Reuse existing: draft → validate → publish (creates immutable `xcape_rule_versions` snapshot) → deactivate/reactivate/archive; Rule Versions page retire/reactivate = rollback; `xcape_rule_audit` logs every change. Added validation on publish: customization outputs must reference existing active products, aggressive categories must define a companion, dose tiers must cover 0–100 without gaps/overlaps. Dose tiers remain in draft rules only until Doc confirms.

## J. Phases (small, reversible commits; acceptance test each)

1. **DB migration** (C.1–C.7) — migration applies cleanly; existing flows untouched; `tsgo` + build + tests pass.
2. **Kit & Customization mapping admin tab** — admin maps DEMO kit → components → category mapping; saves/activates; RLS verified (practitioner cannot edit).
3. **RuleOutputs.customization + tier resolution** — unit tests: 20 → 2.0 ml; 60 → 1.0 ml; gap/overlap validation rejects publish; evaluator attaches resolved dose to proposal.
4. **Practitioner approval → snapshot** — accept creates snapshot with names/prices/rule version; edit-with-reason records override; reject blocks report share (existing gate).
5. **Report + PDF formula block** — snapshot renders; change a catalogue price afterwards → report unchanged; PDF includes block.
6. **Cart → order formula** — add kit from report, checkout, order line shows formula summary in staff view + WhatsApp text.
7. **Integration pass** — single primary journey confirmed; demo rules returned to draft; no fake clinical content live.

## K. End-to-end test cases (DEMO placeholders)

1. **Surface hydration 20/100** → tier 0–24 → 2.0 ml DEMO Hydration Active into the DEMO facial moisturizer base; kit = DEMO Hydration Kit; mild → no companion; approve → snapshot → report shows kit + 2.0 ml → cart → order line retains formula.
2. **Oil/congestion 30/100** → tier 25–49 → 1.5 ml DEMO Sebum Active (aggressive) + auto 1.5 ml DEMO Anti-Inflammatory companion (1:1); attempt to remove companion → blocked with warning; approve → snapshot → report → order.

## L. Inputs still required from Doc (blocking publish, not development)

- Real kit names, contents, prices per category; which base product is customized per category (confirmed only for dehydration → moisturizer)
- Active solution identities/concentrations per category; companion identity and pairing rules beyond provisional 1:1; whether firmness (mild) ever needs a companion
- Confirmation of dose tiers (75–100: 0.5 / 50–74: 1.0 / 25–49: 1.5 / 0–24: 2.0 ml) and that lower score = higher dose
- Usage/warning text per formula; per-active contraindications; max doses and staff mixing instructions
- Whether multiple categories may be customized in one formula (priority concern only vs multi)
- Does customization change kit price; follow-up intervals per category

## Technical notes

- New hooks: `useXcapeKitMapping`, `useXcapeCategoryCustomization`, `useFormulaSnapshots`; evaluator + tier resolution in `src/lib/xcapeRules/` with unit tests alongside `evaluate.test.ts`.
- `cartStore.CartItem` gains optional `formula_snapshot_id` + display fields; `Checkout.tsx` passes it through `_items`.
- No changes to auth, storage buckets, existing RLS, MedSpa modules, or legacy routes.
