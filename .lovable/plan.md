# Team Role Activation — 3 Launch Tabs + Signup Auto-Provisioning

## Background (verified)

- All 7 `/xcape/*` routes are gated by `XcapeSectionGate` with explicit section keys (`src/App.tsx:147-153`).
- The seeded **Team** job role exists in `job_roles` but carries MedSpa leftovers (`staff-today`, `staff-eod`, `admin-calendar`) and omits `xcape-history`.
- `staff_assignments` is empty and no user holds the `team` app_role — the role is configured but assigned to nobody.
- `handle_new_user` already creates a `staff_users` row (`status: 'inactive'`) on every signup; only the bootstrap email gets an auto role.
- Join intent (`?role=`) persists in sessionStorage as `xcape:join_role`, but `XCAPE_ROLES` only knows `affiliate | cdp | ambassador` — `?role=team` is currently rejected.

## Team's 3 launch tabs (Cameroon field launch)

| Tab | Purpose | Section keys |
|---|---|---|
| **Skin Scanner** | Run live skin analyses and generate reports on the spot | `xcape-analysis`, `xcape-reports`, `xcape-history` |
| **Leads & CDPs** | Capture client profiles and track lead attribution back to the team member | `xcape-clients`, `admin-leads`, `admin-attribution` |
| **Events & RSVP** | Manage client RSVPs for the CDP launch campaign | `xcape-events` |

Plus `xcape-account` as a utility destination. Removed from Team: `admin-dashboard`, `staff-today`, `staff-eod`, `admin-calendar` (MedSpa dailies). `xcape-protocols` stays excluded.

## Changes

### 1. Re-scope the Team job role (data update)
- Update the live `job_roles` row for Team: set `permissions->'sections'` to exactly the 8 keys above. Post-login landing is already `/xcape/analysis` (Skin Scanner).

### 2. Group the XCAPE shell navigation under the 3 launch tabs
- Add a shared nav-group mapping (section key → Skin Scanner / Leads & CDPs / Events & RSVP) and render the `XcapeShell` sidebar grouped under these three headings, with Account at the bottom. Leads and Attribution reuse the existing pages/routes — surfaced inside the XCAPE shell for Team instead of the MedSpa admin area.

### 3. Support `team` as a join intent
- Add a `team` entry ("Field Team") to `XCAPE_ROLES` in `src/lib/xcapeMarketing.ts` so `?role=team` validates and persists. No landing-card changes.

### 4. Claim-intent RPC (migration)
- New SECURITY DEFINER function `public.claim_team_intent()`:
  - Acts only on `auth.uid()`; refuses admins/existing role-holders.
  - Sets the caller's `staff_users.status` to `'invited'` (pending) and upserts a `staff_assignments` row pointing at the Team job role (idempotent).
  - `SET search_path = public` + `REVOKE EXECUTE` from public/anon, grant to `authenticated`.
- Called once from `Auth.tsx` after successful signup/login when persisted join role is `team`, then the intent is cleared. Works for email and Google sign-in without touching `handle_new_user`.

### 5. Approve-team-member RPC (migration)
- New SECURITY DEFINER function `public.approve_team_member(_staff_id uuid)`, callable by admins only:
  - Sets `staff_users.status = 'active'`, ensures the Team `staff_assignments` row exists, and inserts the `team` row into `user_roles` (required for RLS on attributed clients/media).
  - Same `SET search_path` + `REVOKE EXECUTE` hardening.

### 6. Pending-approval experience
- `AuthGuard`/`XcapeShell`: a signed-in user whose staff status is `invited` sees a "Team access pending approval" state instead of the workspace (no tab access until activated).

### 7. Admin approval UX
- In `AdminTeam` (Team & Access): surface staff with status `invited` + a pending Team assignment, with an "Approve as Team" button calling `approve_team_member`.

## Acceptance tests
- Unit: persisted `?role=team` intent validates, survives the auth round trip, triggers the claim RPC, and is cleared afterward.
- Unit: sidebar renders the 3 grouped tabs (Skin Scanner / Leads & CDPs / Events & RSVP) for a Team-permission set; pending-state screen renders for `invited` staff.
- DB: Team job role sections match the 8-key list exactly; both new functions have `search_path` set and EXECUTE revoked; claim → approve produces active staff + `team` user_role + Team assignment; approved Team member can read only their attributed clients.
- Full suite green (132 tests), typecheck, production build.

## Out of scope
- Landing page role cards, affiliate/CDP/ambassador provisioning, any change to `handle_new_user`, admin/practitioner permission models, the RSVP data model itself.
