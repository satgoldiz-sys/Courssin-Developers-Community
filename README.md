# Community of Courssin Developers (CCD)

**BUILD • LEARN • INNOVATE • GROW**

Premium, responsive, GDG-inspired (layout patterns) technology community platform built with **HTML5, CSS3, and Vanilla JavaScript**. Backend services use **Supabase** (Auth/PostgreSQL/Storage/Edge Functions) and **Resend** (via Edge Functions).

## Project Structure
- `/` ,  Public pages (`index`, `about`, `membership`, `activities`, `projects`, `community`, `rewards`, `events`, `tech-cohort`, `contact`, `login`, `register`)
- `/dashboard/` ,  Authenticated member dashboard (overview, profile photo, account/password settings, membership registration/status, team, tasks, projects, discussions, achievements, rewards, notifications)
- `/admin/login` ,  Direct administrator sign-in route; normal email and Google sign-ins automatically route administrator accounts to the admin workspace
- `/admin/` ,  Admin dashboard (overview, members and approvals, batches, leadership, teams, tasks, projects, Tech Cohort, rewards, events, articles, and media)
- `/admin/events` and `/admin/content` ,  Admin-only publishing for events, organizers, volunteer positions, articles, and media
- `/events` and `/event?id=...` ,  Public event listing and published event details, including organizers and volunteer opportunities
- `/articles` ,  Publicly readable published stories and media
- `/assets/css/styles.css` ,  Global premium UI system (CCD colors)
- `/assets/js/config.js` ,  **Public** config only (`supabaseUrl`, `supabaseAnonKey`). Never add service keys.
- `/assets/js/supabase-client.js` ,  Supabase browser client helper
- `/assets/js/auth.js` ,  Login/register handlers + **Google OAuth** (`signInWithOAuth` provider `google`)
- `/assets/js/guard.js` ,  Session/role route guard for dashboard/admin
- `/assets/js/dashboard.js` ,  Member data loading, profile save, batch membership registration
- `/assets/js/admin.js` ,  Admin counts and batch management hooks
- `/supabase/schema.sql` ,  PostgreSQL schema, enums, relationships, indexes, profile trigger
- `/supabase/policies.sql` ,  RLS enablement and baseline policies (review/tighten for production)
- `/supabase/functions/registration-email/index.ts` ,  Resend confirmation + batch WhatsApp email (server-side)
- `/supabase/functions/membership/index.ts` ,  Secure WhatsApp invite retrieval for a member’s batch

## Setup (Required for Live Functionality)
1. **Create a Supabase project.** In Supabase Dashboard: Authentication, Database, Storage, Edge Functions.
2. **Run SQL:** execute `supabase/schema.sql`, then `supabase/policies.sql`, `supabase/rls_hardening.sql`, and `supabase/security_hardening.sql` in SQL Editor. On an existing project, apply the hardening scripts after reviewing them; do not rerun schema creation to replace existing data.
3. **Configure Auth:**
   - Enable Email auth (and email confirmations as desired).
   - Enable **Google provider** in Supabase Auth. Add OAuth client credentials from Google Cloud Console.
   - Set the production Site URL to `https://ccd-gilt.vercel.app` and add `https://ccd-gilt.vercel.app/**` to the redirect URL allowlist. Remove localhost and preview deployment URLs from the production allowlist.
   - Assign the initial `administrator` or `super_admin` role through a trusted project-owner operation. The public site does not provide an unauthenticated admin bootstrap flow.
4. **Frontend config:** edit `assets/js/config.js` with your **public** Supabase project URL and publishable/anon key. These are intentionally browser-visible and must be protected by RLS. Never put a service-role/secret key in this file. The static frontend does not read `.env`.
5. **Edge Functions (Resend/WhatsApp):**
   - Each function's `index.ts` is self-contained for individual deployment from the Supabase Dashboard editor; paste that function's full source without adding the `_shared` folder. Functions may also be deployed with the CLI from the project root.
   - Set secrets (server-side only): `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
   - For Dashboard editor deployment, paste the complete `supabase/functions/login-lockout/index.ts` file. It is self-contained and does not need the sibling `_shared` folder. Turn **Verify JWT** off for `login-lockout` only; it handles pre-login requests and validates credentials with Supabase Auth. Keep JWT verification enabled on functions that require a signed-in user.
   - For CLI deployment, run `supabase functions deploy login-lockout` from the project root; `supabase/config.toml` carries the same function-specific JWT setting.
   - Apply `supabase/rls_hardening.sql` to add the `failed_attempts`, `last_failed_at`, and `lockout_until` columns used by this function. The migration file defines them, but this workspace cannot confirm whether they exist in the live database.
   - Reapply `supabase/security_hardening.sql` after adding member profile photos; it creates the `ccd-avatars` bucket and owner-folder upload policies. Members receive their WhatsApp invite only after membership approval.
   - Store WhatsApp invite URLs in `batches.whatsapp_invite_url` (admin-only). Do **not** hardcode links in frontend.
6. **Storage:** create buckets (e.g., avatars/submissions) and add RLS/storage policies.
7. **Run locally:** `npx serve .` (or VS Code Live Server) and open the served URL. OAuth redirects require a real origin (not `file://`).
8. **Admin content uploads:** the hardening SQL creates the `ccd-public-media` bucket. Public visitors can read published media; only administrators can upload or change files. The admin UI accepts JPG, PNG, WebP, MP4, MP3, and PDF files up to 10 MB.

## Security
- No Resend API keys, Supabase service-role keys, or WhatsApp invite links in frontend JS.
- RLS is enabled; policies must be reviewed/tightened per environment. Frontend guards are convenience only.
- Admin/staff actions should be enforced by RLS and, where needed, Edge Functions.
- Publishing, event management, profile-role edits, and reward requests are checked server-side or by database RLS. Only published content is public.
- Keep Edge Function keys in Supabase Function secrets. This static Vercel site does not need private Vercel environment variables.
- `.env` is local-only and ignored by Git and Vercel. `.vercelignore` excludes environment files, Supabase SQL/function sources, and source maps from the static deployment.

## Deployment (Vercel)
- Deploy as a static production site at `https://ccd-gilt.vercel.app`. The public URL is configured in `assets/js/config.js` and `supabase/config.toml`; Supabase Auth Site URL and redirect allowlist must also be set in the Supabase Dashboard.
- Keep service-role and mail secrets in Supabase Edge Function secrets. Do not add them to Vercel for this static architecture. The browser publishable key remains in `assets/js/config.js`.
- Deploy Edge Functions separately with the Supabase CLI and apply the SQL migration after review. No build system or Vercel API functions are required.

## Status
Core UI, premium auth screens with Google icon/OAuth flow, dashboard/admin shells, data hooks, schema/policies, and Edge Function templates are implemented. To make every module fully operational, configure Supabase/Resend/Google OAuth, apply SQL, deploy functions, and extend module-specific CRUD as needed. A full multi-role production platform also requires testing, moderation workflows, and operational admin setup.
