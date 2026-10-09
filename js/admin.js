(function () {
  const S = window.MangoStore;
  const U = window.MangoUI;
  const { $, $$, esc } = U;
  let data = S.load();
  const money = (v) => S.money(v, data.settings.currency);

  function persist(msg) {
    const ok = S.save(data);
    if (ok) toast(msg || 'Guardado ✅');
    return ok;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2200);
  }

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const csv = (rows) => '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const isUrl = (u) => /^https?:\/\//.test(u);

  /* ---------- Login ----------
     Nota: es una protección básica del lado del navegador. Al pasar a
     producción el acceso debe validarse en el servidor. */
  const SESSION = 'me_admin_ok';
  function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    showTab('dashboard');
  }
  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#pin').value === String(data.settings.adminPin)) {
      sessionStorage.setItem(SESSION, '1');
      showApp();
    } else {
      $('#pin').value = '';
      $('#pin').classList.add('shake');
      setTimeout(() => $('#pin').classList.remove('shake'), 500);
      toast('PIN incorrecto');
    }
  });
  $('#logout').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION);
    location.reload();
  });

  /* ---------- Navegación ---------- */
  const RENDER = {
    dashboard: renderDashboard,
    eventos: renderEvents,
    editor: () => {},
    patrocinadores: renderSponsors,
    reservas: renderReservations,
    suscriptores: renderSubscribers,
    contenido: renderContent,
    ajustes: renderSettings,
  };
  function showTab(tab) {
    data = { ...data, reservations: S.load().reservations, subscribers: S.load().subscribers }; // trae lo nuevo de la web
    $('#sideBrand').textContent = data.settings.brand;
    const navTab = tab === 'editor' ? 'eventos' : tab;
    $$('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === navTab));
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
    RENDER[tab]();
    window.scrollTo(0, 0);
  }
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  /* ---------- Resumen ---------- */
  function renderDashboard() {
    const active = data.reservations.filter((r) => r.status !== 'cancelada');
    const paid = active.filter((r) => r.status === 'pagada');
    const stats = [
      ['Eventos publicados', data.events.filter((e) => e.status !== 'borrador').length, '🎪'],
      ['Reservas activas', active.length, '📋'],
      ['Boletas reservadas', active.reduce((n, r) => n + Number(r.qty), 0), '🎟️'],
      ['Ingresos confirmados', money(paid.reduce((n, r) => n + r.total, 0)), '💰'],
      ['Por confirmar', money(active.filter((r) => r.status === 'pendiente').reduce((n, r) => n + r.total, 0)), '⏳'],
      ['Suscriptores', (data.subscribers || []).length, '📬'],
    ];
    $('#stats').innerHTML = stats.map(([l, v, i]) => `<div class="stat"><span>${i}</span><b>${esc(v)}</b><small>${l}</small></div>`).join('');
    $('#stockBars').innerHTML =
      data.events
        .map((ev) => {
          const stock = ev.tickets.reduce((n, t) => n + Number(t.stock), 0);
          const sold = ev.tickets.reduce((n, t) => n + S.sold(data, t.id), 0);
          const pct = stock ? Math.min(100, Math.round((sold / stock) * 100)) : 0;
          return `<div class="bar"><div class="bar-label"><b>${esc(ev.title)}</b><span>${sold} / ${stock} boletas (${pct}%)</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
        })
        .join('') || '<p class="muted">Aún no hay eventos.</p>';
  }

  /* ---------- Lista de eventos ---------- */
  const STATUS_LABEL = { publicado: 'Publicado', borrador: 'Borrador', agotado: 'Agotado' };
  function renderEvents() {
    const list = [...data.events].sort((a, b) => new Date(a.date) - new Date(b.date));
    $('#evList').innerHTML =
      list
        .map((ev) => {
          const sold = ev.tickets.reduce((n, t) => n + S.sold(data, t.id), 0);
          const stock = ev.tickets.reduce((n, t) => n + Number(t.stock), 0);
          return `<article class="ev-row">
            <div class="ev-thumb" style="background-image:url('${esc(ev.mainImage)}')"></div>
            <div class="ev-row-info">
              <b>${esc(ev.title)}</b>
              <span class="tag tag-${ev.status}">${STATUS_LABEL[ev.status] || ev.status}</span>
              ${ev.featured ? '<span class="tag tag-hero">⭐ Destacado</span>' : ''}
              <div class="muted small">${U.fmtDate(ev.date)} · ${esc(ev.venue)}, ${esc(ev.city)}</div>
              <div class="muted small">${sold} de ${stock} boletas reservadas · ${ev.tickets.length} tipos de boleta</div>
            </div>
            <div class="row-actions">
              <a class="icon-btn" href="${U.eventUrl(ev)}" target="_blank" title="Ver">👀</a>
              <button class="icon-btn" data-ev-dup="${esc(ev.id)}" title="Duplicar">⧉</button>
              <button class="btn btn-primary btn-sm" data-ev-edit="${esc(ev.id)}">Editar</button>
              <button class="icon-btn danger" data-ev-del="${esc(ev.id)}" title="Eliminar">🗑️</button>
            </div>
          </article>`;
        })
        .join('') || '<div class="card muted">No hay eventos. ¡Crea el primero!</div>';
  }

  $('#evNew').addEventListener('click', () => openEditor(null));
  $('#evList').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-ev-edit]');
    const dup = e.target.closest('[data-ev-dup]');
    const del = e.target.closest('[data-ev-del]');
    if (ed) return openEditor(ed.dataset.evEdit);
    if (dup) {
      const copy = JSON.parse(JSON.stringify(data.events.find((x) => x.id === dup.dataset.evDup)));
      copy.id = S.uid();
      copy.title += ' (copia)';
      copy.status = 'borrador';
      copy.featured = false;
      copy.tickets.forEach((t) => (t.id = S.uid()));
      data.events.push(copy);
      persist('Evento duplicado como borrador');
      return renderEvents();
    }
    if (del) {
      const ev = data.events.find((x) => x.id === del.dataset.evDel);
      if (!confirm(`¿Eliminar "${ev.title}"? Las reservas existentes se conservan en el historial.`)) return;
      data.events = data.events.filter((x) => x.id !== ev.id);
      persist('Evento eliminado');
      renderEvents();
    }
  });

  /* ---------- Editor de evento ---------- */
  let draft = null;
  const FIELDS = ['title', 'tagline', 'description', 'category', 'status', 'ageLimit', 'date', 'doors', 'venue', 'address', 'city'];

  function blankEvent() {
    const d = new Date(Date.now() + 30 * 864e5);
    d.setHours(19, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      id: '',
      title: '',
      tagline: '',
      description: '',
      category: (data.settings.categories || [])[0] || '',
      status: 'borrador',
      ageLimit: 'Todo público',
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`,
      doors: '18:00',
      venue: '',
      address: '',
      city: '',
      featured: false,
      mainImage: '',
      gallery: [],
      agenda: [],
      tickets: [{ id: S.uid(), name: 'General', price: 50000, stock: 100, perks: '', badge: '' }],
    };
  }

  function openEditor(id) {
    const ev = data.events.find((x) => x.id === id);
    draft = JSON.parse(JSON.stringify(ev || blankEvent()));
    $('#edTitle').textContent = ev ? `Editar: ${ev.title}` : 'Nuevo evento';
    $('#edPreview').hidden = !ev;
    if (ev) $('#edPreview').href = U.eventUrl(ev);
    $('#edCategory').innerHTML = [...new Set([...(data.settings.categories || []), draft.category].filter(Boolean))]
      .map((c) => `<option>${esc(c)}</option>`)
      .join('');
    const f = $('#edForm');
    FIELDS.forEach((k) => (f[k].value = draft[k] || ''));
    f.featured.checked = !!draft.featured;
    renderEditorImages();
    renderEditorTickets();
    renderEditorAgenda();
    showTab('editor');
  }

  function renderEditorImages() {
    const prev = $('#edMainPreview');
    prev.style.backgroundImage = draft.mainImage ? `url("${draft.mainImage}")` : '';
    prev.textContent = draft.mainImage ? '' : 'Sin imagen principal';
    $('#edGallery').innerHTML =
      draft.gallery
        .map(
          (src, i) => `<div class="thumb">
            <img src="${esc(src)}" alt="" />
            <div class="thumb-actions">
              <button type="button" data-gal-move="${i}" data-dir="-1" title="Mover antes">◀</button>
              <button type="button" data-gal-main="${i}" title="Usar como principal">⭐</button>
              <button type="button" data-gal-del="${i}" title="Eliminar">🗑️</button>
              <button type="button" data-gal-move="${i}" data-dir="1" title="Mover después">▶</button>
            </div>
          </div>`
        )
        .join('') || '<p class="muted small">Sin imágenes secundarias.</p>';
  }

  // lee lo escrito en las filas antes de volver a pintarlas
  function syncRows() {
    $$('#edTickets [data-row]').forEach((row, i) => {
      const t = draft.tickets[i];
      t.name = $('[name=tName]', row).value.trim();
      t.price = Number($('[name=tPrice]', row).value) || 0;
      t.stock = Number($('[name=tStock]', row).value) || 0;
      t.badge = $('[name=tBadge]', row).value.trim();
      t.perks = $('[name=tPerks]', row).value;
    });
    $$('#edAgenda [data-row]').forEach((row, i) => {
      const a = draft.agenda[i];
      a.time = $('[name=aTime]', row).value;
      a.title = $('[name=aTitle]', row).value.trim();
      a.text = $('[name=aText]', row).value.trim();
    });
  }

  function renderEditorTickets() {
    $('#edTickets').innerHTML = draft.tickets
      .map((t, i) => {
        const sold = S.sold(data, t.id);
        return `<div class="edit-row ticket-row" data-row>
          <label>Nombre<input name="tName" value="${esc(t.name)}" placeholder="General, VIP…" /></label>
          <label>Precio<input name="tPrice" type="number" min="0" step="1000" value="${t.price}" /></label>
          <label>Cupos<input name="tStock" type="number" min="0" value="${t.stock}" /></label>
          <label>Etiqueta<input name="tBadge" value="${esc(t.badge)}" placeholder="Más vendida" /></label>
          <label class="full">Beneficios (uno por línea)<textarea name="tPerks" rows="2">${esc(t.perks)}</textarea></label>
          <div class="row-foot"><span class="muted small">${sold} reservadas</span><button type="button" class="icon-btn danger" data-del-ticket="${i}" title="Eliminar">🗑️</button></div>
        </div>`;
      })
      .join('');
  }

  function renderEditorAgenda() {
    $('#edAgenda').innerHTML =
      draft.agenda
        .map(
          (a, i) => `<div class="edit-row agenda-row" data-row>
            <label>Hora<input name="aTime" type="time" value="${esc(a.time)}" /></label>
            <label>Actividad<input name="aTitle" value="${esc(a.title)}" /></label>
            <label>Detalle<input name="aText" value="${esc(a.text)}" /></label>
            <button type="button" class="icon-btn danger" data-del-agenda="${i}" title="Eliminar">🗑️</button>
          </div>`
        )
        .join('') || '<p class="muted small">Sin agenda. Es opcional.</p>';
  }

  $('#edAddTicket').addEventListener('click', () => {
    syncRows();
    draft.tickets.push({ id: S.uid(), name: '', price: 0, stock: 100, perks: '', badge: '' });
    renderEditorTickets();
  });
  $('#edTickets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-ticket]');
    if (!b) return;
    syncRows();
    const t = draft.tickets[Number(b.dataset.delTicket)];
    if (S.sold(data, t.id) && !confirm('Esta boleta ya tiene reservas. ¿Eliminarla de todas formas?')) return;
    draft.tickets.splice(Number(b.dataset.delTicket), 1);
    renderEditorTickets();
  });
  $('#edAddAgenda').addEventListener('click', () => {
    syncRows();
    draft.agenda.push({ time: '', title: '', text: '' });
    renderEditorAgenda();
  });
  $('#edAgenda').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-agenda]');
    if (!b) return;
    syncRows();
    draft.agenda.splice(Number(b.dataset.delAgenda), 1);
    renderEditorAgenda();
  });

  $('#edMainFile').addEventListener('change', async (e) => {
    if (!e.target.files[0]) return;
    draft.mainImage = await S.fileToDataUrl(e.target.files[0], { maxSize: 1920 });
    renderEditorImages();
    e.target.value = '';
  });
  $('#edMainUrlBtn').addEventListener('click', () => {
    const u = $('#edMainUrl').value.trim();
    if (!isUrl(u)) return toast('Ingresa una URL válida (https://…)');
    draft.mainImage = u;
    $('#edMainUrl').value = '';
    renderEditorImages();
  });
  $('#edGalFile').addEventListener('change', async (e) => {
    for (const file of e.target.files) draft.gallery.push(await S.fileToDataUrl(file, { maxSize: 1200 }));
    renderEditorImages();
    e.target.value = '';
  });
  $('#edGalUrlBtn').addEventListener('click', () => {
    const u = $('#edGalUrl').value.trim();
    if (!isUrl(u)) return toast('Ingresa una URL válida (https://…)');
    draft.gallery.push(u);
    $('#edGalUrl').value = '';
    renderEditorImages();
  });
  $('#edGallery').addEventListener('click', (e) => {
    const g = draft.gallery;
    const del = e.target.closest('[data-gal-del]');
    const move = e.target.closest('[data-gal-move]');
    const main = e.target.closest('[data-gal-main]');
    if (del) g.splice(Number(del.dataset.galDel), 1);
    else if (move) {
      const i = Number(move.dataset.galMove);
      const j = i + Number(move.dataset.dir);
      if (j < 0 || j >= g.length) return;
      [g[i], g[j]] = [g[j], g[i]];
    } else if (main) draft.mainImage = g[Number(main.dataset.galMain)];
    else return;
    renderEditorImages();
  });

  $('#edBack').addEventListener('click', () => showTab('eventos'));
  $('#edSave').addEventListener('click', () => {
    const f = $('#edForm');
    if (!f.reportValidity()) return;
    syncRows();
    FIELDS.forEach((k) => (draft[k] = f[k].value.trim()));
    draft.featured = f.featured.checked;
    draft.tickets = draft.tickets.filter((t) => t.name);
    draft.agenda = draft.agenda.filter((a) => a.title);
    if (!draft.tickets.length) return toast('Agrega al menos un tipo de boleta');
    const isNew = !draft.id;
    if (isNew) draft.id = S.uid();
    const idx = data.events.findIndex((x) => x.id === draft.id);
    if (idx >= 0) data.events[idx] = draft;
    else data.events.push(draft);
    if (!persist(isNew ? 'Evento creado ✅' : 'Evento guardado ✅')) return;
    openEditor(draft.id);
  });

  /* ---------- Patrocinadores ---------- */
  const TIERS = { oro: '🥇 Oro', plata: '🥈 Plata', bronce: '🥉 Aliado' };
  const linkKind = (u) => {
    const m = /instagram|facebook|tiktok|linkedin|youtube|wa\.me|whatsapp|twitter|x\.com/i.exec(u || '');
    return m ? m[0].replace('wa.me', 'whatsapp').replace('x.com', 'X') : 'web';
  };

  function renderSponsors() {
    $('#spList').innerHTML =
      data.sponsors
        .map(
          (s, i) => `<article class="sp-row">
            <div class="sp-logo"><img src="${esc(s.logo)}" alt="" /></div>
            <div class="sp-info">
              <b>${esc(s.name)}</b>
              <span class="tag tag-${s.tier}">${TIERS[s.tier] || s.tier}</span>
              ${s.inHero ? '<span class="tag tag-hero">En banner</span>' : ''}
              <a href="${esc(s.url)}" target="_blank" rel="noopener" class="muted small">🔗 ${esc(linkKind(s.url))} · ${esc(s.url)}</a>
            </div>
            <div class="row-actions">
              <button class="icon-btn" data-sp-move="${i}" data-dir="-1" title="Subir">▲</button>
              <button class="icon-btn" data-sp-move="${i}" data-dir="1" title="Bajar">▼</button>
              <button class="btn btn-primary btn-sm" data-sp-edit="${esc(s.id)}">Editar</button>
              <button class="icon-btn danger" data-sp-del="${esc(s.id)}" title="Eliminar">🗑️</button>
            </div>
          </article>`
        )
        .join('') || '<div class="card muted">Aún no hay patrocinadores. ¡Agrega el primero!</div>';
  }

  function editSponsor(id) {
    const s = data.sponsors.find((x) => x.id === id) || { id: '', name: '', logo: '', url: '', tier: 'oro', inHero: true };
    let logo = s.logo;
    const body = U.openModal(`
      <h2>${s.id ? 'Editar' : 'Nuevo'} patrocinador</h2>
      <form class="form" id="spForm">
        <label>Nombre<input name="name" value="${esc(s.name)}" required /></label>
        <label>Enlace al hacer clic en el logo (web, Instagram, Facebook, TikTok, WhatsApp…)
          <input name="url" type="url" value="${esc(s.url)}" placeholder="https://instagram.com/marca" required /></label>
        <div class="logo-edit">
          <div class="sp-logo big" id="spLogoPrev">${logo ? `<img src="${esc(logo)}" alt="" />` : 'Sin logo'}</div>
          <div class="logo-edit-actions">
            <label class="btn btn-primary btn-sm file-btn">📤 Subir logo (PNG/SVG/JPG)<input type="file" accept="image/*" id="spLogoFile" hidden /></label>
            <input type="url" id="spLogoUrl" placeholder="…o URL del logo" />
            <p class="muted small">Ideal: PNG con fondo transparente, horizontal.</p>
          </div>
        </div>
        <div class="row">
          <label>Categoría<select name="tier">${Object.entries(TIERS)
            .map(([k, v]) => `<option value="${k}" ${s.tier === k ? 'selected' : ''}>${v}</option>`)
            .join('')}</select></label>
          <label class="check toggle"><input type="checkbox" name="inHero" ${s.inHero ? 'checked' : ''} /> Mostrar en el banner principal</label>
        </div>
        <button class="btn btn-mango btn-block" type="submit">💾 Guardar patrocinador</button>
      </form>`);

    const setLogo = (src) => {
      logo = src;
      $('#spLogoPrev', body).innerHTML = `<img src="${esc(src)}" alt="" />`;
    };
    $('#spLogoFile', body).addEventListener('change', async (e) => {
      if (e.target.files[0]) setLogo(await S.fileToDataUrl(e.target.files[0], { maxSize: 500, keepAlpha: true }));
    });
    $('#spLogoUrl', body).addEventListener('change', (e) => isUrl(e.target.value) && setLogo(e.target.value.trim()));
    $('#spForm', body).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      if (!logo) return toast('Agrega el logo del patrocinador');
      const item = { id: s.id || S.uid(), name: f.name.value.trim(), url: f.url.value.trim(), logo, tier: f.tier.value, inHero: f.inHero.checked };
      const idx = data.sponsors.findIndex((x) => x.id === item.id);
      if (idx >= 0) data.sponsors[idx] = item;
      else data.sponsors.push(item);
      persist('Patrocinador guardado ✅');
      U.closeModal();
      renderSponsors();
    });
  }

  $('#spNew').addEventListener('click', () => editSponsor(null));
  $('#spList').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-sp-edit]');
    const del = e.target.closest('[data-sp-del]');
    const mv = e.target.closest('[data-sp-move]');
    if (ed) return editSponsor(ed.dataset.spEdit);
    if (del) {
      if (!confirm('¿Eliminar este patrocinador?')) return;
      data.sponsors = data.sponsors.filter((x) => x.id !== del.dataset.spDel);
    } else if (mv) {
      const i = Number(mv.dataset.spMove);
      const j = i + Number(mv.dataset.dir);
      if (j < 0 || j >= data.sponsors.length) return;
      [data.sponsors[i], data.sponsors[j]] = [data.sponsors[j], data.sponsors[i]];
    } else return;
    persist();
    renderSponsors();
  });

  /* ---------- Reservas ---------- */
  const STATUS = ['pendiente', 'pagada', 'cancelada'];
  const itemsText = (r) => (r.items || []).map((i) => `${i.qty} × ${i.name}`).join(', ');

  function filteredReservations() {
    const q = $('#resSearch').value.trim().toLowerCase();
    const evId = $('#resEvent').value;
    return [...data.reservations]
      .reverse()
      .filter((r) => (!evId || r.eventId === evId) && (!q || [r.code, r.name, r.doc, r.email, r.phone].join(' ').toLowerCase().includes(q)));
  }

  function renderReservations() {
    const current = $('#resEvent').value;
    $('#resEvent').innerHTML = '<option value="">Todos los eventos</option>' + data.events.map((e) => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');
    $('#resEvent').value = current;
    $('#resBody').innerHTML =
      filteredReservations()
        .map(
          (r) => `<tr>
            <td><b>${esc(r.code)}</b></td>
            <td>${new Date(r.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>${esc(r.eventTitle)}</td>
            <td>${esc(r.name)}<div class="muted small">${esc(r.docType || 'Doc.')} ${esc(r.doc)}</div></td>
            <td><a href="https://wa.me/${esc(String(r.phone).replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(r.phone)}</a><div class="muted small">${esc(r.email)}</div></td>
            <td>${esc(itemsText(r))}</td>
            <td><b>${money(r.total)}</b></td>
            <td><select class="status status-${r.status}" data-res-status="${esc(r.id)}">${STATUS.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
            <td><button class="icon-btn danger" data-res-del="${esc(r.id)}" title="Eliminar">🗑️</button></td>
          </tr>`
        )
        .join('') || '<tr><td colspan="9" class="muted center">No hay reservas.</td></tr>';
  }
  $('#resSearch').addEventListener('input', renderReservations);
  $('#resEvent').addEventListener('change', renderReservations);
  $('#resBody').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-res-status]');
    if (!sel) return;
    data.reservations.find((x) => x.id === sel.dataset.resStatus).status = sel.value;
    persist('Estado actualizado ✅');
    renderReservations();
  });
  $('#resBody').addEventListener('click', (e) => {
    const del = e.target.closest('[data-res-del]');
    if (del && confirm('¿Eliminar esta reserva? Los cupos se liberan.')) {
      data.reservations = data.reservations.filter((x) => x.id !== del.dataset.resDel);
      persist();
      renderReservations();
    }
  });
  $('#resCsv').addEventListener('click', () => {
    const rows = filteredReservations().map((r) => [r.code, r.createdAt, r.eventTitle, r.name, r.docType, r.doc, r.phone, r.email, itemsText(r), r.qty, r.total, r.status]);
    download('reservas.csv', csv([['Codigo', 'Fecha', 'Evento', 'Nombre', 'Tipo doc', 'Documento', 'Celular', 'Correo', 'Boletas', 'Cantidad', 'Total', 'Estado'], ...rows]), 'text/csv');
  });

  /* ---------- Suscriptores ---------- */
  function renderSubscribers() {
    const subs = [...(data.subscribers || [])].reverse();
    $('#subBody').innerHTML =
      subs
        .map(
          (s) => `<tr><td>${esc(s.email)}</td><td>${esc(s.phone || '—')}</td><td>${new Date(s.createdAt).toLocaleDateString('es-CO')}</td>
            <td><button class="icon-btn danger" data-sub-del="${esc(s.email)}" title="Eliminar">🗑️</button></td></tr>`
        )
        .join('') || '<tr><td colspan="4" class="muted center">Aún no hay suscriptores.</td></tr>';
  }
  $('#subBody').addEventListener('click', (e) => {
    const del = e.target.closest('[data-sub-del]');
    if (del && confirm('¿Eliminar este suscriptor?')) {
      data.subscribers = data.subscribers.filter((s) => s.email !== del.dataset.subDel);
      persist();
      renderSubscribers();
    }
  });
  $('#subCsv').addEventListener('click', () => {
    const rows = (data.subscribers || []).map((s) => [s.email, s.phone, s.createdAt]);
    download('suscriptores.csv', csv([['Correo', 'WhatsApp', 'Fecha'], ...rows]), 'text/csv');
  });

  /* ---------- Contenido ---------- */
  function renderContent() {
    const st = data.settings;
    $('#ctCategories').value = (st.categories || []).join(', ');
    $('#ctStats').innerHTML = [0, 1, 2, 3]
      .map((i) => {
        const s = (st.stats || [])[i] || { value: '', label: '' };
        return `<div class="edit-row stat-row" data-row><label>Cifra<input name="sValue" value="${esc(s.value)}" placeholder="+120" /></label><label>Texto<input name="sLabel" value="${esc(s.label)}" placeholder="Eventos realizados" /></label></div>`;
      })
      .join('');
    $('#ctTesti').innerHTML = (st.testimonials || [])
      .map(
        (t, i) => `<div class="edit-row testi-row" data-row>
          <label>Nombre<input name="tName" value="${esc(t.name)}" /></label>
          <label>Cargo / evento<input name="tRole" value="${esc(t.role)}" /></label>
          <label class="full">Testimonio<textarea name="tText" rows="2">${esc(t.text)}</textarea></label>
          <div class="row-foot"><span></span><button type="button" class="icon-btn danger" data-del-testi="${i}">🗑️</button></div>
        </div>`
      )
      .join('');
    $('#ctFaq').innerHTML = (st.faqs || [])
      .map(
        (f, i) => `<div class="edit-row faq-row" data-row>
          <label class="full">Pregunta<input name="fQ" value="${esc(f.q)}" /></label>
          <label class="full">Respuesta<textarea name="fA" rows="2">${esc(f.a)}</textarea></label>
          <div class="row-foot"><span></span><button type="button" class="icon-btn danger" data-del-faq="${i}">🗑️</button></div>
        </div>`
      )
      .join('');
  }

  function readContent() {
    const st = data.settings;
    st.categories = $('#ctCategories').value.split(',').map((c) => c.trim()).filter(Boolean);
    st.stats = $$('#ctStats [data-row]').map((r) => ({ value: $('[name=sValue]', r).value.trim(), label: $('[name=sLabel]', r).value.trim() })).filter((s) => s.value);
    st.testimonials = $$('#ctTesti [data-row]').map((r) => ({ name: $('[name=tName]', r).value.trim(), role: $('[name=tRole]', r).value.trim(), text: $('[name=tText]', r).value.trim() }));
    st.faqs = $$('#ctFaq [data-row]').map((r) => ({ q: $('[name=fQ]', r).value.trim(), a: $('[name=fA]', r).value.trim() }));
  }

  $('#ctAddTesti').addEventListener('click', () => {
    readContent();
    data.settings.testimonials.push({ name: '', role: '', text: '' });
    renderContent();
  });
  $('#ctAddFaq').addEventListener('click', () => {
    readContent();
    data.settings.faqs.push({ q: '', a: '' });
    renderContent();
  });
  $('[data-panel="contenido"]').addEventListener('click', (e) => {
    const t = e.target.closest('[data-del-testi]');
    const f = e.target.closest('[data-del-faq]');
    if (!t && !f) return;
    readContent();
    if (t) data.settings.testimonials.splice(Number(t.dataset.delTesti), 1);
    if (f) data.settings.faqs.splice(Number(f.dataset.delFaq), 1);
    renderContent();
  });
  $('#contentSave').addEventListener('click', () => {
    readContent();
    data.settings.testimonials = data.settings.testimonials.filter((t) => t.name && t.text);
    data.settings.faqs = data.settings.faqs.filter((f) => f.q && f.a);
    persist('Contenido guardado ✅');
    renderContent();
  });

  /* ---------- Ajustes ---------- */
  const SETTINGS = ['brand', 'slogan', 'currency', 'whatsapp', 'phone', 'email', 'address', 'instagram', 'facebook', 'tiktok', 'youtube', 'paymentMethods'];
  function renderSettings() {
    const f = $('#settingsForm');
    SETTINGS.forEach((k) => (f[k].value = data.settings[k] || ''));
    f.adminPin.value = '';
  }
  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    SETTINGS.forEach((k) => (data.settings[k] = f[k].value.trim()));
    if (f.adminPin.value) data.settings.adminPin = f.adminPin.value;
    persist('Ajustes guardados ✅');
    renderSettings();
    $('#sideBrand').textContent = data.settings.brand;
  });
  $('#backupBtn').addEventListener('click', () =>
    download(`respaldo-mangos-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
  );
  $('#restoreFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        if (!Array.isArray(parsed.events) || !Array.isArray(parsed.sponsors)) throw new Error();
        data = parsed;
        persist('Respaldo restaurado ✅');
        showTab('dashboard');
      } catch {
        toast('El archivo no es un respaldo válido');
      }
    };
    r.readAsText(file);
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Esto borra TODO (eventos, patrocinadores y reservas) y vuelve a los datos de ejemplo. ¿Continuar?')) return;
    S.reset();
    data = S.load();
    showTab('dashboard');
    toast('Datos restablecidos');
  });

  if (sessionStorage.getItem(SESSION)) showApp();
})();
