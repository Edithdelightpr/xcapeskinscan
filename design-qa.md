# Design QA — scan-intro redesign (/skin-analysis)

Scope: the public scan-intro start screen only (`src/components/xcape/public/PublicScanIntro.tsx`). No application code, tests, dependencies, assets or behavior were changed by this QA pass.

## Source truth

- Figma: https://www.figma.com/design/cchIMS6TN8i1dqcdcmLGZ3
  - Desktop frame: node `2:2`
  - Mobile frame: node `2:64`
- Implementation commit: `231d8d43e17d95a7f3a8bac4c04c7d3666620611`
- Route rendered: `http://localhost:8080/skin-analysis`

## Evidence

| Screenshot | Viewport (CSS px) | Density |
| --- | --- | --- |
| `/tmp/browser/intro/mobile.png` | 390 × 844 | 1× (deviceScaleFactor not overridden) |
| `/tmp/browser/intro/mobile-consent.png` | 390 × 844 | 1× |
| `/tmp/browser/intro/desktop.png` | 1440 × 900 | 1× |
| `/tmp/browser/intro/desktop-consent.png` | 1440 × 900 | 1× |

Headless Chromium via Playwright, dev server build.

## Primary interactions tested

| Interaction | Mobile 390×844 | Desktop 1440×900 |
| --- | --- | --- |
| "Start analysis here" opens consent surface without dispatching `onStart` | pass | pass |
| "Upload photos instead" opens consent surface | pass | pass |
| "Agree and continue" disabled before the checkbox is ticked | pass (disabled) | pass (disabled) |
| Escape closes the consent surface | pass (dialog removed) | pass (dialog removed) |
| Consent checkbox reset on reopen | pass (unchecked) | pass (unchecked) |
| "Privacy details" disclosure collapsed on open | pass (`aria-expanded="false"`) | pass (`aria-expanded="false"`) |
| "How it works" reveals the below-the-fold details section | pass | pass |

Consent surface renders as a bottom drawer on mobile and a centered dialog on desktop, per the approved frames.

## Layout measurements

- Horizontal overflow (`scrollWidth − clientWidth`): **0 px** at both viewports.
- Primary CTA bottom edge: **567 px** at 390×844 and **589 px** at 1440×900 — visible without scrolling in both cases.
- Desktop: heading + portrait + CTA in the left column, compact light-neutral "Ready when you are" panel on the right; whole decision area fits in one viewport.
- Mobile order confirmed: eyebrow → heading → portrait → CTA → "Upload photos instead" / "How it works" → "Ready when you are" panel.

## Console errors checked

Console and `pageerror` listeners were attached before navigation at both viewports. The only entries are React dev-mode `Function components cannot be given refs` warnings originating from app-level providers (`App`, `QueryClientProvider`, `BrowserRouter`, `AuthProvider`, `Toaster`, `DiscountPopup` and similar). They are pre-existing, global to the app, unrelated to the scan-intro redesign, and absent from production builds. No errors from `PublicScanIntro` or the consent surface.

## Visual findings

- Portrait uses the approved asset with the natural centered crop; no distortion, no duplicated oval or grid overlay drawn on top.
- Top status pill "Alignment guide · auto-capture" overlays the image without adding layout height and is legible at 390 px width.
- Bottom pill "Hold still — no button to press" is legible with sufficient contrast at both viewports.
- Monochrome white/black/grey system, DM Sans, and existing rounded-corner radii preserved; no gradients, purple or gold.
- Interaction targets in the start area and consent surface meet the 44 px minimum.
- No P0, P1 or P2 discrepancies found against the desktop `2:2` and mobile `2:64` frames.

final result: passed
