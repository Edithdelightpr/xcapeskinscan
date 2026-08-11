# XCAPE Wednesday Target — Read-Only Audit & Phased Plan

Target: "Adapt the remix to an XCAPE-themed layout with authentication and role-based routing by Wednesday. Configure the Team role to access skin-analysis lead capture, lead attribution, and event RSVP widgets on client reports, starting immediately by wiring up login authentication and tab routing permissions."

---

## 1. Verified current-state inventory

### 1.1 Authentication — EXISTS, solid
- Email/password + Google OAuth (`src/hooks/useAuth.tsx:82-97`, `src/pages/Auth.tsx:100-114` via `lovable.auth.signInWithOAuth`).
- Single form with `signin | signup | forgot` modes; `check-staff-email` edge function gates all three (`Auth.tsx:44-52`) — sign-in requires a pre-provisioned `staff_users` row.
- Session: `onAuthStateChange` subscribed before `getSession()`; profile load deferred to avoid deadlock (`useAuth.tsx:56-80`). Roles fetched fresh from `user_roles` every load — no localStorage/user_metadata trust.
- Post-login redirect: validated same-origin `?next=` param, default `/xcape` (`Auth.tsx:20-32`); `next` round-trips through Google OAuth (lines 106-107).
- Password reset: full loop — `resetPasswordForEmail` → `/reset-password` page → `PASSWORD_RECOVERY` listener → `updateUser` → `/xcape` (`ResetPassword.tsx`).
- **`?role=` from landing CTAs (`roleAuthHref` → `/auth?role=affiliate|cdp|ambassador`, `src/lib/xcapeMarketing.ts:66`) is never read by Auth.tsx.** Chosen path is silently dropped.

### 1.2 Authorization & roles — EXISTS with a hard enum boundary
- Role source of truth: `user_roles(user_id, role)` with DB enum `app_role = admin | front_desk | medical_aesthetician | cleaner | outreach`.
- RLS verified live: `user_roles` INSERT/UPDATE/DELETE all require `has_role(auth.uid(),'admin')`; SELECT is admin-or-self. Client-side grant/revoke (`useRealStaff.ts:51-68`) is safe at the DB layer. No user-editable metadata is trusted for authorization.
- Signup default verified: `handle_new_user` trigger sets self-signups to `staff_users.status='inactive'`, zero roles — `AuthGuard` parks them on "Awaiting Admin Approval". Only the bootstrap email auto-gets admin.
- Two-layer permission model:
  - `app_role` (enum) → AuthGuard entry, admin gates, most table RLS.
  - JobRole bundle (`job_roles.permissions` + `staff_assignments.tab_overrides`) → `/admin` sidebar tabs, enforced server-side by `has_section_access(uid, section)` (used by `calendar_events` RLS).
- Provisioning: `admin-create-staff` edge function re-verifies admin server-side; grant/revoke UI in `AdminStaffConfig.tsx`.
- **No `team`, `ambassador`, `affiliate`, or `cdp` anywhere** — they exist only as marketing copy in `xcapeMarketing.ts:25-60`.
- Key constraint: `clients` INSERT and `client_visit_assessments` SELECT policies hardcode the four clinical roles — a new `team` role cannot write clients or read assessments until those policies are extended.

### 1.3 Route map — EXISTS
- Public: `/` (XCAPE landing), `/medspa` (untouched Tropics funnel), `/auth`, `/reset-password`, `/report/:token`, booking/intake/checkout/outreach public flows, OAuth consent.
- Guarded (`AuthGuard`, requires ≥1 role + active status): `/outreach/portal`, `/admin`, `/admin/clients/:id`, `/admin/clients/:id/report-preview`, entire `/xcape/*` subtree.
- `/xcape/admin/*` additionally gated client-side by `XcapeAdminGate` (isAdmin).
- **XCAPE shell nav is hardcoded**: `XcapeShell.tsx` renders `PRACTITIONER_NAV` for every signed-in role and `ADMIN_NAV` when `isAdmin` (lines 26-46, 95-100). `useEffectivePermissions`/JobRole sections drive only the legacy `/admin` console — `/xcape` has no per-role tab routing at all.

### 1.4 Skin-analysis lead capture — EXISTS (4 write paths)
- Wizard: `StepClientIntake.tsx:65-73` → `useCreateRealClient` sets `attributed_staff_id = current user`, `status='lead'` — but `source_type=null`, never sets `outreach_id`/`captured_via`, and ignores any referral/outreach context.
- Shared form: `ClientCaptureForm.tsx` (walk-in + outreach modes); outreach mode deliberately credits "the house", not the individual capturer (lines 181-186).
- Public intake: `public-submit-intake` edge function — resolves attribution from referral slug, stamps `outreach_id`/`captured_via`, first-touch sticky (never overwrites existing attribution), plus `intake_submissions` + `lead_journey_events` audit rows.
- Outreach QR intake: `OutreachIntake.tsx` → `capture_outreach_lead` RPC; `?staff=` param is optional and **server-unvalidated** (anyone can stamp attribution).
- IDs: wizard keeps `clientId`/`assessmentId` in state + sessionStorage (`xcape:analysis:wip`) — refresh-safe, not URL-carried.

