# Android install: fix the "Unsafe app blocked" path

## What is actually happening

The screenshot is Google Play Protect blocking an app that a **non-Chrome Android browser** created when the user tapped "Add to Home screen". Samsung Internet (and several in-app browsers) build their own small Android package on the phone, and that package targets an old Android API level, so Play Protect refuses it. It has nothing to do with the site's code being broken.

Chrome on Android does not do this: it asks Google's WebAPK service to build the installed app, and that build always targets a current Android version, so Play Protect accepts it.

Verified on the live app: the manifest is served correctly (`application/manifest+json`, standalone, `id`/`start_url`/`scope` = `/`, 192 + 512 any and maskable icons), and the head links the manifest, theme colour and apple touch icon. So installability itself is correct; the failure is purely which browser performs the install.

## What to change

The install card currently shows the same "open the Chrome menu" text to every Android visitor, even when they are in Samsung Internet or a social in-app browser where that menu does not exist and the install will be blocked.

1. **Detect the Android browser family** in `src/lib/pwa/installState.ts`
   - Add detection for: real Chrome, Samsung Internet (`SamsungBrowser`), and in-app browsers (`FBAN/FB_IAV/Instagram/Line/WhatsApp/TikTok`, `wv`).
   - Return a new affordance value for the blocked-browser case instead of the generic `android` one.
   - Keep the existing `prompt`, `ios` and `none` behaviour untouched.

2. **Browser-correct copy and an escape hatch** in `src/components/pwa/InstallXcape.tsx`
   - Chrome (no prompt event): keep today's Chrome-menu instructions.
   - Samsung Internet / in-app browser: explain plainly that installing from this browser gets blocked by Google Play Protect, and offer a single **Open in Chrome** button.
   - The button uses an Android Chrome intent URL for the current page, with a copy-link fallback if the intent does not resolve.
   - No new dependencies, no service-worker or manifest changes.

3. **Support wording** — one short line under the blocked-browser card: if a user already tapped through the Play Protect warning, they should delete that icon and reinstall from Chrome, since the blocked package never runs.

4. **Tests** in the existing `installState` test file
   - Samsung Internet UA resolves to the blocked-browser affordance.
   - Instagram/Facebook in-app UAs resolve to the blocked-browser affordance.
   - Chrome Android with no deferred prompt still resolves to `android`.
   - Chrome Android with a deferred prompt still resolves to `prompt`.
   - Standalone/dismissed still resolve to `none`.

## Notes

- The manifest, service worker, origin (`https://xcapeskinscan.lovable.app`) and icons are untouched — changing `start_url`, `id` or `scope` would orphan already-installed Android apps.
- This is presentation and guidance only; no backend, analysis, pricing or report logic is affected.
- Verification: full vitest suite, typecheck, production build. No publish.

## Open question

If your Android testers are hitting a different problem than this install block — for example the camera scan failing inside the installed app — tell me the exact step and I will extend the plan to cover it.
