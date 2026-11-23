/* CCD Dashboard - Rewards module (member) */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;

  async function load() {
    const tbody = document.querySelector('#rwTable tbody');
    const myTbody = document.querySelector('#rwMyTable tbody');
    if (!tbody && !myTbody) return;
    try {
      const [{ data: points, error: pe }, { data: rewards, error: re }, { data: redemptions, error: de }] = await Promise.all([
        sb.from('points').select('points').eq('user_id', user.id),
        sb.from('rewards').select('id,title,points_required,eligibility,available').eq('available', true).order('points_required'),
        sb.from('reward_redemptions').select('id,reward_id,status,requested_at,rewards(title)').eq('user_id', user.id).order('requested_at', { ascending: false })
      ]);
      if (pe) throw pe;
      if (re) throw re;
      if (de) throw de;
      const total = (points || []).reduce((a, r) => a + (r.points || 0), 0);
      const pEl = document.getElementById('rwPoints'); if (pEl) pEl.textContent = total;
      const rEl = document.getElementById('rwRedemptions'); if (rEl) rEl.textContent = (redemptions || []).length;

      if (tbody) M.renderList(tbody, rewards, r => {
        const can = total >= (r.points_required || 0);
        return `
          <tr>
            <td><strong>${M.esc(r.title)}</strong><div class="muted">${M.esc(r.eligibility || '')}</div></td>
            <td>${M.esc(r.points_required)}</td>
            <td>${can ? 'Eligible' : 'Not enough points'}</td>
            <td>${can ? `<button class="btn btn-primary btn-sm" data-request="${M.esc(r.id)}">Request</button>` : `<button class="btn btn-secondary btn-sm" disabled>Locked</button>`}</td>
          </tr>`;
      }, M.emptyState('No rewards available right now.'));

      if (myTbody) M.renderList(myTbody, redemptions, r => {
        const title = r.rewards ? r.rewards.title : 'Reward';
        return `
          <tr>
            <td>${M.esc(title)}</td>
            <td>${M.esc(M.fmtDate(r.requested_at))}</td>
            <td><span class="status ${M.statusClass(r.status)}">${M.esc(r.status)}</span></td>
          </tr>`;
      }, M.emptyState('No redemption requests yet.'));

      tbody && tbody.querySelectorAll('[data-request]').forEach(btn => btn.addEventListener('click', async () => {
        const rewardId = btn.dataset.request;
        btn.disabled = true;
        const { data: result, error } = await sb.functions.invoke('request-reward', { body: { reward_id: rewardId } });
        if (error || (result && result.error)) {
          btn.disabled = false;
          let detail = result?.error || '';
          const response = error && error.context;
          if (!detail && response && typeof response.clone === 'function') {
            try { const body = await response.clone().json(); if (typeof body?.error === 'string') detail = body.error; } catch { /* keep generic text */ }
          }
          const notice = document.querySelector('[data-dashboard-notice]');
          M.setNotice(notice, detail || M.errorText(error) || 'The reward request could not be completed.', 'error');
          return;
        }
        const notice = document.querySelector('[data-dashboard-notice]');
        M.setNotice(notice, 'Reward request submitted for review.', 'success');
        load();
      }));
    } catch (e) {
      console.error('Rewards could not be loaded', e);
      if (tbody) M.showError(tbody, `Could not load rewards. ${M.errorText(e)}`, load, 4);
      if (myTbody) M.showError(myTbody, `Could not load redemptions. ${M.errorText(e)}`, load, 3);
    }
  }

  CCD.onReady(load);
})();
