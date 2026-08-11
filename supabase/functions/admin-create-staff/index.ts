// Admin-only edge function: creates a staff member (auth user, profile, roles)
// in one atomic call. Caller must be authenticated AND hold the 'admin' app_role.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APP_ROLES = ['admin', 'front_desk', 'medical_aesthetician', 'cleaner', 'outreach', 'team'] as const;
type AppRole = typeof APP_ROLES[number];

interface Body {
  full_name: string;
  email: string;
  phone?: string | null;
  password?: string;          // optional — when omitted we generate one and return it
  send_invite?: boolean;      // when true, send a magic-link invite instead of password
  roles: AppRole[];
  status?: 'active' | 'inactive';
}

function generatePassword(): string {
  // 16 chars, mixed — easy to copy, hard to guess
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let out = '';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 16; i++) out += charset[bytes[i] % charset.length];
  return out;
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

    // 1. Verify caller is admin (use anon client + caller's JWT)
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
    const body = (await req.json()) as Body;
    const errors: Record<string, string> = {};
    if (!body.full_name?.trim()) errors.full_name = 'Required';
    if (!body.email?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) errors.email = 'Valid email required';
    if (!Array.isArray(body.roles) || body.roles.length === 0) errors.roles = 'Pick at least one role';
    if (body.roles?.some((r) => !APP_ROLES.includes(r))) errors.roles = 'Invalid role';
    if (Object.keys(errors).length > 0) {
      return new Response(JSON.stringify({ error: 'Validation failed', fields: errors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Create auth user with service role
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const sendInvite = !!body.send_invite;
    const password = sendInvite ? undefined : (body.password?.trim() || generatePassword());

    let newUserId: string | null = null;
    let inviteAction: 'invited' | 'created' = 'created';

    if (sendInvite) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email.trim(), {
        data: { full_name: body.full_name.trim() },
      });
      if (error) throw new Error(`Invite failed: ${error.message}`);
      newUserId = data.user?.id ?? null;
      inviteAction = 'invited';
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email.trim(),
        password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name.trim() },
      });
      if (error) throw new Error(`Create user failed: ${error.message}`);
      newUserId = data.user?.id ?? null;
    }

    if (!newUserId) throw new Error('Auth provisioning returned no user id');

    // 4. handle_new_user trigger has already inserted into staff_users.
    //    Patch phone + desired status (default 'active' since admin is creating).
    const desiredStatus = body.status ?? (sendInvite ? 'invited' : 'active');
    await admin.from('staff_users').update({
      full_name: body.full_name.trim(),
      phone: body.phone?.trim() || null,
      status: desiredStatus,
    }).eq('id', newUserId);

    // 5. Grant roles (dedupe — bootstrap email may already have admin)
    const roleRows = body.roles.map((role) => ({ user_id: newUserId!, role }));
    if (roleRows.length > 0) {
      const { error: rolesErr } = await admin
        .from('user_roles').upsert(roleRows, { onConflict: 'user_id,role' });
      if (rolesErr) throw new Error(`Role assignment failed: ${rolesErr.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: newUserId,
        action: inviteAction,
        // Only return password when admin chose direct-create (so they can copy it)
        temp_password: sendInvite ? null : password,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});