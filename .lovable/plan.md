# Public Skin Analysis — wire the real engine report into the new UI

## What is actually wrong today

The analysis itself already works. The most recent public session in the database completed successfully and stored the full engine payload: the four practitioner scores (72 / 78 / 85 / 68), per-variable notes, priority order, overall stability, combined interpretation, home-care directions and treatment directions.

The screen still says "the scores could not be read back" because of one gap in the browser code: while the scanning animation is polling, the poll handler updates phase and stage but never stores the `scores` / `priority_category` it receives. The report stage then renders with `scores = null`. The status endpoint and database function are already returning the scores correctly.

Separately, even once that is fixed, the public report only shows four meters. Everything else the staff outreach flow prints (concern-by-concern breakdown, interpretation, home care, treatment direction) exists in the engine payload but is never sent to the public page.

## Phase A — Fix the score handoff (small, immediate)

- Store scores and priority in the polling path the same way the resume path already does, so a run that completes during the animation lands on a populated report.
- Keep the "could not be read back" message as a genuine fallback only.
- Add a regression test that a completed poll produces a report with scores.

Result: the screen in the screenshot shows four real meters plus the priority band.

## Phase B — Full report parity with the staff workflow

Add a `public-analysis-report` edge function that, for a completed session, returns the same formatted report the staff flow builds:

- per-concern cards: concern name, score, plain-language status, what it means, what it looks like
- overall skin stability and the combined interpretation line
- home-care directions and treatment directions
- the priority concern

It reuses the existing shared formatter (`_shared/reportConcernFormatter.ts`) so wording is identical to the practitioner report. As with the status endpoint, the payload is whitelisted field by field: no session id, no storage path, no signed URL, no `ai_raw`, no raw AI envelope.

The public report screen is extended in the current dark design: score meters at the top, then the concern cards, interpretation and guidance below, keeping the existing typography and spacing.

## Kit and pricing (the one deliberate difference)

The Delight Express Kit formula is only valid after a practitioner accepts it and a snapshot is written. An anonymous visitor has no practitioner decision, so the public report will not print a purchasable formula, dose or price. In the customization position it shows the recommended direction plus a "Book a review with an XCAPE practitioner" call to action, and a lead-capture step (name, phone with country code, email) that creates the lead exactly as the outreach flow does today, so the visitor can be converted and receive the approved kit report.

If you want the public report to show kit pricing before practitioner approval, say so and I will re-scope — it changes the safety model, not the UI.

## Technical notes

- Frontend: `src/pages/PublicSkinAnalysis.tsx` (poll handler state), `src/components/xcape/public/PublicReportStage.tsx` (extended sections), new public concern-card presentation component.
- Backend: new `supabase/functions/public-analysis-report`, reusing `_shared/reportConcernFormatter.ts`; a new whitelisting `public_analysis_report()` SECURITY DEFINER function keyed on the SHA-256 token hash, with `SET search_path` and `REVOKE EXECUTE` from anon/authenticated.
- No schema change to `public_analysis_sessions`; no anonymous RLS grants; 24-hour image retention unchanged.
- Existing tests stay green; new tests cover the poll-to-report handoff and the report payload whitelist.
