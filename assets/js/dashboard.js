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
    const [profile, memberships, tasks, points, notifications, badges, leadership, teams, projects] = await Promise.all([
      sb.from('profiles').select('id,full_name,email,phone,country,city,avatar_url,bio,github_url,portfolio_url,linkedin_url,role,created_at,updated_at').eq('id', user.id).maybeSingle(),
      sb.from('memberships').select('*, batches(name,year,status,start_date,end_date)').eq('user_id', user.id).order('created_at', { ascending: false }),
      sb.from('tasks').select('id,title,status,due_date,points').or(`assigned_to.eq.${user.id}`).limit(20),
      sb.from('points').select('points').eq('user_id', user.id),
      sb.from('notifications').select('id,type,title,body,read_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
      sb.from('achievements').select('title,badge_key').eq('user_id', user.id).order('awarded_at', { ascending: false }).limit(12),
      sb.from('batch_leadership').select('position').eq('user_id', user.id).eq('active', true).limit(8),
      sb.from('teams').select('name').eq('leader_id', user.id).limit(8),
      sb.from('projects').select('title').eq('leader_id', user.id).limit(8)
    ]);
    const p = profile.data || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? ', '; };
    set('welcomeName', p.full_name || user.user_metadata?.full_name || user.email);
    set('statPoints', (points.data || []).reduce((a, r) => a + (r.points || 0), 0));
    set('statTasks', (tasks.data || []).length);
    const active = (memberships.data || []).find(m => ['active','pending','verified'].includes(m.status)) || (memberships.data || [])[0];
    set('statBatch', active?.batches ? `${active.batches.name} ${active.batches.year}` : 'No batch');
    set('statCategory', active?.category || ', ');
    const roleHost = document.getElementById('memberRoleBadges');
    if (roleHost) {
      const roles = [
        ...(leadership.data || []).map(item => item.position),
        ...(teams.data || []).map(item => `Team Lead Â· ${item.name}`),
        ...(projects.data || []).map(item => `Project Lead Â· ${item.title}`),
        ...(badges.data || []).map(item => item.title)
      ].filter(Boolean);
      roleHost.innerHTML = roles.length ? roles.map(role => `<span class="member-role-badge">${esc(role)}</span>`).join('') : '<span class="member-role-empty">Your community contributions and badges will appear here.</span>';
    }
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
      .select('id,batch_id,status,category,employment_status,institution_type,institution_name,institution_country,study_year,created_at,batches(name,year)')
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
      const studyInfo = membership.employment_status === 'student'
        ? `${membership.institution_name || ''}${membership.institution_country ? `, ${membership.institution_country}` : ''}${membership.study_year ? ` \u00b7 ${membership.study_year}` : ''}`
        : membership.employment_status || '';
      return `<article class="membership-status-card"><div><strong>${esc(batchName)}</strong><span class="status ${esc(membership.status)}">${esc(membership.status)}</span><small>Category: ${esc(membership.category || 'Member')}</small>${studyInfo ? `<small>${esc(studyInfo)}</small>` : ''}</div><div>${inviteHtml}</div></article>`;
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
      try {
        payload.avatar_url = await compressAvatar(photo);
      } catch {
        return CCD.setNotice(notice, 'The selected image could not be processed. Try another JPG, PNG, or WebP image.', 'error');
      }
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

  async function compressAvatar(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      const maxDimension = 480;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let result = canvas.toDataURL('image/jpeg', 0.72);
      if (result.length > 220_000) {
        canvas.width = Math.max(1, Math.round(canvas.width * 0.7));
        canvas.height = Math.max(1, Math.round(canvas.height * 0.7));
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL('image/jpeg', 0.58);
      }
      if (result.length > 220_000) throw new Error('Compressed image is too large');
      return result;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function loadBatches(selectEl) {
    const { data } = await sb.from('batches').select('id,name,year,status,is_registration_open').order('year', { ascending: false }).order('name');
    if (!selectEl) return;
    const open = (data || []).filter(b => b.is_registration_open === true);
    selectEl.innerHTML = '<option value="">Select an open batch</option>' + open.map(b => `<option value="${b.id}">${esc(b.name)} ${b.year}</option>`).join('');
    if (!open.length) selectEl.innerHTML = '<option value="">No open batches right now</option>';
  }

  let institutionCatalogPromise;
  function loadInstitutionCatalog(form) {
    const typeSelect = form.elements.institution_type;
    const schoolSelect = form.elements.institution_name;
    const countrySelect = form.elements.institution_country;
    const status = form.querySelector('[data-institution-status]');
    if (!typeSelect || !schoolSelect) return;
    if (!institutionCatalogPromise) {
      const nigerianDirectory = [
        ['university','University of Ibadan'],['university','Lead City University'],['university','KolaDaisi University'],['university','Dominican University, Ibadan'],['university','Precious Cornerstone University'],['university','Atiba University'],['university','First Technical University'],['university','Ajayi Crowther University'],['university','Bowen University'],['university','University of Lagos'],['university','Obafemi Awolowo University'],['university','University of Ilorin'],['university','University of Nigeria, Nsukka'],['university','Covenant University'],['university','Lagos State University'],['university','Federal University of Technology, Akure'],['university','University of Abuja'],['university','Ahmadu Bello University'],['university','Babcock University'],['university','Redeemers University'],['university','American University of Nigeria'],['university','University of Benin'],['university','University of Port Harcourt'],['university','Federal University of Technology, Minna'],['university','National Open University of Nigeria'],
        ['polytechnic','The Polytechnic, Ibadan'],['polytechnic','Federal Polytechnic, Ede'],['polytechnic','Federal Polytechnic, Offa'],['polytechnic','Federal Polytechnic, Ilaro'],['polytechnic','Yaba College of Technology'],['polytechnic','Lagos State Polytechnic'],['polytechnic','Moshood Abiola Polytechnic'],['polytechnic','Federal Polytechnic, Ado-Ekiti'],['polytechnic','Rufus Giwa Polytechnic'],['polytechnic','Osun State Polytechnic, Iree'],['polytechnic','Oyo State College of Agriculture and Technology'],['polytechnic','Gateway ICT Polytechnic'],['polytechnic','Auchi Polytechnic'],['polytechnic','Federal Polytechnic, Nekede'],['polytechnic','Kaduna Polytechnic'],['polytechnic','Kwara State Polytechnic'],
        ['college','Federal College of Education (Special), Oyo'],['college','Federal College of Education, Abeokuta'],['college','Emmanuel Alayande University of Education'],['college','Adeyemi Federal University of Education'],['college','Federal College of Education, Zaria'],['college','Federal College of Education, Osiele'],['college','Nigerian College of Aviation Technology'],['college','Oyo State College of Nursing and Midwifery'],['college','Lead City College of Health Sciences'],['college','Federal College of Agriculture, Moor Plantation'],['college','Federal College of Forestry, Ibadan'],['college','National Institute of Construction Technology']
      ].map(([type,name]) => ({type,name,country:'Nigeria'}));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      institutionCatalogPromise = fetch('https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json',{signal:controller.signal})
        .then(response => response.ok ? response.json() : [])
        .then(rows => nigerianDirectory.concat((Array.isArray(rows)?rows:[]).filter(row => row?.country && row?.name).map(row => ({type:'university',name:row.name,country:row.country}))))
        .catch(() => nigerianDirectory)
        .finally(() => clearTimeout(timeout));
    }
    institutionCatalogPromise.then(institutions => {
      const previousCountry = countrySelect?.value || 'Nigeria';
      if (countrySelect) {
        const countries = [...new Set(institutions.map(item => item.country).filter(Boolean))].sort((a,b) => a.localeCompare(b));
        countrySelect.replaceChildren(new Option('Choose country',''));
        countries.forEach(country => countrySelect.add(new Option(country,country)));
        countrySelect.value = countries.includes(previousCountry) ? previousCountry : (countries.includes('Nigeria') ? 'Nigeria' : '');
      }
      const refresh = () => {
        const type = typeSelect.value;
        const country = countrySelect?.value || '';
        schoolSelect.replaceChildren(new Option(type ? 'Choose a listed institution' : 'Choose institution type first',''));
        schoolSelect.disabled = !type || !country;
        if (!type || !country) return;
        const rows = institutions.filter(item => item.type === type && item.country === country)
          .sort((a,b) => a.name.localeCompare(b.name));
        rows.forEach(item => schoolSelect.add(new Option(item.name,item.name)));
        if (status) status.textContent = rows.length ? `${rows.length} listed ${type} options. The directory is curated for the Ibadan launch.` : 'No listed institution for this type is currently available.';
      };
      if (!typeSelect.dataset.catalogBound) { typeSelect.addEventListener('change', refresh); typeSelect.dataset.catalogBound='true'; }
      if (countrySelect && !countrySelect.dataset.catalogBound) { countrySelect.addEventListener('change', refresh); countrySelect.dataset.catalogBound='true'; }
      refresh();
    });
    if (status) status.textContent = 'Loading the approved institution directory...';
  }
  function setupStudentRegistration(form) {
    const statusSelect = form.elements.employment_status;
    const studentFields = form.querySelector('[data-student-fields]');
    if (!statusSelect || !studentFields) return;
    const studentInputs = ['institution_type', 'institution_country', 'institution_name', 'study_year']
      .map(name => form.elements[name]).filter(Boolean);
    const update = () => {
      const isStudent = statusSelect.value === 'student';
      studentFields.hidden = !isStudent;
      studentInputs.forEach(input => { input.required = isStudent; });
      if (isStudent) loadInstitutionCatalog(form);
    };
    statusSelect.addEventListener('change', update);
    update();
  }

  async function submitMembership(form) {
    const notice = form.querySelector('[data-notice]');
    const batch_id = form.batch_id.value;
    if (!batch_id) return CCD.setNotice(notice, 'Select an open batch.', 'error');
    const accepted = !!form.terms?.checked;
    if (!accepted) return CCD.setNotice(notice, 'You must accept the community rules and terms.', 'error');
    CCD.setNotice(notice, 'Submitting registration...', '');
    const wa = document.getElementById('waResult');
    const clearProgress = () => {
      if (!wa) return;
      wa.replaceChildren();
      wa.classList.remove('registration-bus-loading', 'is-visible');
    };
    if (wa) {
      wa.replaceChildren();
      wa.classList.add('is-visible', 'registration-bus-loading');
      const ride = document.createElement('div');
      ride.className = 'ibadan-bus-ride';
      ride.setAttribute('role', 'status');
      ride.setAttribute('aria-live', 'polite');
      ride.innerHTML = '<span class="ibadan-route">IBADAN &#8226; CCD COMMUNITY</span><span class="ibadan-bus" aria-hidden="true">&#128652;</span><span class="ibadan-road" aria-hidden="true"></span><strong>Getting your community welcome ready&#8230;</strong>';
      wa.appendChild(ride);
    }
    const { data: result, error } = await sb.rpc('register_batch_membership', {
      p_batch_id: batch_id,
      p_category: form.category.value,
      p_preferred_dev_category: form.preferred_dev_category?.value || null,
      p_technologies: form.technologies?.value || null,
      p_areas_of_interest: form.areas_of_interest?.value || null,
      p_why_join: form.why_join?.value || null,
      p_teamwork_experience: form.teamwork_experience?.value || null,
      p_availability: form.availability?.value || null,
      p_terms_accepted: accepted,
      p_employment_status: form.employment_status.value,
      p_institution_type: form.employment_status.value === 'student' ? form.institution_type.value : null,
      p_institution_name: form.employment_status.value === 'student' ? form.institution_name.value.trim() : null,
      p_institution_country: form.employment_status.value === 'student' ? form.institution_country.value.trim() : null,
      p_study_year: form.employment_status.value === 'student' ? form.study_year.value : null
    });
    if (error) {
      clearProgress();
      const message = error.message || '';
      const lowerMessage = message.toLowerCase();
      const friendly = lowerMessage.includes('duplicate key') ? 'You are already registered for this batch.'
        : lowerMessage.includes('whatsapp invite configured') ? 'Supabase is still using an older registration rule. Apply the updated supabase/auto_approve_memberships.sql script in the Supabase SQL Editor, then retry.'
        : lowerMessage.includes('registration is closed') ? 'Registration for this batch has closed.'
        : lowerMessage.includes('register_batch_membership') || lowerMessage.includes('permission denied for function')
          ? 'The registration database function is missing or outdated. Apply supabase/auto_approve_memberships.sql in Supabase, then retry.' : message;
      return CCD.setNotice(notice, friendly, 'error');
    }
    if (result?.status === 'full') {
      clearProgress();
      CCD.setNotice(notice, `This batch has reached its ${result.capacity}-member capacity.`, 'error');
      await loadBatches(form.batch_id);
      return;
    }
    const membershipId = result?.membership_id;
    if (!membershipId || result?.status !== 'active') {
      clearProgress();
      return CCD.setNotice(notice, 'Registration could not be completed. Please try again or contact the CCD team.', 'error');
    }
    const { data: delivery, error: notificationError } = await sb.functions.invoke('registration-email', { body: { membership_id: membershipId } });
    if (wa) await new Promise(resolve => setTimeout(resolve, 1800));
    let inviteUrl = safeHttpsUrl(delivery?.whatsapp_invite_url || '');
    if (!inviteUrl) {
      const { data: inviteResponse } = await sb.functions.invoke('membership', { body: { batch_id } });
      inviteUrl = safeHttpsUrl(inviteResponse?.whatsapp_invite_url || '');
    }
    CCD.setNotice(notice, notificationError
      ? 'You are approved. Your group invite is available on this page and in Notifications if delivery succeeds.'
      : 'You are approved and can join the batch WhatsApp group now.', notificationError ? 'error' : 'success');
    if (wa) {
      wa.replaceChildren();
      wa.classList.remove('registration-bus-loading');
      wa.classList.add('is-visible');
      const message = document.createElement('p');
      message.textContent = notificationError ? 'Your registration is active. Open Notifications or try refreshing to retrieve the group invite.' : 'Your registration is active.';
      wa.appendChild(message);
      if (inviteUrl) {
        const link = document.createElement('a');
        link.className = 'btn btn-primary btn-sm';
        link.href = inviteUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Join WhatsApp group';
        wa.appendChild(link);
      }
    }
    await loadMembershipState();
  }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  window.CCD.esc = esc;

  CCD.onReady(() => {
    loadOverview();
    const pf = document.querySelector('[data-profile-form]');
    if (pf) pf.addEventListener('submit', e => { e.preventDefault(); saveProfile(pf); });
    const bf = document.querySelector('[data-membership-form]');
    if (bf) { setupStudentRegistration(bf); loadBatches(bf.batch_id); bf.addEventListener('submit', e => { e.preventDefault(); submitMembership(bf).catch(error => { const wa = document.getElementById('waResult'); if (wa) { wa.replaceChildren(); wa.classList.remove('registration-bus-loading', 'is-visible'); } CCD.setNotice(bf.querySelector('[data-notice]'), error?.message || 'Registration could not be completed. Check your connection and try again.', 'error'); }); }); }
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
