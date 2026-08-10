import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listClientsTool from "./tools/list-clients";
import getClientTool from "./tools/get-client";
import listAppointmentsTool from "./tools/list-appointments";
import listVisitsTool from "./tools/list-visits";

// Construct the OAuth issuer from the Supabase project ref directly — never
// from SUPABASE_URL, which may be the .lovable.cloud proxy on managed Cloud.
// Vite inlines VITE_SUPABASE_PROJECT_ID as a literal at build time, so this
// stays import-safe (no runtime env read at module top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tropics-medspa-mcp",
  title: "Tropics MedSpa",
  version: "0.1.0",
  instructions:
    "Tools for Tropics MedSpa staff. All calls run as the signed-in staff user and respect the app's row-level security. Use `whoami` to verify the connection, `list_clients` to browse clients, `get_client` for one client, `list_appointments` for scheduling, and `list_visits` for visit history.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listClientsTool, getClientTool, listAppointmentsTool, listVisitsTool],
});