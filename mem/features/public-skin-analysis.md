---
name: Public Skin Analysis (/skin-analysis)
description: Anonymous public capture flow — session tokens, private bucket, server-side image verification rules
type: feature
---

Anonymous public journey at `/skin-analysis` (`.xcape-public` monochrome theme), separate from the authenticated staff wizard but reusing the same `useGuidedCapture` hook and `ScanStage` (`variant="public"`).

- Session: `public-analysis-start` returns the raw token ONCE; only its SHA-256 hash is stored. Token lives in sessionStorage, never in a URL/log. IP/UA are HMAC-pseudonymised; per-IP hourly limit enforced atomically inside `create_public_analysis_session()` (advisory lock).
- Storage: private bucket `xcape-public-demo`, paths always derived server-side as `<session_id>/<view>.jpg`. Upload tokens are insert-only and path-scoped.
- Verification is server-authoritative (`public-analysis-verify-view`): magic-byte sniff → pure-JS decode (jpeg-js / upng-js — ImageScript's WASM breaks in the edge runtime) → EXIF orientation applied → re-encode to bare JPEG (strips EXIF/GPS) → min 480px → brightness/sharpness → exactly-one-face + pose via Lovable AI Gateway vision. Fail-closed: no face check, no verified view. Rejected images are deleted immediately and the view can be retried.
- Public capture is automatic; the manual shutter appears only after a 20s stall and still enforces every quality gate. No "skip lighting check" anywhere.
- Retention: images ≤24h, session ≤30 days, enforced by the hourly `public-analysis-cleanup` cron (returns non-2xx if bucket reconciliation fails).
