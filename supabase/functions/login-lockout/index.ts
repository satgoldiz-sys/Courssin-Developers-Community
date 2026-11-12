import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const genericError = "Invalid email or password.";
const MAX_BODY_BYTES = 8192;

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

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get("content-type") || "").toLowerCase().includes("application/json")) return null;
  const length = Number(req.headers.get("content-length") || "0");
  if (length > MAX_BODY_BYTES) return null;
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server credentials are not configured");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options(req);
  if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
  const body = await readJson(req);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!body || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 1 || password.length > 1024) {
    return respond(req, { error: genericError }, 401);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return respond(req, { error: "Authentication service is not configured" }, 503);

  let admin;
  try { admin = getAdminClient(); } catch { return respond(req, { error: "Authentication service is not configured" }, 503); }
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,lockout_until,failed_attempts").eq("email", email).maybeSingle();
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  if (!profile || profileError) {
    // Perform the same Auth check for unknown profiles to reduce email enumeration by timing.
    await anon.auth.signInWithPassword({ email, password });
    return respond(req, { error: genericError }, 401);
  }

  const now = new Date();
  if (profile.lockout_until && new Date(profile.lockout_until) > now) {
    const remainingMin = Math.ceil((new Date(profile.lockout_until).getTime() - now.getTime()) / 60000);
    return respond(req, { error: "Account temporarily locked", locked: true, lockout_remaining_minutes: remainingMin }, 429);
  }

  const { data, error: authError } = await anon.auth.signInWithPassword({ email, password });
  if (authError || !data.session) {
    const attempts = (profile.failed_attempts || 0) + 1;
    const lockoutUntil = attempts >= 6
      ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : attempts >= 3 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
    await admin.from("profiles").update({
      failed_attempts: attempts,
      last_failed_at: now.toISOString(),
      ...(lockoutUntil ? { lockout_until: lockoutUntil } : {}),
    }).eq("id", profile.id);
    if (lockoutUntil) return respond(req, {
      error: "Account temporarily locked",
      locked: true,
      lockout_remaining_minutes: Math.ceil((new Date(lockoutUntil).getTime() - now.getTime()) / 60000),
    }, 429);
    return respond(req, { error: genericError }, 401);
  }

  await admin.from("profiles").update({ failed_attempts: 0, last_failed_at: null, lockout_until: null }).eq("id", profile.id);
  return respond(req, {
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.session.user,
  });
});
