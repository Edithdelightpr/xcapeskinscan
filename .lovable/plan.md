# XCAPE Landing Page — Rebuilt on the Reference Framework

## Goal

Replace the home page (`/`) with a new XCAPE public landing page that reuses the exact design framework of the "Bottomline chat" reference project (checked out and studied at commit 33801392), reworded for XCAPE's objective: a tropical/melanin-rich skin analysis platform — backed by 17 years of research across 10,000+ skin profiles in Africa — recruiting **Affiliates**, **Certified Distribution Partners (CDPs)**, and **Team/Ambassadors**. Sign-up CTAs link to the existing `/auth` page. No backend or database changes.

## The reference framework (what we replicate)

- Notion-style light monochrome: white background, neutral grays, centered `max-w-5xl` column
- Fixed nav that only appears after scrolling (~60px): logo left, "Sign in" button right
- Hero = one soft-gray `rounded-2xl` card: wordmark, large tight-tracked headline, subcopy, dark CTA button; right side a hand-drawn black-and-white ink illustration (`mix-blend-multiply`)
- Section 2 = three pastel-tinted cards (amber / blue / emerald header band with an overlapping white icon chip)
- Section 3 = inverted dark band (`neutral-900`): eyebrow, heading, 2×2 icon feature grid
- Section 4 = centered closing CTA + hairline footer
- Signature `BlurFade` motion (blur + rise + fade, staggered) and the Camera Plain Variable typeface (font file copied from the reference snapshot)

## Section-by-section mapping to XCAPE

1. **Scroll nav** — XCAPE mark + "Sign in" → `/auth` (if already signed in: "Open XCAPE" → `/xcape/analysis`)
2. **Hero card** — XCAPE wordmark; headline in the spirit of "Skin analysis, built for African skin."; subcopy: guided facial scan, four clinical scores, practitioner review, personalized formula — built on 17 years of research across 10,000+ skin profiles in Africa; CTA "Join XCAPE" → `/auth`; newly generated ink-style illustration of a guided 3-view facial scan (same hand-drawn language as the reference)
3. **"Choose your path"** — three pastel cards: **Affiliate** (refer clients, earn on analyses and kits), **Certified Distribution Partner** (for verified locations where clients get scanned and receive kits), **Team / Ambassador** (join the field team). Each card: one-line description + "Sign up" → `/auth`
4. **Dark band — "What XCAPE does"** — 2×2 grid: Guided 3-view facial scan; Four skin-health scores; Practitioner-reviewed protocols; Personalized kit formula & secure report. Eyebrow carries the research credibility line
5. **Closing CTA + footer** — "Ready to join XCAPE?" → `/auth`; minimal hairline footer

## Technical approach

- New `src/pages/XcapeLanding.tsx` plus small section components under `src/components/xcape/landing/` — no changes to existing landing components
- Routing: `/` → new XCAPE landing; the current MedSpa `Index` moves untouched to `/medspa` so nothing is deleted; every other MedSpa route (`/treatments`, `/tropixa`, `/consultation`, …) keeps its URL
- Scoped light theme: a `.xcape-public` wrapper class in `index.css` carrying the reference's light-monochrome tokens + the three pastel tints as semantic tokens — no hardcoded color utilities in components; the global purple theme is untouched
- Typography: copy `CameraPlainVariable.woff2` from the snapshot into `src/assets`, register `@font-face` scoped to the landing wrapper. Note: this intentionally deviates from the project's Poppins rule for this page only, to stay faithful to the reference framework — the rest of the app keeps Poppins
- Motion: port `BlurFade` dependency-free (IntersectionObserver + CSS transitions) matching the reference timing — no new npm packages
- Hero illustration: generate a hand-drawn black-and-white facial-scan illustration in the same style as the reference artwork
- `index.html` head: title/description/og tags become XCAPE ("XCAPE — Tropical Skin Analysis"); remove the `edithdelightpr` social link from JSON-LD; swap the MedicalBusiness JSON-LD for an Organization entry; regenerate `public/sitemap.xml` to include `/medspa`

## Out of scope (later phases)

- Role-specific onboarding logic for Affiliate / CDP / Team sign-ups
- Redesign of inner pages (`/auth`, the XCAPE shell, MedSpa public pages) — landing first, then we roll the framework outward
- Any backend, database, or authentication changes

## Verification

- Typecheck, build, and existing test suite stay green
- Visual check of the new `/` at top and scrolled states (nav appearance, BlurFade, cards, dark band, footer)
- Confirm `/medspa` still renders the old landing, and all sign-up CTAs reach `/auth`
