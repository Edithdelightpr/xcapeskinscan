# Team Role Activation — Tab Fix + Signup Auto-Provisioning

## Background (verified)

- All 7 `/xcape/*` routes are gated by `XcapeSectionGate` with explicit section keys (`src/App.tsx:147-153`).
- The seeded **Team** job role exists in `job_roles` with explicit sections, but **omits `xcape-history`** (decision: add History, keep Protocols excluded).
- `staff_assignments` is empty and no user holds the `team` app_role — the role is configured but assigned to nobody.
- `handle_new_user` already creates a `staff_users` row (`status: 'inactive'`) on every signup; only the bootstrap email gets an auto role.
- Join intent (`?role=`) persists in sessionStorage as `xcape:join_role`, but `XCAPE_ROLES` only knows `affiliate | cdp | ambassador` — `?role=team` is currently rejected.

## Changes

### 1. Add Analysis History to the Team job role (data update)
- Update the live `job_roles` row for Team: append `xcape-history` to `permissions->'sections'`. Team ends with: dashboard, today, EOD, leads, attribution, calendar, and 6 xcape tabs (analysis, clients, reports, events, history, account). Protocols stays excluded.

### 2. Support `team` as a join intent
- Add a `team` entry ("Field Team") to `XCAPE_ROLES` in `src/lib/xcapeMarketing.ts` so `?role=team` validates and persists. No landing-card changes.

### 3. Claim-intent RPC (migration)
- New SECURITY DEFINER function `public.claim_team_intent()`:
  - Acts only on `auth.uid()`; refuses admins/existing role-holders.
  - Sets the caller's `staff_users.status` to `'invited'` (pending) and upserts a `staff_assignments` row pointing at the Team job role (idempotent).
  - Per project convention: `SET search_path = public` + `REVOKE EXECUTE` from public/anon, grant to `authenticated`.
- Called once from `Auth.tsx` after successful signup/login when persisted join role is `team`, then the intent is cleared. Works for email and Google sign-in without touching `handle_new_user`.

### 4. Approve-team-member RPC (migration)
- New SECURITY DEFINER function `public.approve_team_member(_staff_id uuid)`, callable by admins only:
  - Sets `staff_users.status = 'active'`, ensures the Team `staff_assignments` row exists, and inserts the `team` row into `user_roles` (required for RLS on attributed clients/media).
  - Same `SET search_path` + `REVOKE EXECUTE` hardening.

### 5. Pending-approval experience
- `AuthGuard`/`XcapeShell`: a signed-in user whose staff status is `invited` sees a "Team access pending approval" state instead of the workspace (no tab access until activated).

### 6. Admin approval UX
- In `AdminTeam` (Team & Access): surface staff with status `invited` + a pending Team assignment, with an "Approve as Team" button calling `approve_team_member`.

## Acceptance tests
- Unit: persisted `?role=team` intent validates, survives the auth round trip, and triggers the claim RPC; cleared afterward.
- Unit: pending-state screen renders for `invited` staff; workspace routes stay gated.
- DB: Team job role sections include `xcape-history` and exclude `xcape-protocols`; both new functions have `search_path` set and EXECUTE revoked; claim then approve produces active staff + `team` user_role + Team assignment.
- Full suite green (132 tests), typecheck, production build.

## Out of scope
- Landing page role cards, affiliate/CDP/ambassador provisioning, any change to `handle_new_user`, admin/practitioner permission models, RSVP system.
