# XCAPE Restructure — Audit Report (Audit Only)

This document is the deliverable of an audit-only request. It contains **no implementation steps to execute now**. Approving it confirms the findings as the working baseline for future XCAPE phases. Sections marked **[CONFIRMED]** are verified against the repository and live database; sections marked **[RECOMMENDATION]** are proposals derived from those facts.

---

## 1. Entry points into skin analysis — [CONFIRMED]

| Entry point | Where | Access | What it triggers | Status |
|---|---|---|---|---|
| `VisitAssessmentModal.tsx` | Opened from `/admin/clients/:id` Assessments tab and from `OutreachAnalysisQueue` | admin / medical_aesthetician for writes (`ClientAssessmentsTab.tsx:16-17`); outreach visits gated by `assigned_medical_expert_id` | Reads/writes `client_visit_assessments` via `useSaveVisitAssessment`; embeds the scoring engine and AI panel | **Canonical** |
| `SkinAnalysisAiPanel.tsx` | Inside `VisitAssessmentModal` | Staff role enforced server-side too (`analyze-skin-image/index.ts:28`) | Uploads to `client_media`, invokes `analyze-skin-image` edge function (`SkinAnalysisAiPanel.tsx:92-99`) | **Canonical AI step** |
| `SkinAnalysisEngine.tsx` | Inside `VisitAssessmentModal` or standalone stepper | Same staff | Client-side four-variable scoring via `buildEnginePayload` (`skinEngine.ts`) | **Canonical scoring UI** |
| `OutreachAnalysisQueue.tsx` | Admin → Outreach work mode | Staff assigned to outreach | Opens the same `VisitAssessmentModal` with `appointmentId=null` (`:35,240`) | Canonical launch surface |
| `ClientAssessmentsTab.tsx` | `/admin/clients/:id` tab | `canWriteClinical` for writes | Lists `useClientAssessments`, opens the modal | Canonical |
| `ClientHistoryTab.tsx` | `/admin/clients/:id` tab | Any staff with client access | Read-only history from the same table | Canonical read view |
| `OutreachIntake.tsx` (`/outreach/intake/:slug`) | Public, slug-gated | Anonymous lead | Creates lead + intake photos; does NOT run analysis | Canonical funnel entry (upstream) |
| `SocialMediaIntake.tsx` (`/social-media-intake`) | Public campaign page | Anonymous | Creates a `clients` lead + photos only; explicitly documented as NOT entering the analysis queue (`:39-46`) | Separate decoupled funnel |
| `AnalysisStage.tsx` | Legacy appStore wizard stage (no route) | Staff | Writes an ad-hoc JSON blob to `clients.skin_analysis` (`:79-98`) with its own client-side "liveSummary" logic unrelated to the engine | **Prototype/legacy** |
| `TreatmentStage.tsx` | Wizard stage | Staff | Only READS `clients.skin_analysis` for category hints (`:33`) | Consumer of the legacy blob |
| `ClientMediaTab.tsx`, `OutreachPortal.tsx`, `Outreach.tsx` | Various | — | Media browsing / portal dashboards; none invoke analysis | Not analysis entry points |

---

## 2. Canonical vs prototype/legacy/duplicate — [CONFIRMED]

**Canonical pipeline:** client creation → `useUploadClientMedia` (bucket `client-media`, table `client_media`) → `analyze-skin-image` edge function (staff-role-gated, signs 300s URLs, calls Lovable AI `google/gemini-3-flash-preview`) → practitioner review in `SkinAnalysisAiPanel`/`SkinAnalysisEngine` → four-variable engine payload → `client_visit_assessments` → `admin-create-report-link` → `client_report_links` → `public-report-fetch` → `PersonalReportView` → history via `useClientAssessments`.

