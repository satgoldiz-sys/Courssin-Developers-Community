/* CCD Dashboard - Tasks module (member): list tasks and submit or edit work links. */
(async function () {
  const CCD = window.CCD;
  const M = CCD && CCD.modules;
  if (!M || !M.requireSession) return;
  const session = await M.requireSession();
  if (!session) return;
  const sb = M.sb();
  const user = CCD.user;
  const noticeEl = () => document.querySelector('[data-dashboard-notice]');
  const OPEN_STATUSES = ['assigned', 'in_progress', 'revision_required'];
  const LABELS = { assigned: 'Assigned', in_progress: 'In progress', submitted: 'Submitted', under_review: 'Under review', revision_required: 'Revision required', approved: 'Approved', completed: 'Completed' };
  let tasks = [];
  let submissions = new Map();

  const statusLabel = s => LABELS[s] || String(s || 'N/A').replace(/_/g, ' ');

  function linksHtml(sub) {
    const links = [];
    const repo = M.safeHttpsUrl(sub.repo_url), live = M.safeHttpsUrl(sub.live_url);
    if (repo) links.push(`<a href="${M.esc(repo)}" target="_blank" rel="noopener noreferrer">Code</a>`);
    if (live) links.push(`<a href="${M.esc(live)}" target="_blank" rel="noopener noreferrer">Live</a>`);
    return links.join(' · ');
  }

  function submissionCell(t) {
    const sub = submissions.get(t.id);
    const canEdit = !['approved', 'completed'].includes(t.status);
    if (sub) {
      return `<div><span class="status approved">Submitted ${M.esc(M.fmtDate(sub.submitted_at))}</span>${linksHtml(sub) ? `<div class="muted" style="font-size:.85rem">${linksHtml(sub)}</div>` : ''}${canEdit ? `<div><button class="btn btn-secondary btn-sm" type="button" data-submit-task="${M.esc(t.id)}">Edit submission</button></div>` : ''}</div>`;
    }
    if (OPEN_STATUSES.includes(t.status)) return `<button class="btn btn-primary btn-sm" type="button" data-submit-task="${M.esc(t.id)}">Submit work</button>`;
    return '<span class="muted">N/A</span>';
  }

  function render() {
    const tbody = document.querySelector('#tasksTable tbody');
    if (!tbody) return;
    M.renderList(tbody, tasks, t => `
      <tr data-task-row="${M.esc(t.id)}">
        <td><strong>${M.esc(t.title)}</strong>${t.teams ? `<div class="muted" style="font-size:.82rem">${M.esc(t.teams.name)}</div>` : ''}</td>
        <td><span class="status ${M.statusClass(t.status)}">${M.esc(statusLabel(t.status))}</span></td>
        <td>${M.esc(t.due_date || 'N/A')}</td>
        <td>${M.esc(t.points ?? '')}</td>
        <td>${submissionCell(t)}</td>
      </tr>`, M.emptyState('No tasks assigned yet.'));
    tbody.querySelectorAll('[data-submit-task]').forEach(btn => btn.addEventListener('click', () => openForm(btn.dataset.submitTask)));
  }

  function openForm(taskId) {
    document.querySelectorAll('tr[data-task-form]').forEach(r => r.remove());
    const row = document.querySelector(`tr[data-task-row="${CSS.escape(taskId)}"]`);
    if (!row) return;
    const sub = submissions.get(taskId) || {};
    const formRow = document.createElement('tr');
    formRow.dataset.taskForm = taskId;
    formRow.innerHTML = `<td colspan="5"><form class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <div class="field"><label>Repository link (https)</label><input name="repo_url" type="url" placeholder="https://github.com/you/project" value="${M.esc(sub.repo_url || '')}" maxlength="500"></div>
      <div class="field"><label>Live link (https)</label><input name="live_url" type="url" placeholder="https://" value="${M.esc(sub.live_url || '')}" maxlength="500"></div>
      <div class="field full" style="grid-column:1/-1"><label>Notes for your reviewer</label><textarea name="notes" maxlength="2000" rows="3">${M.esc(sub.notes || '')}</textarea></div>
      <div style="grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" type="submit">${sub.id ? 'Save changes' : 'Submit work'}</button><button class="btn btn-secondary btn-sm" type="button" data-cancel>Cancel</button></div>
      <div class="notice" data-form-notice style="grid-column:1/-1;margin:0"></div></form></td>`;
    row.after(formRow);
    const form = formRow.querySelector('form');
    form.querySelector('[data-cancel]').addEventListener('click', () => formRow.remove());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const note = form.querySelector('[data-form-notice]');
      const repo = form.repo_url.value.trim(), live = form.live_url.value.trim(), notes = form.notes.value.trim();
      if (!repo && !live && !notes) return M.setNotice(note, 'Add a repository link, a live link, or a note.', 'error');
      if ((repo && !M.safeHttpsUrl(repo)) || (live && !M.safeHttpsUrl(live))) return M.setNotice(note, 'Links must start with https://', 'error');
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      M.setNotice(note, 'Saving...', '');
      const payload = { repo_url: repo || null, live_url: live || null, notes: notes || null };
      let error;
      if (sub.id) ({ error } = await sb.from('task_submissions').update(payload).eq('id', sub.id).eq('user_id', user.id));
      else ({ error } = await sb.from('task_submissions').insert({ task_id: taskId, user_id: user.id, ...payload }));
      if (error) { button.disabled = false; return M.setNotice(note, `Could not save your submission. ${M.errorText(error)}`, 'error'); }
      M.setNotice(noticeEl(), sub.id ? 'Submission updated.' : 'Work submitted. Your reviewer has been notified through the task status.', 'success');
      load();
    });
    form.repo_url.focus();
  }

  async function load() {
    const tbody = document.querySelector('#tasksTable tbody');
    if (!tbody) return;
    try {
      const { data: membershipRows, error: membershipError } = await sb.from('team_members').select('team_id').eq('user_id', user.id);
      if (membershipError) throw membershipError;
      const teamIds = (membershipRows || []).map(row => row.team_id).filter(Boolean);
      let query = sb.from('tasks').select('id,title,status,due_date,points,team_id,assigned_to,teams(name)').order('due_date', { ascending: true, nullsFirst: false }).limit(100);
      query = teamIds.length ? query.or(`assigned_to.eq.${user.id},team_id.in.(${teamIds.join(',')})`) : query.eq('assigned_to', user.id);
      const { data, error } = await query;
      if (error) throw error;
      tasks = data || [];
      submissions = new Map();
      if (tasks.length) {
        const { data: subs, error: subError } = await sb.from('task_submissions').select('id,task_id,repo_url,live_url,notes,submitted_at')
          .eq('user_id', user.id).in('task_id', tasks.map(t => t.id)).order('submitted_at', { ascending: false });
        if (subError) console.warn('Task submissions could not be loaded', subError);
        (subs || []).forEach(s => { if (!submissions.has(s.task_id)) submissions.set(s.task_id, s); });
      }
      render();
    } catch (e) {
      console.error('Member tasks could not be loaded', e);
      M.showError(tbody, `Could not load tasks. ${M.errorText(e)}`, load, 5);
    }
  }

  CCD.onReady(load);
})();
