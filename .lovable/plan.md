# XCAPE Public Skin Analysis — `/skin-analysis`

A public, no-signup skin analysis experience that reuses the real capture, engine and report machinery already in the app, orchestrated server-side so no anonymous access is granted to existing client data.

---

## 1. Verified current-state audit

**Public routes (`src/App.tsx`)**: `/` (XcapeLanding), `/medspa`, `/auth`, `/report/:token` (PersonalReport), `/invite/:token`, plus MedSpa public pages. No `/skin-analysis` exists — the route is free.

**Landing design system**: `src/pages/XcapeLanding.tsx` wraps everything in `.xcape-public`, a scoped token override block in `src/index.css` (line ~127). Components: `XcapeLandingNav`, `XcapeHero`, `XcapeHowItWorks`, `XcapeJoinPaths`, `XcapeFeaturesDark`, `XcapeCredibilityStrip`, `XcapeClosingCta`, `BlurFade`. Logo assets already exist (`xcape-logo-black.png`, `xcape-logo-gold.png`, `xcape-icon.png`) — the newly uploaded wordmark will replace/refresh the black asset rather than being retyped.

**Capture stack (`src/components/xcape/scan/`)**
- `GuidedFacialScan.tsx` (475 lines) — consent → scanning → per-view review → upload. Coupled to staff: takes a `RealClient`, calls `useUploadClientMedia` (authenticated, `client-media` bucket), and has an explicit per-view Retake/Accept review phase.
- `ScanStage.tsx` (239) — camera surface, overlay, guidance chrome. Largely reusable.
- `useCameraStream.ts`, `useFaceLandmarker.ts` — fully reusable, no auth coupling. MediaPipe WASM from pinned CDN, model self-hosted at `public/models/face_landmarker.task`.
- `src/lib/scan/scanQuality.ts` — pure quality gates (single face, size, centering, yaw, luma, Laplacian sharpness, 1.5s hold) + `SCAN_VIEWS`. Fully reusable, unit-tested.

**Analysis stack**
- `supabase/functions/analyze-skin-image/index.ts` — **staff-only**: requires a Bearer session and a role in `admin|medical_aesthetician|front_desk|outreach`; signs `client-media` paths; calls the AI gateway; returns structured JSON. Cannot be reused as-is publicly.
- `src/lib/skinEngine.ts` — pure: `buildEnginePayload`, stage tables, priority order, copy bank, `overallStability`. Fully reusable, no auth.
- `SkinAnalysisAiPanel.tsx` — invokes the edge function then builds the engine payload client-side (line ~161). The engine-building logic is portable; the panel UI is staff-only.

**Wizard**: `XcapeAnalysisWizard.tsx` (408) — 6 steps, session WIP key `xcape:analysis:wip`, assessment identity ref, autosave via `useSaveVisitAssessment`. Staff-only; the public flow will not touch it.

**Report**: `PersonalReportView.tsx` is the shared renderer used by `/report/:token` and the staff preview; it consumes `ReportPayload` from `useReportPayload`/`public-report-fetch`. `public-report-fetch` already implements the exact pattern we need: anon-callable, token → SHA-256 → `client_report_links.token_hash`, service-role read, whitelisted response (first name/initials only), view logging with dedupe.

**Storage**: `client-media` (private), `xcape-admin-mockups` (private). No public-demo bucket.

**Phone**: no `components/ui/phone-input.tsx`; a `PhoneInput` component is used across `PublicIntake`, `ClientCaptureForm`, etc., backed by `src/lib/phone.ts` (`COUNTRIES`, `toE164`, `DEFAULT_DIAL_CODE = '+234'`). Cameroon `+237` is already in the list — the default is a per-instance prop, not a global change.

**Lead patterns**: `public-submit-intake` shows the established anon edge-function pattern (honeypot, timing gate, validation, service-role writes, attribution via `source_type`/`referral_meta`).

---

## 2. Reuse / refactor / new-build map

