import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_appointments",
  title: "List appointments",
  description:
    "List appointments in a date range. Defaults to the next 7 days from now. Respects row-level security for the signed-in staff user.",
  inputSchema: {
    from: z.string().datetime().optional().describe("ISO datetime lower bound. Defaults to now."),
    to: z.string().datetime().optional().describe("ISO datetime upper bound. Defaults to now + 7 days."),
    client_id: z.string().uuid().optional().describe("Only appointments for this client."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, client_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const fromIso = from ?? new Date().toISOString();
    const toIso = to ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    let q = sb
      .from("appointments")
      .select("id, client_id, service_id, scheduled_at, status, notes")
      .gte("scheduled_at", fromIso)
      .lte("scheduled_at", toIso)
      .order("scheduled_at", { ascending: true })
      .limit(limit ?? 50);
    if (client_id) q = q.eq("client_id", client_id);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { from: fromIso, to: toIso, appointments: data ?? [] },
    };
  },
});