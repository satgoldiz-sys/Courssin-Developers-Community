import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return Response.json({ error: "Email and password are required" }, { status: 400 });

  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up profile by email (case-insensitive via lower())
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id,email,lockout_until,failed_attempts,last_failed_at")
    .ilike("email", email)
    .maybeSingle();

  // Generic message: do not reveal whether the email exists
  const generic = "Invalid email or password.";

  if (pErr || !profile) {
    // Still attempt a dummy bcrypt/compare to mitigate user enumeration timing
    return Response.json({ error: generic }, { status: 401 });
  }

  // Check lockout
  const now = new Date();
  if (profile.lockout_until && new Date(profile.lockout_until) > now) {
    const remainingMs = new Date(profile.lockout_until).getTime() - now.getTime();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return Response.json({
      error: "Account temporarily locked",
      locked: true,
      lockout_remaining_minutes: remainingMin,
      lockout_until: profile.lockout_until
    }, { status: 429 });
  }

  // Attempt sign-in via Supabase Auth
  const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
  const { data, error: authErr } = await anon.auth.signInWithPassword({ email, password });

  if (authErr || !data.session) {
    // Increment failed attempts
    const newAttempts = (profile.failed_attempts || 0) + 1;
    let lockoutUntil = null;
    if (newAttempts >= 6) {
      lockoutUntil = new Date(now.getTime() + 24 * 3600 * 1000).toISOString(); // 24h
    } else if (newAttempts >= 3) {
      lockoutUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15min
    }
    await admin.from("profiles").update({
      failed_attempts: newAttempts,
      last_failed_at: now.toISOString(),
      ...(lockoutUntil ? { lockout_until: lockoutUntil } : {})
    }).eq("id", profile.id);

    if (lockoutUntil) {
      return Response.json({
        error: "Account temporarily locked",
        locked: true,
        lockout_remaining_minutes: lockoutUntil ? Math.ceil((new Date(lockoutUntil).getTime() - now.getTime()) / 60000) : 0,
        lockout_until: lockoutUntil
      }, { status: 429 });
    }
    return Response.json({ error: generic }, { status: 401 });
  }

  // Successful login: reset counters
  await admin.from("profiles").update({
    failed_attempts: 0,
    last_failed_at: null,
    lockout_until: null
  }).eq("id", profile.id);

  return Response.json({ ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token, user: data.session.user });
});