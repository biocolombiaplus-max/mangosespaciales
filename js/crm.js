/* Centro de control: resumen, inscritos, mesas, ingreso, CRM, campañas y ajustes. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STAGES = {
    nuevo: { label: 'Nuevo', c: 'var(--st-nuevo)', hint: 'Aún sin invitación' },
    invitado: { label: 'Invitado', c: 'var(--st-invitado)', hint: 'Recibió el correo' },
    clic: { label: 'Hizo clic', c: 'var(--st-clic)', hint: 'Abrió el enlace' },
    registrado: { label: 'Registrado', c: 'var(--st-registrado)', hint: 'Ya tiene su entrada' },
    mesa: { label: 'Reservó mesa', c: 'var(--st-mesa)', hint: 'Tiene mesa' },
    perdido: { label: 'Baja / rebote', c: 'var(--st-perdido)', hint: 'No se le envía más' },
  };
  const CAMP_STATUS = { borrador: ['Borrador', ''], enviando: ['Enviando', 'info'], pausada: ['Pausada', 'warn'], terminada: ['Terminada', 'ok'] };

  let token = sessionStorage.getItem('crm_token') || '';
  let view = 'dashboard';
  let pollTimer = null;
  const S = { summary: null, regs: [], tables: [], contacts: [], tags: [], campaigns: [], settings: null, campaign: null };

  /* ---------- Utilidades ---------- */
  async function api(path, opts = {}) {
    const res = await fetch('/api/admin' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/login') {
      logout();
      throw new Error(data.error || 'Sesión terminada');
    }
    if (!res.ok) throw new Error(data.error || 'Error inesperado');
    return data;
  }

  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (bad ? ' bad' : '');
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), bad ? 4500 : 2400);
  }
  const fail = (e) => toast(e.message || String(e), true);

  const fmt = (iso, withTime = true) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + (withTime ? ' ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');
  };
  const waLink = (phone, text = '') => {
    let n = String(phone || '').replace(/\D/g, '');
    if (n.length === 10 && n.startsWith('3')) n = '57' + n;
    return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  };

  function download(name, rows) {
    // un apóstrofo evita que Excel ejecute fórmulas escritas en los formularios
    const cell = (v) => {
      const t = String(v ?? '');
      return `"${(/^[=+\-@]/.test(t) ? "'" + t : t).replace(/"/g, '""')}"`;
    };
    const csv = '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    document.body.classList.add('no-scroll');
    return $('#modalBody');
  }
  function closeModal() {
    $('#modal').hidden = true;
    document.body.classList.remove('no-scroll');
  }
  $('#modal').addEventListener('click', (e) => (e.target.id === 'modal' || e.target.closest('.modal-close')) && closeModal());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModal();
    closeDrawer();
  });

  /* ---------- Sesión ---------- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginError').textContent = '';
    try {
      const d = await api('/login', { method: 'POST', body: { password: $('#password').value } });
      token = d.token;
      sessionStorage.setItem('crm_token', token);
      enter();
    } catch (err) {
      $('#loginError').textContent = err.message;
    }
  });
  function logout() {
    if (token) fetch('/api/admin/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
    token = '';
    sessionStorage.removeItem('crm_token');
    $('#app').hidden = true;
    $('#login').hidden = false;
  }
  $('#logout').addEventListener('click', logout);
  function enter() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    show(location.hash.slice(1) || 'dashboard');
  }

  /* ---------- Navegación ---------- */
  const LOADERS = {
    dashboard: loadDashboard,
    registrations: loadRegs,
    tables: loadTables,
    checkin: () => setTimeout(() => $('#checkinCode').focus(), 50),
    crm: loadContacts,
    campaigns: loadCampaigns,
    'campaign-edit': () => {},
    settings: loadSettings,
  };
  function show(v) {
    if (!LOADERS[v] || v === 'campaign-edit') v = v === 'campaign-edit' ? 'campaigns' : 'dashboard';
    view = v;
    history.replaceState(null, '', '#' + v);
    $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach((s) => (s.hidden = s.dataset.view !== v));
    stopScan();
    LOADERS[v]().catch?.(fail);
    window.scrollTo(0, 0);
  }
  function showEditor() {
    view = 'campaign-edit';
    $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === 'campaigns'));
    $$('.view').forEach((s) => (s.hidden = s.dataset.view !== 'campaign-edit'));
    window.scrollTo(0, 0);
  }
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) show(b.dataset.view);
  });

  // Mientras una campaña se envía, se actualizan los números cada 5 segundos.
  function poll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if ($('#app').hidden || document.hidden) return;
      try {
        if (view === 'dashboard') await loadDashboard();
        if (view === 'campaigns') await loadCampaigns();
        if (view === 'campaign-edit' && S.campaign) await refreshCampaign();
      } catch (e) {
        /* silencioso */
      }
    }, 5000);
  }

  /* ================= Resumen ================= */
  async function loadDashboard() {
    const d = (S.summary = await api('/summary'));
    $('#testBanner').hidden = !d.testMode;
    const e = d.event;
    $('#dashEvent').textContent = `${e.title} ${e.edition} · ${e.venue}, ${e.city}`;
    const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
    const kpi = (label, value, sub, c, meter) =>
      `<div class="kpi" style="--c:${c}"><small>${label}</small><b>${value}</b><span>${sub}</span>${meter !== undefined ? `<div class="meter"><i style="width:${meter}%"></i></div>` : ''}</div>`;
    $('#kpis').innerHTML = [
      kpi('Personas esperadas', d.people, 'inscritos + personas en mesas', 'var(--red)'),
      kpi('Inscritos gratis', d.registrations, 'entradas con QR', 'var(--st-registrado)'),
      kpi('Mesas reservadas', `${d.tables} / ${e.tableCount}`, `${d.tableGuests} personas en mesas`, 'var(--st-mesa)', pct(d.tables, e.tableCount)),
      kpi('Ingresaron', d.checkedIn, 'validados en la puerta', 'var(--blue)', pct(d.checkedIn, d.people)),
      kpi('Contactos CRM', d.contacts, `${d.byStage.invitado + d.byStage.clic} invitados pendientes`, 'var(--st-clic)'),
    ].join('');
    const max = Math.max(1, ...Object.values(d.byStage));
    $('#funnel').innerHTML = Object.entries(STAGES)
      .map(([k, s]) => `<div class="funnel-row"><span><i class="stage-dot" style="--c:${s.c}"></i>${s.label}</span><div class="track"><i style="width:${(d.byStage[k] / max) * 100}%;background:${s.c}"></i></div><b>${d.byStage[k]}</b></div>`)
      .join('');
    const maxDay = Math.max(1, ...d.last7.map((x) => x.count));
    $('#bars').innerHTML = d.last7
      .map((x) => `<div><b>${x.count}</b><i style="height:${(x.count / maxDay) * 120}px"></i>${new Date(x.day + 'T12:00').toLocaleDateString('es-CO', { weekday: 'short' })}</div>`)
      .join('');
    const c = d.campaignRunning;
    $('#dashCampaign').innerHTML = c
      ? `<div class="card-head"><h3>✉️ Enviando: ${esc(c.name)}</h3><span class="pill info">● En curso</span></div>
         <div class="camp-stats"><span><b>${c.stats.sent}</b> enviados</span><span><b>${c.stats.clicks}</b> clics</span><span><b>${c.stats.registered}</b> se inscribieron</span><span><b>${c.stats.failed}</b> errores</span></div>
         ${c.note ? `<p class="muted small">${esc(c.note)}</p>` : ''}`
      : `<div class="card-head"><h3>✉️ Campañas</h3><button class="btn btn-light btn-sm" data-go="campaigns">Ir a campañas</button></div><p class="muted" style="margin:0">No hay campañas enviándose en este momento.</p>`;
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) show(g.dataset.go);
  });

  /* ================= Inscritos ================= */
  async function loadRegs() {
    S.regs = await api('/registrations');
    renderRegs();
  }
  function filteredRegs() {
    const q = $('#regSearch').value.trim().toLowerCase();
    const f = $('#regFilter').value;
    return S.regs.filter((r) => {
      if (f === 'in' && !r.checkedInAt) return false;
      if (f === 'out' && (r.checkedInAt || r.status === 'cancelada')) return false;
      if (f === 'cancelada' && r.status !== 'cancelada') return false;
      return !q || [r.name, r.doc, r.code, r.email, r.phone].join(' ').toLowerCase().includes(q);
    });
  }
  const mailPill = (r) =>
    ({ enviado: '<span class="pill ok">✉ Enviado</span>', 'modo prueba': '<span class="pill">🧪 Prueba</span>', error: `<span class="pill bad" title="${esc(r.emailError)}">✉ Error</span>`, enviando: '<span class="pill">…</span>' }[r.emailStatus] || '');
  function renderRegs() {
    const list = filteredRegs();
    $('#regTable').innerHTML = `<thead><tr><th>Código</th><th>Asistente</th><th>Contacto</th><th>Inscrito</th><th>Correo</th><th>Ingreso</th><th></th></tr></thead><tbody>${
      list
        .map(
          (r) => `<tr>
          <td><span class="code">${esc(r.code)}</span></td>
          <td><b>${esc(r.name)}</b><span class="sub">${esc(r.docType)} ${esc(r.doc)}${r.city ? ' · ' + esc(r.city) : ''}</span></td>
          <td><a href="${waLink(r.phone)}" target="_blank" rel="noopener">${esc(r.phone)}</a><span class="sub">${esc(r.email)}</span></td>
          <td>${fmt(r.createdAt)}</td>
          <td>${mailPill(r)}</td>
          <td>${r.status === 'cancelada' ? '<span class="pill bad">Cancelada</span>' : r.checkedInAt ? `<span class="pill ok">✓ ${fmt(r.checkedInAt)}</span>` : '<span class="pill">Pendiente</span>'}</td>
          <td><div class="actions">
            ${r.status !== 'cancelada' ? `<button class="icon" title="${r.checkedInAt ? 'Deshacer ingreso' : 'Marcar ingreso'}" data-r-in="${r.id}">${r.checkedInAt ? '↩' : '✓'}</button>` : ''}
            <button class="icon" title="Reenviar correo" data-r-mail="${r.id}">✉</button>
            <button class="icon" title="${r.status === 'cancelada' ? 'Reactivar' : 'Cancelar'}" data-r-cancel="${r.id}">${r.status === 'cancelada' ? '♻' : '⊘'}</button>
          </div></td></tr>`
        )
        .join('') || '<tr><td colspan="7" class="empty">Aún no hay inscritos.</td></tr>'
    }</tbody>`;
  }
  $('#regSearch').addEventListener('input', renderRegs);
  $('#regFilter').addEventListener('change', renderRegs);
  $('#regTable').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.rIn) {
        const r = S.regs.find((x) => x.id === b.dataset.rIn);
        await api(`/registrations/${r.id}`, { method: 'PATCH', body: { checkedIn: !r.checkedInAt } });
      }
      if (b.dataset.rMail) {
        await api(`/registrations/${b.dataset.rMail}/resend`, { method: 'POST' });
        toast('Correo reenviado');
      }
      if (b.dataset.rCancel) {
        const r = S.regs.find((x) => x.id === b.dataset.rCancel);
        if (r.status !== 'cancelada' && !confirm(`¿Cancelar la inscripción de ${r.name}? Se libera su cupo.`)) return;
        await api(`/registrations/${r.id}`, { method: 'PATCH', body: { status: r.status === 'cancelada' ? 'activa' : 'cancelada' } });
      }
      await loadRegs();
    } catch (err) {
      fail(err);
    }
  });
  $('#regCsv').addEventListener('click', () =>
    download('inscritos.csv', [['Código', 'Nombre', 'Tipo doc', 'Documento', 'Celular', 'Correo', 'Ciudad', 'Inscrito', 'Estado', 'Ingreso'], ...filteredRegs().map((r) => [r.code, r.name, r.docType, r.doc, r.phone, r.email, r.city, r.createdAt, r.status, r.checkedInAt || ''])])
  );

  /* ================= Mesas ================= */
  async function loadTables() {
    const [tables, summary] = await Promise.all([api('/tables'), S.summary ? S.summary : api('/summary')]);
    S.tables = tables;
    S.summary = summary;
    const ev = summary.event;
    const active = tables.filter((t) => t.status !== 'cancelada');
    $('#tablesSummary').textContent = `${active.length} de ${ev.tableCount} mesas reservadas · ${active.reduce((n, t) => n + t.people, 0)} personas`;
    const byNum = new Map(active.map((t) => [t.table, t]));
    $('#miniMap').innerHTML = [...Array(ev.tableCount)]
      .map((_, i) => {
        const t = byNum.get(i + 1);
        return `<div class="${t ? (t.checkedInAt ? 'in' : 'taken') : ''}" title="${t ? esc(t.name) + ' · ' + t.people + ' personas' : 'Libre'}">${i + 1}</div>`;
      })
      .join('');
    $('#tableTable').innerHTML = `<thead><tr><th>Mesa</th><th>Código</th><th>Titular</th><th>Contacto</th><th>Personas</th><th>Notas</th><th>Estado</th><th></th></tr></thead><tbody>${
      tables
        .map(
          (t) => `<tr>
          <td><b style="font:400 1.4rem var(--condensed)">#${t.table}</b></td>
          <td><span class="code">${esc(t.code)}</span><span class="sub">${fmt(t.createdAt)}</span></td>
          <td><b>${esc(t.name)}</b><span class="sub">${esc(t.docType)} ${esc(t.doc)}</span></td>
          <td><a href="${waLink(t.phone, `Hola ${t.name.split(' ')[0]}, te escribimos de Mangos Espaciales por tu mesa #${t.table}`)}" target="_blank" rel="noopener">💬 ${esc(t.phone)}</a><span class="sub">${esc(t.email)}</span></td>
          <td>${t.people}</td>
          <td class="small">${esc(t.notes) || '—'}</td>
          <td>${t.status === 'cancelada' ? '<span class="pill bad">Cancelada</span>' : t.checkedInAt ? '<span class="pill ok">✓ Llegó</span>' : '<span class="pill warn">Confirmada</span>'} ${mailPill(t)}</td>
          <td><div class="actions">
            ${t.status !== 'cancelada' ? `<button class="icon" title="${t.checkedInAt ? 'Deshacer llegada' : 'Marcar llegada'}" data-t-in="${t.id}">${t.checkedInAt ? '↩' : '✓'}</button>` : ''}
            <button class="icon" title="Reenviar correo" data-t-mail="${t.id}">✉</button>
            <button class="icon" title="${t.status === 'cancelada' ? 'Reactivar' : 'Cancelar y liberar mesa'}" data-t-cancel="${t.id}">${t.status === 'cancelada' ? '♻' : '⊘'}</button>
          </div></td></tr>`
        )
        .join('') || '<tr><td colspan="8" class="empty">Aún no hay mesas reservadas.</td></tr>'
    }</tbody>`;
  }
  $('#tableTable').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.tIn) {
        const t = S.tables.find((x) => x.id === b.dataset.tIn);
        await api(`/tables/${t.id}`, { method: 'PATCH', body: { checkedIn: !t.checkedInAt } });
      }
      if (b.dataset.tMail) {
        await api(`/tables/${b.dataset.tMail}/resend`, { method: 'POST' });
        toast('Correo reenviado');
      }
      if (b.dataset.tCancel) {
        const t = S.tables.find((x) => x.id === b.dataset.tCancel);
        if (t.status !== 'cancelada' && !confirm(`¿Cancelar la mesa #${t.table} de ${t.name}? Quedará libre en la landing.`)) return;
        await api(`/tables/${t.id}`, { method: 'PATCH', body: { status: t.status === 'cancelada' ? 'confirmada' : 'cancelada' } });
      }
      await loadTables();
    } catch (err) {
      fail(err);
    }
  });
  $('#tableCsv').addEventListener('click', () =>
    download('mesas.csv', [['Mesa', 'Código', 'Titular', 'Tipo doc', 'Documento', 'Celular', 'Correo', 'Personas', 'Notas', 'Estado', 'Reservada'], ...S.tables.map((t) => [t.table, t.code, t.name, t.docType, t.doc, t.phone, t.email, t.people, t.notes, t.status, t.createdAt])])
  );

  /* ================= Ingreso ================= */
  async function checkin(code) {
    const box = $('#checkinResult');
    try {
      const d = await api('/checkin', { method: 'POST', body: { code } });
      const r = d.record;
      const who = `<p><b>${esc(r.name)}</b><br>${esc(r.docType)} ${esc(r.doc)}${d.type === 'mesa' ? `<br>Mesa #${r.table} · ${r.people} personas` : ''}</p><p class="code">${esc(r.code)}</p>`;
      if (d.cancelled) {
        box.className = 'checkin-result bad';
        box.innerHTML = `<div><div class="big">⛔</div><h2>Inscripción cancelada</h2>${who}</div>`;
      } else if (d.already) {
        box.className = 'checkin-result warn';
        box.innerHTML = `<div><div class="big">⚠️</div><h2>Ya ingresó</h2>${who}<p class="muted">Registrado a las ${new Date(r.checkedInAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}</p></div>`;
      } else {
        box.className = 'checkin-result ok';
        box.innerHTML = `<div><div class="big">✅</div><h2>¡Bienvenido${d.type === 'mesa' ? ' a tu mesa' : ''}!</h2>${who}</div>`;
      }
    } catch (err) {
      box.className = 'checkin-result bad';
      box.innerHTML = `<div><div class="big">❌</div><h2>No encontrado</h2><p>${esc(err.message)}</p></div>`;
    }
    $('#checkinCode').value = '';
    $('#checkinCode').focus();
  }
  $('#checkinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#checkinCode').value.trim();
    if (code) checkin(code);
  });

  let scanStream = null;
  let scanLoop = null;
  async function startScan() {
    if (!('BarcodeDetector' in window)) {
      $('#scanNote').textContent = 'Este navegador no puede leer QR. Usa Chrome en un celular Android, o escribe el código.';
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = $('#scanVideo');
      video.srcObject = scanStream;
      video.hidden = false;
      await video.play();
      $('#scanBtn').textContent = '⏹ Detener cámara';
      $('#scanNote').textContent = 'Apunta la cámara al código QR.';
      let last = '';
      scanLoop = setInterval(async () => {
        const codes = await detector.detect(video).catch(() => []);
        const value = codes[0] && codes[0].rawValue;
        if (value && value !== last) {
          last = value;
          checkin(value);
          setTimeout(() => (last = ''), 4000);
        }
      }, 400);
    } catch (err) {
      $('#scanNote').textContent = 'No se pudo abrir la cámara: ' + err.message;
      stopScan();
    }
  }
  function stopScan() {
    clearInterval(scanLoop);
    if (scanStream) scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
    $('#scanVideo').hidden = true;
    $('#scanBtn').textContent = '📷 Escanear QR con la cámara';
  }
  $('#scanBtn').addEventListener('click', () => (scanStream ? stopScan() : startScan()));

  /* ================= CRM ================= */
  let crmMode = 'board';
  const colLimit = {};
  const selected = new Set();

  async function loadContacts() {
    const d = await api('/contacts');
    S.contacts = d.contacts;
    S.tags = d.tags;
    const cur = $('#crmTag').value;
    $('#crmTag').innerHTML = '<option value="">Todas las etiquetas</option>' + d.tags.map((t) => `<option>${esc(t)}</option>`).join('');
    $('#crmTag').value = d.tags.includes(cur) ? cur : '';
    renderCrm();
  }

  function filteredContacts() {
    const q = $('#crmSearch').value.trim().toLowerCase();
    const tag = $('#crmTag').value;
    return S.contacts.filter((c) => (!tag || c.tags.includes(tag)) && (!q || [c.name, c.email, c.phone, c.city].join(' ').toLowerCase().includes(q)));
  }

  function renderCrm() {
    const list = filteredContacts();
    $('#crmCount').textContent = `${S.contacts.length} contactos${list.length !== S.contacts.length ? ` · ${list.length} con este filtro` : ''}`;
    $('#board').hidden = crmMode !== 'board';
    $('#listWrap').hidden = crmMode !== 'list';
    if (crmMode === 'board') renderBoard(list);
    else renderList(list);
  }

  const leadCard = (c) => `<article class="lead" draggable="true" data-id="${c.id}">
      <b>${esc(c.name || 'Sin nombre')}</b><span class="em">${esc(c.email)}</span>
      <div>${c.tags.slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="meta"><span>${c.unsubscribed ? '🚫 Baja' : c.bounced ? '⚠️ Rebote' : esc(c.source)}</span><span>${fmt(c.updatedAt, false)}</span></div>
    </article>`;

  function renderBoard(list) {
    $('#board').innerHTML = Object.entries(STAGES)
      .map(([k, s]) => {
        const items = list.filter((c) => c.stage === k);
        const limit = colLimit[k] || 40;
        return `<section class="col" data-stage="${k}" style="--c:${s.c}">
          <div class="col-head"><b><span>${s.label}</span><span>${items.length}</span></b><span>${s.hint}</span></div>
          <div class="col-body">${items.slice(0, limit).map(leadCard).join('')}${items.length > limit ? `<button class="more-btn" data-more="${k}">Ver ${Math.min(40, items.length - limit)} más</button>` : ''}</div>
        </section>`;
      })
      .join('');
  }

  // Arrastrar tarjetas entre etapas
  $('#board').addEventListener('dragstart', (e) => {
    const card = e.target.closest('.lead');
    if (!card) return;
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });
  $('#board').addEventListener('dragend', (e) => e.target.closest('.lead')?.classList.remove('dragging'));
  $('#board').addEventListener('dragover', (e) => {
    const col = e.target.closest('.col');
    if (!col) return;
    e.preventDefault();
    $$('.col.drop').forEach((c) => c !== col && c.classList.remove('drop'));
    col.classList.add('drop');
  });
  $('#board').addEventListener('dragleave', (e) => {
    const col = e.target.closest('.col');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drop');
  });
  $('#board').addEventListener('drop', async (e) => {
    const col = e.target.closest('.col');
    if (!col) return;
    e.preventDefault();
    col.classList.remove('drop');
    const id = e.dataTransfer.getData('text/plain');
    const c = S.contacts.find((x) => x.id === id);
    if (!c || c.stage === col.dataset.stage) return;
    const prev = c.stage;
    c.stage = col.dataset.stage;
    renderCrm();
    try {
      await api(`/contacts/${id}`, { method: 'PATCH', body: { stage: c.stage } });
      toast(`Movido a "${STAGES[c.stage].label}"`);
    } catch (err) {
      c.stage = prev;
      renderCrm();
      fail(err);
    }
  });
  $('#board').addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) {
      colLimit[more.dataset.more] = (colLimit[more.dataset.more] || 40) + 40;
      return renderCrm();
    }
    const card = e.target.closest('.lead');
    if (card) openContact(card.dataset.id);
  });

  function renderList(list) {
    const shown = list.slice(0, 500);
    $('#crmTable').innerHTML = `<thead><tr><th><input type="checkbox" id="selAll" /></th><th>Contacto</th><th>Celular</th><th>Etapa</th><th>Etiquetas</th><th>Origen</th><th>Actualizado</th></tr></thead><tbody>${
      shown
        .map(
          (c) => `<tr data-id="${c.id}">
          <td><input type="checkbox" data-sel="${c.id}" ${selected.has(c.id) ? 'checked' : ''} /></td>
          <td><b>${esc(c.name || 'Sin nombre')}</b><span class="sub">${esc(c.email)}</span></td>
          <td>${c.phone ? `<a href="${waLink(c.phone)}" target="_blank" rel="noopener">${esc(c.phone)}</a>` : '—'}</td>
          <td><span class="pill"><i class="stage-dot" style="--c:${STAGES[c.stage].c}"></i>${STAGES[c.stage].label}</span></td>
          <td>${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td>
          <td class="small">${esc(c.source)}</td>
          <td class="small">${fmt(c.updatedAt)}</td></tr>`
        )
        .join('') || '<tr><td colspan="7" class="empty">No hay contactos. Importa tu base para empezar.</td></tr>'
    }</tbody>${list.length > 500 ? `<tfoot><tr><td colspan="7" class="muted small">Mostrando 500 de ${list.length}. Usa la búsqueda o las etiquetas para filtrar.</td></tr></tfoot>` : ''}`;
    updateBulk();
  }
  function updateBulk() {
    $('#bulk').hidden = selected.size === 0;
    $('#bulkCount').textContent = `${selected.size} seleccionados`;
  }
  $('#crmTable').addEventListener('change', (e) => {
    if (e.target.id === 'selAll') {
      filteredContacts().slice(0, 500).forEach((c) => (e.target.checked ? selected.add(c.id) : selected.delete(c.id)));
      return renderCrm();
    }
    const id = e.target.dataset.sel;
    if (id) {
      e.target.checked ? selected.add(id) : selected.delete(id);
      updateBulk();
    }
  });
  $('#crmTable').addEventListener('click', (e) => {
    if (e.target.closest('input, a')) return;
    const row = e.target.closest('tr[data-id]');
    if (row) openContact(row.dataset.id);
  });
  $('#bulkStage').innerHTML = '<option value="">Mover a…</option>' + Object.entries(STAGES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('');
  async function bulk(action, value) {
    try {
      const d = await api('/contacts/bulk', { method: 'POST', body: { ids: [...selected], action, value } });
      toast(`${d.count} contactos actualizados`);
      selected.clear();
      await loadContacts();
    } catch (err) {
      fail(err);
    }
  }
  $('#bulkStage').addEventListener('change', (e) => e.target.value && bulk('stage', e.target.value).then(() => (e.target.value = '')));
  $('#bulkTag').addEventListener('click', () => {
    const t = prompt('Etiqueta para los contactos seleccionados:');
    if (t) bulk('tag', t.trim());
  });
  $('#bulkDelete').addEventListener('click', () => confirm(`¿Eliminar ${selected.size} contactos? No se puede deshacer.`) && bulk('delete'));

  $('#crmSearch').addEventListener('input', renderCrm);
  $('#crmTag').addEventListener('change', renderCrm);
  $('#crmMode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    crmMode = b.dataset.mode;
    $$('#crmMode button').forEach((x) => x.classList.toggle('active', x === b));
    renderCrm();
  });

  /* ---------- Ficha del contacto ---------- */
  async function openContact(id) {
    try {
      const c = await api(`/contacts/${id}`);
      const card = $('#drawerCard');
      card.innerHTML = `
        <div class="drawer-head">
          <span class="avatar">${esc((c.name || c.email).charAt(0).toUpperCase())}</span>
          <div><h2>${esc(c.name || 'Sin nombre')}</h2><span class="muted small">${esc(c.email)}</span></div>
          <button class="icon" style="margin-left:auto" data-close-drawer>✕</button>
        </div>
        <div class="quick">
          ${c.phone ? `<a class="btn btn-light btn-sm" href="${waLink(c.phone, `Hola ${(c.name || '').split(' ')[0]}`)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
          <a class="btn btn-light btn-sm" href="mailto:${esc(c.email)}">✉️ Correo</a>
          ${c.unsubscribed ? '<span class="pill bad">Se dio de baja</span>' : ''}${c.bounced ? '<span class="pill bad">Correo rebotó</span>' : ''}
        </div>
        <h3>Etapa</h3>
        <div class="stage-pick">${Object.entries(STAGES).map(([k, s]) => `<button style="--c:${s.c}" class="${c.stage === k ? 'on' : ''}" data-stage="${k}">${s.label}</button>`).join('')}</div>
        <div class="form">
          <label>Nombre<input id="dName" value="${esc(c.name)}" /></label>
          <div class="row"><label>Celular<input id="dPhone" value="${esc(c.phone)}" /></label><label>Ciudad<input id="dCity" value="${esc(c.city)}" /></label></div>
          <label>Etiquetas <small>separadas por coma</small><input id="dTags" value="${esc(c.tags.join(', '))}" /></label>
          <label>Notas<textarea id="dNotes" rows="3" placeholder="Ej: quiere mesa para 8, cumpleaños…">${esc(c.notes)}</textarea></label>
          <div class="test-row"><button class="btn btn-primary" id="dSave">💾 Guardar</button>
          ${c.unsubscribed ? '<button class="btn btn-light" id="dResub">Volver a suscribir</button>' : ''}
          <button class="btn btn-light danger" id="dDelete">🗑️ Eliminar</button></div>
        </div>
        ${c.registrations.length || c.tables.length ? `<h3 style="margin-top:20px">Evento</h3>${c.registrations.map((r) => `<p class="small"><span class="pill ok">🎟️ ${esc(r.code)}</span> ${r.status === 'cancelada' ? 'Cancelada' : r.checkedInAt ? 'Ingresó' : 'Inscrito'}</p>`).join('')}${c.tables.map((t) => `<p class="small"><span class="pill warn">🪑 Mesa #${t.table}</span> ${t.people} personas · ${esc(t.code)}</p>`).join('')}` : ''}
        ${c.sentList.length ? `<h3 style="margin-top:20px">Campañas recibidas</h3>${c.sentList.map((s) => `<p class="small">✉️ ${esc(s.campaign)} · ${s.at === 'error' ? '<span class="pill bad">error</span>' : fmt(s.at)}</p>`).join('')}` : ''}
        <h3 style="margin-top:20px">Historial</h3>
        <ul class="timeline">${(c.timeline || []).map((t) => `<li>${esc(t.text)}<small>${fmt(t.at)}</small></li>`).join('') || '<li>Sin actividad</li>'}</ul>
        <p class="muted small">Origen: ${esc(c.source)} · Creado ${fmt(c.createdAt)}</p>`;
      $('#drawer').hidden = false;

      const patch = async (body, msg) => {
        try {
          await api(`/contacts/${c.id}`, { method: 'PATCH', body });
          toast(msg || 'Guardado');
          await loadContacts();
          openContact(c.id);
        } catch (err) {
          fail(err);
        }
      };
      $$('.stage-pick button', card).forEach((b) => b.addEventListener('click', () => patch({ stage: b.dataset.stage }, `Movido a "${STAGES[b.dataset.stage].label}"`)));
      $('#dSave', card).addEventListener('click', () =>
        patch({ name: $('#dName').value, phone: $('#dPhone').value, city: $('#dCity').value, tags: $('#dTags').value.split(',').map((t) => t.trim()).filter(Boolean), notes: $('#dNotes').value })
      );
      $('#dResub', card)?.addEventListener('click', () => patch({ unsubscribed: false, stage: 'nuevo' }, 'Suscrito de nuevo'));
      $('#dDelete', card).addEventListener('click', async () => {
        if (!confirm('¿Eliminar este contacto?')) return;
        await api(`/contacts/${c.id}`, { method: 'DELETE' }).catch(fail);
        closeDrawer();
        loadContacts();
      });
    } catch (err) {
      fail(err);
    }
  }
  function closeDrawer() {
    $('#drawer').hidden = true;
  }
  $('#drawer').addEventListener('click', (e) => (e.target.id === 'drawer' || e.target.closest('[data-close-drawer]')) && closeDrawer());

  $('#crmNew').addEventListener('click', () => {
    const body = openModal(`<h2>Nuevo contacto</h2>
      <form class="form" id="newContact">
        <div class="row"><label>Nombre<input name="name" /></label><label>Correo<input name="email" type="email" required /></label></div>
        <div class="row"><label>Celular<input name="phone" /></label><label>Ciudad<input name="city" /></label></div>
        <label>Etiquetas <small>separadas por coma</small><input name="tags" /></label>
        <button class="btn btn-primary" type="submit">Crear contacto</button>
      </form>`);
    $('#newContact', body).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await api('/contacts', { method: 'POST', body: { name: f.name.value, email: f.email.value, phone: f.phone.value, city: f.city.value, tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean) } });
        closeModal();
        toast('Contacto creado');
        loadContacts();
      } catch (err) {
        fail(err);
      }
    });
  });

  /* ---------- Importar base de datos ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = [';', ',', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += ch;
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => String(c).trim()));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Guarda el archivo como CSV e inténtalo de nuevo.'));
      document.head.appendChild(s);
    });
  }

  async function readFile(file) {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      if (!window.XLSX) await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).map((r) => r.map((c) => String(c)));
    }
    return parseCSV(await file.text());
  }

  const FIELD_PATTERNS = {
    name: /nombre|name|cliente|contacto/i,
    email: /correo|e-?mail|mail/i,
    phone: /tel|cel|whats|phone|m[oó]vil/i,
    city: /ciudad|city|municipio/i,
  };

  $('#crmImport').addEventListener('click', () => {
    const body = openModal(`<h2>Importar base de contactos</h2>
      <p class="muted">Sube un Excel (.xlsx) o CSV con columnas como <b>nombre</b>, <b>correo</b>, <b>celular</b> y <b>ciudad</b>. Los correos repetidos se unen automáticamente.</p>
      <label class="drop" id="dropZone"><b>📄 Elegir archivo</b><span class="muted small">Excel o CSV</span><input type="file" id="importFile" accept=".csv,.xlsx,.xls,.txt" hidden /></label>
      <div id="importStep" hidden></div>`);
    $('#importFile', body).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const rows = await readFile(file);
        if (!rows.length) throw new Error('El archivo está vacío.');
        showMapping(body, rows, file.name.replace(/\.[^.]+$/, ''));
      } catch (err) {
        fail(err);
      }
    });
  });

  function showMapping(body, rows, fileName) {
    const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v).trim());
    const hasHeader = !rows[0].some(isEmail);
    const header = hasHeader ? rows[0].map((h, i) => String(h).trim() || `Columna ${i + 1}`) : rows[0].map((_, i) => `Columna ${i + 1}`);
    const data = hasHeader ? rows.slice(1) : rows;
    const guess = {};
    for (const [field, re] of Object.entries(FIELD_PATTERNS)) {
      const i = hasHeader ? header.findIndex((h) => re.test(h)) : -1;
      guess[field] = i;
    }
    if (guess.email < 0) {
      // sin encabezado: la columna con más correos
      const counts = header.map((_, i) => data.slice(0, 50).filter((r) => isEmail(r[i])).length);
      guess.email = counts.indexOf(Math.max(...counts));
    }
    const opts = (sel) => `<option value="-1">— No usar —</option>` + header.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const step = $('#importStep', body);
    step.hidden = false;
    $('#dropZone', body).hidden = true;
    step.innerHTML = `
      <div class="map-grid form">
        <label>Nombre<select data-f="name">${opts(guess.name)}</select></label>
        <label>Correo *<select data-f="email">${opts(guess.email)}</select></label>
        <label>Celular<select data-f="phone">${opts(guess.phone)}</select></label>
        <label>Ciudad<select data-f="city">${opts(guess.city)}</select></label>
      </div>
      <p class="import-sum" id="importSum"></p>
      <div class="preview-table"><table class="table" id="importPreview"></table></div>
      <div class="form" style="margin-top:14px">
        <label>Etiqueta para esta base <small>sirve para enviar campañas solo a este grupo</small><input id="importTag" value="${esc(fileName)}" /></label>
        <label class="check"><input type="checkbox" id="importConsent" /><span>Confirmo que estos contactos autorizaron recibir comunicaciones de mi marca (Ley 1581 de 2012).</span></label>
        <button class="btn btn-primary" id="importGo">⬆️ Importar contactos</button>
      </div>`;
    const mapped = () => {
      const m = Object.fromEntries($$('[data-f]', step).map((s) => [s.dataset.f, Number(s.value)]));
      return data.map((r) => ({ name: m.name >= 0 ? r[m.name] : '', email: m.email >= 0 ? String(r[m.email]).trim() : '', phone: m.phone >= 0 ? r[m.phone] : '', city: m.city >= 0 ? r[m.city] : '' }));
    };
    const refreshPreview = () => {
      const list = mapped();
      const valid = list.filter((r) => isEmail(r.email));
      const unique = new Set(valid.map((r) => r.email.toLowerCase())).size;
      $('#importSum', step).innerHTML = `<span><b>${list.length}</b> filas</span><span class="pill ok">${unique} correos válidos</span><span class="pill warn">${valid.length - unique} repetidos</span><span class="pill bad">${list.length - valid.length} sin correo válido</span>`;
      $('#importPreview', step).innerHTML = `<thead><tr><th>Nombre</th><th>Correo</th><th>Celular</th><th>Ciudad</th></tr></thead><tbody>${list
        .slice(0, 6)
        .map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.phone)}</td><td>${esc(r.city)}</td></tr>`)
        .join('')}</tbody>`;
    };
    $$('[data-f]', step).forEach((s) => s.addEventListener('change', refreshPreview));
    refreshPreview();
    $('#importGo', step).addEventListener('click', async () => {
      if (!$('#importConsent', step).checked) return toast('Confirma la autorización de los contactos', true);
      const btn = $('#importGo', step);
      btn.disabled = true;
      btn.textContent = 'Importando…';
      try {
        const r = await api('/contacts/import', { method: 'POST', body: { rows: mapped(), tag: $('#importTag', step).value.trim(), consent: true } });
        closeModal();
        toast(`✅ ${r.added} nuevos · ${r.updated} actualizados · ${r.invalid} inválidos · ${r.duplicated} repetidos`);
        loadContacts();
      } catch (err) {
        fail(err);
        btn.disabled = false;
        btn.textContent = '⬆️ Importar contactos';
      }
    });
  }

  /* ================= Campañas ================= */
  async function loadCampaigns() {
    S.campaigns = await api('/campaigns');
    $('#campList').innerHTML =
      S.campaigns
        .map((c) => {
          const [label, cls] = CAMP_STATUS[c.status] || [c.status, ''];
          const total = c.stats.sent + c.pending;
          return `<article class="camp">
            <div>
              <h3>${esc(c.name)} <span class="pill ${cls}">${c.status === 'enviando' ? '● ' : ''}${label}</span></h3>
              <span class="muted small">${c.tag ? `Etiqueta: ${esc(c.tag)}` : 'Todos los contactos'} · cada ${c.interval}s · máx. ${c.dailyLimit}/día</span>
              <div class="camp-stats"><span><b>${c.stats.sent}</b> enviados</span><span><b>${c.pending}</b> pendientes</span><span><b>${c.stats.clicks}</b> clics</span><span><b>${c.stats.registered}</b> inscritos</span><span><b>${c.stats.failed}</b> errores</span></div>
              <div class="progress"><i style="width:${total ? (c.stats.sent / total) * 100 : 0}%"></i></div>
              ${c.note ? `<p class="muted small" style="margin:8px 0 0">${esc(c.note)}</p>` : ''}
            </div>
            <div class="toolbar">
              <button class="btn btn-light" data-camp-open="${c.id}">Abrir</button>
              ${c.status !== 'enviando' ? `<button class="icon danger" title="Eliminar" data-camp-del="${c.id}">🗑️</button>` : ''}
            </div>
          </article>`;
        })
        .join('') || '<div class="card"><p class="muted" style="margin:0">Aún no hay campañas. Crea la primera: la invitación ya viene escrita y lista para ajustar.</p></div>';
  }
  $('#campList').addEventListener('click', async (e) => {
    const open = e.target.closest('[data-camp-open]');
    const del = e.target.closest('[data-camp-del]');
    if (open) openCampaign(S.campaigns.find((c) => c.id === open.dataset.campOpen));
    if (del && confirm('¿Eliminar esta campaña?')) {
      await api(`/campaigns/${del.dataset.campDel}`, { method: 'DELETE' }).catch(fail);
      loadCampaigns();
    }
  });
  $('#campNew').addEventListener('click', async () => {
    try {
      openCampaign(await api('/campaigns', { method: 'POST', body: {} }));
    } catch (err) {
      fail(err);
    }
  });
  $('#campBack').addEventListener('click', () => show('campaigns'));

  const CAMP_FIELDS = ['name', 'tag', 'subjects', 'preheaders', 'body', 'ctaText', 'ctaUrl', 'signature', 'fallbackName', 'interval', 'dailyLimit'];

  async function openCampaign(c) {
    S.campaign = c;
    if (!S.tags.length) await loadContacts().catch(() => {});
    const f = $('#campForm');
    $('#campTag').innerHTML = '<option value="">Todos los contactos</option>' + S.tags.map((t) => `<option>${esc(t)}</option>`).join('');
    CAMP_FIELDS.forEach((k) => (f[k].value = c[k] ?? ''));
    f.includePoster.checked = !!c.includePoster;
    showEditor();
    renderCampaignState();
    preview();
  }

  function campaignValues() {
    const f = $('#campForm');
    const v = Object.fromEntries(CAMP_FIELDS.map((k) => [k, f[k].value]));
    v.includePoster = f.includePoster.checked;
    v.interval = Number(v.interval);
    v.dailyLimit = Number(v.dailyLimit);
    return v;
  }

  function renderCampaignState() {
    const c = S.campaign;
    const running = c.status === 'enviando';
    const [label, cls] = CAMP_STATUS[c.status] || [c.status, ''];
    $('#campTitle').innerHTML = `${esc(c.name)} <span class="pill ${cls}">${running ? '● ' : ''}${label}</span>`;
    $('#campStart').hidden = running;
    $('#campPause').hidden = !running;
    $('#campStart').textContent = c.status === 'pausada' ? '▶ Reanudar envío' : '🚀 Iniciar envío';
    $$('#campForm input, #campForm textarea, #campForm select').forEach((el) => {
      if (!['testTo'].includes(el.id)) el.disabled = running;
    });
    $('#campSave').disabled = running;
    const total = c.stats.sent + c.pending;
    $('#campProgress').innerHTML = `
      <div class="camp-stats" style="margin:0"><span><b>${c.stats.sent}</b> enviados</span><span><b>${c.pending}</b> pendientes</span><span><b>${c.stats.clicks}</b> clics</span><span><b>${c.stats.registered}</b> se inscribieron</span><span><b>${c.stats.failed}</b> errores</span>
      <span>⏱ ≈ ${Math.ceil((c.pending * (c.interval + 4)) / 60)} min restantes</span></div>
      <div class="progress"><i style="width:${total ? (c.stats.sent / total) * 100 : 0}%"></i></div>
      ${c.note ? `<p class="muted small" style="margin:8px 0 0">${esc(c.note)}</p>` : ''}`;
    $('#campLog').innerHTML = `<h3>Registro de envíos</h3><ul class="log">${
      (c.log || []).map((l) => `<li><time>${new Date(l.at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time><span class="${l.ok ? '' : 'err'}">${l.ok ? '✅' : '⛔'} ${esc(l.email)}${l.ok ? ` · <span class="muted">${esc(l.subject)}</span>` : ` · ${esc(l.error)}`}</span></li>`).join('') ||
      '<li class="muted">Aún no se ha enviado nada.</li>'
    }</ul>`;
  }

  async function refreshCampaign() {
    const list = await api('/campaigns');
    const c = list.find((x) => x.id === S.campaign.id);
    if (c) {
      S.campaign = c;
      renderCampaignState();
    }
  }

  async function saveCampaign(quiet) {
    S.campaign = await api(`/campaigns/${S.campaign.id}`, { method: 'PUT', body: campaignValues() });
    renderCampaignState();
    if (!quiet) toast('Campaña guardada');
  }
  $('#campSave').addEventListener('click', () => saveCampaign().catch(fail));
  $('#campStart').addEventListener('click', async () => {
    try {
      await saveCampaign(true);
      if (!confirm(`¿Iniciar el envío a ${S.campaign.pending} contactos? Se enviará 1 correo cada ~${S.campaign.interval} segundos. Puedes pausar cuando quieras.`)) return;
      S.campaign = await api(`/campaigns/${S.campaign.id}/start`, { method: 'POST' });
      renderCampaignState();
      toast('🚀 Envío iniciado');
    } catch (err) {
      fail(err);
    }
  });
  $('#campPause').addEventListener('click', async () => {
    try {
      S.campaign = await api(`/campaigns/${S.campaign.id}/pause`, { method: 'POST' });
      renderCampaignState();
      toast('Envío pausado');
    } catch (err) {
      fail(err);
    }
  });
  $('#campTest').addEventListener('click', async () => {
    const to = $('#testTo').value.trim();
    if (!to) return toast('Escribe tu correo para la prueba', true);
    try {
      if (S.campaign.status !== 'enviando') await saveCampaign(true);
      const r = await api(`/campaigns/${S.campaign.id}/test`, { method: 'POST', body: { to } });
      toast(r.testMode ? '🧪 Guardado en la bandeja de prueba (modo prueba)' : '✉️ Prueba enviada, revisa tu correo');
    } catch (err) {
      fail(err);
    }
  });

  let previewTimer;
  async function preview() {
    try {
      const d = await api('/campaigns/preview', { method: 'POST', body: campaignValues() });
      $('#pvSubject').textContent = d.subject;
      $('#pvFrame').srcdoc = d.html;
    } catch (err) {
      /* la vista previa no es crítica */
    }
    spamCheck();
  }
  $('#campForm').addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(preview, 500);
  });
  $('#pvShuffle').addEventListener('click', preview);

  // Revisión de buenas prácticas para no caer en spam.
  const SPAM_WORDS = ['gratis', 'gratuito', '100%', 'gana', 'ganador', 'premio', 'oferta', 'promoción', 'urgente', 'última oportunidad', 'haz clic aquí', 'click aquí', 'dinero', '$$$', 'descuento', 'compra ya', 'garantizado', 'sin costo alguno'];
  function spamCheck() {
    const v = campaignValues();
    const subjects = v.subjects.split('\n').map((s) => s.trim()).filter(Boolean);
    const checks = [];
    const add = (level, text) => checks.push({ level, text });

    add(subjects.length >= 3 ? 'ok' : subjects.length ? 'warn' : 'bad', subjects.length >= 3 ? `${subjects.length} versiones del asunto: cada persona recibe uno distinto` : 'Agrega al menos 3 versiones del asunto');
    const shouty = subjects.filter((s) => {
      const letters = s.replace(/[^a-záéíóúñ]/gi, '');
      return letters.length > 6 && letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length / letters.length > 0.4;
    });
    add(shouty.length ? 'bad' : 'ok', shouty.length ? `Asunto en MAYÚSCULAS: "${shouty[0]}"` : 'Asuntos sin mayúsculas sostenidas');
    const bangs = subjects.filter((s) => (s.match(/!/g) || []).length > 1);
    add(bangs.length ? 'warn' : 'ok', bangs.length ? 'Evita varios signos de exclamación en el asunto' : 'Signos de exclamación moderados');
    const text = (v.subjects + ' ' + v.body + ' ' + v.ctaText).toLowerCase();
    const found = SPAM_WORDS.filter((w) => text.includes(w));
    const inSubject = SPAM_WORDS.filter((w) => v.subjects.toLowerCase().includes(w));
    add(inSubject.length ? 'bad' : found.length ? 'warn' : 'ok', inSubject.length ? `Palabras de riesgo en el asunto: ${inSubject.join(', ')} (usa "sin costo" en el texto)` : found.length ? `Palabras de riesgo en el texto: ${found.join(', ')}` : 'Sin palabras típicas de spam');
    add(/\{\{\s*nombre\s*\}\}/.test(v.subjects + v.body) ? 'ok' : 'warn', /\{\{\s*nombre\s*\}\}/.test(v.subjects + v.body) ? 'Personalizado con el nombre de cada contacto' : 'Usa {{nombre}} para personalizar');
    add(/\{[^{}]*\|[^{}]*\}/.test(v.body) ? 'ok' : 'warn', /\{[^{}]*\|[^{}]*\}/.test(v.body) ? 'El mensaje tiene variaciones automáticas' : 'Agrega variaciones como {Hola|Qué más} para que cada correo sea distinto');
    const words = v.body.split(/\s+/).filter(Boolean).length;
    add(words >= 25 && words <= 180 ? 'ok' : 'warn', words < 25 ? 'El mensaje es muy corto: agrega algo de texto' : words > 180 ? 'El mensaje es largo: corto funciona mejor' : `Mensaje corto y cercano (${words} palabras)`);
    add(v.interval >= 10 ? 'ok' : 'bad', `1 correo cada ${v.interval || 0} segundos${v.interval >= 10 ? '' : ' (mínimo 10)'}`);
    add(v.dailyLimit <= 300 ? 'ok' : 'warn', v.dailyLimit <= 300 ? `Máximo ${v.dailyLimit} por día` : `${v.dailyLimit} por día es alto para un dominio nuevo: empieza con 100-300`);
    add(/^https:\/\//.test(v.ctaUrl) ? 'ok' : v.ctaUrl ? 'warn' : 'bad', /^https:\/\//.test(v.ctaUrl) ? 'El botón lleva a una dirección segura (https)' : v.ctaUrl ? 'Usa una dirección https para el botón' : 'Falta la dirección del botón');

    const okCount = checks.filter((c) => c.level === 'ok').length;
    const score = Math.round((okCount / checks.length) * 100);
    const cls = checks.some((c) => c.level === 'bad') ? 'bad' : score >= 80 ? 'ok' : 'warn';
    $('#spamCheck').innerHTML = `<h3>Revisión anti-spam <span class="pill score ${cls}">${score}/100</span></h3><ul>${checks.map((c) => `<li class="${c.level}">${esc(c.text)}</li>`).join('')}</ul>`;
  }

  /* ================= Ajustes ================= */
  const EVENT_FIELDS = ['title', 'edition', 'city', 'tagline', 'subtitle', 'date', 'venue', 'venueDetail', 'address', 'whatsapp', 'tableCount', 'tableSeats', 'organizer', 'tableConditions'];
  const MAIL_FIELDS = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'fromName', 'fromEmail', 'replyTo', 'publicUrl', 'physicalAddress'];

  async function loadSettings() {
    const s = (S.settings = await api('/settings'));
    $('#testBanner').hidden = !s.testMode;
    const ef = $('#eventForm');
    EVENT_FIELDS.forEach((k) => (ef[k].value = s.event[k] ?? ''));
    ef.registrationOpen.checked = !!s.event.registrationOpen;
    ef.tablesOpen.checked = !!s.event.tablesOpen;
    renderLineup(s.event.lineup || []);
    const mf = $('#mailForm');
    MAIL_FIELDS.forEach((k) => (mf[k].value = s.mail[k] ?? ''));
    mf.smtpSecure.checked = !!s.mail.smtpSecure;
    if (!mf.publicUrl.value) mf.publicUrl.placeholder = s.effective.publicUrl || 'https://tudominio.com';
    $('#mailEnvNote').hidden = !s.fromEnv.smtp;
    $('#pwEnvNote').hidden = !s.fromEnv.adminPassword;
    $('#securityForm').adminPassword.disabled = s.fromEnv.adminPassword;
  }

  function renderLineup(list) {
    $('#lineupRows').innerHTML = list
      .map(
        (a) => `<div class="lineup-row">
        <input data-l="name" value="${esc(a.name)}" placeholder="Artista" />
        <select data-l="country"><option value="VE" ${a.country === 'VE' ? 'selected' : ''}>Venezuela</option><option value="CO" ${a.country === 'CO' ? 'selected' : ''}>Colombia</option><option value="CO-VE" ${a.country === 'CO-VE' ? 'selected' : ''}>Ambos</option></select>
        <input data-l="genre" value="${esc(a.genre)}" placeholder="Género" />
        <button type="button" class="icon danger" data-l-del>✕</button>
      </div>`
      )
      .join('');
  }
  const readLineup = () => $$('.lineup-row').map((r) => ({ name: $('[data-l=name]', r).value.trim(), country: $('[data-l=country]', r).value, genre: $('[data-l=genre]', r).value.trim() }));
  $('#addArtist').addEventListener('click', () => renderLineup([...readLineup(), { name: '', country: 'CO', genre: '' }]));
  $('#lineupRows').addEventListener('click', (e) => {
    if (!e.target.closest('[data-l-del]')) return;
    e.target.closest('.lineup-row').remove();
  });

  $('#eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const event = Object.fromEntries(EVENT_FIELDS.map((k) => [k, f[k].value.trim()]));
    event.registrationOpen = f.registrationOpen.checked;
    event.tablesOpen = f.tablesOpen.checked;
    event.lineup = readLineup().filter((a) => a.name);
    try {
      await api('/settings', { method: 'PUT', body: { event } });
      toast('Evento guardado ✅');
      S.summary = null;
      loadSettings();
    } catch (err) {
      fail(err);
    }
  });

  $('#mailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const m = Object.fromEntries(MAIL_FIELDS.map((k) => [k, f[k].value.trim()]));
    m.smtpSecure = f.smtpSecure.checked;
    try {
      await api('/settings', { method: 'PUT', body: { mail: m } });
      toast('Correo guardado ✅');
      loadSettings();
    } catch (err) {
      fail(err);
    }
  });
  $('#smtpTest').addEventListener('click', async () => {
    const to = $('#smtpTestTo').value.trim();
    if (!to) return toast('Escribe un correo para la prueba', true);
    try {
      const r = await api('/mail/test', { method: 'POST', body: { to } });
      toast(r.testMode ? '🧪 Modo prueba: revisa la bandeja de prueba' : '✅ Conexión correcta: revisa tu correo');
    } catch (err) {
      fail(err);
    }
  });

  $('#securityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/settings', { method: 'PUT', body: { adminPassword: e.target.adminPassword.value } });
      e.target.reset();
      toast('Contraseña actualizada ✅');
    } catch (err) {
      fail(err);
    }
  });

  $('#setTabs').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-set]');
    if (!b) return;
    $$('#setTabs button').forEach((x) => x.classList.toggle('active', x === b));
    $$('[data-set-panel]').forEach((p) => (p.hidden = p.dataset.setPanel !== b.dataset.set));
    if (b.dataset.set === 'outbox') loadOutbox().catch(fail);
  });

  async function loadOutbox() {
    const list = await api('/outbox');
    $('#outboxList').innerHTML =
      list.map((m) => `<button data-mail="${esc(m.id)}"><b>${esc(m.subject)}</b>${esc(m.to)} · ${esc(m.kind || '')}<br><span class="muted">${fmt(m.date)}</span></button>`).join('') ||
      '<p class="muted">Aquí aparecen los correos mientras estés en modo prueba.</p>';
    const first = list[0];
    if (first) openOutbox(first.id);
  }
  async function openOutbox(id) {
    const m = await api(`/outbox/${encodeURIComponent(id)}`);
    $$('#outboxList button').forEach((b) => b.classList.toggle('on', b.dataset.mail === id));
    $('#outboxFrame').srcdoc = m.html;
  }
  $('#outboxList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mail]');
    if (b) openOutbox(b.dataset.mail).catch(fail);
  });

  /* ---------- Inicio ---------- */
  poll();
  if (token) enter();
})();
