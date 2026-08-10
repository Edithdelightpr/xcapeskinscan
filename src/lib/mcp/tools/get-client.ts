import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_client",
  title: "Get client",
  description: "Fetch a single client by id, with recent visits and upcoming appointments.",
  inputSchema: {
    client_id: z.string().uuid().describe("The client's UUID (from list_clients)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const [clientRes, visitsRes, apptsRes] = await Promise.all([
      sb.from("clients").select("*").eq("id", client_id).maybeSingle(),
      sb
        .from("client_visit_logs")
        .select("id, visited_at, status, notes")
        .eq("client_id", client_id)
        .order("visited_at", { ascending: false })
        .limit(10),
      sb
        .from("appointments")
        .select("id, scheduled_at, status, service_id, notes")
        .eq("client_id", client_id)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(10),
    ]);
    if (clientRes.error) return errorResult(clientRes.error.message);
    if (!clientRes.data) return errorResult("Client not found or not visible to this user.");
    const payload = {
      client: clientRes.data,
      recent_visits: visitsRes.data ?? [],
      upcoming_appointments: apptsRes.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});