**Legacy/duplicate:**
- `AnalysisStage.tsx` + `clients.skin_analysis` JSON column: legacy prototype. Writes a blob nothing in the canonical flow reads; only `TreatmentStage` consumes it. Candidate for retirement after migration of any historic reads.
- `src/lib/skinFramework.ts`: parallel V2.1 concern framework (5 required + 2 optional concern keys, own band table). The assessment type marks it `@deprecated` ("retained for back-compat reads; new writes omit"). Overlaps `skinEngine.ts`.
- `src/lib/reportInterpretation.ts`: a THIRD band scheme (critical/low/fair/good/strong) used only for report display tone, on top of the engine's 10 `StageBand`s.
- **Three separate PDF generators:** `clientReportPdf.ts` (staff-side, storage-backed), `portalReportPdf.ts` (booking-portal, lightweight), and edge function `public-report-download-pdf` (public report link, pdf-lib). Not duplicates by intent, but fragmented; the server-side one is canonical for the report-link flow.
- `PersonalReport.tsx` vs `AdminReportPreview.tsx`: NOT duplicates — intentional pixel parity via shared `PersonalReportView` (explicit comments in both files). Keep both.
- Four intake funnels (`/consultation`, `/intake/:slug`, `/social-media-intake`, `/outreach/intake/:slug`) are channel variants, not duplicates; none is core to the analysis engine itself.
- `useReportNotes.ts`/`report_notes` and `reportRanges.ts`/`reportNarrative.ts`/`reportExport.ts` belong to the **business** reporting feature, not client skin reports — name collision only.

---

## 3. End-to-end flow — [CONFIRMED]

```text
Client created (Admin client list, /outreach/intake/:slug, /social-media-intake)
  -> images: useUploadClientMedia -> bucket client-media (private),
     table client_media, path clients/{clientId}/assessments/{assessmentId}/{category}/...
  -> AI: SkinAnalysisAiPanel -> analyze-skin-image edge fn
     (staff role check -> sign URLs -> Lovable AI gateway -> structured JSON:
      observations, suggested_scores, image_quality; decision-support only, not persisted)
  -> practitioner review: accept/adjust AI suggestions or manual sliders
  -> scoring: skinEngine.ts buildEnginePayload
     4 variables: pigmentation_stability, barrier_surface_hydration,
                  firmness_skin_support, oil_congestion_balance
     each: machine_score + practitioner_score (0=worst,100=healthiest),
           concern_burden = 100 - score, stage band, copy-bank narrative
     aggregates: overall_skin_stability, priority_order, combined_interpretation,
                 recommended_treatment_directions (narrative strings, NOT ids)
  -> save: useSaveVisitAssessment -> client_visit_assessments
     (skin_analysis JSON incl. engine + ai_assist; recommended_services/products JSON;
      main_concern, home_care, follow_up_recommendation, next_visit_in_weeks)
  -> share: admin-create-report-link -> client_report_links
     (deterministic HMAC-SHA256 token of "v1:{link_id}" with REPORT_LINK_SIGNING_SECRET;
      only sha256(token) stored; one active link per (client, assessment); expires_at NULL)
  -> public view: /report/:token -> public-report-fetch
     (hash lookup, revoked/expiry checks, whitelisted payload, hydrates services/products
      by id, builds treatment plan + care journey + promo; logs client_report_events)
  -> PDF: public-report-download-pdf (pdf-lib + byte-identical mirror of reportConcernFormatter)
  -> history: ClientAssessmentsTab / ClientHistoryTab via useClientAssessments
     (same client_visit_assessments table; no separate history table)
```

Report rendering parity is enforced: `src/lib/reportConcernFormatter.ts` is mirrored byte-for-byte into `supabase/functions/_shared/` with a parity test.

---

## 4. Reusable assets — [CONFIRMED]

- **Pure report components (reusable as-is):** `ReportHeader`, `MainConcernCard`, `ConcernCard`, `KeyReadingsGrid`, `EngineOverviewCard`, `HomeCareRoutine`, `PractitionerNoteCard`, `TreatmentJourney`, `YourCareJourney`, `ExploreMoreStrip`. None import the supabase client or appStore.
- **Analysis engine:** `src/lib/skinEngine.ts` (scoring + copy bank), `reportConcernFormatter.ts`, `SkinAnalysisEngine.tsx`, `SkinAnalysisAiPanel.tsx`, `VisitAssessmentModal.tsx`, `analyze-skin-image` edge function + `prompt.ts`.
- **Hooks:** `useVisitAssessments`, `useClientMedia` (upload + signed URLs), `useReportPayload`, `useReportLinks`, `useClientAssessments`.
- **Tables (core):** `clients`, `client_visit_assessments`, `client_media`, `client_report_links`, `client_report_events`, `client_safety_intakes`, plus minimal read-only use of `services`/`products` (id, name, description, price, image).
- **Storage:** `client-media` bucket (private, signed-URL reads, role-gated writes — verified in live policies).
- **Edge functions (core):** `analyze-skin-image`, `admin-create-report-link`, `admin-get-report-link-url`, `admin-revoke-report-link`, `admin-preview-report`, `public-report-fetch`, `public-report-download-pdf`, `public-report-event`; `_shared/reportConcernFormatter.ts`, `reportTreatmentPlan.ts`, `reportCareJourney.ts`.
- **Catalog:** report flow uses only thin id-based hydration of `services`/`products` — the rich `service_categories`/`service_families` taxonomy serves the storefront, not the report.
- **Auth roles:** `app_role` enum (admin, front_desk, medical_aesthetician, cleaner, outreach), `user_roles` + `has_role`/`is_admin`/`is_clinical_writer` (all SECURITY DEFINER with `search_path` set — verified live), `staff_users` with status gate.
- **Admin capabilities:** staff lifecycle via `admin-create-staff`/`admin-delete-staff`, impersonation with audit logging, report link management, job-role permission bundles + per-staff tab overrides (`permissions.ts`, `adminAreas.ts` — 11 sidebar areas).

