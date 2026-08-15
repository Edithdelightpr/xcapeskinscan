---
name: PWA & web push
description: XCAPE PWA setup — manifest, guarded SW registration, install UX, push subscription storage and the VAPID secret still required
type: feature
---
XCAPE is an installable PWA (Layer 1 only — no Capacitor/native).

- Manifest: hand-authored `public/manifest.webmanifest` (vite-plugin-pwa runs with `manifest: false`). Standalone, portrait, start_url/scope `/`, white theme/background matching the `.xcape-public` landing system. Icons generated from `src/assets/xcape-icon.png` into `public/icons-xcape-*.png` (any + maskable) — never create a new logo.
- Service worker: `vite-plugin-pwa` generateSW, `injectRegister: null`, `devOptions.enabled: false`. Registered ONLY from `src/lib/pwa/registerServiceWorker.ts` (refuses dev, iframes, Lovable preview hosts, `?sw=off`, and unregisters `/sw.js` in those cases).
- Caching: HTML navigations NetworkFirst, `/assets/` hashed files CacheFirst. Never cache Supabase responses, signed URLs, reports or session data.
- Push: `public/xcape-push-sw.js` (imported into sw.js) handles `push` + `notificationclick` same-origin deep links. Client logic in `src/lib/pwa/push.ts`; subscriptions persist to `public.push_subscriptions` (auth-only, RLS by user_id). Permission is requested only from an explicit user action.
- **Still required for real delivery:** `VITE_VAPID_PUBLIC_KEY` frontend env + a `VAPID_PRIVATE_KEY` backend secret + a sender edge function. Until then `enablePushNotifications()` returns `vapid_missing` — never fake success.
- Install UX: `src/components/pwa/InstallXcape.tsx` (used on the landing page), helpers/tests in `src/lib/pwa/installState.ts`.

- **Origin lock:** production PWA origin is permanently `https://xcapeskinscan.lovable.app`. Renaming the Lovable slug orphans installed Android PWAs (it happened once with `xcape-skin-scanner`). Never change the slug or `CANONICAL_PUBLIC_APP_URL` without an explicit, planned migration; `src/lib/publicAppUrl.test.ts` and `src/lib/pwa/manifestIdentity.test.ts` guard it.
