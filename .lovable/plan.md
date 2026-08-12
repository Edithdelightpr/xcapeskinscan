# Public skin analysis — journey redesign to match the mockups

Rebuild the four screens of `/skin-analysis` so they match the uploaded designs, and surface the four real scores on the finished screen. Delivery (WhatsApp/Email lead capture) is out of scope for this pass.

## Screen 1 — Start ("Look at the camera. We'll do the rest.")

Split layout, light theme.

- Left: eyebrow `XCAPE QUICK ANALYSIS`, large headline, one-line subcopy ("We'll automatically capture front, left and right views."), horizontal 1-2-3 stepper (Capture / Analyze / Report), compact consent checkbox, `Upload photos instead` text link, lock icon privacy line.
- Right: rounded camera panel with the face-alignment frame, "Hold still" caption, a status pill ("Alignment ready · auto-capturing"), and a Front/Left/Right chip rail underneath.
- Existing consent copy and the medical disclaimer stay, condensed under the fold of the left column.

Note: the camera panel only becomes live after consent + start; before that it shows the same framed placeholder so the layout does not jump.

## Screen 2 — Capture

- Full-width light shell: amber banner strip above the camera reading `Capture 2 of 3 · automatic`.
- Camera pane keeps the oval + crosshair guide and a large bottom caption with the live instruction ("Turn gently to your left").
- Right rail (existing `PublicFlowPanel`, restyled): the three tinted step rows, Front/Left/Right thumbnails with accepted check / in-progress ring, then Lighting / Position / Stability readouts with dot + label, then the auto-continue note, `Upload photos instead` and the privacy line.
- All state stays wired to the real `useGuidedCapture` guidance — no fake indicators.

## Screen 3 — Analyzing

Dark card on a light page.

- Header becomes a breadcrumb: `Capture complete · Analyzing · Report` with the active item underlined.
- Left: captured front frame with the dotted contour overlay and a horizontal scan beam; below it, the three captured thumbnails with green checks.
- Right: headline "Your skin analysis is taking shape.", subcopy, and the four metric rows (Pigmentation Balance, Barrier & Hydration, Firmness, Oil & Congestion) with icon, animated bar and number that fill in as the server phase advances.
- Bottom: `Preparing your XCAPE report · NN%` progress line and the `Open my report` button, enabled once the run completes.

## Screen 4 — Report ready

Dark card, same shell.

- Breadcrumb reads `Capture complete · Analysis complete · Report ready`.
- Left: front frame with contour overlay plus the three thumbnails with checked Front/Left/Right labels.
- Right: "Your XCAPE report is ready.", the four final scores with bars, and a `Priority detected: <weakest category>` box explaining the lowest-scoring area.
- Actions: `View full report` (primary) and `Send / share report` — the send action opens a disabled-for-now panel or is deferred until the delivery work lands.

## Technical notes

- Backend: extend `public_analysis_status` and the `public-analysis-status` function whitelist to include the four completed scores (`pigmentation_stability`, `barrier_surface_hydration`, `firmness_skin_support`, `oil_congestion_balance`) and the derived priority category — returned only when `status = 'complete'`. No new grants, no anonymous table access, no exposure of `worker_lease` / heartbeat.
- Client: extend `sanitizeStatusPayload` in `src/lib/publicAnalysisSession.ts` to validate scores as finite integers 0–100, dropping anything malformed.
- Components: restyle `PublicScanIntro`, `PublicCaptureStage`, `PublicFlowPanel`, `AnalysisScanAnimation`; add a `PublicReportStage`; add a shared `PublicJourneyHeader` for the logo + breadcrumb + Exit.
- `ScanStage` keeps `minimalChrome`; only its caption/overlay styling changes. The capture, lease, polling and recovery logic is untouched.
- Palette: XCAPE monochrome with functional accents only (amber = capture/attention, sky = analyzing, emerald = good/complete) exactly as in the mockups. No gold branding.
- Accessibility: keep 44px targets, `aria-live` on the live instruction and phase text, keyboard-reachable upload fallback.
- Tests: extend the existing public-analysis suites for the score sanitizer and the report-stage render; keep the branding assertions passing.
