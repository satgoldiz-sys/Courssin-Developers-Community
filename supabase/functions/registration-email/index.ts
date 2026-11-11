import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Server email configuration missing" }, { status: 500 });
  }
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const { membership_id } = await req.json();
    if (!membership_id) return Response.json({ error: "membership_id required" }, { status: 400 });

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership, error } = await admin
      .from("memberships")
      .select("id,user_id,category,batches(name,whatsapp_invite_url),profiles(full_name,email)")
      .eq("id", membership_id)
      .eq("user_id", user.id)
      .single();
    if (error || !membership) return Response.json({ error: "Membership not found" }, { status: 404 });

    const name = membership.profiles?.full_name || "Member";
    const email = membership.profiles?.email || user.email;
    const batch = membership.batches?.name || "Your Batch";
    const wa = membership.batches?.whatsapp_invite_url || "#";
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#202124">
        <h2>Welcome to Community of Courssin Developers!</h2>
        <p>Hello ${name},</p>
        <p>Congratulations! Your registration into the Community of Courssin Developers has been successfully received.</p>
        <p><strong>Batch:</strong> ${batch}<br><strong>Membership Category:</strong> ${membership.category}<br><strong>Registration Status:</strong> Successful</p>
        <p><a href="${wa}" style="display:inline-block;background:#050505;color:#fff;padding:12px 18px;border-radius:4px;text-decoration:none">Join your batch WhatsApp group</a></p>
        <p>BUILD. LEARN. INNOVATE. GROW.<br>Community of Courssin Developers (CCD)</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "CCD <onboarding@resend.dev>", to: [email], subject: "Welcome to Community of Courssin Developers!", html })
    });
    const body = await res.json();
    if (!res.ok) return Response.json({ error: body }, { status: 500 });
    await admin.from("memberships").update({ whatsapp_sent: true }).eq("id", membership_id);
    return Response.json({ ok: true, id: body.id });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
});
