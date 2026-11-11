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
    const [profile, memberships, tasks, points] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      sb.from('memberships').select('*, batches(name,year,status,start_date,end_date)').eq('user_id', user.id).order('created_at', { ascending: false }),
      sb.from('tasks').select('id,title,status,due_date,points').or(`assigned_to.eq.${user.id}`).limit(20),
      sb.from('points').select('points').eq('user_id', user.id)
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
    }
  }

  async function saveProfile(form) {
    const notice = form.querySelector('[data-notice]');
    const payload = {};
    ['full_name','phone','country','city','github_url','portfolio_url','linkedin_url','bio'].forEach(k => { if (form[k]) payload[k] = form[k].value.trim(); });
    CCD.setNotice(notice, 'Saving...', '');
    const { error } = await sb.from('profiles').update(payload).eq('id', user.id);
    CCD.setNotice(notice, error ? error.message : 'Profile updated.', error ? 'error' : 'success');
  }

  async function loadBatches(selectEl) {
    const { data } = await sb.from('batches').select('id,name,year,status,is_registration_open').order('year', { ascending: false }).order('name');
    if (!selectEl) return;
    const open = (data || []).filter(b => b.is_registration_open || b.status === 'registration_open');
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
      terms_accepted: !!form.terms?.checked,
      status: 'pending'
    };
    if (!payload.terms_accepted) return CCD.setNotice(notice, 'You must accept the community rules and terms.', 'error');
    CCD.setNotice(notice, 'Submitting registration...', '');
    const { data, error } = await sb.from('memberships').insert(payload).select('id').single();
    if (error) return CCD.setNotice(notice, error.message.includes('duplicate') ? 'You are already registered for this batch.' : error.message, 'error');
    // Trigger notification + (if approved) WhatsApp invite Edge Function (best-effort)
    try { await sb.functions.invoke('registration-email', { body: { membership_id: data.id } }); } catch (e) {}
    CCD.setNotice(notice, 'Registration submitted. A notification has been sent to you and the admin team for review.', 'success');
    const wa = document.getElementById('waResult');
    if (wa) wa.classList.add('is-visible');
  }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  window.CCD.esc = esc;

  document.addEventListener('DOMContentLoaded', () => {
    loadOverview();
    const pf = document.querySelector('[data-profile-form]');
    if (pf) pf.addEventListener('submit', e => { e.preventDefault(); saveProfile(pf); });
    const bf = document.querySelector('[data-membership-form]');
    if (bf) { loadBatches(bf.batch_id); bf.addEventListener('submit', e => { e.preventDefault(); submitMembership(bf); }); }
    document.querySelectorAll('[data-signout]').forEach(b => b.addEventListener('click', async () => { await sb.auth.signOut(); location.href = CCD.getBase() + ''; }));
  });
})();