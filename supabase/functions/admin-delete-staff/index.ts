// Admin-only edge function: permanently deletes a staff member by removing
// the underlying auth.users row. FK ON DELETE CASCADE handles staff_users,
// user_roles, staff_assignments, routine_instances, eod_reports, etc.
// Records that reference staff with ON DELETE SET NULL (clients.attributed_staff_id,
// deliverables.owner_staff_id, finance_entries.source_client_id, etc.) are nulled.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1. Verify caller is admin (using their JWT)
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: callerRoles } = await callerClient
      .from('user_roles').select('role').eq('user_id', caller.id);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Validate body
    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.user_id || typeof body.user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Self-delete guard
    if (body.user_id === caller.id) {
      return new Response(
        JSON.stringify({ error: "You can't delete your own account." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Last-admin guard (friendlier than letting the DB trigger fire)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: targetRoles } = await admin
      .from('user_roles').select('role').eq('user_id', body.user_id);
    const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === 'admin');
    if (targetIsAdmin) {
      const { count: adminCount } = await admin
        .from('user_roles')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if ((adminCount ?? 0) <= 1) {
        return new Response(
          JSON.stringify({
            error: 'Cannot delete the last administrator. Promote another user to admin first.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // 5. Delete the auth user — FK cascades clean up the rest.
    const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
    if (delErr) {
      return new Response(
        JSON.stringify({ error: `Delete failed: ${delErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});