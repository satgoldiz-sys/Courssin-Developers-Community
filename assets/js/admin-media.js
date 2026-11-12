/* Admin uploads go through Storage RLS; this browser helper never uses a secret key. */
(function () {
  const CCD = window.CCD;
  if (!CCD) return;
  const extensions = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "audio/mpeg": "mp3", "application/pdf": "pdf"
  };

  async function upload(file, folder, imagesOnly) {
    if (!file) return null;
    if (file.size > 10 * 1024 * 1024) throw new Error("Files must be 10 MB or smaller.");
    if (!extensions[file.type] || (imagesOnly && !file.type.startsWith("image/"))) {
      throw new Error("Choose an allowed JPG, PNG, WebP, MP4, MP3, or PDF file.");
    }
    const sb = CCD.getSupabase();
    if (!sb) throw new Error("Supabase is not configured.");
    const path = `${folder}/${crypto.randomUUID()}.${extensions[file.type]}`;
    const { error } = await sb.storage.from("ccd-public-media").upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type
    });
    if (error) throw new Error(error.message || "Upload failed.");
    const { data } = sb.storage.from("ccd-public-media").getPublicUrl(path);
    return { object_path: path, public_url: data.publicUrl, media_type: file.type };
  }

  CCD.uploadPublicMedia = upload;
})();