| Piece | Verdict |
|---|---|
| `useCameraStream`, `useFaceLandmarker`, `scanQuality.ts`, `skinEngine.ts` | Reuse unchanged |
| `ScanStage.tsx` | Reuse; add an optional `variant="public"` prop for the light-reference chrome |
| `GuidedFacialScan.tsx` | Extract the capture state machine into a headless `useGuidedCapture()` hook; the staff component keeps its review phase, the public component skips it (auto-advance) |
| `PersonalReportView` + report components | Reuse for the public report, fed by a sanitized public payload |
| `public-report-fetch` | Pattern reused; new dedicated function rather than widening this one |
| `analyze-skin-image` | New sibling `public-skin-analyze` (session-token auth instead of JWT) sharing the prompt module via `_shared` |
| `XcapeAnalysisWizard`, `Step*` components, `useClientMedia`, `useVisitAssessments` | Untouched — staff flow must keep working |
| Public page, session model, scanning animation, delivery sheet | New build |

---

## 3. Route and UX state machine

Route: **`/skin-analysis`** (public, outside `AuthGuard`, wrapped in `.xcape-public`). Landing CTA "Try free skin analysis" added to `XcapeHero` and `XcapeClosingCta`.

```text
intro ──consent──> permission ──granted──> capture(front→left→right)
  │                    │denied                    │ auto-capture on gates pass
  │                    ▼                          ▼
  │                fallback(upload)  ───────> uploading ──> analyzing
  │                                                            │
  └───────────────────────────────────────────────> report <───┘
                                                     │
                                       deliver-sheet ⇄ report (closable)
                                                     └─> delivered
```

- `intro`: headline, 3-step chip row (Capture · Analyze · Report), privacy + cosmetic-not-medical disclaimer, "Start scan" (single consent action), "Upload photos instead" secondary.
- `capture`: no shutter button on the happy path; each view auto-captures after the stable hold and immediately advances. Thumbnails appear as small confirmations, never as approval gates.
- `analyzing`: dark charcoal stage, frozen front frame, phase messages, indeterminate progress.
- `report`: full `PersonalReportView`, no blur/paywall. Sticky "Send / share my report" opens the sheet; the sheet is dismissible and the report stays fully readable.

---

## 4. Component hierarchy / file plan

**New**
- `src/pages/PublicSkinAnalysis.tsx` — page shell, `.xcape-public`, Seo, state machine host.
- `src/components/xcape/public/PublicScanIntro.tsx`
- `src/components/xcape/public/PublicCaptureStage.tsx` (uses `ScanStage` + `useGuidedCapture`)
- `src/components/xcape/public/PublicUploadFallback.tsx`
- `src/components/xcape/public/AnalysisScanAnimation.tsx`
- `src/components/xcape/public/PublicReportView.tsx` (thin wrapper over `PersonalReportView` + sticky CTA)
- `src/components/xcape/public/ReportDeliverySheet.tsx`
- `src/hooks/usePublicAnalysis.ts` — session create, upload, analyze, poll, deliver.
- `src/lib/publicAnalysisSession.ts` — session token persistence (sessionStorage), idempotency keys.

**Refactor (behaviour-preserving)**
- `src/components/xcape/scan/useGuidedCapture.ts` — extracted from `GuidedFacialScan.tsx`; the staff component is rewritten to consume it, existing tests kept green.
- `ScanStage.tsx` — add `variant` prop, default = current styling.
- `PhoneInput` — accept a `defaultDial` prop; public sheet passes `+237`.
- `XcapeHero.tsx` / `XcapeClosingCta.tsx` — add the CTA.
- `src/App.tsx`, `public/sitemap.xml` — route + sitemap entry.

**Edge functions (new)**
`public-analysis-start`, `public-analysis-upload-url`, `public-analysis-run`, `public-analysis-report`, `public-analysis-deliver`, `public-analysis-cleanup` (cron).

---

## 5. Automatic capture and failure recovery

Reuse the existing gates and 1.5s hold. Public differences:
- No per-view Accept step: on gate pass → freeze frame → capture → 400ms confirmation → next view.
- Rolling guidance copy ("Move a little closer", "Turn slightly left", "More light needed") driven by `evaluateFrame`.
- **Stuck timer**: after 20s on a view with no capture, reveal a manual shutter and "Skip lighting check" (relaxes the sharpness/luma thresholds one notch, flagged in the payload).
- **Recovery paths**: camera denied/unavailable, no `getUserMedia`, landmark model load failure (`useFaceLandmarker` already exposes `error` + `retry`), or three consecutive failed views → upload fallback (file input, same client-side quality validation + single-face check before upload).
- Retake available per view from the thumbnail strip at any time before analysis starts.

