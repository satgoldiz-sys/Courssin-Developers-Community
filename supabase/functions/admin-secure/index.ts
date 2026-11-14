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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

async function announceEvent(admin: ReturnType<typeof getAdminClient>, event: Record<string, unknown>): Promise<void> {
  if (!RESEND_API_KEY || !RESEND_SENDER_EMAIL) { console.error("Event email skipped: Resend secrets are not configured"); return; }
  const { data: profiles, error } = await admin.from("profiles").select("email,full_name").not("email", "is", null).limit(5000);
  if (error) { console.error("Event email recipients could not be loaded", error.code); return; }
  const title = escapeHtml(String(event.title || "CCD event"));
  const description = escapeHtml(String(event.description || ""));
  const date = escapeHtml(String(event.event_date || ""));
  const venue = escapeHtml(String(event.venue || ""));
  const eventUrl = `https://ccd-gilt.vercel.app/event?id=${encodeURIComponent(String(event.id || ""))}`;
  const htmlContent = `<div style="font-family:Arial,sans-serif;color:#193b28;max-width:600px;margin:auto"><h1>${title}</h1><p>${description}</p>${date ? `<p><strong>When:</strong> ${date}</p>` : ""}${venue ? `<p><strong>Where:</strong> ${venue}</p>` : ""}<p><a href="${eventUrl}" style="display:inline-block;background:#087c4b;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">View event details</a></p><p>Community of Courssin Developers</p></div>`;
  for (const profile of profiles || []) {
    if (typeof profile.email !== "string" || !profile.email.includes("@")) continue;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`, to: [profile.email], subject: `CCD event: ${String(event.title || "New event")}`, html: htmlContent }),
      });
      if (!response.ok) console.error("Resend event announcement failed", response.status, await response.text());
    } catch (error) { console.error("Resend event announcement request failed", error); }
  }
}


type FieldKind = "text" | "longText" | "uuid" | "date" | "timestamp" | "number" | "boolean" | "url" | "object" | "role" | "status";
const RULES: Record<string, { key: string; fields: Record<string, FieldKind> }> = {
  profiles: { key: "id", fields: { role: "role" } },
  batches: { key: "id", fields: { name: "text", year: "number", start_date: "date", end_date: "date", registration_open_date: "date", registration_close_date: "date", whatsapp_invite_url: "url", capacity: "number", description: "longText", status: "status", is_registration_open: "boolean" } },
  teams: { key: "id", fields: { batch_id: "uuid", name: "text", leader_id: "uuid", objectives: "longText" } },
  tasks: { key: "id", fields: { batch_id: "uuid", team_id: "uuid", assigned_to: "uuid", title: "text", description: "longText", instructions: "longText", difficulty: "text", status: "status", start_date: "date", due_date: "date", points: "number", reference_materials: "longText", submission_requirements: "longText" } },
  achievements: { key: "id", fields: { user_id: "uuid", title: "text", description: "longText", badge_key: "text" } },
  points: { key: "id", fields: { user_id: "uuid", batch_id: "uuid", source_type: "text", source_id: "uuid", points: "number", reason: "longText" } },
  reward_redemptions: { key: "id", fields: { reward_id: "uuid", user_id: "uuid", status: "status" } },
  projects: { key: "id", fields: { batch_id: "uuid", team_id: "uuid", leader_id: "uuid", title: "text", description: "longText", status: "status", deadline: "date", github_url: "url", live_url: "url" } },
  rewards: { key: "id", fields: { title: "text", description: "longText", points_required: "number", eligibility: "longText", available: "boolean" } },
  tech_cohorts: { key: "id", fields: { batch_id: "uuid", title: "text", theme: "text", event_date: "date", venue: "text", description: "longText", format: "text" } },
  announcements: { key: "id", fields: { batch_id: "uuid", title: "text", body: "longText" } },
  batch_settings: { key: "batch_id", fields: { batch_id: "uuid", settings: "object" } },
  batch_leadership: { key: "id", fields: { batch_id: "uuid", user_id: "uuid", position: "text", responsibilities: "longText", appointed_at: "date", active: "boolean" } },
  memberships: { key: "id", fields: { status: "status", approved_by: "uuid", approved_at: "timestamp", whatsapp_sent: "boolean" } },
  articles: { key: "id", fields: { title: "text", slug: "text", excerpt: "longText", body: "longText", cover_image_url: "url", status: "status" } },
  media_assets: { key: "id", fields: { title: "text", description: "longText", object_path: "text", public_url: "url", media_type: "text", alt_text: "text", status: "status" } },
  events: { key: "id", fields: { title: "text", description: "longText", event_type: "text", event_date: "timestamp", venue: "text", image_url: "url", status: "status" } },
  event_organizers: { key: "id", fields: { event_id: "uuid", full_name: "text", image_url: "url", batch_position: "text", volunteer_position: "text", sort_order: "number" } },
  event_volunteer_positions: { key: "id", fields: { event_id: "uuid", title: "text", description: "longText", slots: "number", status: "status" } },
};

const roles = ["super_admin", "administrator", "batch_lead", "team_leader", "reviewer_mentor", "community_member", "alumni"];
const statusValues: Record<string, Set<string>> = {
  batches: new Set(["upcoming", "registration_open", "registration_closed", "active", "closing_soon", "completed", "archived"]),
  tasks: new Set(["assigned", "in_progress", "submitted", "under_review", "revision_required", "approved", "completed"]),
  projects: new Set(["planning", "active", "completed", "archived", "on_hold"]),
  memberships: new Set(["pending", "verified", "active", "completed", "rejected", "withdrawn"]),
  reward_redemptions: new Set(["pending", "approved", "rejected"]),
  articles: new Set(["draft", "published", "archived"]),
  media_assets: new Set(["draft", "published", "archived"]),
  events: new Set(["draft", "published", "archived"]),
  event_volunteer_positions: new Set(["open", "closed"]),
};

function validatePayload(table: string, input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const fields = RULES[table].fields;
  const payload = input as Record<string, unknown>;
  const keys = Object.keys(payload);
  if (!keys.length || keys.some((key) => !Object.hasOwn(fields, key))) return null;
  for (const [key, value] of Object.entries(payload)) {
    if (value === null && fields[key] !== "boolean" && fields[key] !== "object") continue;
    const kind = fields[key];
    if (kind === "text" && (typeof value !== "string" || value.length > 500)) return null;
    if (kind === "longText" && (typeof value !== "string" || value.length > 100_000)) return null;
    if (kind === "uuid" && value !== null && !isUuid(value)) return null;
    if (kind === "date" && value !== null && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) return null;
    if (kind === "timestamp" && value !== null && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) return null;
    if (kind === "number" && (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 1_000_000)) return null;
    if (kind === "boolean" && typeof value !== "boolean") return null;
    if (kind === "url" && value !== null) {
      if (typeof value !== "string" || value.length > 2048) return null;
      try { if (new URL(value).protocol !== "https:") return null; } catch { return null; }
    }
    if (kind === "object" && (!value || typeof value !== "object" || Array.isArray(value))) return null;
    if (kind === "role" && (typeof value !== "string" || !roles.includes(value))) return null;
    if (kind === "status" && (typeof value !== "string" || !statusValues[table]?.has(value))) return null;
  }
  if (table === "articles" && "slug" in payload && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(payload.slug))) return null;
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options(req);
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
  const body = await readJson(req);
  const action = body?.action;
  const table = body?.table;
  const recordId = body?.record_id;
  const isMembersDataRequest = action === "members-data";
  if (!body || typeof action !== "string" || (!isMembersDataRequest && (typeof table !== "string" || !RULES[table]))) {
    return respond(req, { error: "Invalid request" }, 400);
  }
  if (!isMembersDataRequest && !["insert", "update", "delete", "select"].includes(action)) return respond(req, { error: "Invalid action" }, 400);

  const user = await getUser(req);
  if (!user) return respond(req, { error: "Unauthorized" }, 401);
  let admin;
  try { admin = getAdminClient(); } catch { return respond(req, { error: "Server is not configured" }, 503); }
  const { data: caller, error: roleError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (roleError || !caller || !["super_admin", "administrator"].includes(caller.role)) {
    return respond(req, { error: "Administrator access required" }, 403);
  }

  if (isMembersDataRequest) {
    const [profilesResult, pendingResult] = await Promise.all([
      admin.from("profiles").select("id,full_name,email,role,created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("memberships").select("id,user_id,batch_id,status,created_at,category").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    ]);
    if (profilesResult.error) {
      console.error("admin member list query failed", profilesResult.error.code);
      return respond(req, { error: `Member list query failed: ${profilesResult.error.message}`, code: profilesResult.error.code }, 500);
    }
    if (pendingResult.error) {
      console.error("admin registration list query failed", pendingResult.error.code);
      return respond(req, { error: `Registration list query failed: ${pendingResult.error.message}`, code: pendingResult.error.code }, 500);
    }
    const pending = pendingResult.data || [];
    const userIds = [...new Set(pending.map((row) => row.user_id))];
    const batchIds = [...new Set(pending.map((row) => row.batch_id))];
    const [applicantResult, batchResult] = await Promise.all([
      userIds.length ? admin.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [], error: null }),
      batchIds.length ? admin.from("batches").select("id,name,year").in("id", batchIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (applicantResult.error || batchResult.error) {
      const error = applicantResult.error || batchResult.error;
      console.error("admin registration relations query failed", error?.code);
      return respond(req, { error: `Registration details query failed: ${error?.message || "unknown database error"}`, code: error?.code }, 500);
    }
    const applicants = new Map((applicantResult.data || []).map((row) => [row.id, row]));
    const batches = new Map((batchResult.data || []).map((row) => [row.id, row]));
    return respond(req, {
      ok: true,
      profiles: profilesResult.data || [],
      approvals: pending.map((row) => ({ ...row, profiles: applicants.get(row.user_id) || null, batches: batches.get(row.batch_id) || null })),
    });
  }

  if (typeof table !== "string" || !RULES[table]) return respond(req, { error: "Invalid table" }, 400);

  const key = RULES[table].key;
  if (["update", "delete", "select"].includes(action) && !isUuid(recordId)) return respond(req, { error: "A valid record_id is required" }, 400);
  const query = admin.from(table);
  let result;
  if (action === "insert") {
    const payload = validatePayload(table, body.payload);
    if (!payload) return respond(req, { error: "Invalid fields or values" }, 400);
    if (table === "profiles" || table === "memberships") return respond(req, { error: "This table cannot be inserted through this endpoint" }, 400);
    if (table === "articles") payload.author_id = user.id;
    if (table === "achievements") payload.awarded_at = new Date().toISOString();
    if (table === "points") payload.awarded_by = user.id;
    if (table === "tasks") payload.created_by = user.id;
    if (table === "reward_redemptions") { payload.reviewed_by = user.id; payload.reviewed_at = new Date().toISOString(); }
    if (table === "articles" && payload.status === "published") payload.published_at = new Date().toISOString();
    if (table === "media_assets") payload.uploaded_by = user.id;
    if (table === "events") payload.created_by = user.id;
    if (table === "batch_leadership") payload.appointed_by = user.id;
    if (table === "batches") payload.whatsapp_invite_url = COMMUNITY_INVITE_URL;
    result = await query.insert(payload).select().single();
    if (!result.error && table === "batch_leadership" && result.data) {
      const appointment = result.data as Record<string, unknown>;
      const [{ data: batch }, { data: profile }] = await Promise.all([
        admin.from("batches").select("name,year").eq("id", appointment.batch_id).maybeSingle(),
        admin.from("profiles").select("full_name,email").eq("id", appointment.user_id).maybeSingle(),
      ]);
      const batchName = batch ? `${batch.name} ${batch.year}` : "CCD";
      const position = String(appointment.position || "community leader");
      await admin.from("notifications").insert({ user_id: appointment.user_id, type: "leadership", title: "Leadership appointment", body: `You have been appointed ${position} for ${batchName}. Congratulations!` });
      if (RESEND_API_KEY && RESEND_SENDER_EMAIL && profile?.email) {
        try {
          const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${RESEND_SENDER_NAME} <${RESEND_SENDER_EMAIL}>`, to: [profile.email], subject: `CCD leadership appointment: ${position}`, html: `<div style="font-family:Arial,sans-serif;color:#193b28"><h1>Congratulations, ${escapeHtml(String(profile.full_name || "CCD member"))}!</h1><p>You have been appointed <strong>${escapeHtml(position)}</strong> for <strong>${escapeHtml(batchName)}</strong>.</p><p>${escapeHtml(String(appointment.responsibilities || "We look forward to your contribution to the community."))}</p></div>` }) });
          if (!response.ok) console.error("Leadership appointment email failed", response.status, await response.text());
        } catch (error) { console.error("Leadership appointment email request failed", error); }
      }
    }
  } else if (action === "update") {
    const payload = validatePayload(table, body.payload);
    if (!payload) return respond(req, { error: "Invalid fields or values" }, 400);
    if (table === "memberships") return respond(req, { error: "Use the membership approval endpoint so batch capacity is enforced" }, 400);
    if (table === "profiles") {
      if (recordId === user.id) return respond(req, { error: "You cannot change your own administrator role" }, 403);
      if (payload.role === "super_admin" && caller.role !== "super_admin") return respond(req, { error: "Only a super administrator can grant that role" }, 403);
      const { data: target } = await admin.from("profiles").select("role").eq("id", recordId).maybeSingle();
      if (target?.role === "super_admin" && caller.role !== "super_admin") return respond(req, { error: "Only a super administrator can change that role" }, 403);
    }
    if (table === "articles" && payload.status === "published") payload.published_at = new Date().toISOString();
    result = await query.update(payload).eq(key, recordId).select().maybeSingle();
  } else if (action === "delete") {
    if (["profiles", "memberships", "batch_settings"].includes(table)) return respond(req, { error: "Delete is not allowed for this table" }, 400);
    result = await query.delete().eq(key, recordId).select().maybeSingle();
  } else {
    result = await query.select("*").eq(key, recordId).maybeSingle();
  }
  if (result.error) {
    console.error("admin-secure database operation failed", { table, action, code: result.error.code });
    return respond(req, { error: "The requested operation could not be completed" }, 500);
  }
  if (action !== "insert" && !result.data) return respond(req, { error: "Record not found" }, 404);
  if (table === "events" && action !== "delete" && result.data?.status === "published") {
    await announceEvent(admin, result.data as Record<string, unknown>);
  }
  return respond(req, { ok: true, data: result.data });
});
