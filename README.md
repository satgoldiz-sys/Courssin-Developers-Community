# Community of Courssin Developers (CCD)

**BUILD • LEARN • INNOVATE • GROW**

Premium, responsive, GDG-inspired (layout patterns) technology community platform built with **HTML5, CSS3, and Vanilla JavaScript**. Backend services use **Supabase** (Auth/PostgreSQL/Storage/Edge Functions) and **Resend** (via Edge Functions).

## Project Structure
- `/` ,  Public pages (`index`, `about`, `membership`, `activities`, `projects`, `community`, `rewards`, `events`, `tech-cohort`, `contact`, `login`, `register`)
- `/dashboard/` ,  Authenticated member dashboard (overview, profile, membership registration, team, tasks, projects, discussions, achievements, rewards, notifications)
- `/admin/` ,  Admin dashboard (overview, members, batches, leadership, teams, tasks, projects, Tech Cohort, rewards)
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
2. **Run SQL:** execute `supabase/schema.sql`, then `supabase/policies.sql` in SQL Editor.
3. **Configure Auth:**
   - Enable Email auth (and email confirmations as desired).
   - Enable **Google provider** in Supabase Auth. Add OAuth client credentials from Google Cloud Console.
   - Add redirect URLs: `http://localhost/*`, your Vercel URL, and `/dashboard/index.html`/`/login.html` as needed.
4. **Frontend config:** copy `.env.example` to `.env.local` for local reference (optional; gitignored), then edit `assets/js/config.js` with your **public** `supabaseUrl` and `supabaseAnonKey`. This static site does not read `.env` in the browser.
5. **Edge Functions (Resend/WhatsApp):**
   - Deploy functions from `supabase/functions/*`.
   - Set secrets (server-side only): `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.
   - Store WhatsApp invite URLs in `batches.whatsapp_invite_url` (admin-only). Do **not** hardcode links in frontend.
6. **Storage:** create buckets (e.g., avatars/submissions) and add RLS/storage policies.
7. **Run locally:** `npx serve .` (or VS Code Live Server) and open the served URL. OAuth redirects require a real origin (not `file://`).

## Security
- No Resend API keys, Supabase service-role keys, or WhatsApp invite links in frontend JS.
- RLS is enabled; policies must be reviewed/tightened per environment. Frontend guards are convenience only.
- Admin/staff actions should be enforced by RLS and, where needed, Edge Functions.

## Deployment (Vercel)
- Deploy as a static site. Set production Supabase Auth redirect URLs to your Vercel domain.
- Keep secrets in Supabase/Vercel server environments, never in client files.

## Status
Core UI, premium auth screens with Google icon/OAuth flow, dashboard/admin shells, data hooks, schema/policies, and Edge Function templates are implemented. To make every module fully operational, configure Supabase/Resend/Google OAuth, apply SQL, deploy functions, and extend module-specific CRUD as needed. A full multi-role production platform also requires testing, moderation workflows, and operational admin setup.
