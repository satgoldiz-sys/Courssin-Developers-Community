(async function () {
  const CCD = window.CCD, A = CCD && CCD.admin;
  if (!A) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();
  const form = document.querySelector('[data-library-form]');
  const host = document.querySelector('[data-library-list]');
  const notice = document.querySelector('[data-library-notice]');
  const drop = document.querySelector('[data-library-dropzone]');
  const esc = A.esc;

  function setNotice(message, type = '') { notice.textContent = message; notice.className = `notice ${type}`; }
  if (drop && form) {
    const input = form.elements.file;
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('is-dragover'); if (event.dataTransfer.files.length) input.files = event.dataTransfer.files; });
    drop.addEventListener('click', () => input.click());
  }
  async function load() {
    const { data, error } = await sb.from('library_resources').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    host.innerHTML = (data || []).map(item => `<article class="card"><span class="chip">${esc(item.category)}</span><h2>${esc(item.title)}</h2><p>${esc(item.description || '')}</p><button class="btn btn-secondary btn-sm" data-library-delete="${esc(item.id)}" data-path="${esc(item.storage_path || '')}">Remove</button></article>`).join('') || '<article class="card">No resources yet.</article>';
    host.querySelectorAll('[data-library-delete]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm('Remove this library item?')) return;
      if (button.dataset.path) await sb.storage.from('ccd-member-library').remove([button.dataset.path]);
      const { error: deleteError } = await sb.from('library_resources').delete().eq('id', button.dataset.libraryDelete);
      if (deleteError) return setNotice(deleteError.message, 'error');
      load();
    }));
  }
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const files = [...form.elements.file.files];
    const url = form.elements.resource_url.value.trim();
    if (!files.length && !url) return setNotice('Provide a link or choose files/folder.', 'error');
    if (files.length && url) return setNotice('Add either a link or files at a time.', 'error');
    if (files.some(file => file.size > 50 * 1024 * 1024)) return setNotice('Each file must be 50 MB or smaller.', 'error');
    const uploaded = [];
    try {
      if (files.length) {
        for (const file of files) {
          const fileName = (file.webkitRelativePath || file.name).replace(/[^a-zA-Z0-9._/-]/g, '_');
          const path = `${crypto.randomUUID()}/${fileName}`;
          const { error } = await sb.storage.from('ccd-member-library').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
          if (error) throw error;
          uploaded.push({ path, title: files.length === 1 ? form.elements.title.value.trim() : file.name.replace(/\.[^.]+$/, '') });
        }
      }
      const base = { description: form.elements.description.value.trim() || null, category: form.elements.category.value.trim(), created_by: session.user.id };
      const resources = uploaded.length
        ? uploaded.map(file => ({ ...base, title: file.title, resource_type: 'file', resource_url: null, storage_path: file.path }))
        : [{ ...base, title: form.elements.title.value.trim(), resource_type: 'link', resource_url: url, storage_path: null }];
      const { error } = await sb.from('library_resources').insert(resources);
      if (error) throw error;
      form.reset(); form.elements.category.value = 'Digital Marketing';
      setNotice(`${resources.length} resource${resources.length === 1 ? '' : 's'} added to the member library.`, 'success');
      await load();
    } catch (error) {
      if (uploaded.length) await sb.storage.from('ccd-member-library').remove(uploaded.map(item => item.path));
      console.error('Library upload failed', error); setNotice(error.message || 'Could not add this resource.', 'error');
    }
  });
  load().catch(error => setNotice(error.message || 'Apply the community engagement library SQL migration.', 'error'));
})();
