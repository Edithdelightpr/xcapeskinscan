import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_visits",
  title: "List visits",
  description:
    "List client visit logs for a given client, most recent first. Respects row-level security.",
  inputSchema: {
    client_id: z.string().uuid().describe("The client whose visits to list."),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("client_visit_logs")
      .select("id, visited_at, status, notes, created_at")
      .eq("client_id", client_id)
      .order("visited_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return errorResult(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { visits: data ?? [] },
    };
  },
});