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
  if (!response.ok) console.error("Resend registration email failed", response.status, await response.text());
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
  if (!body || !isUuid(body.membership_id)) return respond(req, { error: "A valid membership_id is required" }, 400);
  const user = await getUser(req);
  if (!user) return respond(req, { error: "Unauthorized" }, 401);

  let admin;
  try { admin = getAdminClient(); } catch { return respond(req, { error: "Server is not configured" }, 503); }
  const { data: membership, error: membershipError } = await admin.from("memberships")
    .select("id,user_id,batch_id,category,status,whatsapp_sent,batches(name,whatsapp_invite_url),profiles!memberships_user_id_fkey(full_name)")
    .eq("id", body.membership_id).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership) return respond(req, { error: "Membership not found" }, 404);

  const batchName = membership.batches?.name || "Your Batch";
  const memberName = membership.profiles?.full_name || "Member";
  const recipientEmail = user.email || "";
  const approved = ["active", "verified", "approved"].includes(membership.status);
  const inviteUrl = approved ? communityInvite(membership.batches?.whatsapp_invite_url) : null;
  if (inviteUrl && !membership.whatsapp_sent) {
    const inviteBody = `Join the CCD community WhatsApp group: ${inviteUrl}`;
    const { data: existingInvite, error: existingInviteError } = await admin.from("notifications")
      .select("id").eq("user_id", user.id).eq("type", "whatsapp").eq("body", inviteBody).limit(1).maybeSingle();
    if (existingInviteError) return respond(req, { error: "WhatsApp notification could not be checked" }, 500);
    if (!existingInvite) {
      const { error } = await admin.from("notifications").insert({
        user_id: user.id,
        type: "whatsapp",
        title: "Your CCD community WhatsApp group",
        body: inviteBody,
      });
      if (error) return respond(req, { error: "WhatsApp invitation notification could not be created" }, 500);
    }
    const { error } = await admin.from("memberships").update({ whatsapp_sent: true })
      .eq("id", membership.id).eq("user_id", user.id);
    if (error) console.error("Could not mark WhatsApp invite as sent", membership.id, error.message);
  }

  const safeName = escapeHtml(memberName);
  const safeBatch = escapeHtml(batchName);
  const emailHtml = inviteUrl
    ? `<div style="font-family:Arial,sans-serif;color:#193b28;max-width:600px;margin:auto"><h1>Welcome to CCD, ${safeName}!</h1><p>Your registration for <strong>${safeBatch}</strong> is successful and approved.</p><p>Join our community WhatsApp group to connect with members and get updates:</p><p><a href="${inviteUrl}" style="display:inline-block;background:#087c4b;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">Join community</a></p><p>We’re glad to have you with us.<br>Community of Courssin Developers</p></div>`
    : `<div style="font-family:Arial,sans-serif;color:#193b28;max-width:600px;margin:auto"><h1>Welcome to CCD, ${safeName}!</h1><p>Your registration for <strong>${safeBatch}</strong> has been received and is awaiting approval. We’ll notify you when its status changes.</p><p>Community of Courssin Developers</p></div>`;
  try {
    const sent = await sendEmail(recipientEmail, memberName, inviteUrl ? `Welcome to CCD — ${batchName} registration successful` : `CCD registration received — ${batchName}`, emailHtml);
    if (!sent) console.error("Registration email was not delivered; check Resend secrets and sender verification", membership.id);
  } catch (error) { console.error("Registration email request failed", membership.id, error); }

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: user.id,
    type: approved ? "approval" : "registration",
    title: approved ? "Registration approved" : "Registration received",
    body: approved
      ? `Your registration for batch "${batchName}" has been approved automatically. Welcome to CCD!`
      : `Your membership registration for batch "${batchName}" has been received and is awaiting review.`,
  });
  if (notificationError) console.error("Registration status notification could not be created", membership.id, notificationError.message);

  const { data: admins, error: adminsError } = await admin.from("profiles").select("id")
    .in("role", ["super_admin", "administrator"]);
  if (adminsError) console.error("Admin notification recipients could not be loaded", membership.id, adminsError.message);
  if (!adminsError && admins?.length) {
    const { error } = await admin.from("notifications").insert(admins.map((row) => ({
      user_id: row.id,
      type: "new_registration",
      title: "New batch registration",
      body: `${memberName} registered for batch "${batchName}" (category: ${membership.category}).`,
    })));
    if (error) console.error("Admin registration notification could not be created", membership.id, error.message);
  }

  return respond(req, { ok: true, status: membership.status, whatsapp_invite_url: inviteUrl });
});
