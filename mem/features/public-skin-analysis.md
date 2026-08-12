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

## P2.1 production boundaries (implemented)

- All session-state writes go through service-role-only SECURITY DEFINER RPCs
  (`public_analysis_issue_view`, `_resolve_view`, `_commit_view`, `_status`)
  that lock the row `FOR UPDATE`. Edge Functions must never read–merge–replace
  session JSON in JavaScript again.
- Attempt ceilings are enforced in the database: 4 per view, 10 per session;
  exhaustion returns 429 with a structured code.
- Decode guard: header dimensions are parsed before allocating any surface;
  above `MAX_DECODE_PIXELS` (20M) the image is rejected. Face size must fall
  inside `MIN_FACE_FRACTION`..`MAX_FACE_FRACTION`.
- Client error semantics: ONLY 401/410 clear the stored token. 422 = capture
  guidance, 429 = limit guidance, network/5xx/storage = recoverable retry.
- `/skin-analysis` resumes from `public-analysis-status` (strictly whitelisted
  response: status, phase, verified_views, capture_method, expires_at) and the
  page owns the shared `verifiedViews`, so camera↔upload switches and reloads
  keep progress. `useGuidedCapture({ skipViews })` never re-asks a final view.