---

## 5. Coupling — [CONFIRMED]

| Domain | Coupling to analysis/report flow | Essential? |
|---|---|---|
| Appointments | None in report components/payload | N/A |
| Visits (`client_visit_logs`) | Report depends on `client_visit_assessments`, not visit logs; modal writes visit sign-out outcome for outreach | Incidental |
| Treatment plans | `YourTreatmentPlan`/`NextStepCard`/`RecommendedTreatments` render `treatment_plan` from `_shared/reportTreatmentPlan.ts` | Essential if plans stay in product scope |
| Payments | `PaymentActionCard` + `public-report-claim-payment` + `payment_settings` inline in the report view | **Incidental to analysis; core to current monetization. Biggest extraction candidate.** |
| Sales (`visit_line_items`, `finance_entries`) | Zero references in report-scoped files | None |
| Shop/cart | `RecommendedProducts` and `FloatingCareSummary` use `useCartStore`; checkout link inside report | Incidental, entangled in shared view |
| Outreach | Report payload reads `outreach_settings` (contact info) and `staff_users.promo_*` for the promo block only | Incidental, replaceable with clinic-config |
| Subscriptions | None in report code | None |
| appStore (1754-line Zustand) | Report flow never imports it; analysis flow depends only on auth/`useAuth` roles | Legacy ops state; can be left behind |
| Navigation | Report preview route lives inside MedSpa admin shell, but `PersonalReportView` has zero dependency on `adminAreas`/`permissions` | Incidental; easy to relocate |
| Brand | `AskOnWhatsAppBlock` and others read `src/lib/brand.ts` (Tropics name/WhatsApp); `APP_PUBLIC_URL` fallback is hardcoded to the Tropics preview domain in 3 edge functions | Must be parameterized for XCAPE |

---

## 6. Hide / keep / separate — [RECOMMENDATION based on confirmed facts]

**Can be hidden safely now (route-level, no data or logic changes):** storefront and marketing pages (`/treatments*`, `/tropixa`, `/products*`, `/checkout*`, `/about`, `/menu`), booking/scheduling (`/book*`, `/schedule*`), referral (`/r/:slug`, `ReferralAttribution`, `DiscountPopup`), unsubscribe/manage-booking. Nothing in the analysis/report pipeline imports these.

**Must remain temporarily:** `Admin.tsx` shell (it hosts Clients → Assessments/Reports), `ClientProfile.tsx`, auth (`/auth`, `/reset-password`), `OutreachIntake` (currently the only remote client-capture funnel that feeds the analysis queue), `useAuth`/role machinery, `admin-create-staff`/`admin-delete-staff`.

**Must be separated before hiding:**
- `PaymentActionCard`, `RecommendedProducts` (cart), `FloatingCareSummary`, `ReportPromoCta` are hard-wired into the shared `PersonalReportView` — extract behind a feature slot/flag before removing commerce, or the public report breaks.
- The promo block in `public-report-fetch` reads `outreach_settings`/`staff_users.promo_*`/`site_settings` — needs a neutral clinic-config source before outreach settings are removed.
- `AnalysisStage.tsx`/`clients.skin_analysis` must not be deleted until `TreatmentStage`'s read is confirmed unused.
- `admin-create-portal-link`/`public-manage-booking` expose client-media photo URLs via booking tokens — a hidden coupling to keep in mind before retiring booking.
- `src/lib/brand.ts` and the `APP_PUBLIC_URL` hardcoded fallback tie generated links and WhatsApp CTAs to Tropics — parameterize first.

---

