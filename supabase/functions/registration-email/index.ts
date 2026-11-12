import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Keep this function self-contained so it can be pasted into the Supabase Dashboard editor.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    .select("id,user_id,batch_id,category,status,batches(name,whatsapp_invite_url),profiles(full_name)")
    .eq("id", body.membership_id).eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership) return respond(req, { error: "Membership not found" }, 404);

  const batchName = membership.batches?.name || "Your Batch";
  const memberName = membership.profiles?.full_name || "Member";
  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: user.id,
    type: "registration",
    title: "Registration received",
    body: `Your membership registration for batch "${batchName}" has been received and is awaiting review.`,
  });
  if (notificationError) return respond(req, { error: "Registration notification could not be created" }, 500);

  const { data: admins, error: adminsError } = await admin.from("profiles").select("id")
    .in("role", ["super_admin", "administrator"]);
  if (adminsError) return respond(req, { error: "Admin notification could not be created" }, 500);
  if (admins?.length) {
    const { error } = await admin.from("notifications").insert(admins.map((row) => ({
      user_id: row.id,
      type: "new_registration",
      title: "New batch registration",
      body: `${memberName} registered for batch "${batchName}" (category: ${membership.category}).`,
    })));
    if (error) return respond(req, { error: "Admin notification could not be created" }, 500);
  }

  const approved = ["active", "verified", "approved"].includes(membership.status);
  const inviteUrl = approved ? membership.batches?.whatsapp_invite_url || null : null;
  if (inviteUrl) {
    const { error } = await admin.from("notifications").insert({
      user_id: user.id,
      type: "whatsapp",
      title: "Your batch WhatsApp group",
      body: `Join your batch WhatsApp group: ${inviteUrl}`,
    });
    if (!error) await admin.from("memberships").update({ whatsapp_sent: true }).eq("id", membership.id).eq("user_id", user.id);
  }
  if (approved) {
    await admin.from("notifications").insert({
      user_id: user.id,
      type: "approval",
      title: "Registration approved",
      body: `Your registration for batch "${batchName}" has been approved. Welcome to CCD!`,
    });
  }
  return respond(req, { ok: true, status: membership.status, whatsapp_invite_url: inviteUrl });
});
