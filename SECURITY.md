# Security notes

What protects the app now:
Server side: row level security on every table, Edge Function rate limits (membership, approvals, rewards, emails, admin actions, login lockout), and database triggers that cap how fast one user can insert activity, discussions, replies and submissions (supabase/rate_limit_hardening.sql).
Browser side: strict Content Security Policy, HSTS, frame blocking and other headers in vercel.json; request throttling, double submit blocking, honeypot fields and a progressive login lockout in assets/js/security.js. Client checks only slow down casual abuse; the server limits are the real protection.

Steps for you:
1. Run supabase/fix_dashboard_tools.sql, then supabase/rate_limit_hardening.sql in the SQL Editor.
2. Redeploy all Edge Functions.
3. In Supabase Auth, enable CAPTCHA, leaked password protection and email rate limits.
4. The .env file in the project holds server secrets. Do not deploy or share it. Rotate the service role and Resend keys if the zip has been shared.
