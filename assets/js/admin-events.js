/* Admin-only events, organizers and volunteer positions. RLS and the Edge Function recheck every write. */
(async function () {
  const CCD = window.CCD;
  const A = CCD && CCD.admin;
  if (!A || !A.requireSession) return;
  const session = await A.requireSession();
  if (!session) return;
  const sb = A.sb();
  const esc = A.esc;
  const eventForm = document.querySelector('[data-event-form]');
  const organizerForm = document.querySelector('[data-organizer-form]');
  const volunteerForm = document.querySelector('[data-volunteer-form]');
  const peopleSection = document.querySelector('[data-event-people]');
  let events = [];
  let batches = [];
  let currentEvent = null;
  let currentOrganizer = null;

  function notice(message, type = "") {
    A.setNotice(document.querySelector('[data-dashboard-notice]'), message, type);
  }

  async function invoke(action, table, recordId, payload) {
    const { data, error } = await sb.functions.invoke("admin-secure", {
      body: { action, table, ...(recordId ? { record_id: recordId } : {}), ...(payload ? { payload } : {}) }
    });
    if (error || data?.error) {
      notice(data?.error || error?.message || "The operation could not be completed.", "error");
      return null;
    }
    return data?.data ?? data;
  }

  function localDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function resetEventForm() {
    eventForm.reset();
    eventForm.elements.namedItem("id").value = "";
    document.querySelector("[data-event-form-title]").textContent = "Create an event";
    document.querySelector("[data-event-image-current]").textContent = "";
  }

  async function loadEvents() {
    const tbody = document.querySelector("[data-events-table]");
    const { data, error } = await sb.from("events")
      .select("id,title,event_type,event_date,venue,description,image_url,status")
      .order("event_date", { ascending: false }).limit(200);
    if (error) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Could not load events. Apply the security_hardening.sql migration.</td></tr>';
      return;
    }
    events = data || [];
    tbody.innerHTML = events.length ? events.map((event) => `
      <tr>
        <td><strong>${esc(event.title)}</strong><div class="muted">${esc(event.event_type || event.venue || "")}</div></td>
        <td>${event.event_date ? esc(new Date(event.event_date).toLocaleString()) : "—"}</td>
        <td><span class="status ${esc(event.status)}">${esc(event.status)}</span></td>
        <td><div class="toolbar"><button class="btn btn-secondary btn-sm" data-edit-event="${esc(event.id)}">Edit</button><button class="btn btn-secondary btn-sm" data-manage-event="${esc(event.id)}">Team & volunteers</button><button class="btn btn-secondary btn-sm" data-toggle-event="${esc(event.id)}">${event.status === "published" ? "Archive" : "Publish"}</button></div></td>
      </tr>`).join("") : '<tr><td colspan="4" class="muted">No events yet. Create one above.</td></tr>';

    tbody.querySelectorAll("[data-edit-event]").forEach((button) => button.addEventListener("click", () => {
      const event = events.find((row) => row.id === button.dataset.editEvent);
      if (!event) return;
      eventForm.elements.namedItem("id").value = event.id;
      eventForm.elements.namedItem("title").value = event.title || "";
      eventForm.elements.namedItem("event_type").value = event.event_type || "";
      eventForm.elements.namedItem("event_date").value = localDate(event.event_date);
      eventForm.elements.namedItem("venue").value = event.venue || "";
      eventForm.elements.namedItem("description").value = event.description || "";
      eventForm.elements.namedItem("status").value = event.status || "draft";
      eventForm.elements.namedItem("image").value = "";
      document.querySelector("[data-event-image-current]").textContent = event.image_url ? "Current cover image is set. Upload a new file to replace it." : "";
      document.querySelector("[data-event-form-title]").textContent = "Edit event";
      eventForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    tbody.querySelectorAll("[data-manage-event]").forEach((button) => button.addEventListener("click", () => openEventTeam(button.dataset.manageEvent)));
    tbody.querySelectorAll("[data-toggle-event]").forEach((button) => button.addEventListener("click", async () => {
      const event = events.find((row) => row.id === button.dataset.toggleEvent);
      if (!event) return;
      const status = event.status === "published" ? "archived" : "published";
      if (await invoke("update", "events", event.id, { status })) {
        notice(status === "published" ? "Event published." : "Event archived.", "success");
        loadEvents();
      }
    }));
  }

  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = eventForm.elements.namedItem("id").value;
    const previous = events.find((row) => row.id === id);
    const file = eventForm.elements.namedItem("image").files[0];
    const save = eventForm.querySelector('[type="submit"]');
    save.disabled = true;
    try {
      const uploaded = file ? await CCD.uploadPublicMedia(file, "events/covers", true) : null;
      const rawDate = eventForm.elements.namedItem("event_date").value;
      const payload = {
        title: eventForm.elements.namedItem("title").value.trim(),
        event_type: eventForm.elements.namedItem("event_type").value.trim() || null,
        event_date: rawDate ? new Date(rawDate).toISOString() : null,
        venue: eventForm.elements.namedItem("venue").value.trim() || null,
        description: eventForm.elements.namedItem("description").value.trim() || null,
        image_url: uploaded?.public_url || previous?.image_url || null,
        status: eventForm.elements.namedItem("status").value,
      };
      const result = await invoke(id ? "update" : "insert", "events", id, payload);
      if (result) {
        notice("Event saved.", "success");
        resetEventForm();
        await loadEvents();
      }
    } catch (error) {
      notice(error.message || "Could not upload the event image.", "error");
    } finally { save.disabled = false; }
  });
  document.querySelector("[data-event-reset]").addEventListener("click", resetEventForm);

  async function openEventTeam(eventId) {
    currentEvent = events.find((row) => row.id === eventId);
    if (!currentEvent) return;
    peopleSection.hidden = false;
    document.querySelector("[data-selected-event-title]").textContent = `${currentEvent.title}: organizers & volunteers`;
    organizerForm.reset(); volunteerForm.reset();
    organizerForm.elements.namedItem("event_id").value = eventId;
    volunteerForm.elements.namedItem("event_id").value = eventId;
    currentOrganizer = null;
    document.querySelector("[data-organizer-form-title]").textContent = "Add an organizer";
    if (!batches.length) {
      const { data } = await sb.from("batches").select("id,name,year").order("year", { ascending: false });
      batches = data || [];
      const select = organizerForm.elements.namedItem("batch_id");
      select.innerHTML = '<option value="">Select batch</option>' + batches.map((batch) => `<option value="${esc(batch.id)}">${esc(batch.name)} ${esc(batch.year)}</option>`).join("");
    }
    await Promise.all([loadOrganizers(eventId), loadVolunteers(eventId)]);
    peopleSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadOrganizers(eventId) {
    const tbody = document.querySelector("[data-organizers-table]");
    const { data, error } = await sb.from("event_organizers")
      .select("id,full_name,image_url,batch_id,batch_position,volunteer_position,sort_order,batches(name,year)")
      .eq("event_id", eventId).order("sort_order");
    if (error) { tbody.innerHTML = '<tr><td colspan="4" class="muted">Could not load organizers.</td></tr>'; return; }
    tbody.innerHTML = data?.length ? data.map((person) => `
      <tr><td><strong>${esc(person.full_name)}</strong><div class="muted">${esc(person.batches ? `${person.batches.name} ${person.batches.year}` : "")}</div></td>
      <td>${esc(person.batch_position)}</td><td>${esc(person.volunteer_position || "—")}</td>
      <td><div class="toolbar"><button class="btn btn-secondary btn-sm" data-edit-organizer="${esc(person.id)}">Edit</button><button class="btn btn-secondary btn-sm" data-delete-organizer="${esc(person.id)}">Remove</button></div></td></tr>`).join("") : '<tr><td colspan="4" class="muted">No organizers added yet.</td></tr>';
    tbody.querySelectorAll("[data-edit-organizer]").forEach((button) => button.addEventListener("click", () => {
      const person = data.find((row) => row.id === button.dataset.editOrganizer);
      if (!person) return;
      currentOrganizer = person;
      organizerForm.elements.namedItem("id").value = person.id;
      organizerForm.elements.namedItem("event_id").value = eventId;
      organizerForm.elements.namedItem("full_name").value = person.full_name || "";
      organizerForm.elements.namedItem("batch_id").value = person.batch_id || "";
      organizerForm.elements.namedItem("batch_position").value = person.batch_position || "";
      organizerForm.elements.namedItem("volunteer_position").value = person.volunteer_position || "";
      organizerForm.elements.namedItem("image").value = "";
      document.querySelector("[data-organizer-form-title]").textContent = "Edit organizer";
      organizerForm.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    tbody.querySelectorAll("[data-delete-organizer]").forEach((button) => button.addEventListener("click", async () => {
      if (await invoke("delete", "event_organizers", button.dataset.deleteOrganizer)) loadOrganizers(eventId);
    }));
  }

  organizerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = organizerForm.elements.namedItem("id").value;
    const file = organizerForm.elements.namedItem("image").files[0];
    const button = organizerForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const uploaded = file ? await CCD.uploadPublicMedia(file, "events/organizers", true) : null;
      const batchId = organizerForm.elements.namedItem("batch_id").value;
      const payload = {
        event_id: currentEvent.id,
        full_name: organizerForm.elements.namedItem("full_name").value.trim(),
        image_url: uploaded?.public_url || currentOrganizer?.image_url || null,
        batch_id: batchId || null,
        batch_position: organizerForm.elements.namedItem("batch_position").value.trim(),
        volunteer_position: organizerForm.elements.namedItem("volunteer_position").value.trim() || null,
        sort_order: 0,
      };
      if (await invoke(id ? "update" : "insert", "event_organizers", id, payload)) {
        organizerForm.reset();
        organizerForm.elements.namedItem("event_id").value = currentEvent.id;
        organizerForm.elements.namedItem("id").value = "";
        currentOrganizer = null;
        document.querySelector("[data-organizer-form-title]").textContent = "Add an organizer";
        await loadOrganizers(currentEvent.id);
        notice("Organizer saved.", "success");
      }
    } catch (error) { notice(error.message || "Could not upload the organizer image.", "error"); }
    finally { button.disabled = false; }
  });
  document.querySelector("[data-organizer-reset]").addEventListener("click", () => {
    organizerForm.reset();
    organizerForm.elements.namedItem("event_id").value = currentEvent?.id || "";
    organizerForm.elements.namedItem("id").value = "";
    currentOrganizer = null;
    document.querySelector("[data-organizer-form-title]").textContent = "Add an organizer";
  });

  async function loadVolunteers(eventId) {
    const tbody = document.querySelector("[data-volunteers-table]");
    const { data, error } = await sb.from("event_volunteer_positions")
      .select("id,title,description,slots,status").eq("event_id", eventId).order("created_at", { ascending: false });
    if (error) { tbody.innerHTML = '<tr><td colspan="4" class="muted">Could not load volunteer positions.</td></tr>'; return; }
    tbody.innerHTML = data?.length ? data.map((position) => `
      <tr><td><strong>${esc(position.title)}</strong><div class="muted">${esc(position.description || "")}</div></td>
      <td>${esc(position.slots)}</td><td><span class="status ${esc(position.status)}">${esc(position.status)}</span></td>
      <td><button class="btn btn-secondary btn-sm" data-delete-volunteer="${esc(position.id)}">Remove</button></td></tr>`).join("") : '<tr><td colspan="4" class="muted">No volunteer positions added yet.</td></tr>';
    tbody.querySelectorAll("[data-delete-volunteer]").forEach((button) => button.addEventListener("click", async () => {
      if (await invoke("delete", "event_volunteer_positions", button.dataset.deleteVolunteer)) loadVolunteers(eventId);
    }));
  }

  volunteerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = volunteerForm.querySelector('[type="submit"]');
    button.disabled = true;
    const payload = {
      event_id: currentEvent.id,
      title: volunteerForm.elements.namedItem("title").value.trim(),
      description: volunteerForm.elements.namedItem("description").value.trim() || null,
      slots: Number(volunteerForm.elements.namedItem("slots").value),
      status: volunteerForm.elements.namedItem("status").value,
    };
    if (await invoke("insert", "event_volunteer_positions", null, payload)) {
      volunteerForm.reset();
      volunteerForm.elements.namedItem("event_id").value = currentEvent.id;
      await loadVolunteers(currentEvent.id);
      notice("Volunteer position saved.", "success");
    }
    button.disabled = false;
  });

  loadEvents();
})();
