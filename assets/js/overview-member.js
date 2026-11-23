/* Member overview: fills the Donezo-style cards on dashboard/index. */
(async function () {
  const CCD = window.CCD;
  const UI = CCD && CCD.ui;
  if (!CCD || !UI || !CCD.isConfigured()) return;
  const sb = CCD.getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const user = session.user;
  const $ = (id) => document.getElementById(id);
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const dateLabel = (value) => value ? new Date(value + (String(value).length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
  UI.timer(document.querySelector('.ov-timer'));
  CCD.onReady(UI.legalLine);

  try {
    const { data: teamRows } = await sb.from('team_members').select('team_id').eq('user_id', user.id);
    const teamIds = [...new Set((teamRows || []).map((row) => row.team_id).filter(Boolean))];
    let tasksQuery = sb.from('tasks').select('id,title,status,due_date,points,teams(name)').order('due_date', { ascending: true }).limit(200);
    tasksQuery = teamIds.length ? tasksQuery.or(`assigned_to.eq.${user.id},team_id.in.(${teamIds.join(',')})`) : tasksQuery.eq('assigned_to', user.id);
    const [{ data: tasks }, { data: projects }] = await Promise.all([
      tasksQuery,
      sb.from('projects').select('id,title,deadline,status,project_members!inner(user_id)').eq('project_members.user_id', user.id).order('deadline', { ascending: true }).limit(6)
    ]);
    const list = tasks || [];
    const kinds = { done: 0, active: 0, pending: 0 };
    list.forEach((task) => { kinds[UI.statusKind(task.status)] += 1; });
    text('ovTotal', list.length);
    text('ovDone', kinds.done);
    text('ovActive', kinds.active);
    UI.gauge(document.querySelector('[data-gauge]'), { done: kinds.done, active: kinds.active, pending: kinds.pending, caption: 'Tasks completed' });

    // Tasks due per weekday in the current week (Sunday first).
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay());
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    list.forEach((task) => {
      if (!task.due_date) return;
      const due = new Date(task.due_date + 'T00:00:00');
      if (due >= start && due < end) counts[due.getDay()] += 1;
    });
    UI.weekBars(document.querySelector('[data-week-bars]'), counts, 'tasks due');

    // Reminder: next open deadline.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const next = list.find((task) => UI.statusKind(task.status) !== 'done' && task.due_date && new Date(task.due_date + 'T00:00:00') >= today);
    const btn = $('ovRemBtn');
    if (next) {
      text('ovRemTitle', next.title);
      text('ovRemMeta', `Due ${dateLabel(next.due_date)}${next.teams?.name ? ' / ' + next.teams.name : ''}${next.points ? ' / ' + next.points + ' XP' : ''}`);
    } else if (list.some((task) => UI.statusKind(task.status) !== 'done')) {
      text('ovRemTitle', 'Open tasks need dates');
      text('ovRemMeta', 'Check your task list for details.');
    } else {
      text('ovRemTitle', 'You are all caught up');
      text('ovRemMeta', 'No upcoming deadlines right now.');
      if (btn) { btn.href = 'projects'; btn.lastChild.textContent = 'Browse projects'; }
    }

    const host = $('ovProjects');
    if (host) {
      const rows = projects || [];
      host.innerHTML = rows.length ? rows.map((project) => `<li><a href="projects"><span class="ov-ico">${UI.esc(UI.initials(project.title).slice(0, 2))}</span><span class="ov-list-copy"><strong>${UI.esc(project.title)}</strong><small>Due date: ${UI.esc(dateLabel(project.deadline))}</small></span></a></li>`).join('') : '<li class="ov-empty">No projects assigned yet.</li>';
    }

    const people = $('ovPeople');
    if (people) {
      if (!teamIds.length) { people.innerHTML = '<p class="ov-empty">You are not in a team yet. Teams appear here once a leader adds you.</p>'; }
      else {
        const { data: members, error } = await sb.from('team_members').select('user_id,role,team_id,profiles(full_name,avatar_url),teams(name)').in('team_id', teamIds).limit(6);
        if (error || !members?.length) people.innerHTML = '<p class="ov-empty">Team members will show here.</p>';
        else people.innerHTML = members.map((member) => {
          const name = member.profiles?.full_name || (member.user_id === user.id ? 'You' : 'Team member');
          return `<div class="ov-person">${UI.avatar(name, member.profiles?.avatar_url)}<span class="ov-person-copy"><strong>${UI.esc(name)}</strong><small>${UI.esc(member.teams?.name || 'Team')}</small></span><span class="ov-tag">${UI.esc(member.role || 'member')}</span></div>`;
        }).join('');
      }
    }
  } catch (error) {
    console.error('Overview could not be loaded', error);
    const notice = document.querySelector('[data-dashboard-notice]');
    if (notice) CCD.setNotice(notice, `Some overview cards could not load: ${error?.message || 'check your connection and Supabase policies.'}`, 'error');
  }
})();
