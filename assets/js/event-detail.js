/* Published event details are readable only through the public-content RLS policies. */
(async function () {
  const cfg = window.CCD_CONFIG || {};
  const root = document.querySelector('[data-event-detail]');
  if (!root) return;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const safeImage = (value) => {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
    catch { return ''; }
  };
  const params = new URLSearchParams(location.search);
  const sampleKey = params.get('sample');
  if (sampleKey) {
    const sample = (window.CCD_SAMPLE_EVENTS || []).find((item) => item.key === sampleKey);
    if (!sample) return showMissing();
    document.querySelector('[data-event-title]').textContent = sample.title;
    document.querySelector('[data-event-type]').textContent = sample.type;
    document.querySelector('[data-event-meta]').textContent = `${sample.date} | ${sample.location}`;
    document.title = `${sample.title} | CCD Events`;
    root.innerHTML = `<article class="event-detail-card"><img class="event-detail-cover" src="assets/images/${esc(sample.image)}" alt="${esc(sample.title)}" loading="lazy"><div class="event-detail-copy"><span class="chip chip-accent">${esc(sample.type)}</span><h2>About this event</h2><p class="event-detail-description">${esc(sample.desc)}</p><div class="event-facts"><div><small>Date and time</small><strong>${esc(sample.date)}</strong></div><div><small>Location</small><strong>${esc(sample.location)}</strong></div></div></div></article><section class="event-detail-section"><div class="card"><h2>Organizers and volunteer opportunities</h2><p class="muted">Organizer and volunteer details will be announced when this event is published by the CCD team.</p></div></section><a class="btn btn-secondary" href="events">Back to all events</a>`;
    return;
  }
  const eventId = params.get('id');
  if (!eventId) return showMissing();
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    root.innerHTML = '<div class="card event-not-found"><h2>Event details are unavailable right now.</h2><a class="btn btn-primary" href="events">Browse events</a></div>';
    return;
  }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let event;
  let error;
  try {
    ({ data: event, error } = await sb.from('events')
      .select('id,title,description,event_type,event_date,venue,image_url,event_organizers(full_name,image_url,batch_position,volunteer_position,batches(name,year)),event_volunteer_positions(title,description,slots,status)')
      .eq('id', eventId).eq('status', 'published').maybeSingle());
  } catch {
    return showMissing();
  }
  if (error || !event) return showMissing();

  const title = document.querySelector('[data-event-title]');
  const type = document.querySelector('[data-event-type]');
  const meta = document.querySelector('[data-event-meta]');
  if (title) title.textContent = event.title;
  if (type) type.textContent = event.event_type || 'CCD Event';
  if (meta) meta.textContent = [event.event_date ? new Date(event.event_date).toLocaleString() : 'Date to be announced', event.venue].filter(Boolean).join(' | ');
  document.title = `${event.title} | CCD Events`;

  const image = safeImage(event.image_url);
  const organizers = (event.event_organizers || []).map((person) => {
    const photo = safeImage(person.image_url);
    const batch = person.batches ? `${person.batches.name} ${person.batches.year}` : '';
    return `<article class="event-organizer-card">
      ${photo ? `<img src="${esc(photo)}" alt="${esc(person.full_name)}" loading="lazy">` : '<div class="event-organizer-placeholder" aria-hidden="true">CCD</div>'}
      <div><h3>${esc(person.full_name)}</h3><p class="event-organizer-position">${esc(person.batch_position)}</p>${batch ? `<p class="muted">${esc(batch)}</p>` : ''}${person.volunteer_position ? `<span class="chip">${esc(person.volunteer_position)}</span>` : ''}</div>
    </article>`;
  }).join('');
  const volunteerPositions = event.event_volunteer_positions || [];
  const volunteers = volunteerPositions.length ? volunteerPositions.map((position) => `
    <article class="event-volunteer-card"><div><h3>${esc(position.title)}</h3><p class="muted">${esc(position.description || 'Help make this event happen.')}</p></div>
      <span class="status ${esc(position.status)}">${position.status === 'open' ? `${esc(position.slots)} open` : 'Closed'}</span></article>`).join('') : '<p class="muted">Volunteer opportunities have not been posted yet.</p>';

  root.innerHTML = `<article class="event-detail-card">
    ${image ? `<img class="event-detail-cover" src="${esc(image)}" alt="${esc(event.title)}" loading="lazy">` : ''}
    <div class="event-detail-copy"><span class="chip chip-accent">${esc(event.event_type || 'CCD Event')}</span><h2>About this event</h2><p class="event-detail-description">${esc(event.description || 'More event information will be shared soon.')}</p>
      <div class="event-facts"><div><small>Date and time</small><strong>${event.event_date ? esc(new Date(event.event_date).toLocaleString()) : 'To be announced'}</strong></div><div><small>Location</small><strong>${esc(event.venue || 'To be announced')}</strong></div></div>
    </div>
  </article>
  <section class="event-detail-section"><div class="section-heading"><div><span class="chip">The people behind it</span><h2>Event organizers</h2><p class="muted">Meet the team coordinating this event.</p></div></div>
    ${organizers ? `<div class="event-organizers-grid">${organizers}</div>` : '<div class="card"><p class="muted">Organizer details will be announced soon.</p></div>'}
  </section>
  <section class="event-detail-section"><div class="section-heading"><div><span class="chip chip-accent">Get involved</span><h2>Volunteer opportunities</h2><p class="muted">Roles and availability for this event.</p></div></div>
    <div class="event-volunteer-list">${volunteers}</div>
  </section>
  <a class="btn btn-secondary" href="events">Back to all events</a>`;

  function showMissing() {
    root.innerHTML = '<div class="card event-not-found"><span class="chip">Event unavailable</span><h2>We couldnâ€™t find this event.</h2><p class="muted">It may be unpublished or the link may have expired.</p><a class="btn btn-primary" href="events">Browse events</a></div>';
  }
})();
