/* Landing de ¿Dónde es el After?: inscripción gratis, patrocinadores y reserva de mesas por WhatsApp. */
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
      registrationOpen: true,
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
    sponsors: [],
    sponsorConfig: {},
  };

  let state = FALLBACK;

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

    const q = encodeURIComponent(place(ev));
    $('#mapFrame').src = `https://www.google.com/maps?q=${q}&output=embed`;
    $('#mapsLink').href = `https://www.google.com/maps/search/?api=1&query=${q}`;
    const s = start(ev);
    const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    $('#calLink').href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${ev.title} ${ev.edition}`)}&dates=${f(s)}/${f(new Date(s.getTime() + 6 * 36e5))}&location=${q}&details=${encodeURIComponent(location.origin + location.pathname)}`;
    $$('[data-wa-mesa]').forEach((a) => (a.href = wa(tableMessage(ev))));
    $('#waHelp').href = wa(`Hola, tengo una pregunta sobre ${ev.title}`);
    $('#waFooter').href = wa(`Hola, quiero información de ${ev.title}`);

    if (!ev.registrationOpen) closeForm('#regForm', 'Las inscripciones están cerradas. ¡Gracias por tu interés!');
  }

  // Las mesas se reservan solo por WhatsApp: así el equipo confirma ubicación y condiciones en persona.
  // Antes de abrir WhatsApp se piden nombre, WhatsApp y correo (formulario #mesaForm).
  function tableMessage(ev, d = {}) {
    return [
      `¡Hola, ${ev.organizer}! 👋🥭`,
      `Quiero *reservar una mesa* para *${ev.title} ${ev.edition}* 🎉`,
      `📅 ${dayText(ev)} · ${timeText(ev)}`,
      `📍 ${ev.venue} · ${ev.venueDetail}, ${ev.city}`,
      '',
      '*Mis datos:*',
      `👤 Nombre: ${d.name || ''}`,
      `📱 WhatsApp: ${d.phone || ''}`,
      `✉️ Correo: ${d.email || ''}`,
      `👥 Personas: ${d.people || 'Por definir'}`,
      ...(d.occasion ? [`🎂 Ocasión: ${d.occasion}`] : []),
      '',
      '¿Me confirman disponibilidad, ubicación y condiciones de la mesa? ¡Gracias!',
    ].join('\n');
  }

  // Solo se redibujan si cambiaron, para que la animación no salte en cada actualización.
  let sponsorsKey = '';
  function renderSponsors() {
    const SP = window.MangoSponsors;
    const ev = state.event;
    $('#spCta').href = wa(`Hola, quiero ser patrocinador de ${ev.title} ${ev.edition}`);
    renderCredits(state.sponsorConfig || {});
    if (!SP) return;
    const list = state.sponsors || [];
    const cfg = state.sponsorConfig || {};
    const key = JSON.stringify([list, cfg]);
    if (key === sponsorsKey) return;
    sponsorsKey = key;
    // Mientras no haya logos, las franjas muestran al organizador y espacios para vender patrocinios.
    const join = wa(`Hola, quiero que mi marca esté en ${ev.title} ${ev.edition}`);
    const organizer = `<a class="sp-item sp-bg-glass sp-org" href="${join}" target="_blank" rel="noopener"><img src="assets/mangos-espaciales.webp" alt="Mangos Espaciales" /><span><small>Organiza</small>Mangos Espaciales</span></a>`;
    const slot = `<a class="sp-item sp-slot" href="${join}" target="_blank" rel="noopener"><b>Tu marca aquí</b><small>Patrocina este evento →</small></a>`;
    const slots = [organizer, slot, slot, slot];
    const featuredSlot = `<a class="sp-card sp-card-slot" href="${join}" target="_blank" rel="noopener"><div class="sp-card-logo"><b>Tu marca<br />aquí</b></div><div class="sp-card-foot"><span>Patrocinador oficial</span><em>Disponible ↗</em></div></a>`;
    SP.marquee($('#spTop'), list, cfg, { minItems: 10, placeholders: slots });
    SP.marquee($('#spMid'), list, cfg, { minItems: 8, scale: 1.9, placeholders: slots });
    SP.marquee($('#spLow'), list, cfg, { minItems: 8, scale: 1.7, reverse: true, placeholders: slots });
    $('#spTopWrap').hidden = $('#spMidWrap').hidden = $('#spLowWrap').hidden = false;
    SP.featured($('#spFeatured'), list, cfg, { placeholders: [featuredSlot, featuredSlot, featuredSlot] });
  }

  // Créditos del pie de página: sin enlace quedan como sello, sin ser tocables.
  function renderCredits(cfg) {
    [['#creditWeb', cfg.creditWeb], ['#creditTickets', cfg.creditTickets === undefined ? 'https://eventosid.com' : cfg.creditTickets]].forEach(([sel, url]) => {
      const a = $(sel);
      if (url) a.href = url;
      else a.removeAttribute('href');
      a.classList.toggle('nolink', !url);
    });
  }

  function closeForm(sel, msg) {
    const f = $(sel);
    $$('input, select, button', f).forEach((el) => (el.disabled = true));
    $('.form-error', f).textContent = msg;
  }


  /* ---------- Conexión con los datos ----------
     Sin sheetsUrl (js/after-config.js) todo va a /api: en Vercel son las funciones
     que guardan en Cloudinary y, más adelante, el servidor propio. */
  const SHEETS = ((window.AFTER_CONFIG || {}).sheetsUrl || '').trim();
  const OFFLINE = 'No pudimos conectar. Revisa tu internet e inténtalo de nuevo, o escríbenos por WhatsApp.';

  async function loadEvent() {
    if (SHEETS) {
      const res = await fetch(SHEETS, { cache: 'no-store' });
      const d = await res.json();
      if (!d.ok) throw new Error();
      return {
        ...FALLBACK,
        event: { ...FALLBACK.event, tableCount: d.tableCount || FALLBACK.event.tableCount },
        sponsors: d.sponsors || [],
        sponsorConfig: d.sponsorConfig || {},
      };
    }
    const res = await fetch('/api/public/event', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const d = await res.json();
    return { ...FALLBACK, ...d, event: { ...FALLBACK.event, ...(d.event || {}) } };
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
        : await fetch(kind === 'recover' ? '/api/public/recover' : '/api/public/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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

  /* ---------- Ventana del formulario ----------
     Los botones "Inscribirme" abren el formulario de una vez. Se usa el
     mismo formulario de la página: se mueve a la ventana y vuelve a su sitio al cerrar. */
  let moved = null;
  const SHEETS_TEXT = {
    gratis: { badge: 'Entrada GRATIS', title: 'Inscríbete gratis', sub: 'Solo mayores de 18 · Menos de 1 minuto · Tu QR al instante.' },
    recuperar: { badge: 'Ya inscritos', title: 'Recupera tu QR', sub: 'Solo con tu documento y tu correo · Sin volver a inscribirte.' },
    mesa: { badge: 'Reserva de mesa', title: 'Reserva tu mesa', sub: 'Atención personalizada por WhatsApp · Cupos limitados.' },
  };
  // Con registroUrl, la inscripción y la recuperación del QR van al módulo externo.
  const EMBED = ((window.AFTER_CONFIG || {}).registroUrl || '').trim();
  const EMBED_TEXT = {
    gratis: { badge: 'Entrada GRATIS', title: 'Inscríbete gratis', sub: 'Solo mayores de 18 · Menos de 1 minuto · Tu QR al instante.' },
    recuperar: { badge: 'Ya inscritos', title: 'Recupera tu QR', sub: 'Ingresa con tu documento y el correo con el que te registraste.' },
  };
  if (EMBED) {
    $('#regForm').hidden = true;
    $('#regCta').hidden = false;
    $('#embedOpen').href = EMBED;
    $('#embedFrame').addEventListener('load', () => $('#embedBox').classList.add('ready'));
  }
  function openEmbed(kind) {
    const t = EMBED_TEXT[kind] || EMBED_TEXT.gratis;
    $('#sheetBadge').textContent = t.badge;
    $('#sheetTitle').textContent = t.title;
    $('#sheetSub').textContent = t.sub;
    const f = $('#embedFrame');
    if (!f.src) f.src = EMBED; // se carga una vez; al cerrar y abrir conserva lo escrito
    $('#embedBox').hidden = false;
    $('#sheet').classList.add('embed');
    $('#sheet').hidden = false;
    document.body.classList.add('no-scroll');
  }

  function openSheet(kind) {
    closeSheet();
    if (EMBED && kind !== 'mesa') return openEmbed(kind);
    const node = { mesa: $('#mesaForm'), recuperar: $('#recoverForm') }[kind] || $('#regForm');
    moved = { node, parent: node.parentNode, next: node.nextSibling };
    const t = SHEETS_TEXT[kind] || SHEETS_TEXT.gratis;
    $('#sheetBadge').textContent = t.badge;
    $('#sheetTitle').textContent = t.title;
    $('#sheetSub').textContent = t.sub;
    $('#sheetBody').appendChild(node);
    $('#sheetBody').scrollTop = 0;
    $('#sheet').hidden = false;
    document.body.classList.add('no-scroll');
    setTimeout(() => $('input:not([type=checkbox]):not(.hp)', node).focus(), 250);
  }
  function closeSheet() {
    if (moved) {
      moved.parent.insertBefore(moved.node, moved.next);
      moved = null;
    }
    $('#sheet').hidden = true;
    $('#sheet').classList.remove('embed');
    $('#embedBox').hidden = true;
    if ($('#modal').hidden) document.body.classList.remove('no-scroll');
  }
  $('#sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet' || e.target.closest('.sheet-close')) closeSheet();
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tab-open], [data-wa-mesa]');
    if (a) {
      e.preventDefault();
      openSheet(a.matches('[data-wa-mesa]') ? 'mesa' : a.dataset.tabOpen);
    }
    if (e.target.closest('#navLinks a')) $('#navLinks').classList.remove('open');
  });
  $('#navToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));

  /* ---------- Envío de formularios ---------- */
  function formData(form) {
    const d = Object.fromEntries(new FormData(form));
    d.consent = form.consent.checked;
    d.adult = form.adult.checked;
    d.ref = ref();
    d.website = form.website ? form.website.value : '';
    return d;
  }

  function validate(form) {
    const d = formData(form);
    if (!d.name || d.name.trim().length < 3) return 'Escribe tu nombre completo.';
    if (!d.doc || d.doc.trim().length < 4) return 'Escribe tu número de documento.';
    if (!d.phone || d.phone.replace(/\D/g, '').length < 7) return 'Escribe tu celular.';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email || '')) return 'Escribe un correo válido.';
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
        intro: d.existing ? (d.emailSent === false ? 'Aquí tienes de nuevo tu código.' : 'Te reenviamos tu código al correo.') : `Tu entrada <b>GRATIS</b> quedó registrada, ${esc(d.name.split(' ')[0])}.`,
        code: d.code,
        qr: d.qr,
        email: d.email,
        emailed: d.emailSent !== false,
        share: true,
      })
    );
  });

  /* ---------- Recuperar QR ---------- */
  $('#recoverForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const err = $('.form-error', form);
    const btn = $('button[type=submit]', form);
    const doc = form.doc.value.trim();
    const email = form.email.value.trim();
    err.textContent = doc.replace(/\W/g, '').length < 4 ? 'Escribe tu número de documento.' : !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) ? 'Escribe el correo con el que te inscribiste.' : '';
    if (err.textContent) return;
    btn.disabled = true;
    btn.textContent = 'Buscando…';
    try {
      const d = await send('recover', { doc, email });
      form.reset();
      success({
        title: `¡Aquí está tu QR, ${d.name.split(' ')[0]}!`,
        intro: 'Tu inscripción sigue activa ✅ No tienes que volver a inscribirte.',
        code: d.code,
        qr: d.qr,
        email: d.email,
        emailed: false,
        share: true,
      });
    } catch (er) {
      err.textContent = er.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔑 Recuperar mi QR';
    }
  });

  /* ---------- Mesa por WhatsApp ---------- */
  const MESA_KEY = 'after_mesa';
  try {
    const prev = JSON.parse(localStorage.getItem(MESA_KEY) || '{}');
    ['name', 'phone', 'email'].forEach((k) => prev[k] && ($('#mesaForm')[k].value = prev[k]));
  } catch (e) {
    /* sin almacenamiento: el formulario empieza vacío */
  }

  $('#mesaForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const d = Object.fromEntries(['name', 'phone', 'email', 'people', 'occasion'].map((k) => [k, form[k].value.trim().replace(/\s+/g, ' ')]));
    const err = $('.form-error', form);
    err.textContent =
      d.name.length < 3 ? 'Escribe tu nombre completo.'
      : d.phone.replace(/\D/g, '').length < 7 ? 'Escribe tu número de WhatsApp.'
      : !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email) ? 'Escribe un correo válido.'
      : !form.adult.checked ? 'El evento es solo para mayores de 18 años.'
      : '';
    if (err.textContent) return;
    try {
      localStorage.setItem(MESA_KEY, JSON.stringify({ name: d.name, phone: d.phone, email: d.email }));
    } catch (er) {
      /* no es necesario recordar los datos */
    }
    const url = wa(tableMessage(state.event, d));
    // se abre en el mismo clic (si no, el navegador lo bloquea); en celular abre la app de WhatsApp
    const win = window.open(url, '_blank');
    if (!win) location.href = url;
    closeSheet();
    $('#modalBody').innerHTML = `
      <div class="success">
        <h2>¡Ya casi, ${esc(d.name.split(' ')[0])}!</h2>
        <p>Te abrimos <b>WhatsApp</b> con tu solicitud de mesa lista. <b>Solo pulsa enviar</b> y te confirmamos disponibilidad, ubicación y condiciones.</p>
        <p class="small">Recuerda: cada persona de tu mesa también se inscribe <b>gratis</b> para recibir su QR de ingreso.</p>
        <div class="actions">
          <a class="btn btn-whatsapp" href="${url}" target="_blank" rel="noopener">💬 Abrir WhatsApp de nuevo</a>
          <button class="btn btn-red" data-close data-tab-open="gratis">🎟️ Inscribirme gratis</button>
        </div>
      </div>`;
    $('#modal').hidden = false;
    document.body.classList.add('no-scroll');
  });

  /* ---------- Confirmación ---------- */
  function success({ title, intro, code, qr, email, emailed, share, invite }) {
    closeSheet();
    const ev = state.event;
    const shareText = `¡Vamos pa' ${ev.title} ${ev.edition} en ${ev.city}! Entrada gratis con inscripción: ${location.origin}${location.pathname}`;
    $('#modalBody').innerHTML = `
      <div class="success">
        <h2>${esc(title)}</h2>
        <p>${intro}</p>
        <div class="code">${esc(code)}</div>
        <img class="qr" src="${qr}" alt="Código QR ${esc(code)}" />
        ${
          emailed
            ? `<p>Te enviamos tu QR a <b>${esc(email)}</b>. Preséntalo con tu documento en la entrada.</p>
        <p class="small">¿No lo ves? Revisa spam o promociones.</p>`
            : `<p><b>Descarga tu QR o tómale captura</b> y preséntalo con tu documento en la entrada.</p>`
        }
        <div class="actions">
          ${emailed ? '' : `<a class="btn btn-yellow" id="qrDownload" href="${qr}" download="Entrada-${esc(code)}.png">⬇️ Descargar mi entrada</a>`}
          <a class="btn btn-blue" href="${$('#calLink').href}" target="_blank" rel="noopener">📆 Agregar al calendario</a>
          ${invite ? `<button class="btn btn-red" data-close data-tab-open="gratis">🎟️ Inscribir a mis acompañantes</button>` : ''}
          ${share ? `<a class="btn btn-whatsapp" href="https://wa.me/?text=${encodeURIComponent(shareText)}" target="_blank" rel="noopener">💬 Invitar a mis panas</a>` : ''}
        </div>
      </div>`;
    $('#modal').hidden = false;
    document.body.classList.add('no-scroll');
    confetti();
    if (!emailed) ticketImage(qr, code).then((url) => url && $('#qrDownload') && ($('#qrDownload').href = url));
  }

  // Entrada descargable: QR, código, fecha y lugar en una imagen lista para mostrar en la puerta.
  function ticketImage(qr, code) {
    return new Promise((resolve) => {
      const ev = state.event;
      const img = new Image();
      img.onload = () => {
        const W = 720, H = 1040;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const x = c.getContext('2d');
        x.fillStyle = '#FFF8E7';
        x.fillRect(0, 0, W, H);
        ['#FCD116', '#003893', '#CE1126'].forEach((col, i) => {
          x.fillStyle = col;
          x.fillRect((W / 3) * i, 0, W / 3 + 1, 18);
        });
        x.textAlign = 'center';
        x.fillStyle = '#1B1530';
        x.font = '800 30px "Plus Jakarta Sans", sans-serif';
        x.fillText(ev.organizer.toUpperCase() + ' PRESENTA', W / 2, 84);
        x.fillStyle = '#CE1126';
        x.font = '400 64px Anton, Impact, sans-serif';
        x.fillText(`${ev.title} ${ev.edition}`.toUpperCase(), W / 2, 160, W - 60);
        x.fillStyle = '#1B1530';
        x.font = '700 28px "Plus Jakarta Sans", sans-serif';
        x.fillText(`${dayText(ev)} · ${timeText(ev)}`, W / 2, 212);
        x.fillText(`${ev.venue} · ${ev.venueDetail}, ${ev.city}`, W / 2, 252, W - 60);
        x.imageSmoothingEnabled = false;
        x.fillStyle = '#fff';
        x.fillRect(150, 290, 420, 420);
        x.drawImage(img, 160, 300, 400, 400);
        x.fillStyle = '#1B1530';
        x.font = '400 64px Anton, Impact, sans-serif';
        x.fillText(code, W / 2, 800);
        x.font = '800 30px "Plus Jakarta Sans", sans-serif';
        x.fillStyle = '#CE1126';
        x.fillText('ENTRADA GRATIS · SOLO +18', W / 2, 858);
        x.fillStyle = '#1B1530';
        x.font = '500 24px "Plus Jakarta Sans", sans-serif';
        x.fillText('Presenta este QR con tu documento en la entrada.', W / 2, 920, W - 60);
        x.fillText('Entrada personal e intransferible.', W / 2, 956);
        try {
          resolve(c.toDataURL('image/png'));
        } catch (e) {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = qr;
    });
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
  setInterval(refresh, 60000); // patrocinadores al día
})();