---

## 6. Analysis animation

`AnalysisScanAnimation.tsx`: frozen front capture on a charcoal stage; layered CSS/SVG only (no video, no extra library):
1. Vertical light sweep (transform + linear-gradient mask, 2.4s loop).
2. Face-region outlines drawn from the last MediaPipe landmark set already held in memory (forehead, cheeks, perioral, jaw) with staggered opacity pulses.
3. Region highlight tied to the current phase.
4. Phase labels: "Reading surface balance" → "Comparing your three views" → "Preparing your skin scores" → "Building your personal report", driven by **real pipeline phases** emitted by `usePublicAnalysis` (upload complete → AI call in flight → engine build → report assembly). Indeterminate bar, no fake percentage.
5. Minimum display 2.5s, hard cap none — transitions the moment the last real phase resolves after the floor.
6. `useReducedMotion` → static frame, region outlines without pulse, phase text swaps only.

---

## 7. Backend request flow

```text
POST public-analysis-start
  → validates honeypot/timing, rate limit by IP hash
  → inserts public_analysis_sessions (token_hash, expires_at = now()+2h)
  → returns { token, session_id }

POST public-analysis-upload-url { token, view }
  → verifies token → returns short-lived signed UPLOAD url into
    xcape-public-demo/<session_id>/<view>.jpg (private bucket)

POST public-analysis-run { token, idempotency_key }
  → verifies token, enforces one in-flight run per session
  → signs the 3 objects (300s), calls the AI gateway with the shared prompt
  → builds the engine payload server-side (ported skinEngine scoring)
  → stores result on the session row, sets status=complete
  → returns { status, phase } (poll-friendly)

GET/POST public-analysis-report { token }
  → returns SANITIZED payload: four scores, stage copy, priority,
    home-care guidance, disclaimer. No client PII, no image URLs,
    no kit formula (see Decisions).

POST public-analysis-deliver { token, idempotency_key, name, channel,
                               contact, deliver_consent, followup_consent }
  → validates + normalises to E.164 (+237 default)
  → upsert/match lead in `clients` (source_type='public_demo')
  → links session → client, writes consent record
  → enqueues WhatsApp/email delivery via the existing email/WhatsApp senders
  → returns { ok, already_delivered? }
```

All functions: anon-callable (`verify_jwt=false`), service-role only server-side, CORS from the SDK helper, Zod-style validation, structured errors (429/402 surfaced in UI).

---

## 8. Database, RLS, storage

**New table `public.public_analysis_sessions`**
`id, token_hash, token_prefix, status, phase, views_captured jsonb, engine jsonb, ai_raw jsonb, image_paths jsonb, ip_hash, user_agent_hash, client_id (nullable FK clients), delivered_at, delivery_channel, expires_at, images_purge_at, created_at, updated_at`

**New table `public.public_analysis_consents`**
`id, session_id FK, consent_type ('camera'|'delivery'|'marketing'), granted bool, granted_at, ip_hash, evidence jsonb, created_at`

Grants for both: `GRANT ALL … TO service_role;` only — **no anon, no authenticated grants**. RLS enabled; policies: admins can read via `has_role(auth.uid(),'admin')`; everything else goes through edge functions. No SECURITY DEFINER RPCs needed.

**Storage**: new private bucket `xcape-public-demo` (public=false). Policies deny all client roles; access exclusively via service-role signed URLs. Objects keyed by `session_id`.

**Retention / cleanup**: images purged at `images_purge_at` = capture + 24h; session rows anonymised (engine kept, `ip_hash`/`user_agent_hash`/images cleared) at 30 days. `public-analysis-cleanup` on `pg_cron` hourly. Retention stated verbatim in the on-page privacy copy.

**Rate limits**: max 5 sessions/hour per `ip_hash`, max 1 analysis run per session, max 3 uploads per session, 8 MB and `image/jpeg|png` enforced on the signed-upload policy and re-checked server-side.

---

## 9. Report delivery and lead capture

Sheet fields: full name; channel toggle (WhatsApp default / Email); contact field for the chosen channel (`PhoneInput` defaulting to `+237` Cameroon); required delivery-consent statement (implicit in submit, recorded explicitly); separate **unchecked** "Send me helpful follow-up about my XCAPE results" checkbox.

