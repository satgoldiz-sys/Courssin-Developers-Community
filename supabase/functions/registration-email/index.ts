import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization") || "";
  const { membership_id } = await req.json().catch(() => ({}));
  if (!membership_id) return Response.json({ error: "membership_id required" }, { status: 400 });

  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch the membership + batch (with WhatsApp invite URL stored server-side)
  const { data: membership, error: memErr } = await admin
    .from("memberships")
    .select("id,user_id,batch_id,category,status,batches(name,whatsapp_invite_url),profiles(full_name,email)")
    .eq("id", membership_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memErr || !membership) return Response.json({ error: "Membership not found" }, { status: 404 });

  const name = membership.profiles?.full_name || "Member";
  const email = membership.profiles?.email || user.email;
  const batch = membership.batches?.name || "Your Batch";
  const wa = membership.batches?.whatsapp_invite_url || null;

  // 2. Create a notification record for the user (always)
  const { error: notifErr } = await admin.from("notifications").insert({
    user_id: user.id,
    type: "registration",
    title: "Registration received",
    body: `Your membership registration for batch "${batch}" has been received and is awaiting review.`
  });

  // 3. Create an admin notification (all admins)
  const { data: admins } = await admin.from("profiles").select("id").in("role", ["super_admin", "administrator"]);
  if (admins && admins.length) {
    await admin.from("notifications").insert(
      admins.map(a => ({
        user_id: a.id,
        type: "new_registration",
        title: "New batch registration",
        body: `${name} registered for batch "${batch}" (category: ${membership.category}).`
      }))
    );
  }

  // 4. If approved, send WhatsApp invite + notify user
  if (membership.status === "approved" || membership.status === "active" || membership.status === "verified") {
    if (wa) {
      const { error: waErr } = await admin.from("notifications").insert({
        user_id: user.id,
        type: "whatsapp",
        title: "Your batch WhatsApp group",
        body: `Join your batch WhatsApp group: ${wa}`
      });
      await admin.from("memberships").update({ whatsapp_sent: true }).eq("id", membership_id);
    }
    await admin.from("notifications").insert({
      user_id: user.id,
      type: "approval",
      title: "Registration approved",
      body: `Your registration for batch "${batch}" has been approved. Welcome to CCD!`
    });
  }

  return Response.json({ ok: true, status: membership.status, whatsapp_invite_url: wa, notification_error: notifErr?.message || null });
});