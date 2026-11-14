import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SENDER_EMAIL = Deno.env.get("RESEND_SENDER_EMAIL") || "";
const SENDER_NAME = Deno.env.get("RESEND_SENDER_NAME") || "Community of Courssin Developers";

function cors(req: Request): HeadersInit {
  const origin = req.headers.get("origin") || "";
  return { ...(origin === "https://ccd-gilt.vercel.app" ? { "Access-Control-Allow-Origin": origin } : {}), "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
function response(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function escape(value: string) { return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response(req, { error: "Method not allowed" }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response(req, { error: "Invalid JSON" }, 400); }
  if (!(["sign_in", "password_changed"].includes(String(body.action)))) return response(req, { error: "Invalid action" }, 400);
  const token = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!URL || !ANON || !SERVICE || !token) return response(req, { error: "Unauthorized" }, 401);
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return response(req, { error: "Unauthorized" }, 401);
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = data.user;
  let subject = "Your CCD password was changed";
  let heading = "Password changed";
  let message = "Your account password was changed successfully. If you did not make this change, reset your password and contact the CCD team.";
  if (body.action === "sign_in") {
    const ua = (req.headers.get("user-agent") || "Unknown device").slice(0, 300);
    const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown").split(",")[0].trim();
    const marker = `${ip}|${ua}`;
    const previous = String(user.app_metadata?.ccd_last_device || "");
    if (!previous) {
      await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, ccd_last_device: marker } });
      return response(req, { ok: true, first_device: true });
    }
    if (previous === marker) return response(req, { ok: true, new_device: false });
    const update = await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, ccd_last_device: marker } });
    if (update.error) console.error("Could not update sign-in device marker", update.error.message);
    subject = "New sign-in to your CCD account";
    heading = "New device sign-in";
    message = `A sign-in to your CCD account was detected from a device or network we have not seen before.<br><br><strong>Device:</strong> ${escape(ua)}<br><strong>Time:</strong> ${new Date().toUTCString()}<br><br>If this was not you, change your password and contact the CCD team.`;
  }
  if (!RESEND_API_KEY || !SENDER_EMAIL) { console.error("Security email skipped: Resend secrets missing"); return response(req, { ok: true, email_sent: false }); }
  const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${SENDER_NAME} <${SENDER_EMAIL}>`, to: [user.email], subject, html: `<div style="font-family:Arial,sans-serif;color:#193b28;max-width:600px;margin:auto"><h1>${heading}</h1><p>${message}</p><p>Community of Courssin Developers</p></div>` }) });
  if (!sent.ok) { console.error("Resend security email failed", sent.status, await sent.text()); return response(req, { ok: true, email_sent: false }); }
  return response(req, { ok: true, email_sent: true });
});
