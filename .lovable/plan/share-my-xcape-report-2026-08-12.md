# Share my XCAPE report

Let a person who just finished the free public scan enter their name, mobile number and (optional) email, and receive their own report link — reusing the existing personal-report link machinery the staff panel already uses.

## What the visitor sees

1. On the finished report screen, "Send my report" opens a short form: full name, mobile (country-code field, defaults +234), email (optional), and a consent checkbox for follow-up.
2. On submit, the report is registered to them and the screen shows:
   - "Your report is ready" with the personal link,
   - Copy link, Share (native share sheet), and Open my report,
   - a note that the XCAPE team may follow up.
3. A WhatsApp message with the link is sent to the number when WhatsApp sending is configured; otherwise a "Send on WhatsApp" button opens WhatsApp pre-filled with the same message. Copy/share always works.
4. The kit/formula section of the personal report stays hidden until a practitioner approves it — nothing invented, no price shown before approval.

## What happens behind the scenes

The anonymous session is promoted into the normal clinical records so the report is the same one staff can see and work on:

- Find-or-create a `clients` lead row from the phone number (matching the existing public-intake behaviour: match on normalised phone, otherwise insert as a lead with source = public skin analysis).
- Write a `client_visit_assessments` row from the session's saved engine payload (scores, notes, interpretation, directions). No recomputation — the exact stored engine output is copied.
- Create the persistent report link in `client_report_links` with the existing deterministic HMAC token (`REPORT_LINK_SIGNING_SECRET`), so only `sha256(token)` is stored and staff can recover the URL later from the Reports tab.
- Stamp the session with `client_id`, `delivery_channel` and `delivered_at` (columns already exist), and log the lead journey / attribution event so the team sees a new contactable lead.
- Log the WhatsApp send in `outreach_logs`, same as the intake acknowledgement flow.

## Technical notes

New edge function `public-analysis-share-report`:
- authenticated only by the raw public session token (same pattern as `public-analysis-report`); rejects sessions that are not `complete`, expired, or already delivered (idempotent — re-submitting returns the same link).
- validates name / E.164 phone / optional email with Zod, normalises the phone, rate-limits by session (one claim per session, small attempt cap).
- returns only `{ report_url, delivered_channel }` — never client id, assessment id, session id or storage paths.

Token derivation (`deriveToken`, `sha256Hex`) is moved from `admin-create-report-link` into `supabase/functions/_shared/reportLinkToken.ts` and imported by both, so there is one implementation.

WhatsApp delivery reuses the existing pattern in `send-intake-whatsapp`: Cloud API send when `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` are set, otherwise a `wa.me` fallback link returned to the browser. A new `report_share` template category is used for the message body.

Frontend:
- `PublicShareReportForm.tsx` (dark public theme, mobile-first) replacing the "coming soon" button in `PublicReportStage.tsx`.
- `shareReport()` added to `src/lib/publicAnalysisSession.ts`, with the same structured-error handling used elsewhere.

Migration: an RPC (`public_analysis_claim_lead`) with row-level locking that performs the session→client/assessment promotion in one transaction so double submits cannot create duplicate leads or links. Service-role only, `SET search_path`, `REVOKE EXECUTE` from public per project convention.

Tests: unit tests for phone/email normalisation and idempotent claim behaviour, plus a regression test that the share response never contains ids or storage paths.

## Out of scope

- Email delivery of the link (structure allows adding it later; email is captured now).
- Any change to kit pricing, formula approval or the practitioner workflow.