Server: idempotency key prevents duplicate leads on retry; lead matching by normalised phone/email; `clients` row gets `source_type='public_demo'` and `referral_meta` carrying any `?ref=`/UTM from the landing visit (reusing `useReferralSlug`). Two consent rows written (`delivery`, `marketing`) — never merged.

---

## 10. Security / privacy review

| Threat | Mitigation |
|---|---|
| Anonymous access to real client data | No new anon grants; every read goes through a token-scoped edge function returning a whitelisted payload |
| Token guessing | 32-byte random token, SHA-256 stored, prefix indexed, 2h TTL, single-session scope |
| Cross-visitor leakage | All storage keys and rows scoped by `session_id` resolved from the token; never from a client-supplied id |
| Image abuse / storage flooding | Rate limits, 3-object cap, size/MIME limits, 24h purge |
| AI cost abuse | One run per session, per-IP session cap, 429/402 surfaced honestly |
| PII in the public report | Sanitized payload; no name/contact echoed back before delivery |
| Service-role leakage | Keys read only inside functions; never returned or logged |
| Misleading claims | Cosmetic-insight disclaimer on intro, analysis and report; no medical language |

---

## 11. Phases

**P0 — Extraction (no user-visible change)**: `useGuidedCapture` extracted, `ScanStage` variant prop, `PhoneInput` `defaultDial`. *Accept:* staff wizard behaves identically; existing scan tests pass.

**P1 — Backend foundation**: tables + RLS + grants, `xcape-public-demo` bucket, `public-analysis-start` / `upload-url` / `cleanup`. *Accept:* session created and images uploaded via signed URL from a script; no anon table access possible.

**P2 — Public capture UI**: route, intro, capture stage, upload fallback, recovery paths. *Accept:* three views auto-captured on mobile Safari + desktop Chrome with zero shutter taps on the happy path.

**P3 — Analysis + animation**: `public-analysis-run`, engine build server-side, `AnalysisScanAnimation` with real phases and reduced-motion variant. *Accept:* phases reflect actual pipeline state; no fake counter.

**P4 — Report**: `public-analysis-report` + `PublicReportView`. *Accept:* full report, unblurred, no signup.

**P5 — Delivery + lead**: sheet, `public-analysis-deliver`, consent rows, dedupe. *Accept:* duplicate submits create one lead; consents stored separately; report remains viewable after closing the sheet.

**P6 — Polish**: landing CTAs, logo asset refresh, SEO/sitemap, analytics events.

Dependencies: P0→P2, P1→P2→P3→P4→P5.

---

## 12. Test plan

Unit: `scanQuality` gates (existing), engine scoring parity between staff and public paths, phone normalisation for `+237`, sanitizer (no PII/image URLs escape), idempotency.
Integration (Playwright): permission grant/deny, auto-capture happy path, stuck-view manual fallback, upload fallback, model-load failure retry, report render, sheet open/close/persist, duplicate delivery submit.
Security: attempt anon select on both new tables and the new bucket (must fail); attempt to read another session's report with a mutated token; rate-limit trip at the 6th session.
Accessibility: keyboard operation of intro/sheet, focus trap, `prefers-reduced-motion`, contrast on charcoal stage, screen-reader phase announcements via `aria-live`.
Regression: staff `/xcape/analysis` full wizard, `/report/:token`, admin preview.

---

## 13. Decisions and assumptions (defaults chosen, confirm if wrong)

1. **No kit formula in the public report.** Project rules require a practitioner-approved snapshot before any formula or purchase. Default: the public report shows the four scores, priority, interpretation and home-care guidance, plus a "Get your customized kit" CTA that routes to lead capture — not a purchasable formula. *(Alternative: allow auto-approved formulas publicly — this contradicts the current protocol guardrail and is not recommended.)*
2. **Public sessions are not `client_visit_assessments` rows** until a lead is captured. This keeps the clinical table free of anonymous noise; on delivery the session can optionally be materialised into a real assessment for the matched client. Default: materialise on delivery.
3. **Delivery channel implementation**: reuse the existing email queue for email; WhatsApp delivery uses the existing `send-intake-whatsapp` pattern (link handoff) rather than a new provider integration.
4. **The report link given to the lead** reuses `client_report_links` once the session is materialised, so the delivered link behaves exactly like a staff-issued report link.
5. Image retention default 24h; session data 30 days. Adjustable before P1.
