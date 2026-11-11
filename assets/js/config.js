window.CCD_CONFIG = {
  appName: "Community of Courssin Developers",
  tagline: "BUILD • LEARN • INNOVATE • GROW",
  // Set your public Supabase project values here (NEVER service-role key).
  supabaseUrl: "https://etfhkyomhxxfeagpwtlr.supabase.co",
  supabaseAnonKey: "sb_publishable_MfKhn2xJDe0UrE0x1tm98g_68-hbX8I",
  // Resend and WhatsApp are handled only via Supabase Edge Functions.
  features: {
    auth: true,
    googleOAuth: true,
    database: true,
    email: true,
    whatsapp: true
  }
};
