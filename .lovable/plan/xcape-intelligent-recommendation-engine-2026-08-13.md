# XCAPE Intelligent Recommendation Engine

Upgrade the existing protocol resolver into a reasoning engine: priority → interactions → activation → redundancy check → minimum effective protocol → customization → ordered routine → explanation, with every include/exclude decision recorded and auditable.

Nothing about the scan engine, capture flow, assessment identity, report links, PDF or checkout changes.

## Decisions locked in

- **Polarity**: scores stay 100 = healthiest internally. A derived `severity = 100 - score` drives priority, bands and all client/practitioner language. No stored data changes; existing dose tiers (health 0–24 → 2.0 ml) stay exactly as they are.
- **Anti-inflammatory companion**: the minimisation layer may now exclude it, but only with an explicit recorded reason. This changes the current absolute v1.1 pairing, so the protocol version bumps to `xcape-protocol-2.0`.
- **Configuration**: severity bands, priority weights, activation thresholds, interaction rules and the compatibility matrix live in versioned, admin-editable database rows — not code constants.
- **Copy**: fully deterministic. No AI call in this feature.

## What gets built

### 1. Versioned configuration (database)

New admin-editable, versioned config replacing hard-coded bands:

- `xcape_recommendation_configs` — one row per version (`version`, `status` draft/published/retired, `published_at`, `notes`).
- `xcape_severity_bands` — band ranges and labels (maintenance / supportive / intervention / priority) per config version.
- `xcape_activation_rules` — per product SKU per category: activation threshold, priority weight, whether the product may satisfy the need on its own.
- `xcape_interaction_rules` — the pairwise interpretations from the brief (high oil + dehydration → control without stripping; dehydration + weak elasticity; pigmentation + oil; pigmentation without oil; broad low severity), each with an effect on priority/activation and the wording used to explain it.
- `xcape_compatibility_rules` — ALLOW / PREFER / OPTIONAL / AVOID / REQUIRES_REVIEW per SKU pair.

Each table gets GRANTs, RLS (admins write, authenticated read published, service_role all) and is seeded with the confirmed values from the brief. The engine falls back to the seeded defaults compiled in code when no published config is reachable, so the public/edge path never breaks.

### 2. Reasoning engine (`src/lib/xcapeRules/reasoning.ts`)

Pure, dependency-free, mirrored byte-for-byte to `supabase/functions/_shared/` like `protocol.ts` already is, with a parity test.

Pipeline:

```text
scores -> severity -> band -> priority ranking (severity x weight, interaction adjusted)
      -> interaction findings
      -> per-product activation score
      -> redundancy pass (drop products whose need is already met)
      -> compatibility pass (AVOID / REQUIRES_REVIEW)
      -> foundation check (Cleanser -> Toner -> Face Cream as one system)
      -> customization (existing dose tiers, only for Face Cream / Body Milk)
      -> ordered routine (Cleanse -> Prepare -> Target -> Hydrate/Repair -> Protect)
      -> decisions[] : every product RECOMMEND or DO NOT RECOMMEND + reason
```

`resolveProtocol` is kept and now consumes the reasoning result, so all existing callers (staff panel, proposals, public report, snapshot builder) keep working. Existing guarantees preserved: only Face Cream and Body Milk are customizable, body = 3× face, DS availability gating, `mapping_gaps` / "XCAPE product/kit mapping required", no invented products, ingredients, prices or frequencies. Missing frequency or dosing rule produces an explicit flag, never a guess.

### 3. Client output

`protocolPlan.ts` and the report views gain the sections from the brief:

- Your primary skin priority / secondary priority
- Your XCAPE routine — numbered steps with WHEN / HOW / ROLE / WHY
- Why these products (interaction findings in plain language)
- What we are not targeting yet (excluded low-priority concerns)

No medical or "cure" claims; decisive XCAPE phrasing only.

### 4. Practitioner output

`StaffProtocolPanel` and `XcapeProposalsPanel` show raw scores, severity, ranking, interaction findings, activated and non-activated products with the reason for each, dose, frequency, order, config version, catalogue version and status. Accept / Edit / Reject stays as-is; material edits and rejections still require a reason.

### 5. Snapshot immutability

`xcape_formula_snapshots` gains `recommendation_rule_version`, `product_catalogue_version` and a `decisions` JSONB column holding the full reasoning trace. Accepted reports read the snapshot only, so later config changes never alter an existing report.

### 6. Tests

At least 30 scenario tests covering every case listed in section 22 — the four dimensions at low/moderate/high, the named interaction pairs, all-low and all-high, redundancy, exclusion, missing mapping, missing frequency, missing dosing rule, practitioner edit/reject, and snapshot immutability. The 20/50/70/78 example is asserted explicitly (severity: elasticity primary, oil secondary, dehydration supportive, pigmentation maintenance; Advanced Serum excluded with reason). Then typecheck, full test run and production build.

## Out of scope

Public capture (P2/P3), scoring engine, lead capture, report-link architecture, PWA. No publishing.
