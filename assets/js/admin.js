(async function(){
  const CCD = window.CCD; if (!CCD || !CCD.isConfigured()) return;
  const sb = CCD.getSupabase();
  const { data: { session } } = await sb.auth.getSession(); if (!session) return;
  const A = CCD.admin || {};
  const esc = CCD.esc || (s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  async function count(table, filter) { let q = sb.from(table).select('*', { count: 'exact', head: true }); if (filter) q = filter(q); const { count } = await q; return count || 0; }
  const set = (id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;};
  try {
    set('mMembers', await count('profiles'));
    set('mMemberships', await count('memberships'));
    set('mBatches', await count('batches'));
    set('mTasks', await count('tasks'));
  } catch(e){}
  async function loadBatches(){
    const t = document.querySelector('#batchesTable tbody'); if(!t) return;
    const { data, error } = await sb.from('batches').select('*').order('year',{ascending:false}).order('name').limit(50);
    if(error){ t.innerHTML = `<tr><td colspan="6" class="muted">${esc(error.message)}</td></tr>`; return; }
    t.innerHTML = (data||[]).map(b=>`<tr><td>${esc(b.name)}</td><td>${esc(b.year)}</td><td><span class="status ${esc(b.status)}">${esc(b.status)}</span></td><td>${b.registration_open_date||', '}</td><td>${b.registration_close_date||', '}</td><td><button class="btn btn-secondary btn-sm" data-toggle-batch="${b.id}" data-open="${!b.is_registration_open}">${b.is_registration_open?'Close':'Open'}</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No batches yet.</td></tr>';
    t.querySelectorAll('[data-toggle-batch]').forEach(btn=>btn.addEventListener('click', async()=>{
      const { data, error } = await sb.functions.invoke('admin-secure', { body: { action: 'update', table: 'batches', record_id: btn.dataset.batch, payload: { is_registration_open: btn.dataset.open==='true', status: btn.dataset.open==='true'?'registration_open':'registration_closed' } } });
      if (error) alert(error.message); else loadBatches();
    }));
  }
  async function saveBatch(form){
    const notice=form.querySelector('[data-notice]');
    const payload={ name:form.name.value.trim(), year:+form.year.value, description:form.description.value, registration_open_date:form.registration_open_date.value||null, registration_close_date:form.registration_close_date.value||null, start_date:form.start_date.value||null, end_date:form.end_date.value||null, status:form.status.value, is_registration_open:form.is_registration_open.checked };
    CCD.setNotice(notice,'Saving...','');
    const { data, error } = await sb.functions.invoke('admin-secure', { body: { action: 'insert', table: 'batches', payload } });
    CCD.setNotice(notice, error?error.message:'Batch saved.', error?'error':'success');
    if (!error) { form.reset(); loadBatches(); }
  }
  CCD.onReady(()=>{
    loadBatches();
    const f=document.querySelector('[data-batch-form]'); if(f) f.addEventListener('submit',e=>{e.preventDefault();saveBatch(f);});
  });
})();
