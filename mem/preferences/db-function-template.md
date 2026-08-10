---
name: SECURITY DEFINER function template
description: Pin search_path on new SQL functions; do NOT revoke EXECUTE from authenticated on RLS/trigger helpers
type: preference
---
Every new public.* function MUST set `search_path = public` to fix linter 0011.

```sql
CREATE OR REPLACE FUNCTION public.fn_name(...)
RETURNS ...
LANGUAGE sql -- or plpgsql
STABLE
SECURITY DEFINER
SET search_path = public   -- ALWAYS set
AS $$ ... $$;
```

## EXECUTE permissions — read carefully

**RLS policy bodies do NOT bypass GRANTs.** Postgres still checks that the calling
role has EXECUTE on any function referenced in a policy or in a trigger fired by
a user action. Revoking EXECUTE from `authenticated` on such helpers breaks
EVERY query against tables whose policies use them — symptom: HTTP 403 with
`permission denied for function <name>` (code 42501). This already happened once
on this project to `has_role`, `is_admin`, `is_task_owner`, `is_task_collaborator`
and the trigger functions, locking the admin out and silently breaking buttons.

### Decision matrix

| Function called from… | Must keep EXECUTE for `authenticated`? |
|---|---|
| RLS policy USING/WITH CHECK | YES (also `anon` if anon policies use it) |
| Trigger on a user-writable table | YES |
| `supabase.rpc()` from browser as signed-in user | YES |
| `supabase.rpc()` from public page | YES for `anon` |
| Only other SECURITY DEFINER functions | Safe to revoke |
| Only edge functions / service role | Safe to revoke |
| Supabase Auth trigger (`handle_new_user`) | Safe to revoke (runs as `supabase_auth_admin`) |

### Linter warnings 0028 / 0029 are acceptable

Warnings 0028 (anon executable) and 0029 (authenticated executable) are
**informational** for helpers that intentionally need to be callable so RLS can
work. Mark them as by-design rather than "fixing" them by revoking EXECUTE.
The functions are still safe because they only return booleans / read auth-keyed
rows and have `SET search_path = public`.

### When in doubt

Default to `GRANT EXECUTE ... TO authenticated`. Only revoke after confirming
the function is never reached via the invoker code path.