## 7. The missing recommendation-criteria layer — [CONFIRMED GAP] + [RECOMMENDATION]

**Confirmed gap:** No table, function, or code maps scores/findings/contraindications to solutions.
- The engine emits only narrative strings (`recommended_treatment_directions`, `recommended_home_care_directions`); these are **never read** by any selection logic.
- `RecommendedServicesPicker`/`RecommendedProductsPicker` (`VisitAssessmentModal.tsx:1194-1313+`) are manual free-form search-and-add over the entire active catalog. No filter, suggestion, warning, or default references the engine, bands, or priority order.
- `client_safety_intakes` (46 columns incl. contraindication data and `skin_concerns`) is displayed read-only in CRM/report tabs but is **never queried** during recommendation entry, report generation, or plan acceptance. The only safety signal at recommendation time is a free-text `red_flags` field stored alongside the assessment, enforced against nothing.
- Existing catalog tags (`services` via `service_categories.concerns`, `products.skin_concerns`) are display/marketing metadata, not wired to scoring or safety.

**Recommended layer (design proposal, not a claim of any external standard):**
1. A criteria table, e.g. `xcape_solution_criteria`: scope (service or product), solution id, the engine variable(s) it addresses, the stage-band range where it is considered appropriate, exclusion flags, and an XCAPE-approved flag with approver/audit fields.
2. A contraindication map, e.g. `xcape_solution_exclusions`: solution id ↔ safety-intake field/value that excludes or warns (pregnancy, active medication categories, recent procedures, allergies — using fields already present in `client_safety_intakes`).
3. A pure resolver function (shared lib + mirrored `_shared/` copy, same parity-test pattern as `reportConcernFormatter`): inputs = `EnginePayload` + client safety intake; outputs = suggested solutions with reasons, excluded items with reasons. Deterministic, testable, no AI required.
4. UI: pickers show "Suggested by analysis" (pre-filtered, with reason chips) and hard warnings on excluded items; practitioner still approves every selection — consistent with the existing decision-support-only philosophy.
5. Governance: admin UI to maintain the criteria (which solutions are XCAPE-approved, which bands they apply to), versioned so a report shows which criteria version produced its suggestions.

---

## 8. Security gaps for a standalone approved-practitioner SaaS — [CONFIRMED FACTS]

**Isolation:**
- **No tenant concept exists anywhere** — verified: zero org/clinic/tenant columns in the live schema; every table is global; all RLS is role-based via `has_role()`. `Admin.tsx:722-724` even comments this as a "Phase 0 limitation". Multi-tenant use today would leak all data across organizations. Any SaaS step requires an `org_id` retrofit on every table, every RLS policy, and every service-role query in edge functions.
- `public-lookup-client` reads up to 2000 rows of the global `clients` table in memory; `analyze-skin-image` reads any client's media with the service role. Fine single-tenant; cross-tenant leaks in SaaS form.

**Roles and approval:**
- RLS on `user_roles` is verified safe: users read only their own rows; insert/update/delete are admin-only — no self-escalation path.
- `handle_new_user` (verified live): every signup creates an **inactive** `staff_users` row with **no roles** (except the bootstrap email, which becomes active admin). Good foundation for an approval model.
- **Gap:** the approval gate is client-side only (`AuthGuard.tsx:29-57`). No audited edge function checks `staff_users.status` — an account marked `inactive` that still holds role rows can still call privileged edge functions (`admin-create-report-link`, `admin-preview-report`, etc.). Server-side status checks are missing.
- **Gap:** any admin can mint new admins in one call (`admin-create-staff:132-138`), no secondary approval or audit requirement.
- **Gap:** all edge functions deploy with `verify_jwt=false` and hand-roll auth. Every new function that forgets the manual check is wide open. A shared auth middleware in `_shared/` is the natural hardening step.

**Storage ownership:**
- `client-media` upload paths are client-scoped (`clients/{clientId}/...`) but any staff role can write into any client's folder (verified live policy); no practitioner-level ownership. Signed-URL reads and admin-only deletes are correctly configured.
- `intake-photos` allows **anonymous uploads** under `outreach/` and `social/` paths (verified live policy) — acceptable for funnels, but needs monitoring/rate limiting in a SaaS context.

