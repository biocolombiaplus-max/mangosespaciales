/* Landing de ¿Dónde es el After?: datos en vivo, inscripción gratis y reserva de mesas. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Respaldo por si la página se abre sin el servidor.
  const FALLBACK = {
    event: {
      title: '¿Dónde es el After?', edition: 'Vol. 1', city: 'Cúcuta', tagline: 'De Venezuela para el mundo',
      subtitle: 'La fiesta colombo-venezolana para recordar y gozar como en las mejores fiestas de los 80, 90 y 2000.',
      date: '2026-10-24T18:00', venue: 'Patín de la Fruta', venueDetail: 'Malecón', address: 'Malecón, Cúcuta, Norte de Santander',
      whatsapp: '573005081812', organizer: 'Mangos Espaciales', tableCount: 30, tableSeats: 6,
      tableConditions: '', registrationOpen: true, tablesOpen: true,
      lineup: [
        { name: "Billo's Caracas Boys", country: 'VE', genre: 'Orquesta bailable' },
        { name: 'Los Melódicos', country: 'VE', genre: 'Orquesta bailable' },
        { name: 'Natusha', country: 'VE', genre: 'Tecnomerengue' },
        { name: 'Miguel Moly', country: 'VE', genre: 'Merengue' },
        { name: 'Caramelos de Cianuro', country: 'VE', genre: 'Rock' },
        { name: 'Los Amigos Invisibles', country: 'VE', genre: 'Funk · Acid jazz' },
        { name: 'Danny Ocean', country: 'VE', genre: 'Pop urbano' },
      ],
    },
    tablesTaken: [],
    sponsors: [],
    sponsorConfig: {},
  };

  let state = FALLBACK;
  let selectedTable = null;

  // ref = contacto que llegó desde un correo de invitación
  const params = new URLSearchParams(location.search);
  if (params.get('ref')) sessionStorage.setItem('after_ref', params.get('ref'));
  const ref = () => sessionStorage.getItem('after_ref') || '';

  const start = (ev) => new Date(`${ev.date}:00-05:00`);
  function dayText(ev) {
    const s = start(ev).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const timeText = (ev) => start(ev).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
  const phoneText = (n) => String(n).replace(/\D/g, '').replace(/^57/, '').replace(/(\d{3})(\d{3})(\d+)/, '$1 $2 $3');
  const wa = (text) => `https://wa.me/${String(state.event.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  const place = (ev) => `${ev.venue} ${ev.venueDetail}, ${ev.address}`;

  /* ---------- Render ---------- */
  function render() {
    const ev = state.event;
    const binds = {
      organizer: ev.organizer, edition: ev.edition, city: ev.city, subtitle: ev.subtitle, venue: ev.venue,
      venueDetail: ev.venueDetail, address: ev.address, day: dayText(ev), time: timeText(ev),
      tableCount: ev.tableCount, phone: phoneText(ev.whatsapp),
    };
    $$('[data-bind]').forEach((n) => {
      const v = binds[n.dataset.bind];
      if (v !== undefined && v !== '') n.textContent = v;
    });

    const lineup = ev.lineup || [];
    $('#lineup').innerHTML =
      lineup
        .map((a, i) => `<article class="artist"><span class="cflag ${esc(a.country)}" title="${a.country === 'CO' ? 'Colombia' : a.country === 'VE' ? 'Venezuela' : 'Colombia y Venezuela'}"></span>
          <span class="num">${String(i + 1).padStart(2, '0')}</span><h3>${esc(a.name)}</h3><span class="genre">${esc(a.genre)}</span></article>`)
        .join('') + '<article class="artist more"><h3>¡Y muchos más!</h3><span class="genre" style="color:#fff">Gaitas, salsa, vallenato y los clásicos de la frontera</span></article>';
    const names = lineup.map((a) => `<span>${esc(a.name)}</span><span>★</span>`).join('');
    $('#ticker').innerHTML = names + names;

    renderSponsors();
    renderTables();
    $('#peopleSelect').innerHTML = [...Array(Number(ev.tableSeats) || 1)].map((_, i) => `<option value="${i + 1}">${i + 1} persona${i ? 's' : ''}</option>`).join('');
    $('#peopleSelect').value = ev.tableSeats;
    $('#tableConditions').textContent = ev.tableConditions || '';

    const q = encodeURIComponent(place(ev));
    $('#mapFrame').src = `https://www.google.com/maps?q=${q}&output=embed`;
    $('#mapsLink').href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    const s = start(ev);
    const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    $('#calLink').href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${ev.title} ${ev.edition}`)}&dates=${f(s)}/${f(new Date(s.getTime() + 6 * 36e5))}&location=${q}&details=${encodeURIComponent(location.origin + location.pathname)}`;
    $('#waTables').href = wa(`Hola, quiero reservar una mesa para ${ev.title} ${ev.edition}`);
    $('#waHelp').href = wa(`Hola, tengo una pregunta sobre ${ev.title}`);
    $('#waFooter').href = wa(`Hola, quiero información de ${ev.title}`);

    if (!ev.registrationOpen) closeForm('#regForm', 'Las inscripciones están cerradas. ¡Gracias por tu interés!');
    if (!ev.tablesOpen) closeForm('#tableForm', 'La reserva de mesas está cerrada. Escríbenos por WhatsApp.');
  }

  // Solo se redibujan si cambiaron, para que la animación no salte en cada actualización.
  let sponsorsKey = '';
  function renderSponsors() {
    const SP = window.MangoSponsors;
    const ev = state.event;
    $('#spCta').href = wa(`Hola, quiero ser patrocinador de ${ev.title} ${ev.edition}`);
    if (!SP) return;
    const list = state.sponsors || [];
    const cfg = state.sponsorConfig || {};
    const key = JSON.stringify([list, cfg]);
    if (key === sponsorsKey) return;
    sponsorsKey = key;
    // Mientras no haya logos, las franjas muestran al organizador y espacios para vender patrocinios.
    const join = wa(`Hola, quiero que mi marca esté en ${ev.title} ${ev.edition}`);
    const organizer = `<a class="sp-item sp-bg-glass sp-org" href="${join}" target="_blank" rel="noopener"><img src="assets/mango-logo.svg" alt="" /><span><small>Organiza</small>Mangos Espaciales</span></a>`;
    const slot = `<a class="sp-item sp-slot" href="${join}" target="_blank" rel="noopener"><b>Tu marca aquí</b><small>Patrocina este evento →</small></a>`;
    const slots = [organizer, slot, slot, slot];
    const featuredSlot = `<a class="sp-card sp-card-slot" href="${join}" target="_blank" rel="noopener"><div class="sp-card-logo"><b>Tu marca<br />aquí</b></div><div class="sp-card-foot"><span>Patrocinador oficial</span><em>Disponible ↗</em></div></a>`;
    SP.marquee($('#spTop'), list, cfg, { minItems: 10, placeholders: slots });
    SP.marquee($('#spMid'), list, cfg, { minItems: 8, scale: 1.9, placeholders: slots });
    SP.marquee($('#spLow'), list, cfg, { minItems: 8, scale: 1.7, reverse: true, placeholders: slots });
    $('#spTopWrap').hidden = $('#spMidWrap').hidden = $('#spLowWrap').hidden = false;
    SP.featured($('#spFeatured'), list, cfg, { placeholders: [featuredSlot, featuredSlot, featuredSlot] });
  }

  function closeForm(sel, msg) {
    const f = $(sel);
    $$('input, select, button', f).forEach((el) => (el.disabled = true));
    $('.form-error', f).textContent = msg;
  }

  function renderTables() {
    const ev = state.event;
    const taken = new Set(state.tablesTaken);
    if (selectedTable && taken.has(selectedTable)) selectedTable = null;
    $('#tableMap').innerHTML = [...Array(Number(ev.tableCount) || 0)]
      .map((_, i) => {
        const n = i + 1;
        const t = taken.has(n);
        return `<button type="button" class="tbl ${selectedTable === n ? 'selected' : ''}" data-table="${n}" ${t ? 'disabled' : ''} aria-label="Mesa ${n}${t ? ' reservada' : ''}">${n}</button>`;
      })
      .join('');
    const left = ev.tableCount - taken.size;
    $('#tablesLeft').textContent = left > 0 ? `${left} de ${ev.tableCount} mesas libres` : 'Mesas agotadas';
    $('#tablesLeftTab').textContent = left > 0 ? `${left} libres` : 'agotadas';
    updatePicked();
  }

  function updatePicked() {
    const p = $('#picked');
    p.classList.toggle('on', !!selectedTable);
    p.textContent = selectedTable ? `✅ Mesa #${selectedTable} seleccionada` : '👈 Elige una mesa en el mapa';
    $('#tableSubmit').disabled = !selectedTable || !state.event.tablesOpen;
    $('#tableSubmit').textContent = selectedTable ? `Reservar mesa #${selectedTable}` : 'Reservar mesa';
  }

  /* ---------- Conexión con los datos ----------
     Con sheetsUrl (js/after-config.js) las inscripciones van a Google Sheets;
     sin él, al servidor propio de Mangos Espaciales (/api). */
  const SHEETS = ((window.AFTER_CONFIG || {}).sheetsUrl || '').trim();
  const OFFLINE = 'No pudimos conectar. Revisa tu internet e inténtalo de nuevo, o escríbenos por WhatsApp.';

  async function loadEvent() {
    if (SHEETS) {
      const res = await fetch(SHEETS, { cache: 'no-store' });
      const d = await res.json();
      if (!d.ok) throw new Error();
      return {
        ...FALLBACK,
        event: { ...FALLBACK.event, tableCount: d.tableCount, tableSeats: d.tableSeats },
        tablesTaken: d.tablesTaken,
        sponsors: d.sponsors || [],
        sponsorConfig: d.sponsorConfig || {},
      };
    }
    const res = await fetch('/api/public/event', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    return res.json();
  }

  function qrDataUrl(text) {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createDataURL(8, 2);
  }

  async function send(kind, payload) {
    let res;
    try {
      res = SHEETS
        ? // text/plain evita la verificación previa (CORS) que Google no responde
          await fetch(SHEETS, { method: 'POST', body: JSON.stringify({ action: kind, ...payload }) })
        : await fetch(kind === 'register' ? '/api/public/register' : '/api/public/table', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (e) {
      throw new Error(OFFLINE);
    }
    const data = await res.json().catch(() => ({ error: OFFLINE }));
    if (!res.ok || data.error) throw new Error(data.error || 'No se pudo completar. Inténtalo de nuevo.');
    if (!data.qr) data.qr = qrDataUrl(data.code);
    return data;
  }

  async function refresh() {
    try {
      state = await loadEvent();
    } catch (e) {
      /* sin conexión se muestra la información base del evento */
    }
    render();
  }

  /* ---------- Pestañas ---------- */
  function openTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.tab-panel').forEach((p) => (p.hidden = p.dataset.panel !== name));
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => openTab(t.dataset.tab)));
  /* ---------- Ventana del formulario ----------
     Los botones "Inscribirme" y "Mesa" abren el formulario de una vez. Se usa el
     mismo formulario de la página: se mueve a la ventana y vuelve a su sitio al cerrar. */
  let moved = null;
  const SHEETS_TEXT = {
    gratis: { badge: 'Entrada GRATIS', title: 'Inscríbete gratis', sub: 'Solo mayores de 18 · Menos de 1 minuto · Tu QR llega a tu correo.' },
    mesa: { badge: 'Reserva de mesa', title: 'Elige tu mesa', sub: 'Toca una mesa libre en el mapa y completa tus datos.' },
  };
  function openSheet(kind) {
    closeSheet();
    openTab(kind);
    const node = kind === 'mesa' ? $('[data-panel="mesa"] .panel-grid') : $('#regForm');
    moved = { node, parent: node.parentNode, next: node.nextSibling };
    const t = SHEETS_TEXT[kind];
    $('#sheetBadge').textContent = t.badge;
    $('#sheetTitle').textContent = t.title;
    $('#sheetSub').textContent = t.sub;
    $('#sheet').classList.toggle('wide', kind === 'mesa');
    $('#sheetBody').appendChild(node);
    $('#sheetBody').scrollTop = 0;
    $('#sheet').hidden = false;
    document.body.classList.add('no-scroll');
    if (kind === 'gratis') setTimeout(() => $('#regForm [name=name]').focus(), 250);
  }
  function closeSheet() {
    if (moved) {
      moved.parent.insertBefore(moved.node, moved.next);
      moved = null;
    }
    $('#sheet').hidden = true;
    if ($('#modal').hidden) document.body.classList.remove('no-scroll');
  }
  $('#sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet' || e.target.closest('.sheet-close')) closeSheet();
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tab-open]');
    if (a) {
      e.preventDefault();
      openSheet(a.dataset.tabOpen);
    }
    if (e.target.closest('#navLinks a')) $('#navLinks').classList.remove('open');
  });
  $('#navToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));

  $('#tableMap').addEventListener('click', (e) => {
    const b = e.target.closest('[data-table]');
    if (!b || b.disabled) return;
    selectedTable = Number(b.dataset.table);
    renderTables();
    if (window.innerWidth < 1020) $('#picked').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Envío de formularios ---------- */
  function formData(form) {
    const d = Object.fromEntries(new FormData(form));
    d.consent = form.consent.checked;
    d.adult = form.adult.checked;
    d.ref = ref();
    return d;
  }

  function validate(form) {
    const d = formData(form);
    if (!d.name || d.name.trim().length < 3) return 'Escribe tu nombre completo.';
    if (!d.doc || d.doc.trim().length < 4) return 'Escribe tu número de documento.';
    if (!d.phone || d.phone.replace(/\D/g, '').length < 7) return 'Escribe tu celular.';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email || '')) return 'Escribe un correo válido: ahí te llega tu QR.';
    if (form.barrio && !(d.barrio || '').trim()) return 'Escribe tu barrio.';
    if (!d.adult) return 'El evento es solo para mayores de 18 años.';
    if (!d.consent) return 'Debes autorizar el tratamiento de datos.';
    return '';
  }

  async function submit(form, kind, extra, onSuccess) {
    const err = $('.form-error', form);
    const btn = $('button[type=submit]', form);
    err.textContent = validate(form);
    if (err.textContent) return;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const data = await send(kind, { ...formData(form), ...extra });
      form.reset();
      onSuccess(data);
    } catch (e) {
      err.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
      refresh();
    }
  }

  $('#regForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submit(e.target, 'register', {}, (d) =>
      success({
        title: d.existing ? '¡Ya estabas inscrito!' : '¡Estás dentro!',
        intro: d.existing ? 'Te reenviamos tu código al correo.' : `Tu entrada <b>GRATIS</b> quedó registrada, ${esc(d.name.split(' ')[0])}.`,
        code: d.code,
        qr: d.qr,
        email: d.email,
        share: true,
      })
    );
  });

  $('#tableForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedTable) {
      $('.form-error', e.target).textContent = 'Elige una mesa en el mapa.';
      return;
    }
    submit(e.target, 'table', { table: selectedTable, people: Number($('#peopleSelect').value) }, (d) => {
      selectedTable = null;
      success({
        title: `¡Mesa #${d.table} reservada!`,
        intro: `Para ${d.people} personas. Recuerda: <b>cada acompañante debe inscribirse gratis</b>.`,
        code: d.code,
        qr: d.qr,
        email: d.email,
        share: true,
        invite: true,
      });
    });
  });

  /* ---------- Confirmación ---------- */
  function success({ title, intro, code, qr, email, share, invite }) {
    closeSheet();
    const ev = state.event;
    const shareText = `¡Vamos pa' ${ev.title} ${ev.edition} en ${ev.city}! Entrada gratis con inscripción: ${location.origin}${location.pathname}`;
    $('#modalBody').innerHTML = `
      <div class="success">
        <h2>${esc(title)}</h2>
        <p>${intro}</p>
        <div class="code">${esc(code)}</div>
        <img class="qr" src="${qr}" alt="Código QR ${esc(code)}" />
        <p>Te enviamos tu QR a <b>${esc(email)}</b>. Preséntalo con tu documento en la entrada.</p>
        <p class="small">¿No lo ves? Revisa spam o promociones.</p>
        <div class="actions">
          <a class="btn btn-blue" href="${$('#calLink').href}" target="_blank" rel="noopener">📆 Agregar al calendario</a>
          ${invite ? `<button class="btn btn-red" data-close data-tab-open="gratis">🎟️ Inscribir a mis acompañantes</button>` : ''}
          ${share ? `<a class="btn btn-whatsapp" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">💬 Invitar a mis panas</a>` : ''}
        </div>
      </div>`;
    $('#modal').hidden = false;
    document.body.classList.add('no-scroll');
    confetti();
  }

  function closeModal() {
    $('#modal').hidden = true;
    document.body.classList.remove('no-scroll');
  }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.closest('.modal-close') || e.target.closest('[data-close]')) {
      closeModal();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeModal();
    closeSheet();
  });

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#FCD116', '#003893', '#CE1126', '#FF2D7A', '#1BA6B8'];
    const box = document.createElement('div');
    box.className = 'confetti';
    box.innerHTML = [...Array(80)]
      .map(() => `<i style="left:${Math.random() * 100}%;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 0.6}s;transform:rotate(${Math.random() * 360}deg)"></i>`)
      .join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5000);
  }

  /* ---------- Cuenta regresiva ---------- */
  function tick() {
    const diff = Math.max(0, start(state.event) - Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    $('#cdD').textContent = pad(Math.floor(diff / 864e5));
    $('#cdH').textContent = pad(Math.floor(diff / 36e5) % 24);
    $('#cdM').textContent = pad(Math.floor(diff / 6e4) % 60);
    $('#cdS').textContent = pad(Math.floor(diff / 1e3) % 60);
  }

  render();
  refresh();
  tick();
  setInterval(tick, 1000);
  setInterval(refresh, 60000); // mesas y cupos al día
})();
