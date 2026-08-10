// Public webhook for n8n / Calendly → Supabase.
// POST any Calendly-shaped JSON; the function upserts a client, writes the
// appointment, and logs a lead journey event. No auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const digits = (v: unknown): string =>
  (typeof v === "string" ? v : "").replace(/\D+/g, "");

/** Pull the first matching value from a nested object by key list. */
function pick<T = unknown>(obj: any, paths: string[]): T | undefined {
  for (const p of paths) {
    const parts = p.split(".");
    let cur: any = obj;
    let ok = true;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in cur) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

/** Find a phone number inside Calendly questions_and_answers. */
function phoneFromQA(qa: any): string | undefined {
  if (!Array.isArray(qa)) return undefined;
  for (const item of qa) {
    const q = String(item?.question ?? "").toLowerCase();
    const a = String(item?.answer ?? "");
    if (!a) continue;
    if (/phone|mobile|whatsapp|tel/i.test(q)) return a;
  }
  return undefined;
}

/** Derive a "YYYY-MM-DD" / "HH:MM" pair from an ISO datetime string. */
function splitStartTime(iso: string | undefined) {
  if (!iso) return { date: null as string | null, time: null as string | null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16);
  return { date, time };
}

/** Constant-time string compare. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function computeHmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json({
      ok: true,
      service: "calendly-webhook",
      message: "POST a Calendly-style JSON payload here.",
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[calendly-webhook] missing SUPABASE_URL / SERVICE_ROLE");
    return json({ error: "Server misconfigured" }, 500);
  }

  // Read the raw body once so we can both verify the signature and parse it.
  const rawBody = await req.text();

  // Webhook authentication. We accept either:
  //   - an HMAC-SHA256 signature over the raw body in `x-webhook-signature`
  //     (preferred — used by Calendly's official signing scheme), OR
  //   - a shared secret in `x-webhook-secret` (legacy / n8n).
  // The function refuses the request if `CALENDLY_WEBHOOK_SECRET` is set and
  // neither check passes. If the secret env var is not configured the
  // function returns 500 so it can never silently accept anonymous calls.
  const WEBHOOK_SECRET = Deno.env.get("CALENDLY_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("[calendly-webhook] CALENDLY_WEBHOOK_SECRET not configured");
    return json({ error: "Server misconfigured" }, 500);
  }
  const providedSecret = req.headers.get("x-webhook-secret") ?? "";
  const providedSig = (req.headers.get("x-webhook-signature") ?? "").trim();
  let authorized = false;
  if (providedSecret && timingSafeEqual(providedSecret, WEBHOOK_SECRET)) {
    authorized = true;
  } else if (providedSig) {
    // Calendly sends e.g. "t=...,v1=<hex>" — pull out the v1 hex if present,
    // otherwise treat the entire header value as the hex signature.
    const v1Match = providedSig.match(/v1=([a-f0-9]+)/i);
    const sigHex = (v1Match ? v1Match[1] : providedSig).toLowerCase();
    const expected = await computeHmacHex(WEBHOOK_SECRET, rawBody);
    if (timingSafeEqual(sigHex, expected)) authorized = true;
  }
  if (!authorized) {
    return json({ error: "Invalid signature" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // (Do not log the full payload — it contains invitee PII.)
  console.log("[calendly-webhook] received event");

  // Event type — accept Calendly's real shape ("event") OR our flatter shape.
  const rawEvent =
    pick<string>(body, ["event", "event_type", "type"]) ?? "invitee.created";
  const eventType = String(rawEvent).toLowerCase();

  // Invitee details — try Calendly's nested payload first, then flat.
  const fullName = pick<string>(body, [
    "payload.invitee.name",
    "payload.name",
    "invitee.name",
    "name",
  ]);
  const email = pick<string>(body, [
    "payload.invitee.email",
    "payload.email",
    "invitee.email",
    "email",
  ]);
  const phoneRaw =
    pick<string>(body, [
      "payload.invitee.phone",
      "payload.phone",
      "invitee.phone",
      "phone",
    ]) ??
    phoneFromQA(pick(body, ["payload.invitee.questions_and_answers", "payload.questions_and_answers", "questions_and_answers"]));

  // Scheduled event details.
  const startTime = pick<string>(body, [
    "payload.scheduled_event.start_time",
    "payload.event.start_time",
    "scheduled_event.start_time",
    "event.start_time",
    "start_time",
  ]);
  const eventName =
    pick<string>(body, [
      "payload.scheduled_event.name",
      "payload.event_type.name",
      "scheduled_event.name",
      "event_type.name",
      "event_name",
    ]) ?? "Calendly Booking";
  const eventUri =
    pick<string>(body, [
      "payload.scheduled_event.uri",
      "payload.event.uri",
      "scheduled_event.uri",
      "event.uri",
      "event_uri",
    ]) ?? "";

  // Attribution (passed via /book/:slug → utm_content = staff_user_id).
  const utmContent = pick<string>(body, [
    "payload.tracking.utm_content",
    "tracking.utm_content",
    "utm_content",
  ]);
  const attributedStaffId = isUuid(utmContent) ? utmContent : null;

  if (!fullName && !email && !phoneRaw) {
    return json(
      { error: "Missing invitee identity (need at least name, email or phone)" },
      400,
    );
  }

  // ---------- 1. Find or create client ----------
  let clientId: string | null = null;

  if (email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.id) clientId = data.id;
  }

  if (!clientId && phoneRaw) {
    const phoneDigits = digits(phoneRaw);
    if (phoneDigits.length >= 7) {
      // Match by trailing 9 digits (handles +234 vs 0 prefix variants).
      const tail = phoneDigits.slice(-9);
      const { data } = await supabase
        .from("clients")
        .select("id, phone")
        .not("phone", "is", null)
        .limit(200);
      const hit = (data ?? []).find((c: any) => digits(c.phone).endsWith(tail));
      if (hit) clientId = hit.id;
    }
  }

  if (!clientId) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        full_name: fullName ?? email ?? phoneRaw ?? "Calendly Lead",
        email: email ?? null,
        phone: phoneRaw ?? null,
        source_type: "calendly",
        status: "lead",
        membership_type: "none",
        attributed_staff_id: attributedStaffId,
        last_contact_date: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      console.error("[calendly-webhook] client insert failed:", error);
      return json({ error: "Failed to create client" }, 500);
    }
    clientId = data.id;
    console.log("[calendly-webhook] created client:", clientId);
  } else {
    console.log("[calendly-webhook] matched existing client:", clientId);
  }

  // ---------- 2. Appointment write ----------
  const { date, time } = splitStartTime(startTime);
  let appointmentId: string | null = null;
  let journeyStatus = "calendly_event";

  if (eventType.includes("created") || eventType === "invitee.created") {
    if (!date || !time) {
      return json({ error: "Missing scheduled_event.start_time" }, 400);
    }
    const notes = eventUri ? `Calendly event: ${eventUri}` : "Booked via Calendly";
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        treatment: eventName,
        date,
        time,
        status: "scheduled",
        source: "calendly",
        attributed_staff_id: attributedStaffId,
        notes,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[calendly-webhook] appointment insert failed:", error);
      return json({ error: "Failed to create appointment" }, 500);
    }
    appointmentId = data.id;
    journeyStatus = "booked_via_calendly";
    console.log("[calendly-webhook] created appointment:", appointmentId);
  } else if (eventType.includes("cancel")) {
    if (eventUri) {
      const { data } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("client_id", clientId)
        .ilike("notes", `%${eventUri}%`)
        .select("id");
      appointmentId = data?.[0]?.id ?? null;
    }
    journeyStatus = "cancelled_via_calendly";
  } else if (eventType.includes("reschedul")) {
    if (eventUri && date && time) {
      const { data } = await supabase
        .from("appointments")
        .update({ date, time, status: "scheduled" })
        .eq("client_id", clientId)
        .ilike("notes", `%${eventUri}%`)
        .select("id");
      appointmentId = data?.[0]?.id ?? null;
    }
    journeyStatus = "rescheduled_via_calendly";
  }

  // ---------- 3. Lead journey event ----------
  const { error: journeyError } = await supabase
    .from("lead_journey_events")
    .insert({
      client_id: clientId,
      status: journeyStatus,
      note: `${eventName}${startTime ? ` @ ${startTime}` : ""}`,
      by_staff_id: attributedStaffId,
    });
  if (journeyError) {
    console.warn("[calendly-webhook] journey insert failed:", journeyError.message);
  }

  return json({
    ok: true,
    event_type: eventType,
    client_id: clientId,
    appointment_id: appointmentId,
    attributed_staff_id: attributedStaffId,
  });
});