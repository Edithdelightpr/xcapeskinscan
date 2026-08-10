import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description:
    "List clients visible to the signed-in staff user. Supports a text search across full name, phone, and email, and a status filter. Results respect the app's row-level security.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Case-insensitive substring match on name, phone, or email."),
    status: z.string().trim().min(1).optional().describe("Optional client status filter (e.g. `active`)."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return. Default 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("clients")
      .select("id, full_name, phone, email, status, source_type, created_at")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    if (search) {
      const s = search.replace(/[,%()]/g, " ");
      q = q.or(
        `full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`,
      );
    }
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { clients: data ?? [] },
    };
  },
});