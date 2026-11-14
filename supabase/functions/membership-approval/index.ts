import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Keep this function self-contained so it can be pasted into the Supabase Dashboard editor.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_SENDER_EMAIL = Deno.env.get("RESEND_SENDER_EMAIL") || "";
const RESEND_SENDER_NAME = Deno.env.get("RESEND_SENDER_NAME") || "Community of Courssin Developers";
const COMMUNITY_INVITE_URL = "https://chat.whatsapp.com/HLFmAATDowQKFLjhamkoh2";
function communityInvite(fallback?: string | null): string | null {
  const candidate = COMMUNITY_INVITE_URL.trim() || (fallback || "").trim();
  try { const url = new URL(candidate); return url.protocol === "https:" && (url.hostname === "wa.me" || url.hostname.endsWith(".whatsapp.com") || url.hostname === "whatsapp.com") ? url.href : null; } catch { return null; }
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") || "";
  const allowed = origin === "https://ccd-gilt.vercel.app";
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function options(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

async function readJson(req: Request, maxBytes = 256_000): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) return null;
  const length = Number(req.headers.get("content-length") || "0");
  if (length > maxBytes) return null;
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getUser(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const match = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(match[1]);
  return error ? null : data.user;
}

function getUserClient(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Server credentials are not configured");
  const match = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Authentication required");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server credentials are not configured");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

async function sendEmail(to: string, name: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY || !RESEND_SENDER_EMAIL || !to) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`, to: [name ? `${name} <${to}>` : to], subject, html }),
  });
  if (!response.ok) console.error("Resend membership email failed", response.status, await response.text());
  return response.ok;
}

async function isAdmin(userId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data, error } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return !error && ["super_admin", "administrator"].includes(data?.role);
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options(req);
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
  const body = await readJson(req, 4096);
  const membershipId = body?.membership_id;
  const action = body?.action;
  if (!body || !isUuid(membershipId) || !["approve", "reject"].includes(String(action))) {
    return respond(req, { error: "A valid membership_id and action are required" }, 400);
  }
  const user = await getUser(req);
  if (!user) return respond(req, { error: "Unauthorized" }, 401);
  try {
    if (!await isAdmin(user.id)) return respond(req, { error: "Administrator access required" }, 403);
  } catch {
    return respond(req, { error: "Server is not configured" }, 503);
  }

  let admin;
  try { admin = getAdminClient(); } catch { return respond(req, { error: "Server is not configured" }, 503); }
  const { data: membership, error: membershipError } = await admin.from("memberships")
    .select("id,user_id,batch_id,category,status,batches(name,whatsapp_invite_url),profiles!memberships_user_id_fkey(full_name)")
    .eq("id", membershipId).maybeSingle();
  if (membershipError || !membership) return respond(req, { error: "Membership not found" }, 404);
  if (membership.status !== "pending") return respond(req, { error: "Only pending registrations can be reviewed" }, 409);

  const nextStatus = action === "approve" ? "active" : "rejected";
  if (action === "approve") {
    const { data: approval, error: approvalError } = await admin.rpc("approve_membership_with_capacity", {
      p_membership_id: membership.id,
      p_approved_by: user.id,
    });
    if (approvalError) return respond(req, { error: "Membership approval could not be completed" }, 500);
    if (approval?.status === "full") return respond(req, { error: `This batch has reached its ${approval.capacity}-member capacity` }, 409);
    if (approval?.status === "invite_missing") return respond(req, { error: "Add a WhatsApp invite to this batch before approving registrations" }, 409);
    if (approval?.status !== "active") return respond(req, { error: "This registration is no longer pending" }, 409);
  } else {
    const { error: updateError } = await admin.from("memberships").update({
      status: nextStatus,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }).eq("id", membership.id).eq("status", "pending");
    if (updateError) return respond(req, { error: "Membership could not be updated" }, 500);
  }

  const batchName = membership.batches?.name || "Your Batch";
  const memberName = membership.profiles?.full_name || "Member";
  const notification = action === "approve"
    ? { user_id: membership.user_id, type: "approval", title: "Registration approved", body: `Your registration for batch "${batchName}" has been approved. Welcome to CCD!` }
    : { user_id: membership.user_id, type: "rejection", title: "Registration update", body: `Your registration for batch "${batchName}" was not approved. Contact the CCD team for more information.` };
  await admin.from("notifications").insert(notification);
  const inviteUrl = action === "approve" ? communityInvite(membership.batches?.whatsapp_invite_url) : null;
  if (inviteUrl) {
    const { error } = await admin.from("notifications").insert({
      user_id: membership.user_id,
      type: "whatsapp",
      title: "Your batch WhatsApp group",
      body: `Join the CCD community WhatsApp group: ${inviteUrl}`,
    });
    if (!error) await admin.from("memberships").update({ whatsapp_sent: true }).eq("id", membership.id);
  }
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(membership.user_id);
    const recipientEmail = authUser.user?.email || "";
    const safeName = escapeHtml(memberName);
    const safeBatch = escapeHtml(batchName);
    const content = action === "approve"
      ? `<div style="font-family:Arial,sans-serif;color:#193b28;max-width:600px;margin:auto"><h1>Welcome to CCD, ${safeName}!</h1><p>Your registration for <strong>${safeBatch}</strong> has been approved.</p>${inviteUrl ? `<p>Join the community WhatsApp group:</p><p><a href="${inviteUrl}" style="display:inline-block;background:#087c4b;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">Join community</a></p>` : ""}<p>Community of Courssin Developers</p></div>`
      : `<div style="font-family:Arial,sans-serif;color:#193b28;max-width:600px;margin:auto"><h1>Registration update</h1><p>Hello ${safeName}, your registration for <strong>${safeBatch}</strong> was not approved. Please contact the CCD team if you have questions.</p></div>`;
    const sent = await sendEmail(recipientEmail, memberName, action === "approve" ? `Welcome to CCD — ${batchName} registration approved` : `CCD registration update — ${batchName}`, content);
    if (!sent) console.error("Membership decision email was not delivered; check Resend secrets", membership.id);
  } catch (error) { console.error("Membership decision email request failed", membership.id, error); }
  const { data: admins } = await admin.from("profiles").select("id").in("role", ["super_admin", "administrator"]);
  if (admins?.length) await admin.from("notifications").insert(admins.map((row) => ({
    user_id: row.id,
    type: "registration_update",
    title: `Registration ${action === "approve" ? "approved" : "rejected"}`,
    body: `${memberName}'s registration for batch "${batchName}" was ${action === "approve" ? "approved" : "rejected"} by ${user.email || "an administrator"}.`,
  })));

  return respond(req, { ok: true, status: nextStatus });
});
