/* Admin overview: fills the Donezo-style cards on admin/index. Stat counts and the activity feed come from admin.js. */
(async function () {
  const CCD = window.CCD;
  const UI = CCD && CCD.ui;
  if (!CCD || !UI || !CCD.isConfigured()) return;
  const sb = CCD.getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const $ = (id) => document.getElementById(id);
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  CCD.onReady(UI.legalLine);
  try {
    const [{ data: memberships }, { data: profiles }, { data: batches }] = await Promise.all([
      sb.from('memberships').select('id,status,created_at').order('created_at', { ascending: false }).limit(500),
      sb.from('profiles').select('id,full_name,email,avatar_url,role,created_at').order('created_at', { ascending: false }).limit(5),
      sb.from('batches').select('id,is_registration_open').limit(100)
    ]);
    const apps = memberships || [];
    const kinds = { done: 0, active: 0, pending: 0 };
    const approved = ['approved', 'active', 'verified', 'completed'], rejected = ['rejected', 'cancelled', 'withdrawn'];
    let waiting = 0, declined = 0;
    apps.forEach((m) => {
      const s = String(m.status || '').toLowerCase();
      if (approved.includes(s)) kinds.done += 1;
      else if (rejected.includes(s)) declined += 1;
      else { kinds.active += 1; waiting += 1; }
    });
    UI.gauge(document.querySelector('[data-gauge]'), { done: kinds.done, active: kinds.active, pending: declined, caption: 'Applications approved' });

    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    apps.forEach((m) => { const d = new Date(m.created_at); if (d >= start) counts[d.getDay()] += 1; });
    UI.weekBars(document.querySelector('[data-week-bars]'), counts, 'new memberships');

    text('ovRemTitle', waiting ? `${waiting} application${waiting === 1 ? '' : 's'} waiting` : 'No applications waiting');
    text('ovRemMeta', waiting ? 'Approve or reject them to onboard members.' : 'New applications will appear here.');
    text('ovOpenBatches', (batches || []).filter((b) => b.is_registration_open).length);

    const people = $('ovPeople');
    if (people) {
      people.innerHTML = (profiles || []).length ? profiles.map((p) => `<div class="ov-person">${UI.avatar(p.full_name || p.email, p.avatar_url)}<span class="ov-person-copy"><strong>${UI.esc(p.full_name || 'CCD member')}</strong><small>${UI.esc(p.email || '')}</small></span><span class="ov-tag">${UI.esc(String(p.role || 'member').replace('_', ' '))}</span></div>`).join('') : '<p class="ov-empty">No members yet.</p>';
    }
  } catch (error) {
    console.error('Admin overview could not be loaded', error);
    const notice = document.querySelector('[data-dashboard-notice]');
    if (notice) CCD.setNotice(notice, `Some overview cards could not load: ${error?.message || 'check Supabase policies.'}`, 'error');
  }
})();
