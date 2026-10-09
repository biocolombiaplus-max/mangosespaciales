/* Utilidades y componentes compartidos por las páginas públicas. */
(function () {
  const S = window.MangoStore;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:|mailto:|tel:|data:image\/)/i.test(u || '') ? u : '#');

  const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const dateParts = (iso) => {
    const d = new Date(iso);
    return { day: d.getDate(), month: MONTHS[d.getMonth()], year: d.getFullYear() };
  };
  const fmtDate = (iso, withTime = true) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const s = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return (s.charAt(0).toUpperCase() + s.slice(1)) + (withTime ? ' · ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '');
  };

  const waLink = (data, text) => `https://wa.me/${(data.settings.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  const eventUrl = (ev) => `evento.html?id=${encodeURIComponent(ev.id)}`;

  /* ---------- Tarjeta de evento (cartelera) ---------- */
  function eventCard(data, ev) {
    const p = dateParts(ev.date);
    const left = S.eventAvailable(data, ev);
    const soldOut = left === 0 || ev.status === 'agotado';
    return `<article class="ev-card">
      <a href="${eventUrl(ev)}" class="ev-media">
        <img src="${esc(safeUrl(ev.mainImage))}" alt="${esc(ev.title)}" loading="lazy" onerror="this.style.opacity=0" />
        <span class="ev-date"><b>${p.day}</b>${p.month}</span>
        <span class="ev-cat">${esc(ev.category)}</span>
        ${soldOut ? '<span class="ev-flag sold">Agotado</span>' : left <= 30 ? '<span class="ev-flag hot">🔥 Últimas boletas</span>' : ''}
      </a>
      <div class="ev-body">
        <h3><a href="${eventUrl(ev)}">${esc(ev.title)}</a></h3>
        <p class="ev-meta">📍 ${esc(ev.venue)} · ${esc(ev.city)}</p>
        <p class="ev-meta">🕒 ${fmtDate(ev.date)}</p>
        <div class="ev-foot">
          <div><small>Desde</small><b>${S.money(S.minPrice(ev), data.settings.currency)}</b></div>
          <a class="btn ${soldOut ? 'btn-light' : 'btn-primary'} btn-sm" href="${eventUrl(ev)}">${soldOut ? 'Ver evento' : 'Comprar'}</a>
        </div>
      </div>
    </article>`;
  }

  /* ---------- Encabezado y pie de página ---------- */
  function renderChrome(data) {
    const st = data.settings;
    const socials = [
      ['Instagram', st.instagram, 'IG'],
      ['Facebook', st.facebook, 'FB'],
      ['TikTok', st.tiktok, 'TT'],
      ['YouTube', st.youtube, 'YT'],
    ].filter(([, u]) => u);
    const socialLinks = socials.map(([n, u, s]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" aria-label="${n}">${s}</a>`).join('');

    const header = $('#siteHeader');
    if (header) {
      header.innerHTML = `
      <div class="topbar">
        <div class="container topbar-inner">
          <span>🔒 Compra 100% segura</span>
          <span class="hide-sm">💬 Soporte por WhatsApp</span>
          <span class="hide-sm">✉️ ${esc(st.email)}</span>
          <div class="topbar-social">${socialLinks}</div>
        </div>
      </div>
      <div class="header">
        <div class="container header-inner">
          <a class="brand" href="index.html">
            <img src="assets/mango-logo.svg" alt="" width="46" height="46" />
            <span><b>${esc(st.brand)}</b><small>${esc(st.slogan)}</small></span>
          </a>
          <form class="search" action="index.html#eventos" role="search">
            <span aria-hidden="true">🔎</span>
            <input name="q" type="search" placeholder="Busca eventos, artistas o ciudades" aria-label="Buscar eventos" />
            <button class="btn btn-primary btn-sm" type="submit">Buscar</button>
          </form>
          <nav class="nav-links" id="navLinks">
            <a href="index.html#eventos">Eventos</a>
            <a href="index.html#organiza">Organiza tu evento</a>
            <a href="index.html#ayuda">Ayuda</a>
            <button class="link-btn" data-lookup>Mi reserva</button>
          </nav>
          <a class="btn btn-mango btn-sm header-cta" href="index.html#eventos">🎟️ <span class="hide-xs">Comprar </span>boletas</a>
          <button class="nav-toggle" id="navToggle" aria-label="Abrir menú">☰</button>
        </div>
      </div>`;
      const q = new URLSearchParams(location.search).get('q');
      if (q) $('.search input').value = q;
      $('#navToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
    }

    const footer = $('#siteFooter');
    if (footer) {
      const cats = (st.categories || []).map((c) => `<a href="index.html?cat=${encodeURIComponent(c)}#eventos">${esc(c)}</a>`).join('');
      const pays = String(st.paymentMethods || '').split(',').map((p) => p.trim()).filter(Boolean).map((p) => `<span>${esc(p)}</span>`).join('');
      footer.innerHTML = `
      <div class="container footer-grid">
        <div class="footer-brand">
          <a class="brand" href="index.html"><img src="assets/mango-logo.svg" alt="" width="48" height="48" /><span><b>${esc(st.brand)}</b><small>${esc(st.slogan)}</small></span></a>
          <p>Organizamos, producimos y vendemos eventos que la gente no olvida. Boletería, patrocinios y marketing en un solo lugar.</p>
          <div class="footer-social">${socialLinks}</div>
        </div>
        <div><h4>Eventos</h4>${cats}</div>
        <div><h4>Ayuda</h4>
          <a href="index.html#ayuda">Preguntas frecuentes</a>
          <button class="link-btn" data-lookup>Consultar mi reserva</button>
          <a href="legal.html#terminos">Términos y condiciones</a>
          <a href="legal.html#privacidad">Política de datos personales</a>
          <a href="index.html#organiza">Organiza tu evento</a>
        </div>
        <div><h4>Contacto</h4>
          <a href="${waLink(data, '¡Hola! Necesito información')}" target="_blank" rel="noopener">💬 WhatsApp ${esc(st.phone)}</a>
          <a href="mailto:${esc(st.email)}">✉️ ${esc(st.email)}</a>
          <span>📍 ${esc(st.address)}</span>
        </div>
      </div>
      <div class="container footer-pay"><small>Medios de pago</small><div>${pays}</div></div>
      <div class="footer-bottom"><div class="container">© ${new Date().getFullYear()} ${esc(st.brand)} · Todos los derechos reservados</div></div>`;
    }

    let wa = $('#waFloat');
    if (!wa) {
      wa = document.createElement('a');
      wa.id = 'waFloat';
      wa.className = 'whatsapp-float';
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.setAttribute('aria-label', 'Escríbenos por WhatsApp');
      wa.innerHTML = '<svg viewBox="0 0 32 32" width="30" height="30" fill="#fff"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.3-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.1 2.2.9 3 1 4.1.8.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z"/></svg>';
      document.body.appendChild(wa);
    }
    wa.href = waLink(data, '¡Hola! Quiero información sobre sus eventos');
  }

  /* ---------- Modal genérico ---------- */
  function ensureModal() {
    let m = $('#modal');
    if (m) return m;
    m = document.createElement('div');
    m.className = 'modal';
    m.id = 'modal';
    m.hidden = true;
    m.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true"><button class="modal-close" aria-label="Cerrar">✕</button><div class="modal-body"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', (e) => (e.target === m || e.target.closest('.modal-close')) && closeModal());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
    return m;
  }
  function openModal(html) {
    const m = ensureModal();
    $('.modal-card', m).classList.remove('wide');
    $('.modal-body', m).innerHTML = html;
    m.hidden = false;
    document.body.classList.add('no-scroll');
    return $('.modal-body', m);
  }
  function closeModal() {
    const m = $('#modal');
    if (m) m.hidden = true;
    document.body.classList.remove('no-scroll');
  }

  /* ---------- Consultar reserva ---------- */
  function openLookup() {
    const body = openModal(`
      <span class="kicker">Mi reserva</span>
      <h2>Consulta tu reserva</h2>
      <p class="muted">Ingresa el código que recibiste y tu número de documento.</p>
      <form class="form" id="lookupForm">
        <label>Código de reserva<input name="code" placeholder="ME-XXXXXX" required /></label>
        <label>Documento<input name="doc" required inputmode="numeric" /></label>
        <button class="btn btn-primary btn-block" type="submit">Consultar</button>
      </form>
      <div id="lookupResult"></div>`);
    $('#lookupForm', body).addEventListener('submit', (e) => {
      e.preventDefault();
      const data = S.load();
      const code = e.target.code.value.trim().toUpperCase();
      const doc = e.target.doc.value.trim();
      const r = data.reservations.find((x) => x.code.toUpperCase() === code && String(x.doc) === doc);
      const STATUS = { pendiente: '⏳ Pendiente de pago', pagada: '✅ Pagada y confirmada', cancelada: '❌ Cancelada' };
      $('#lookupResult', body).innerHTML = r
        ? `<div class="lookup-ok"><b>${esc(r.eventTitle)}</b>
            <p>${(r.items || []).map((i) => `${i.qty} × ${esc(i.name)}`).join(' · ')}</p>
            <p>Total ${S.money(r.total, data.settings.currency)}</p>
            <span class="status-pill status-${r.status}">${STATUS[r.status] || r.status}</span></div>`
        : '<p class="lookup-err">No encontramos una reserva con esos datos. Revisa el código o escríbenos por WhatsApp.</p>';
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-lookup]')) openLookup();
    if (e.target.closest('#navLinks a')) $('#navLinks')?.classList.remove('open');
  });
  window.addEventListener('scroll', () => $('#siteHeader')?.classList.toggle('scrolled', window.scrollY > 40));

  window.MangoUI = { $, $$, esc, safeUrl, fmtDate, dateParts, waLink, eventUrl, eventCard, renderChrome, openModal, closeModal };
})();
