(function () {
  const S = window.MangoStore;
  let data = S.load();

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:|mailto:|tel:|data:image\/)/i.test(u || '') ? u : '#');

  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  };

  const waLink = (text) =>
    `https://wa.me/${(data.settings.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  /* ---------- Render ---------- */
  function render() {
    const { event: ev, settings: st } = data;
    document.title = `${ev.title} · ${st.brand}`;
    document.querySelectorAll('[data-bind="brand"]').forEach((n) => (n.textContent = st.brand));

    $('#evTitle').textContent = ev.title;
    $('#evTagline').textContent = ev.tagline;
    $('#evDate').textContent = fmtDate(ev.date);
    $('#evVenue').textContent = `${ev.venue} · ${ev.city}`;
    $('#evDescription').textContent = ev.description;
    $('#heroBg').style.backgroundImage = ev.mainImage ? `url("${safeUrl(ev.mainImage)}")` : '';

    $('#locVenue').textContent = ev.venue;
    $('#locCity').textContent = ev.city;
    $('#locDate').textContent = fmtDate(ev.date);
    $('#mapLink').href = safeUrl(ev.mapUrl);

    $('#highlights').innerHTML = (ev.highlights || [])
      .map((h, i) => `<article class="hl hl-${i % 4}"><span class="hl-icon">${esc(h.icon)}</span><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></article>`)
      .join('');

    $('#gallery').innerHTML = (ev.gallery || []).length
      ? ev.gallery.map((src, i) => `<figure class="g-item g-${i % 5}"><img loading="lazy" src="${esc(safeUrl(src))}" alt="Imagen del evento ${i + 1}" /></figure>`).join('')
      : '<p class="muted">Pronto publicaremos imágenes del evento.</p>';

    renderSponsors();
    renderTickets();

    const socials = [
      ['Instagram', st.instagram, '📸'],
      ['Facebook', st.facebook, '👍'],
      ['TikTok', st.tiktok, '🎵'],
      ['WhatsApp', waLink('¡Hola! Quiero información del evento'), '💬'],
    ].filter(([, u]) => u);
    $('#socials').innerHTML = socials
      .map(([n, u, i]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" aria-label="${n}">${i} <span>${n}</span></a>`)
      .join('');
    $('#waFloat').href = waLink(`¡Hola! Quiero información de ${ev.title}`);
    $('#sponsorCta').href = waLink(`¡Hola! Quiero ser patrocinador de ${ev.title}`);
    $('#year').textContent = new Date().getFullYear();
  }

  function sponsorLink(sp, cls) {
    return `<a class="${cls}" href="${esc(safeUrl(sp.url))}" target="_blank" rel="noopener sponsored" title="${esc(sp.name)}">
      <img src="${esc(safeUrl(sp.logo))}" alt="${esc(sp.name)}" loading="lazy" /></a>`;
  }

  function renderSponsors() {
    const hero = data.sponsors.filter((s) => s.inHero);
    $('#heroSponsorsWrap').hidden = hero.length === 0;
    const items = hero.map((s) => sponsorLink(s, 'sp-hero')).join('');
    // con 4 o más logos la cinta se desplaza; se duplica la lista para que no se corte
    const moving = hero.length >= 4;
    const track = $('#heroSponsors');
    track.classList.toggle('static', !moving);
    track.innerHTML = moving ? items + items.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ') : items;

    const tiers = [
      ['oro', '🥇 Patrocinadores Oro'],
      ['plata', '🥈 Patrocinadores Plata'],
      ['bronce', '🥉 Aliados'],
    ];
    $('#sponsorTiers').innerHTML = tiers
      .map(([key, label]) => {
        const list = data.sponsors.filter((s) => s.tier === key);
        if (!list.length) return '';
        return `<div class="tier tier-${key}"><h3>${label}</h3><div class="sp-grid">${list.map((s) => sponsorLink(s, 'sp-card')).join('')}</div></div>`;
      })
      .join('');
  }

  function renderTickets() {
    const cur = data.settings.currency;
    $('#tickets').innerHTML = data.tickets
      .map((t, i) => {
        const left = S.available(data, t);
        const soldOut = left === 0;
        const perks = String(t.perks || '').split('\n').filter(Boolean).map((p) => `<li>${esc(p)}</li>`).join('');
        return `<article class="ticket ticket-${i % 3} ${soldOut ? 'soldout' : ''}">
          ${t.badge ? `<span class="ticket-badge">${esc(t.badge)}</span>` : ''}
          <h3>${esc(t.name)}</h3>
          <div class="price">${S.money(t.price, cur)}</div>
          <ul>${perks}</ul>
          <p class="stock">${soldOut ? 'Agotada' : left <= 20 ? `🔥 ¡Solo quedan ${left}!` : `${left} disponibles`}</p>
          <button class="btn ${i === 1 ? 'btn-mango' : 'btn-pink'} btn-block" data-reserve="${esc(t.id)}" ${soldOut ? 'disabled' : ''}>
            ${soldOut ? 'Agotada' : '🎟️ Reservar ahora'}</button>
        </article>`;
      })
      .join('');
  }

  /* ---------- Reserva ---------- */
  function openReserve(ticketId) {
    const t = data.tickets.find((x) => x.id === ticketId);
    if (!t) return;
    const left = S.available(data, t);
    const max = Math.min(10, left);
    $('#modalBody').innerHTML = `
      <span class="kicker">Reserva</span>
      <h2 id="modalTitle">Boleta ${esc(t.name)}</h2>
      <p class="muted">${S.money(t.price, data.settings.currency)} c/u · ${left} disponibles</p>
      <form id="reserveForm" class="form">
        <label>Nombre completo<input name="name" required autocomplete="name" /></label>
        <label>Documento<input name="doc" required inputmode="numeric" /></label>
        <div class="row">
          <label>Celular / WhatsApp<input name="phone" required type="tel" autocomplete="tel" /></label>
          <label>Correo<input name="email" required type="email" autocomplete="email" /></label>
        </div>
        <label>Cantidad
          <div class="qty">
            <button type="button" data-q="-1">−</button>
            <input name="qty" type="number" min="1" max="${max}" value="1" readonly />
            <button type="button" data-q="1">+</button>
          </div>
        </label>
        <div class="total">Total: <b id="total">${S.money(t.price, data.settings.currency)}</b></div>
        <label class="check"><input type="checkbox" required /> Acepto el tratamiento de mis datos personales.</label>
        <button class="btn btn-mango btn-lg btn-block" type="submit">🚀 Confirmar reserva</button>
      </form>`;
    openModal();

    const form = $('#reserveForm');
    const qty = form.qty;
    form.querySelectorAll('[data-q]').forEach((b) =>
      b.addEventListener('click', () => {
        qty.value = Math.max(1, Math.min(max, Number(qty.value) + Number(b.dataset.q)));
        $('#total').textContent = S.money(t.price * qty.value, data.settings.currency);
      })
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      data = S.load(); // por si cambió el inventario en otra pestaña
      const n = Number(qty.value);
      if (n > S.available(data, t)) {
        alert('Lo sentimos, ya no hay suficientes boletas disponibles.');
        return closeModal(), render();
      }
      const code = 'ME-' + Date.now().toString(36).toUpperCase().slice(-6);
      const res = {
        id: S.uid(),
        code,
        ticketId: t.id,
        ticketName: t.name,
        qty: n,
        total: t.price * n,
        name: form.name.value.trim(),
        doc: form.doc.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        status: 'pendiente',
        createdAt: new Date().toISOString(),
      };
      data.reservations.push(res);
      if (!S.save(data)) return;
      showConfirmation(res);
      renderTickets();
    });
  }

  function showConfirmation(r) {
    const msg = `¡Hola! Acabo de reservar ${r.qty} boleta(s) ${r.ticketName} para ${data.event.title}. Código: ${r.code}. Nombre: ${r.name}`;
    $('#modalBody').innerHTML = `
      <div class="confirm">
        <img src="assets/mango-logo.svg" alt="" class="confirm-mango" />
        <h2>¡Reserva lista! 🎉</h2>
        <p>Tu código de reserva es</p>
        <div class="code">${esc(r.code)}</div>
        <p class="muted">${r.qty} × ${esc(r.ticketName)} · Total ${S.money(r.total, data.settings.currency)}</p>
        <p>Envíanos tu código por WhatsApp para recibir los datos de pago y confirmar tu boleta.</p>
        <a class="btn btn-mango btn-lg btn-block" href="${waLink(msg)}" target="_blank" rel="noopener">💬 Confirmar por WhatsApp</a>
      </div>`;
  }

  function openModal() {
    $('#modal').hidden = false;
    document.body.classList.add('no-scroll');
  }
  function closeModal() {
    $('#modal').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  /* ---------- Cuenta regresiva ---------- */
  function tick() {
    const diff = Math.max(0, new Date(data.event.date) - new Date());
    const pad = (n) => String(n).padStart(2, '0');
    $('#cdD').textContent = pad(Math.floor(diff / 864e5));
    $('#cdH').textContent = pad(Math.floor(diff / 36e5) % 24);
    $('#cdM').textContent = pad(Math.floor(diff / 6e4) % 60);
    $('#cdS').textContent = pad(Math.floor(diff / 1e3) % 60);
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reserve]');
    if (btn) openReserve(btn.dataset.reserve);
    if (e.target.id === 'modal' || e.target.closest('#modalClose')) closeModal();
    if (e.target.closest('#navLinks a')) $('#navLinks').classList.remove('open');
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
  $('#navToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
  window.addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', window.scrollY > 30));
  // refresca si el admin guarda cambios en otra pestaña
  window.addEventListener('storage', () => {
    data = S.load();
    render();
  });

  render();
  tick();
  setInterval(tick, 1000);
})();
