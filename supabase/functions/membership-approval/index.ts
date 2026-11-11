import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization") || "";
  const { membership_id, action } = await req.json().catch(() => ({}));
  if (!membership_id || !["approve", "reject"].includes(action)) {
    return Response.json({ error: "membership_id and action (approve|reject) required" }, { status: 400 });
  }

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

  // Fetch membership
  const { data: membership, error: memErr } = await admin
    .from("memberships")
    .select("id,user_id,batch_id,category,status,batches(name,whatsapp_invite_url),profiles(full_name,email)")
    .eq("id", membership_id)
    .maybeSingle();
  if (memErr || !membership) return Response.json({ error: "Membership not found" }, { status: 404 });

  const newStatus = action === "approve" ? "approved" : "rejected";
  const { error: updErr } = await admin.from("memberships").update({
    status: newStatus,
    approved_by: user.id,
    approved_at: new Date().toISOString()
  }).eq("id", membership_id);
  if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

  const batch = membership.batches?.name || "Your Batch";
  const wa = membership.batches?.whatsapp_invite_url || null;
  const name = membership.profiles?.full_name || "Member";
  const memberUserId = membership.user_id;

  // Notify the member
  if (action === "approve") {
    await admin.from("notifications").insert({
      user_id: memberUserId,
      type: "approval",
      title: "Registration approved",
      body: `Your registration for batch "${batch}" has been approved. Welcome to CCD!`
    });
    if (wa) {
      await admin.from("notifications").insert({
        user_id: memberUserId,
        type: "whatsapp",
        title: "Your batch WhatsApp group",
        body: `Join your batch WhatsApp group: ${wa}`
      });
      await admin.from("memberships").update({ whatsapp_sent: true }).eq("id", membership_id);
    }
  } else {
    await admin.from("notifications").insert({
      user_id: memberUserId,
      type: "rejection",
      title: "Registration update",
      body: `Your registration for batch "${batch}" was not approved. Contact the CCD team for more information.`
    });
  }

  // Notify all admins
  const { data: admins } = await admin.from("profiles").select("id").in("role", ["super_admin", "administrator"]);
  if (admins && admins.length) {
    await admin.from("notifications").insert(
      admins.map(a => ({
        user_id: a.id,
        type: "registration_update",
        title: `Registration ${action === "approve" ? "approved" : "rejected"}`,
        body: `${name}'s registration for batch "${batch}" was ${action === "approve" ? "approved" : "rejected"} by ${user.email}.`
      }))
    );
  }

  return Response.json({ ok: true, status: newStatus, whatsapp_invite_url: wa });
});