/* Página de detalle del evento: información, selección de boletas y reserva. */
(function () {
  const S = window.MangoStore;
  const U = window.MangoUI;
  const { $, esc, safeUrl } = U;
  const MAX_PER_ORDER = 10;

  let data = S.load();
  const id = new URLSearchParams(location.search).get('id');
  let ev = S.publicEvents(data).find((e) => e.id === id) || (!id && S.publicEvents(data)[0]);
  const cart = {}; // ticketId -> cantidad

  U.renderChrome(data);

  if (!ev) {
    $('#eventPage').innerHTML = `<section class="section"><div class="container empty">
      <img src="assets/mango-logo.svg" alt="" /><h2>Este evento no está disponible</h2>
      <p>Puede que haya terminado o el enlace no sea correcto.</p>
      <a class="btn btn-primary" href="index.html#eventos">Ver cartelera</a></div></section>`;
    $('#mobileBuy').remove();
    return;
  }

  const money = (v) => S.money(v, data.settings.currency);
  const place = () => [ev.venue, ev.address, ev.city].filter(Boolean).join(', ');

  /* ---------- Información ---------- */
  function renderInfo() {
    document.title = `${ev.title} · ${data.settings.brand}`;
    document.querySelector('meta[name="description"]').content = `${ev.tagline || ''} ${U.fmtDate(ev.date)} en ${ev.venue}, ${ev.city}.`;
    $('#evBg').style.backgroundImage = `url("${safeUrl(ev.mainImage)}")`;
    $('#evPoster').src = safeUrl(ev.mainImage);
    $('#evPoster').alt = ev.title;
    $('#crumbTitle').textContent = ev.title;
    $('#evCat').textContent = ev.category;
    $('#evTitle').textContent = ev.title;
    $('#evTagline').textContent = ev.tagline;
    $('#evDate').textContent = U.fmtDate(ev.date);
    $('#evVenue').textContent = `${ev.venue}, ${ev.city}`;
    $('#evDoors').textContent = ev.doors || 'Por confirmar';
    $('#evAge').textContent = ev.ageLimit || 'Todo público';
    $('#evDescription').textContent = ev.description;

    $('#agendaBlock').hidden = !(ev.agenda || []).length;
    $('#agenda').innerHTML = (ev.agenda || [])
      .map((a) => `<li><time>${esc(a.time)}</time><div><b>${esc(a.title)}</b>${a.text ? `<p>${esc(a.text)}</p>` : ''}</div></li>`)
      .join('');

    $('#galleryBlock').hidden = !(ev.gallery || []).length;
    $('#gallery').innerHTML = (ev.gallery || [])
      .map((src, i) => `<button class="g-item g-${i % 5}" data-photo="${i}"><img loading="lazy" src="${esc(safeUrl(src))}" alt="Foto ${i + 1} de ${esc(ev.title)}" /></button>`)
      .join('');

    $('#locVenue').textContent = ev.venue;
    $('#locAddress').textContent = [ev.address, ev.city].filter(Boolean).join(', ');
    const q = encodeURIComponent(place());
    $('#mapFrame').src = `https://www.google.com/maps?q=${q}&output=embed`;
    $('#mapLink').href = `https://www.google.com/maps/search/?api=1&query=${q}`;

    const sponsors = data.sponsors;
    $('#evSponsorsBlock').hidden = !sponsors.length;
    $('#evSponsors').innerHTML = sponsors
      .map((s) => `<a class="sp-card" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener sponsored" title="Visitar ${esc(s.name)}"><img src="${esc(safeUrl(s.logo))}" alt="${esc(s.name)}" loading="lazy" /></a>`)
      .join('');

    const more = S.publicEvents(data).filter((e) => e.id !== ev.id).slice(0, 3);
    $('#moreBlock').hidden = !more.length;
    $('#moreEvents').innerHTML = more.map((e) => U.eventCard(data, e)).join('');
    $('#mobilePrice').textContent = money(S.minPrice(ev));

    // Calendario de Google
    const start = new Date(ev.date);
    const end = new Date(start.getTime() + 4 * 36e5);
    const gcal = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    $('#calLink').href =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(ev.title)}&dates=${gcal(start)}/${gcal(end)}` +
      `&location=${encodeURIComponent(place())}&details=${encodeURIComponent(location.href)}`;

    // Datos estructurados para Google (aparece mejor en búsquedas)
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: ev.title,
      startDate: ev.date,
      description: ev.description,
      image: /^https?:/.test(ev.mainImage) ? [ev.mainImage] : undefined,
      eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'Place', name: ev.venue, address: [ev.address, ev.city].filter(Boolean).join(', ') },
      organizer: { '@type': 'Organization', name: data.settings.brand },
      offers: (ev.tickets || []).map((t) => ({
        '@type': 'Offer',
        name: t.name,
        price: t.price,
        priceCurrency: data.settings.currency,
        availability: S.available(data, t) ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        url: location.href,
      })),
    });
    document.head.appendChild(ld);
  }

  /* ---------- Selección de boletas ---------- */
  const totalQty = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = () => ev.tickets.reduce((n, t) => n + (cart[t.id] || 0) * t.price, 0);

  function renderTickets() {
    $('#ticketList').innerHTML = ev.tickets
      .map((t) => {
        const left = S.available(data, t);
        const soldOut = left === 0 || ev.status === 'agotado';
        const perks = String(t.perks || '').split('\n').filter(Boolean).map((p) => `<li>${esc(p)}</li>`).join('');
        const q = cart[t.id] || 0;
        return `<div class="tk ${soldOut ? 'soldout' : ''} ${q ? 'selected' : ''}">
          <div class="tk-top">
            <div><b>${esc(t.name)}</b>${t.badge ? ` <span class="tk-badge">${esc(t.badge)}</span>` : ''}
              <div class="tk-price">${money(t.price)}</div></div>
            ${
              soldOut
                ? '<span class="tk-sold">Agotada</span>'
                : `<div class="stepper"><button data-step="${esc(t.id)}" data-d="-1" ${q ? '' : 'disabled'} aria-label="Quitar">−</button><span>${q}</span><button data-step="${esc(t.id)}" data-d="1" aria-label="Agregar">+</button></div>`
            }
          </div>
          ${perks ? `<ul>${perks}</ul>` : ''}
          ${!soldOut && left <= 20 ? `<p class="tk-left">🔥 Solo quedan ${left}</p>` : ''}
        </div>`;
      })
      .join('');
    $('#buyTotal').textContent = money(totalPrice());
    const n = totalQty();
    $('#buyBtn').disabled = n === 0;
    $('#buyBtn').textContent = n ? `Continuar · ${n} boleta${n > 1 ? 's' : ''}` : 'Selecciona tus boletas';
  }

  $('#ticketList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const t = ev.tickets.find((x) => x.id === b.dataset.step);
    const next = (cart[t.id] || 0) + Number(b.dataset.d);
    if (next < 0 || next > S.available(data, t)) return;
    if (Number(b.dataset.d) > 0 && totalQty() >= MAX_PER_ORDER) return alert(`Máximo ${MAX_PER_ORDER} boletas por compra.`);
    cart[t.id] = next;
    renderTickets();
  });

  /* ---------- Checkout ---------- */
  $('#buyBtn').addEventListener('click', () => {
    const items = ev.tickets.filter((t) => cart[t.id]).map((t) => ({ ticketId: t.id, name: t.name, qty: cart[t.id], price: t.price }));
    const body = U.openModal(`
      <span class="kicker">Finaliza tu reserva</span>
      <h2>${esc(ev.title)}</h2>
      <p class="muted">${U.fmtDate(ev.date)} · ${esc(ev.venue)}</p>
      <div class="summary">
        ${items.map((i) => `<div><span>${i.qty} × ${esc(i.name)}</span><b>${money(i.qty * i.price)}</b></div>`).join('')}
        <div class="summary-total"><span>Total</span><b>${money(totalPrice())}</b></div>
      </div>
      <form id="checkoutForm" class="form">
        <label>Nombre completo<input name="name" required autocomplete="name" /></label>
        <div class="row">
          <label>Tipo de documento<select name="docType"><option>CC</option><option>CE</option><option>TI</option><option>Pasaporte</option><option>NIT</option></select></label>
          <label>Número de documento<input name="doc" required inputmode="numeric" /></label>
        </div>
        <div class="row">
          <label>Celular / WhatsApp<input name="phone" required type="tel" autocomplete="tel" /></label>
          <label>Correo electrónico<input name="email" required type="email" autocomplete="email" /></label>
        </div>
        <label class="check"><input type="checkbox" required /> Acepto los <a href="legal.html#terminos" target="_blank">términos y condiciones</a> y la <a href="legal.html#privacidad" target="_blank">política de tratamiento de datos</a>.</label>
        <button class="btn btn-mango btn-lg btn-block" type="submit">Confirmar reserva</button>
        <p class="buy-note">🔒 Tus datos están protegidos.</p>
      </form>`);

    $('#checkoutForm', body).addEventListener('submit', (e) => {
      e.preventDefault();
      data = S.load(); // inventario más reciente
      ev = data.events.find((x) => x.id === ev.id) || ev;
      const short = items.find((i) => {
        const t = ev.tickets.find((x) => x.id === i.ticketId);
        return !t || i.qty > S.available(data, t);
      });
      if (short) {
        alert(`Lo sentimos, ya no hay suficientes boletas ${short.name}.`);
        U.closeModal();
        Object.keys(cart).forEach((k) => delete cart[k]);
        return renderTickets();
      }
      const f = e.target;
      const res = {
        id: S.uid(),
        code: 'ME-' + Date.now().toString(36).toUpperCase().slice(-6),
        eventId: ev.id,
        eventTitle: ev.title,
        items,
        qty: items.reduce((n, i) => n + i.qty, 0),
        total: items.reduce((n, i) => n + i.qty * i.price, 0),
        name: f.name.value.trim(),
        docType: f.docType.value,
        doc: f.doc.value.trim(),
        phone: f.phone.value.trim(),
        email: f.email.value.trim(),
        status: 'pendiente',
        createdAt: new Date().toISOString(),
      };
      data.reservations.push(res);
      if (!S.save(data)) return;
      Object.keys(cart).forEach((k) => delete cart[k]);
      renderTickets();
      showConfirmation(body, res);
    });
  });

  function showConfirmation(body, r) {
    const detail = r.items.map((i) => `${i.qty} × ${i.name}`).join(', ');
    const msg = `¡Hola! Acabo de reservar boletas para ${r.eventTitle}.\nCódigo: ${r.code}\nBoletas: ${detail}\nTotal: ${money(r.total)}\nNombre: ${r.name}`;
    body.innerHTML = `
      <div class="confirm">
        <img src="assets/mango-logo.svg" alt="" class="confirm-mango" />
        <h2>¡Reserva confirmada! 🎉</h2>
        <p>Guarda tu código de reserva:</p>
        <div class="code">${esc(r.code)}</div>
        <div class="summary">
          ${r.items.map((i) => `<div><span>${i.qty} × ${esc(i.name)}</span><b>${money(i.qty * i.price)}</b></div>`).join('')}
          <div class="summary-total"><span>Total a pagar</span><b>${money(r.total)}</b></div>
        </div>
        <p class="muted">Envíanos tu código por WhatsApp para recibir los datos de pago (${esc(data.settings.paymentMethods)}). Al confirmar el pago te enviamos tus boletas con código QR.</p>
        <a class="btn btn-mango btn-lg btn-block" href="${U.waLink(data, msg)}" target="_blank" rel="noopener">💬 Pagar y confirmar por WhatsApp</a>
      </div>`;
  }

  /* ---------- Compartir ---------- */
  $('#shareBtn').addEventListener('click', async () => {
    const shareData = { title: ev.title, text: `${ev.title} · ${U.fmtDate(ev.date)}`, url: location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (e) { /* cancelado */ }
      return;
    }
    U.openModal(`
      <h2>Compartir evento</h2>
      <div class="share-grid">
        <a class="btn btn-light" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}">💬 WhatsApp</a>
        <a class="btn btn-light" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}">👍 Facebook</a>
        <a class="btn btn-light" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}">✖️ X</a>
        <button class="btn btn-light" id="copyLink">📋 Copiar enlace</button>
      </div>`);
    $('#copyLink').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(shareData.url);
        e.target.textContent = '✅ Copiado';
      } catch (err) {
        prompt('Copia el enlace:', shareData.url);
      }
    });
  });

  /* ---------- Galería ampliada ---------- */
  $('#gallery').addEventListener('click', (e) => {
    const b = e.target.closest('[data-photo]');
    if (b) U.openModal(`<img class="lightbox" src="${esc(safeUrl(ev.gallery[Number(b.dataset.photo)]))}" alt="" />`).parentElement.classList.add('wide');
  });

  /* ---------- Cuenta regresiva ---------- */
  function tick() {
    const diff = Math.max(0, new Date(ev.date) - new Date());
    const pad = (n) => String(n).padStart(2, '0');
    $('#cdD').textContent = pad(Math.floor(diff / 864e5));
    $('#cdH').textContent = pad(Math.floor(diff / 36e5) % 24);
    $('#cdM').textContent = pad(Math.floor(diff / 6e4) % 60);
    $('#cdS').textContent = pad(Math.floor(diff / 1e3) % 60);
  }

  // la barra de compra móvil se oculta cuando la caja de boletas está a la vista
  new IntersectionObserver(([en]) => $('#mobileBuy').classList.toggle('hide', en.isIntersecting)).observe($('#boletas'));

  renderInfo();
  renderTickets();
  tick();
  setInterval(tick, 1000);
})();
