import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization") || "";
  const { batch_id } = await req.json().catch(() => ({}));
  if (!batch_id) return Response.json({ error: "batch_id required" }, { status: 400 });
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createClient(url, service);
  // Only return invite if user has membership in this batch
  const { data: mem } = await admin.from("memberships").select("id").eq("batch_id", batch_id).eq("user_id", user.id).maybeSingle();
  if (!mem) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { data: batch } = await admin.from("batches").select("whatsapp_invite_url").eq("id", batch_id).single();
  return Response.json({ whatsapp_invite_url: batch?.whatsapp_invite_url || null });
});
