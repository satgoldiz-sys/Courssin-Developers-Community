import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization") || "";
  const { action, table, record_id, payload } = await req.json().catch(() => ({}));

  if (!action || !table) return Response.json({ error: "action and table are required" }, { status: 400 });

  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify caller is admin
  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const callerRole = caller?.role;
  if (!["super_admin", "administrator"].includes(callerRole)) {
    return Response.json({ error: "Forbidden: admin role required" }, { status: 403 });
  }

  const allowedTables = ["batches", "teams", "tasks", "projects", "rewards", "tech_cohorts", "announcements", "batch_settings", "memberships"];
  if (!allowedTables.includes(table)) {
    return Response.json({ error: "Table not allowed" }, { status: 400 });
  }

  let result;
  switch (action) {
    case "insert":
      result = await admin.from(table).insert(payload).select().single();
      break;
    case "update":
      if (!record_id) return Response.json({ error: "record_id required for update" }, { status: 400 });
      result = await admin.from(table).update(payload).eq("id", record_id).select().single();
      break;
    case "delete":
      if (!record_id) return Response.json({ error: "record_id required for delete" }, { status: 400 });
      result = await admin.from(table).delete().eq("id", record_id).select().single();
      break;
    case "select":
      result = await admin.from(table).select("*").eq("id", record_id).maybeSingle();
      break;
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, data: result.data });
});