### 1.5 Lead attribution — EXISTS, strong schema
- `clients`: `attributed_staff_id`, `acquisition_owner_id`, `consultation_owner_id`, `recurring_owner_id`, `outreach_id`, `captured_via`, `source_type`, `intake_source`, `referral_meta` (jsonb), `acquisition_locked`. No `created_by`/ambassador column.
- `attribution_events` (13 cols): `actor_staff_id` vs `owner_staff_id` split already models "captured by" vs "credited to"; 15 event kinds; RLS: admin read, outreach read, self read.
- `referral_visits` (write-only via `public-record-referral-visit`; never mutates ownership), `client_conversions`, `lead_journey_events`.
- Reporting UIs: `AdminLeads.tsx` (filters by source/outreach/attributed staff + CSV export) behind `admin-leads`; `AdminAttribution.tsx` etc. behind `admin-attribution` — two independently grantable section keys.

### 1.6 Events / RSVP — MISSING (no RSVP exists, real or mock)
- `calendar_events` + `calendar_event_recipients` = internal staff broadcast inbox only (admin → staff; `acknowledged_at` read-receipt, no accept/decline). `linked_client_id`/`linked_staff_id` columns exist but are never set or read. INSERT gated by `has_section_access(uid,'admin-calendar')`.
- Real bookings live in `appointments` (1:1 client slots, operational status enum) — wrong shape for multi-invitee RSVP.
- Client report (`PersonalReportView.tsx`) contains zero event/RSVP UI; identical tree for public and staff preview by design.

### 1.7 Theming readiness — PARTIAL
- Landing + `index.html` metadata + favicons: fully XCAPE.
- Authenticated surfaces still Tropics plum/glass: `XcapeShell.tsx` (`gradient-primary`, line 143), `Auth.tsx` (glass-strong, 117-118), `AuthGuard` fallback screens. Global `:root` tokens remain MedSpa purple by design; only `.xcape-public` overrides. XCAPE logo assets already bundled and used in shell/auth.
- Minor: `og:url`/JSON-LD URLs are relative (`index.html:16,27`).

### 1.8 Health
- 126/126 tests green; typecheck clean; production build passing.

---

## 2. Gap matrix (vs Wednesday target)

| Capability | State | Evidence |
|---|---|---|
| Login authentication | **Exists** | useAuth/AuthGuard/reset flow verified |
| Post-login routing to XCAPE workspace | **Exists** | `/xcape` default; `?next=` validated |
| `?role=` intent preserved from landing | **Missing** | Auth.tsx never reads `role` |
| "Team" role | **Missing** | Not in enum/type/UI/RLS |
| Role-based tab routing in XCAPE shell | **Missing** | XcapeShell nav hardcoded; `/xcape` not in SECTION_KEYS |
| Team → lead capture | **Partial** | Insert paths exist; blocked by role-hardcoded `clients` INSERT policy; wizard drops outreach/referral attribution |
| Team → lead attribution views | **Partial** | Schema + admin UIs exist; gated by `admin-leads`/`admin-attribution` sections; no Team-facing view in `/xcape` |
| Event RSVP | **Missing** | No response model anywhere; `calendar_events` is staff-internal |
| "RSVP widgets on client reports" | **Misplaced (recommend redirect)** | Report is a client-facing clinical/sales document with a shared public/staff tree — see §4 |
| XCAPE theme on authenticated shell | **Partial** | Logo done; purple glass remains |
| RLS safety of new role | **Must verify per-phase** | Role lists hardcoded in several policies |

---

## 3. Phased plan (prioritized for Wednesday)

