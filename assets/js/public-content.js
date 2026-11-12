/* Public content reads are limited by Supabase RLS to published records. */
(async function () {
  const cfg = window.CCD_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const safeUrl = (value) => {
    try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; }
    catch { return ""; }
  };

  async function loadEvents() {
    const root = document.querySelector("[data-events]");
    if (!root) return;
    const { data, error } = await sb.from("events")
      .select("id,title,description,event_type,event_date,venue,image_url,event_organizers(full_name,image_url,batch_position,volunteer_position,batches(name,year)),event_volunteer_positions(title,description,slots,status)")
      .eq("status", "published").order("event_date", { ascending: true }).limit(50);
    if (error || !data?.length) return; // Keep the existing sample event cards as a safe fallback.
    root.innerHTML = data.map((event) => {
      const image = safeUrl(event.image_url);
      const organizers = (event.event_organizers || []).map((person) => `
        <div class="card" style="display:flex;align-items:center;gap:12px;padding:12px;margin-top:10px">
          ${safeUrl(person.image_url) ? `<img src="${esc(safeUrl(person.image_url))}" alt="" loading="lazy" style="width:48px;height:48px;object-fit:cover;border-radius:50%">` : ""}
          <div><strong>${esc(person.full_name)}</strong><div class="muted">${esc(person.batch_position)}${person.batches ? ` · ${esc(person.batches.name)} ${esc(person.batches.year)}` : ""}</div>${person.volunteer_position ? `<div class="help">Event role: ${esc(person.volunteer_position)}</div>` : ""}</div>
        </div>`).join("");
      const volunteers = (event.event_volunteer_positions || []).filter((role) => role.status === "open");
      const volunteerHtml = volunteers.length ? `<div style="margin-top:14px"><strong>Volunteer opportunities</strong><ul class="list-check">${volunteers.map((role) => `<li>${esc(role.title)} — ${esc(role.slots)} opening${role.slots === 1 ? "" : "s"}${role.description ? `: ${esc(role.description)}` : ""}</li>`).join("")}</ul></div>` : "";
      return `<article class="card event-card">
        ${image ? `<img class="event-image" src="${esc(image)}" alt="" loading="lazy">` : ""}
        <div class="event-body"><span class="chip chip-accent">${esc(event.event_type || "CCD Event")}</span>
          <h2>${esc(event.title)}</h2>
          <p class="event-meta">${event.event_date ? esc(new Date(event.event_date).toLocaleString()) : "Date to be announced"}${event.venue ? ` · ${esc(event.venue)}` : ""}</p>
          <p>${esc(event.description || "")}</p>
          ${organizers ? `<div style="margin-top:16px"><strong>Organizers</strong>${organizers}</div>` : ""}${volunteerHtml}
        </div></article>`;
    }).join("");
  }

  async function loadArticles() {
    const root = document.getElementById("publishedArticles");
    if (!root) return;
    const { data, error } = await sb.from("articles")
      .select("id,title,excerpt,body,cover_image_url,published_at")
      .eq("status", "published").order("published_at", { ascending: false }).limit(50);
    if (error) { root.innerHTML = '<p class="muted">Articles are temporarily unavailable.</p>'; return; }
    root.innerHTML = data?.length ? data.map((article) => `
      <article class="card reveal is-visible">
        ${safeUrl(article.cover_image_url) ? `<img class="event-image" src="${esc(safeUrl(article.cover_image_url))}" alt="" loading="lazy">` : ""}
        <span class="chip">${article.published_at ? esc(new Date(article.published_at).toLocaleDateString()) : "CCD article"}</span>
        <h2>${esc(article.title)}</h2><p>${esc(article.excerpt || "")}</p>
        <details><summary class="btn btn-secondary btn-sm">Read article</summary><div class="article-copy" style="white-space:pre-line;margin-top:16px">${esc(article.body)}</div></details>
      </article>`).join("") : '<p class="muted">No articles have been published yet.</p>';
  }

  async function loadMedia() {
    const root = document.getElementById("publishedMedia");
    if (!root) return;
    const { data, error } = await sb.from("media_assets")
      .select("id,title,description,public_url,media_type,alt_text,created_at")
      .eq("status", "published").order("created_at", { ascending: false }).limit(60);
    if (error) { root.innerHTML = '<p class="muted">Media is temporarily unavailable.</p>'; return; }
    root.innerHTML = data?.length ? data.map((asset) => {
      const url = safeUrl(asset.public_url);
      if (!url) return "";
      let preview = `<a class="btn btn-secondary btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open media</a>`;
      if (asset.media_type.startsWith("image/")) preview = `<img class="event-image" src="${esc(url)}" alt="${esc(asset.alt_text || "")}" loading="lazy">`;
      else if (asset.media_type === "video/mp4") preview = `<video class="event-image" src="${esc(url)}" controls preload="none"></video>`;
      else if (asset.media_type === "audio/mpeg") preview = `<audio src="${esc(url)}" controls preload="none" style="width:100%"></audio>`;
      return `<article class="card reveal is-visible">${preview}<h3>${esc(asset.title)}</h3><p>${esc(asset.description || "")}</p></article>`;
    }).join("") : '<p class="muted">No media has been published yet.</p>';
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadEvents();
    loadArticles();
    loadMedia();
  });
})();
