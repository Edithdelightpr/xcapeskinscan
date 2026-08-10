import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in staff user's id, email, and staff role (if any).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const { data: staff } = await sb
      .from("staff_users")
      .select("id, full_name, email, role, active")
      .eq("id", ctx.getUserId())
      .maybeSingle();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { user_id: ctx.getUserId(), email: ctx.getUserEmail(), staff: staff ?? null },
            null,
            2,
          ),
        },
      ],
      structuredContent: { user_id: ctx.getUserId(), email: ctx.getUserEmail(), staff },
    };
  },
});