### Phase 1 — Wednesday core: auth wiring + Team role + tab routing
1. **Add `team` to `app_role`** (migration): `ALTER TYPE public.app_role ADD VALUE 'team'`; extend the role lists in the `clients` INSERT, `client_visit_assessments` SELECT, and any other policy that hardcodes clinical roles (audit all `has_role(...)` policies in the same migration). All grants/policies in one migration.
2. **Client plumbing**: `AppRole` type + label in `useAuth.tsx`; add `team` to grant/revoke UIs (`AdminStaffConfig`, `AddStaffWizard`).
3. **Seed a "Team" JobRole** with sections: `admin-dashboard`, `staff-today`, `staff-eod`, `admin-leads`, `admin-attribution`, `admin-calendar` (existing keys; `has_section_access` works unchanged).
4. **XCAPE section keys + shell routing**: add `xcape-analysis`, `xcape-clients`, `xcape-reports`, `xcape-history`, `xcape-protocols`, `xcape-account` to `SECTION_KEYS`/`SECTION_LABELS`/`SECTION_GROUPS`; make `XcapeShell` nav items render from `useEffectivePermissions()`; add a route-level guard per `/xcape/*` child (deny → friendly "no access" screen). Default bundles keep current roles' behavior identical (reversible).
5. **Auth `?role=` wiring**: read + validate against known values; show role-aware copy on the form; persist intent to `sessionStorage`; display it on the "Awaiting Admin Approval" screen so admins assign the right role. No self-serve role granting.
6. **XCAPE theme pass (shell only)**: introduce `.xcape-app` token scope; apply to `XcapeShell`, `Auth`, `AuthGuard` screens. Do not touch global `:root` (MedSpa console unchanged) — reversible by removing the class.

### Phase 2 — Team workflows (starts immediately after Phase 1)
7. **Team lead capture**: wizard intake sets `captured_via`/`source_type` and preserves referral/outreach context (`useReferralSlug`) instead of hardcoding `source_type=null`; verify `clients` INSERT policy admits `team`.
8. **Team attribution view**: surface "My captured leads" + attribution scorecard inside `/xcape` for Team (reads already RLS-safe via `attributed_staff_id`/`attribution_events` self policies).
9. **Event RSVP (new, minimal)**: new `event_invitations` table (`event_id → calendar_events`, `client_id`, `token_hash`, `response_status`, `responded_at`) + GRANTs + RLS + Team-facing event/invite management inside `/xcape`, and a tokenized public response page. Reuse `appointments`' `notify-booking-created` pattern for invites/reminders.
10. Validate/fix the unvalidated `?staff=` attribution param on `OutreachIntake` (server-side allow-list).

### Phase 3 — Post-Wednesday hardening
11. Partner onboarding decision for affiliate/CDP (external users — not staff accounts).
12. Optional individual-capturer attribution split on `clients` (reuse `actor_staff_id`/`owner_staff_id` model).
13. Absolute `og:url`/canonical metadata.

---

## 4. Recommendation on "RSVP widgets on client reports"

Do not embed RSVP in the clinical report. `PersonalReportView.tsx` is a client-facing document rendered identically for public token links and staff preview — an invitation widget there would mix staff workflow into a conversion-focused, shareable document. Smallest clearer workflow honoring the intent: Team manages events and invitations from a staff-side `/xcape/events` surface; clients respond on a dedicated public invitation link (same token pattern as report links). If visibility on reports is later desired, append one slim, non-clinical "You're invited" card only — after Phase 2 RSVP exists.

## 5. Acceptance tests

**Phase 1**: (a) new enum value + policy migration applies; `team` user can INSERT client and SELECT own assessments; non-team denied unchanged. (b) `team` grant/revoke works from Access Management; RLS blocks non-admin grant (existing policies). (c) Team member sees only granted tabs in `/xcape`; direct URL to a denied tab shows the no-access screen; admin/practitioner nav unchanged. (d) `/auth?role=ambassador` shows role-aware copy; intent survives OAuth round-trip and shows on the approval-pending screen. (e) `/` and `/medspa` render unchanged; shell renders XCAPE theme; reduced-motion + mobile widths checked. (f) All existing tests green + new tests for nav gating and `roleAuthHref` consumption; typecheck + build pass.

**Phase 2**: (g) Team-captured lead carries `captured_via` + sticky attribution; wizard no longer nulls source. (h) Team attribution view lists only own leads (RLS-verified). (i) Invite → public link → accept/decline persists; expired/revoked token rejected; reminders fire. (j) `?staff=` forgery rejected server-side.

## 6. Explicitly out of scope
- Rebuilding the analysis engine, report renderer, catalogue, cart, checkout.
- Rebranding or restructuring the legacy `/admin` MedSpa console and `/medspa` marketing pages.
- Self-serve role granting; affiliate/CDP backend onboarding (Phase 3 decision).
- Embedding RSVP widgets inside the client report document.
- Mobile app packaging; camera changes; payments.
- Copying any operational data from the original project.

## 7. Top regression/security risks
- Extending `app_role` requires touching every policy that enumerates roles — a missed policy silently locks Team out (mitigate: audit all `has_role` policies in the Phase 1 migration).
- XCAPE nav permission wiring must keep current roles' defaults byte-identical or practitioners lose tabs on deploy day.
- `?staff=` attribution forgery on `OutreachIntake` (open today, pre-existing).
- `has_section_access` is SECURITY DEFINER — new section keys are data-only, but JobRole edits by admins instantly change access (expected; note in admin UI copy).
