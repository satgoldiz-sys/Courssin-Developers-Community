(async function(){
  const CCD=window.CCD;if(!CCD||!CCD.isConfigured())return;
  const sb=CCD.getSupabase();const {data:{session}}=await sb.auth.getSession();if(!session)return;
  const host=document.querySelector('[data-library-list]');const notice=document.querySelector('[data-library-notice]');
  const esc=CCD.esc||((s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  try{
    const {data:rows,error}=await sb.from('library_resources').select('id,title,description,category,resource_type,resource_url,storage_path,created_at').eq('active',true).order('category').order('title');
    if(error)throw error;
    const cards=await Promise.all((rows||[]).map(async item=>{
      let href=item.resource_url;
      if(item.resource_type==='file'&&item.storage_path){const {data,error:signedError}=await sb.storage.from('ccd-member-library').createSignedUrl(item.storage_path,3600);if(signedError)throw signedError;href=data.signedUrl;}
      return `<article class="card library-card"><span class="chip">${esc(item.category)}</span><h2>${esc(item.title)}</h2><p>${esc(item.description||'CCD learning resource')}</p><a class="btn btn-primary btn-sm" href="${esc(href||'#')}" target="_blank" rel="noopener noreferrer">Open resource</a></article>`;
    }));
    host.innerHTML=cards.join('')||'<article class="card"><h2>Library is getting ready</h2><p>New member resources will appear here.</p></article>';
  }catch(error){console.error('Member library failed to load',error);if(notice){notice.textContent='Library could not load. Your account must have an active batch membership.';notice.className='notice error';}host.innerHTML='';}
})();
