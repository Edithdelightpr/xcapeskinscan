# Plan: Adopt the official XCAPE logo

Replace the generated monogram + text wordmark with the official uploaded logo (gold serif "Xcape" wordmark with green leaf, 1254×1254 PNG on white). Two processed variants cover every surface: full-black monochrome for the light landing, transparent gold original for the dark app surfaces.

## 1. Process the uploaded logo (deterministic, no AI edit)

From `user-uploads://image-2.png` using ImageMagick:

- **Trim + transparency**: crop to content bounding box (`-trim`), convert white background to transparent (`-fuzz -transparent white`).
- **Variant A — `xcape-logo-black.png`**: full monochrome black (RGB zeroed, alpha preserved) for the light Notion-style landing where gold-on-white lacks contrast and the framework is monochrome.
- **Variant B — `xcape-logo-gold.png`**: original gold letters + green leaf on transparency, for dark surfaces (app shell, auth) where the official gold reads well.
- **Mark crop — `xcape-icon.png`**: the "X + leaf" cropped square from Variant B, used only as the favicon/touch-icon source.

Store Variants A/B as Lovable CDN assets (`lovable-assets create` → `src/assets/xcape-logo-black.png.asset.json`, `src/assets/xcape-logo-gold.png.asset.json`) and import the pointer URLs. The favicon stays a real file in `public/` (never a pointer).

## 2. Landing page (light, monochrome) — black variant

- `src/components/xcape/landing/XcapeHero.tsx`: replace the monogram `<img>` + "XCAPE" text span with the single official logo image, `alt="XCAPE"`, explicit `width`/`height` from the processed file, sized ~`h-10 w-auto`. Headline, CTAs and illustration unchanged.
- `src/components/xcape/landing/XcapeLandingNav.tsx`: same swap in the scrolled nav (`h-7 w-auto`, `alt="XCAPE"`).

## 3. App shell + auth (dark surfaces) — gold variant

- `src/components/xcape/XcapeShell.tsx`: add the gold logo image beside/above the existing XCAPE name in the sidebar header (keep name + tagline text; logo at `h-7 w-auto`).
- `src/pages/Auth.tsx`: place the gold logo above the existing "XCAPE" heading (`h-10 w-auto`).

## 4. Favicon + touch icon

- From the `xcape-icon.png` crop: `magick -resize 64x64 -background none -gravity center -extent 64x64 public/favicon.png` (gold mark, transparent bg — visible on light and dark browser chrome).
- Regenerate `public/apple-touch-icon.png` at 180×180 on a white background (iOS flattens transparency to black otherwise).
- `index.html` already references `/favicon.png` + `/apple-touch-icon.png` — no markup change needed.

## 5. Cleanup

- Delete `src/assets/xcape-mark.png` (generated monogram, unused after the swap; it has no CDN pointer).
- `public/favicon.jpeg` (old Tropics-era file, unreferenced) removed only after confirming no reference remains.

## Technical details

- Alt text: `alt="XCAPE"` on the hero/auth logo (conveys brand); nav logo also `"XCAPE"` since it links home.
- Explicit width/height attributes on every `<img>` to prevent layout shift; `fetchPriority` untouched (hero illustration keeps `high`).
- No routing, copy, theme-token, or layout changes; no MedSpa (`/medspa`) changes.
- Logo processing uses ImageMagick only — no AI regeneration, so letterforms stay pixel-faithful.

## Verification

- `rg` confirms zero remaining references to `xcape-mark`.
- Typecheck, full test suite, production build.
- Playwright screenshots: landing hero + scrolled nav (desktop 1280, mobile 390), auth page, signed-out shell fallback, and `/favicon.png` serving the new mark.