**Report links:**
- Bearer-token-only: anyone with the URL views the full report, downloads the PDF, logs events, and can submit a payment claim (`public-report-claim-payment`, unauthenticated write, capped at ₦100M, inserted as `pending_review`).
- Token hygiene is good (HMAC-derived, only sha256 stored, revoke supported, one active link per assessment).
- **Gap:** links **never expire by default** (`expires_at = NULL` by design) and there is no rate limiting or per-link access alerting beyond `client_report_events`. For a SaaS, per-organization expiry policy and anomaly surfacing are needed.
- Booking tokens (`public-manage-booking`) similarly gate signed URLs to client photos — same bearer model.

**Configuration:**
- `APP_PUBLIC_URL` has a hardcoded fallback to the Tropics preview domain in three edge functions — generated links would point at the wrong product if unset. Must be removed for XCAPE.

---

## 9. Target information architecture — [RECOMMENDATION]

```text
XCAPE Practitioner Console (approved practitioners)
  Dashboard            -> today's analyses, pending reviews, recent reports
  Clients
    Client list/search -> create or select client
    Client profile     -> Assessments (canonical), Media, Safety intake, Report history
  New Analysis         -> client -> photos -> AI assist -> four-variable scoring
                          -> criteria-driven suggestions -> practitioner approval
                          -> save assessment
  Reports              -> issue link, preview, revoke, view events, download PDF
  Solutions Catalog    -> read-only view of XCAPE-approved services/products
                          relevant to their practice

XCAPE Admin Console (platform)
  Practitioner Management -> approve/activate/suspend practitioners (server-enforced)
  Criteria Governance     -> solution criteria, exclusions, bands, versioning, audit
  Catalog Management      -> services/products, approval flags
  Report Link Oversight   -> links across orgs, revocation, anomaly events
  Security & Access       -> role grants with audit trail, session/impersonation logs
  Configuration           -> brand/contact config, link expiry policy, public URL
```

Deliberately absent from the target IA: appointments, visits, treatment-plan payment commerce, outreach CRM, inventory, finance, subscriptions. Treatment-plan display stays only if plans remain a product feature; payment/cart blocks move to an optional slot.

---

## 10. Phased UI/UX reconstruction plan — [RECOMMENDATION]

**Phase 0 — Freeze the core (no visual change).** Document the canonical pipeline (this audit); tag `AnalysisStage.tsx`/`clients.skin_analysis` and `skinFramework.ts` as legacy in code comments; add the parity-test pattern to any new shared lib. Goal: everyone agrees what is canonical before anything moves.

**Phase 1 — Configuration decoupling.** Parameterize `src/lib/brand.ts` and remove the hardcoded `APP_PUBLIC_URL` fallbacks; move report promo/contact data from `outreach_settings` to a neutral config source; extract commerce cards (`PaymentActionCard`, cart-backed products/summary, promo CTA) from `PersonalReportView` behind a feature slot. The public report must render identically with the slot on or off.

**Phase 2 — Security foundation.** Server-side `staff_users.status` enforcement in all privileged edge functions via a shared `_shared/` auth helper; practitioner approval flow (signup → pending → admin approval → active); audit logging for role grants; report-link expiry policy. (Multi-org isolation is a separate, later decision — Phase 2 keeps single-tenant.)

**Phase 3 — Recommendation-criteria layer.** Build the criteria/exclusions tables, deterministic resolver (with mirrored `_shared/` copy and parity tests), picker suggestions/warnings, and the admin governance UI. Practitioner approval stays mandatory; the engine itself is not rebuilt.

**Phase 4 — XCAPE console IA.** Introduce the practitioner console shell (Section 9) alongside the existing admin; migrate Clients/Assessments/Reports into it; hide MedSpa-ops routes at the router level; then rebrand the visible surfaces (name, logo, copy — Dr. Edith's name removed from product branding while the protocol content is retained as clinical copy). Decommission legacy surfaces only after their last confirmed consumer is gone.

**Preserved throughout:** `client_visit_assessments` schema and engine payload shape, `client_media` storage layout, the HMAC report-link system and `client_report_links` rows (existing client links keep working), `reportConcernFormatter` parity, and the AI-assist decision-support boundary.

---

## Fact-vs-recommendation summary

- Sections 1-5, 7 (gap portion), and 8 are confirmed against the repo and live database (schema, RLS policies, storage policies, function bodies).
- Sections 6, 7 (design), 9, and 10 are recommendations awaiting your direction.
- No claim is made that the scoring model or criteria design constitutes an industry or medical standard; the engine is preserved as-is and the criteria layer is proposed as configuration owned by the XCAPE program, with practitioner approval remaining the final step.
