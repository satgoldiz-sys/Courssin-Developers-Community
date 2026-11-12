/* Admin-only writing and media library manager. User-facing renderers escape all stored text. */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();
  const esc = A.esc;
  const articleForm = document.querySelector("[data-article-form]");
  const mediaForm = document.querySelector("[data-media-form]");
  let articles = [];

  function notice(message, type = "") {
    A.setNotice(document.querySelector("[data-dashboard-notice]"), message, type);
  }

  async function invoke(action, table, recordId, payload) {
    const { data, error } = await sb.functions.invoke("admin-secure", {
      body: { action, table, ...(recordId ? { record_id: recordId } : {}), ...(payload ? { payload } : {}) }
    });
    if (error || data?.error) {
      notice(data?.error || error?.message || "The operation could not be completed.", "error");
      return null;
    }
    return data?.data ?? data;
  }

  function slugify(text) {
    return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
  }

  const titleInput = articleForm.elements.namedItem("title");
  const slugInput = articleForm.elements.namedItem("slug");
  let slugEdited = false;
  slugInput.addEventListener("input", () => { slugEdited = true; });
  titleInput.addEventListener("input", () => { if (!slugEdited || !slugInput.value) slugInput.value = slugify(titleInput.value); });

  function resetArticle() {
    articleForm.reset();
    articleForm.elements.namedItem("id").value = "";
    slugEdited = false;
    document.querySelector("[data-article-form-title]").textContent = "Write an article";
  }

  async function loadArticles() {
    const tbody = document.querySelector("[data-articles-table]");
    const { data, error } = await sb.from("articles")
      .select("id,title,slug,excerpt,body,cover_image_url,status,published_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Could not load articles. Apply the security_hardening.sql migration.</td></tr>';
      return;
    }
    articles = data || [];
    tbody.innerHTML = articles.length ? articles.map((article) => `
      <tr><td><strong>${esc(article.title)}</strong><div class="muted">/${esc(article.slug)}</div></td>
      <td><span class="status ${esc(article.status)}">${esc(article.status)}</span></td>
      <td>${article.published_at ? esc(new Date(article.published_at).toLocaleDateString()) : "—"}</td>
      <td><div class="toolbar"><button class="btn btn-secondary btn-sm" data-edit-article="${esc(article.id)}">Edit</button><button class="btn btn-secondary btn-sm" data-article-status="${esc(article.id)}">${article.status === "published" ? "Archive" : "Publish"}</button></div></td></tr>`).join("") : '<tr><td colspan="4" class="muted">No articles yet.</td></tr>';
    tbody.querySelectorAll("[data-edit-article]").forEach((button) => button.addEventListener("click", () => {
      const article = articles.find((row) => row.id === button.dataset.editArticle);
      if (!article) return;
      articleForm.elements.namedItem("id").value = article.id;
      articleForm.elements.namedItem("title").value = article.title || "";
      articleForm.elements.namedItem("slug").value = article.slug || "";
      articleForm.elements.namedItem("excerpt").value = article.excerpt || "";
      articleForm.elements.namedItem("body").value = article.body || "";
      articleForm.elements.namedItem("status").value = article.status || "draft";
      articleForm.elements.namedItem("cover").value = "";
      slugEdited = true;
      document.querySelector("[data-article-form-title]").textContent = "Edit article";
      articleForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    tbody.querySelectorAll("[data-article-status]").forEach((button) => button.addEventListener("click", async () => {
      const article = articles.find((row) => row.id === button.dataset.articleStatus);
      if (!article) return;
      const status = article.status === "published" ? "archived" : "published";
      if (await invoke("update", "articles", article.id, { status })) {
        notice(status === "published" ? "Article published." : "Article archived.", "success");
        loadArticles();
      }
    }));
  }

  articleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = articleForm.elements.namedItem("id").value;
    const oldArticle = articles.find((row) => row.id === id);
    const save = articleForm.querySelector('[type="submit"]');
    save.disabled = true;
    try {
      const cover = articleForm.elements.namedItem("cover").files[0];
      const uploaded = cover ? await CCD.uploadPublicMedia(cover, "articles/covers", true) : null;
      const payload = {
        title: articleForm.elements.namedItem("title").value.trim(),
        slug: slugify(articleForm.elements.namedItem("slug").value.trim()),
        excerpt: articleForm.elements.namedItem("excerpt").value.trim() || null,
        body: articleForm.elements.namedItem("body").value.trim(),
        cover_image_url: uploaded?.public_url || oldArticle?.cover_image_url || null,
        status: articleForm.elements.namedItem("status").value,
      };
      const result = await invoke(id ? "update" : "insert", "articles", id, payload);
      if (result) {
        notice("Article saved.", "success");
        resetArticle();
        await loadArticles();
      }
    } catch (error) { notice(error.message || "Could not upload the cover image.", "error"); }
    finally { save.disabled = false; }
  });
  document.querySelector("[data-article-reset]").addEventListener("click", resetArticle);

  async function loadMedia() {
    const tbody = document.querySelector("[data-media-table]");
    const { data, error } = await sb.from("media_assets")
      .select("id,title,description,public_url,media_type,alt_text,status")
      .order("created_at", { ascending: false }).limit(200);
    if (error) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Could not load media. Apply the security_hardening.sql migration.</td></tr>';
      return;
    }
    tbody.innerHTML = data?.length ? data.map((asset) => `
      <tr><td><a href="${esc(asset.public_url)}" target="_blank" rel="noopener noreferrer">${esc(asset.title)}</a></td>
      <td>${esc(asset.media_type)}</td><td><span class="status ${esc(asset.status)}">${esc(asset.status)}</span></td>
      <td><button class="btn btn-secondary btn-sm" data-media-status="${esc(asset.id)}">${asset.status === "published" ? "Archive" : "Publish"}</button></td></tr>`).join("") : '<tr><td colspan="4" class="muted">No media uploaded yet.</td></tr>';
    tbody.querySelectorAll("[data-media-status]").forEach((button) => button.addEventListener("click", async () => {
      const asset = data.find((row) => row.id === button.dataset.mediaStatus);
      if (!asset) return;
      const status = asset.status === "published" ? "archived" : "published";
      if (await invoke("update", "media_assets", asset.id, { status })) {
        notice(status === "published" ? "Media published." : "Media archived.", "success");
        loadMedia();
      }
    }));
  }

  mediaForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = mediaForm.elements.namedItem("file").files[0];
    const save = mediaForm.querySelector('[type="submit"]');
    save.disabled = true;
    try {
      const uploaded = await CCD.uploadPublicMedia(file, "library", false);
      const result = await invoke("insert", "media_assets", null, {
        title: mediaForm.elements.namedItem("title").value.trim(),
        description: mediaForm.elements.namedItem("description").value.trim() || null,
        alt_text: mediaForm.elements.namedItem("alt_text").value.trim() || null,
        object_path: uploaded.object_path,
        public_url: uploaded.public_url,
        media_type: uploaded.media_type,
        status: mediaForm.elements.namedItem("status").value,
      });
      if (result) {
        mediaForm.reset();
        notice("Media uploaded and saved.", "success");
        loadMedia();
      }
    } catch (error) { notice(error.message || "Media upload failed.", "error"); }
    finally { save.disabled = false; }
  });

  loadArticles();
  loadMedia();
})();
