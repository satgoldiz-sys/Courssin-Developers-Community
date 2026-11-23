/* CCD Dashboard - Discussions module (member): start discussions, read them and reply. */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;
  const CATEGORIES = ['General Discussions', 'Project Help', 'Learning Resources', 'Career Advice', 'Showcase'];
  const noticeEl = () => document.querySelector('[data-dashboard-notice]');
  let posts = [];
  let names = new Map();

  const nameOf = (id) => id === user.id ? 'You' : (names.get(id)?.full_name || 'Member');
  const missingReplies = (e) => /discussion_replies|pgrst205|42p01/i.test(`${e?.message || ''} ${e?.code || ''}`);

  function mountComposer() {
    if (document.querySelector('[data-discussion-form]')) return;
    const card = document.querySelector('.table-card');
    if (!card) return;
    const wrap = document.createElement('section');
    wrap.className = 'form-card';
    wrap.style.cssText = 'max-width:none;margin:0 0 16px';
    wrap.innerHTML = `<h2 style="font-size:1.1rem;margin-bottom:10px">Start a discussion</h2>
      <form data-discussion-form class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <div class="field"><label for="disc-category">Category</label><select id="disc-category" name="category">${CATEGORIES.map(c => `<option>${M.esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="disc-title">Title</label><input id="disc-title" name="title" required maxlength="160" placeholder="What would you like to talk about?"></div>
        <div class="field" style="grid-column:1/-1"><label for="disc-body">Message</label><textarea id="disc-body" name="body" required maxlength="4000" rows="3" placeholder="Share details, questions or ideas"></textarea></div>
        <div style="grid-column:1/-1"><button class="btn btn-primary btn-sm" type="submit">Post discussion</button></div>
        <div class="notice" data-form-notice style="grid-column:1/-1;margin:0"></div>
      </form>`;
    card.before(wrap);
    const form = wrap.querySelector('form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const note = form.querySelector('[data-form-notice]');
      const title = form.title.value.trim(), body = form.body.value.trim();
      if (!title || !body) return M.setNotice(note, 'Add a title and a message.', 'error');
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      M.setNotice(note, 'Posting...', '');
      const { error } = await sb.from('discussions').insert({ user_id: user.id, category: form.category.value, title, body });
      button.disabled = false;
      if (error) return M.setNotice(note, `Could not post your discussion. ${M.errorText(error)}`, 'error');
      form.reset();
      M.setNotice(note, 'Discussion posted.', 'success');
      load();
    });
  }

  function render() {
    const tbody = document.querySelector('#discussionsTable tbody');
    if (!tbody) return;
    M.renderList(tbody, posts, d => `
      <tr data-post-row="${M.esc(d.id)}">
        <td>${M.esc(d.category)}</td>
        <td><strong>${M.esc(d.title)}</strong></td>
        <td>${M.esc(nameOf(d.user_id))}</td>
        <td>${M.esc(M.fmtDate(d.created_at))}</td>
        <td><button class="btn btn-secondary btn-sm" type="button" data-open-post="${M.esc(d.id)}" aria-expanded="false">Open</button></td>
      </tr>`, M.emptyState('No discussions yet. Start the first one above.'));
    tbody.querySelectorAll('[data-open-post]').forEach(btn => btn.addEventListener('click', () => toggle(btn)));
  }

  async function toggle(btn) {
    const id = btn.dataset.openPost;
    const existing = document.querySelector(`tr[data-post-detail="${CSS.escape(id)}"]`);
    if (existing) { existing.remove(); btn.textContent = 'Open'; btn.setAttribute('aria-expanded', 'false'); return; }
    btn.textContent = 'Close';
    btn.setAttribute('aria-expanded', 'true');
    const post = posts.find(p => p.id === id);
    const row = btn.closest('tr');
    const detail = document.createElement('tr');
    detail.dataset.postDetail = id;
    detail.innerHTML = `<td colspan="5"><div style="white-space:pre-line;margin-bottom:12px">${M.esc(post.body)}</div>
      <div data-replies class="muted">Loading replies...</div>
      <form data-reply-form style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><input name="body" required maxlength="4000" placeholder="Write a reply" aria-label="Write a reply" style="flex:1 1 240px"><button class="btn btn-primary btn-sm" type="submit">Reply</button></form>
      ${post.user_id === user.id ? '<div style="margin-top:8px"><button class="btn btn-secondary btn-sm" type="button" data-delete-post>Delete my post</button></div>' : ''}
      <div class="notice" data-detail-notice style="margin:10px 0 0"></div></td>`;
    row.after(detail);
    const repliesHost = detail.querySelector('[data-replies]');
    const note = detail.querySelector('[data-detail-notice]');

    async function loadReplies() {
      const { data, error } = await sb.from('discussion_replies').select('id,body,user_id,created_at').eq('discussion_id', id).order('created_at', { ascending: true }).limit(200);
      if (error) {
        repliesHost.textContent = missingReplies(error) ? 'Replies are not set up yet. An administrator needs to run supabase/fix_dashboard_tools.sql.' : `Could not load replies. ${M.errorText(error)}`;
        return;
      }
      const more = await M.publicProfiles((data || []).map(r => r.user_id));
      more.forEach((v, k) => names.set(k, v));
      repliesHost.innerHTML = (data || []).length ? (data || []).map(r => `<div style="padding:8px 0;border-top:1px solid var(--line)"><strong>${M.esc(nameOf(r.user_id))}</strong> <span class="muted" style="font-size:.8rem">${M.esc(M.fmtDate(r.created_at, true))}</span><div style="white-space:pre-line">${M.esc(r.body)}</div>${r.user_id === user.id ? `<button class="btn btn-ghost btn-sm" type="button" data-delete-reply="${M.esc(r.id)}">Delete</button>` : ''}</div>`).join('') : 'No replies yet. Be the first to reply.';
      repliesHost.querySelectorAll('[data-delete-reply]').forEach(b => b.addEventListener('click', async () => {
        const { error: delError } = await sb.from('discussion_replies').delete().eq('id', b.dataset.deleteReply).eq('user_id', user.id);
        if (delError) return M.setNotice(note, `Could not delete the reply. ${M.errorText(delError)}`, 'error');
        loadReplies();
      }));
    }
    await loadReplies();

    detail.querySelector('[data-reply-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = form.body.value.trim();
      if (!body) return;
      const button = form.querySelector('button');
      button.disabled = true;
      const { error } = await sb.from('discussion_replies').insert({ discussion_id: id, user_id: user.id, body });
      button.disabled = false;
      if (error) return M.setNotice(note, missingReplies(error) ? 'Replies are not set up yet. An administrator needs to run supabase/fix_dashboard_tools.sql.' : `Could not send your reply. ${M.errorText(error)}`, 'error');
      form.reset();
      M.setNotice(note, '', '');
      loadReplies();
    });
    detail.querySelector('[data-delete-post]')?.addEventListener('click', async () => {
      if (!confirm('Delete this discussion and its replies?')) return;
      const { error } = await sb.from('discussions').delete().eq('id', id).eq('user_id', user.id);
      if (error) return M.setNotice(note, `Could not delete the post. ${M.errorText(error)}`, 'error');
      load();
    });
  }

  async function load() {
    const tbody = document.querySelector('#discussionsTable tbody');
    if (!tbody) return;
    mountComposer();
    try {
      const { data, error } = await sb.from('discussions').select('id,category,title,body,user_id,created_at').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      posts = data || [];
      names = await M.publicProfiles(posts.map(p => p.user_id));
      render();
    } catch (e) {
      console.error('Discussions could not be loaded', e);
      M.showError(tbody, `Could not load discussions. ${M.errorText(e)}`, load, 5);
    }
  }

  CCD.onReady(load);
})();
