(async function () {
  const CCD = window.CCD;
  if (!CCD || !CCD.isConfigured()) {
    const n = document.querySelector('[data-dashboard-notice]');
    if (n) CCD && CCD.setNotice(n, 'Configure Supabase in assets/js/config.js to enable live dashboard data.', 'error');
    return;
  }
  const sb = CCD.getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = (CCD.getBase() || '') + 'login'; return; }
  const user = session.user;
  window.CCD.session = session;
  window.CCD.user = user;

  async function loadOverview() {
    const [profile, memberships, tasks, points, notifications] = await Promise.all([
      sb.from('profiles').select('id,full_name,email,phone,country,city,avatar_url,bio,github_url,portfolio_url,linkedin_url,role,created_at,updated_at').eq('id', user.id).maybeSingle(),
      sb.from('memberships').select('*, batches(name,year,status,start_date,end_date)').eq('user_id', user.id).order('created_at', { ascending: false }),
      sb.from('tasks').select('id,title,status,due_date,points').or(`assigned_to.eq.${user.id}`).limit(20),
      sb.from('points').select('points').eq('user_id', user.id),
      sb.from('notifications').select('id,type,title,body,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4)
    ]);
    const p = profile.data || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? ', '; };
    set('welcomeName', p.full_name || user.user_metadata?.full_name || user.email);
    set('statPoints', (points.data || []).reduce((a, r) => a + (r.points || 0), 0));
    set('statTasks', (tasks.data || []).length);
    const active = (memberships.data || []).find(m => ['active','pending','verified'].includes(m.status)) || (memberships.data || [])[0];
    set('statBatch', active?.batches ? `${active.batches.name} ${active.batches.year}` : 'No batch');
    set('statCategory', active?.category || ', ');
    const tbody = document.querySelector('#tasksTable tbody');
    if (tbody) {
      tbody.innerHTML = (tasks.data || []).slice(0, 8).map(t => `<tr><td>${esc(t.title)}</td><td><span class="status ${esc(t.status)}">${esc(t.status)}</span></td><td>${t.due_date || ', '}</td><td>${t.points ?? ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No tasks assigned yet.</td></tr>';
    }
    const profileForm = document.querySelector('[data-profile-form]');
    if (profileForm) {
      ['full_name','phone','country','city','github_url','portfolio_url','linkedin_url','bio'].forEach(k => { if (profileForm[k]) profileForm[k].value = p[k] || ''; });
      const preview = profileForm.querySelector('[data-avatar-preview]');
      const fallback = profileForm.querySelector('[data-avatar-fallback]');
      if (preview && p.avatar_url) { preview.src = p.avatar_url; preview.hidden = false; if (fallback) fallback.hidden = true; }
    }
    const notificationPreview = document.querySelector('[data-notification-preview]');
    if (notificationPreview) {
      const rows = notifications.data || [];
      notificationPreview.innerHTML = rows.length ? rows.map((item) => {
        const invite = item.type === 'whatsapp' && String(item.body || '').match(/https:\/\/[^\s]+/);
        const inviteUrl = invite ? safeHttpsUrl(invite[0].replace(/[),.;]+$/, '')) : '';
        return `<a class="notification-preview-item${item.read_at ? '' : ' is-unread'}" href="notifications"><span class="notification-preview-dot" aria-hidden="true"></span><span><strong>${esc(item.title || 'CCD update')}</strong><small>${esc(item.created_at ? new Date(item.created_at).toLocaleDateString() : 'New')}</small>${inviteUrl ? '<span class="notification-preview-join">WhatsApp link available</span>' : ''}</span></a>`;
      }).join('') : '<p class="muted">You are all caught up. New updates will appear here.</p>';
    }
  }

  function safeHttpsUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
  }

  async function loadMembershipState() {
    const host = document.querySelector('[data-membership-status]');
    if (!host) return;
    const { data, error } = await sb.from('memberships')
      .select('id,batch_id,status,category,created_at,batches(name,year)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    if (error) {
      host.innerHTML = '<p class="muted">Could not load membership status. Please reload or contact the CCD team.</p>';
      return;
    }
    if (!data?.length) {
      host.innerHTML = '<p class="muted">You have not applied to a batch yet. Choose an open batch below to get started.</p>';
      return;
    }
    const cards = await Promise.all(data.map(async (membership) => {
      const batchName = membership.batches ? `${membership.batches.name} ${membership.batches.year}` : 'CCD batch';
      let inviteHtml = '';
      if (['active', 'verified'].includes(membership.status)) {
        const { data: inviteData } = await sb.functions.invoke('membership', { body: { batch_id: membership.batch_id } });
        const inviteUrl = safeHttpsUrl(inviteData?.whatsapp_invite_url || '');
        inviteHtml = inviteUrl
          ? `<a class="btn btn-primary btn-sm" href="${esc(inviteUrl)}" target="_blank" rel="noopener noreferrer">Join WhatsApp group</a>`
          : '<span class="help">Approved. Your group link is also available in Notifications.</span>';
      } else if (membership.status === 'pending') {
        inviteHtml = '<span class="help">Your group link will be available after an administrator approves this application.</span>';
      }
      return `<article class="membership-status-card"><div><strong>${esc(batchName)}</strong><span class="status ${esc(membership.status)}">${esc(membership.status)}</span><small>Category: ${esc(membership.category || 'Member')}</small></div><div>${inviteHtml}</div></article>`;
    }));
    host.innerHTML = cards.join('');
  }

  async function saveProfile(form) {
    const notice = form.querySelector('[data-notice]');
    const payload = {};
    ['full_name','phone','country','city','github_url','portfolio_url','linkedin_url','bio'].forEach(k => { if (form[k]) payload[k] = form[k].value.trim(); });
    const photo = form.elements.avatar?.files?.[0];
    if (photo) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
        return CCD.setNotice(notice, 'Choose a JPG, PNG, or WebP image up to 5 MB.', 'error');
      }
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[photo.type];
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await sb.storage.from('ccd-avatars').upload(path, photo, {
        contentType: photo.type, cacheControl: '3600', upsert: false
      });
      if (uploadError) return CCD.setNotice(notice, uploadError.message || 'Photo upload failed. Apply the avatar storage policies and try again.', 'error');
      payload.avatar_url = sb.storage.from('ccd-avatars').getPublicUrl(path).data.publicUrl;
    }
    CCD.setNotice(notice, 'Saving...', '');
    const { error } = await sb.from('profiles').update(payload).eq('id', user.id);
    CCD.setNotice(notice, error ? error.message : 'Profile updated.', error ? 'error' : 'success');
    if (!error && payload.avatar_url) {
      const preview = form.querySelector('[data-avatar-preview]');
      const fallback = form.querySelector('[data-avatar-fallback]');
      if (preview) { preview.src = payload.avatar_url; preview.hidden = false; }
      if (fallback) fallback.hidden = true;
      form.elements.avatar.value = '';
    }
  }

  async function loadBatches(selectEl) {
    const { data } = await sb.from('batches').select('id,name,year,status,is_registration_open').order('year', { ascending: false }).order('name');
    if (!selectEl) return;
    const open = (data || []).filter(b => b.is_registration_open === true);
    selectEl.innerHTML = '<option value="">Select an open batch</option>' + open.map(b => `<option value="${b.id}">${esc(b.name)} ${b.year}</option>`).join('');
    if (!open.length) selectEl.innerHTML = '<option value="">No open batches right now</option>';
  }

  async function submitMembership(form) {
    const notice = form.querySelector('[data-notice]');
    const batch_id = form.batch_id.value;
    if (!batch_id) return CCD.setNotice(notice, 'Select an open batch.', 'error');
    const payload = {
      user_id: user.id, batch_id,
      category: form.category.value,
      preferred_dev_category: form.preferred_dev_category?.value,
      technologies: form.technologies?.value,
      areas_of_interest: form.areas_of_interest?.value,
      why_join: form.why_join?.value,
      teamwork_experience: form.teamwork_experience?.value,
      availability: form.availability?.value,
      terms_accepted: !!form.terms?.checked
    };
    if (!payload.terms_accepted) return CCD.setNotice(notice, 'You must accept the community rules and terms.', 'error');
    CCD.setNotice(notice, 'Submitting registration...', '');
    const { data, error } = await sb.from('memberships').insert(payload).select('id').single();
    if (error) return CCD.setNotice(notice, error.message.includes('duplicate') ? 'You are already registered for this batch.' : error.message, 'error');
    const { error: notificationError } = await sb.functions.invoke('registration-email', { body: { membership_id: data.id } });
    CCD.setNotice(notice, notificationError
      ? 'Registration submitted. Your WhatsApp link will be available after approval; notification delivery may be delayed.'
      : 'Registration submitted for review. Your WhatsApp link will appear after an administrator approves your membership.', 'success');
    const wa = document.getElementById('waResult');
    if (wa) { wa.textContent = 'Membership status and any approved WhatsApp invite are shown below and in Notifications.'; wa.classList.add('is-visible'); }
    await loadMembershipState();
  }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  window.CCD.esc = esc;

  CCD.onReady(() => {
    loadOverview();
    const pf = document.querySelector('[data-profile-form]');
    if (pf) pf.addEventListener('submit', e => { e.preventDefault(); saveProfile(pf); });
    const bf = document.querySelector('[data-membership-form]');
    if (bf) { loadBatches(bf.batch_id); bf.addEventListener('submit', e => { e.preventDefault(); submitMembership(bf); }); }
    loadMembershipState();
    const profileForm = document.querySelector('[data-profile-form]');
    const avatarInput = profileForm?.elements.avatar;
    if (avatarInput) avatarInput.addEventListener('change', () => {
      const photo = avatarInput.files?.[0];
      if (!photo) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
        avatarInput.value = '';
        CCD.setNotice(profileForm.querySelector('[data-notice]'), 'Choose a JPG, PNG, or WebP image up to 5 MB.', 'error');
        return;
      }
      const preview = profileForm.querySelector('[data-avatar-preview]');
      const fallback = profileForm.querySelector('[data-avatar-fallback]');
      if (preview) { preview.src = URL.createObjectURL(photo); preview.hidden = false; }
      if (fallback) fallback.hidden = true;
    });
  });
})();
