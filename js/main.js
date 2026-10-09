/* Página de inicio: carrusel, cartelera, patrocinadores, testimonios y FAQ. */
(function () {
  const S = window.MangoStore;
  const U = window.MangoUI;
  const { $, esc, safeUrl } = U;
  let data = S.load();

  const params = new URLSearchParams(location.search);
  const filters = { q: (params.get('q') || '').trim().toLowerCase(), cat: params.get('cat') || 'Todos', city: 'Todas', sort: 'date' };

  /* ---------- Carrusel de destacados ---------- */
  let slide = 0;
  let timer;
  function renderCarousel() {
    const events = S.publicEvents(data);
    const featured = events.filter((e) => e.featured);
    const list = featured.length ? featured : events.slice(0, 3);
    $('#carousel').hidden = !list.length;
    $('#slides').innerHTML = list
      .map((ev, i) => {
        const p = U.dateParts(ev.date);
        return `<article class="slide ${i === 0 ? 'active' : ''}" style="background-image:url('${esc(safeUrl(ev.mainImage))}')">
          <div class="slide-content">
            <span class="badge-cat">${esc(ev.category)}</span>
            <h1>${esc(ev.title)}</h1>
            <p class="slide-tagline">${esc(ev.tagline)}</p>
            <div class="slide-meta">
              <span>📅 ${U.fmtDate(ev.date)}</span>
              <span>📍 ${esc(ev.venue)}, ${esc(ev.city)}</span>
            </div>
            <div class="slide-actions">
              <a class="btn btn-mango btn-lg" href="${U.eventUrl(ev)}#boletas">🎟️ Comprar boletas</a>
              <a class="btn btn-glass btn-lg" href="${U.eventUrl(ev)}">Ver detalles</a>
            </div>
          </div>
          <div class="slide-ticket">
            <div class="st-date"><b>${p.day}</b><span>${p.month} ${p.year}</span></div>
            <div class="st-price"><small>Boletas desde</small><b>${S.money(S.minPrice(ev), data.settings.currency)}</b></div>
          </div>
        </article>`;
      })
      .join('');
    $('#carDots').innerHTML = list.map((_, i) => `<button aria-label="Ir al evento ${i + 1}" data-dot="${i}" class="${i === 0 ? 'active' : ''}"></button>`).join('');
    const multi = list.length > 1;
    $('#carPrev').hidden = $('#carNext').hidden = $('#carDots').hidden = !multi;
    slide = 0;
    clearInterval(timer);
    if (multi) timer = setInterval(() => go(slide + 1), 6500);
  }
  function go(i) {
    const slides = document.querySelectorAll('.slide');
    if (!slides.length) return;
    slide = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('active', k === slide));
    document.querySelectorAll('[data-dot]').forEach((d, k) => d.classList.toggle('active', k === slide));
  }
  $('#carPrev').addEventListener('click', () => go(slide - 1));
  $('#carNext').addEventListener('click', () => go(slide + 1));
  $('#carDots').addEventListener('click', (e) => e.target.dataset.dot && go(Number(e.target.dataset.dot)));

  /* ---------- Patrocinadores ---------- */
  const sponsorLink = (sp, cls) =>
    `<a class="${cls}" href="${esc(safeUrl(sp.url))}" target="_blank" rel="noopener sponsored" title="Visitar ${esc(sp.name)}">
      <img src="${esc(safeUrl(sp.logo))}" alt="${esc(sp.name)}" loading="lazy" /></a>`;

  function renderSponsors() {
    const hero = data.sponsors.filter((s) => s.inHero);
    $('#heroSponsorsWrap').hidden = hero.length === 0;
    const items = hero.map((s) => sponsorLink(s, 'sp-hero')).join('');
    // con 5 o más logos la cinta se desplaza; se duplica la lista para que no se corte
    const moving = hero.length >= 5;
    const track = $('#heroSponsors');
    track.classList.toggle('static', !moving);
    track.innerHTML = moving ? items + items.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ') : items;

    const tiers = [
      ['oro', 'Patrocinadores Oro'],
      ['plata', 'Patrocinadores Plata'],
      ['bronce', 'Aliados'],
    ];
    $('#sponsorTiers').innerHTML = tiers
      .map(([key, label]) => {
        const list = data.sponsors.filter((s) => s.tier === key);
        if (!list.length) return '';
        return `<div class="tier tier-${key}"><h3>${label}</h3><div class="sp-grid">${list.map((s) => sponsorLink(s, 'sp-card')).join('')}</div></div>`;
      })
      .join('');
  }

  /* ---------- Cartelera ---------- */
  function renderFilters() {
    const cats = ['Todos', ...(data.settings.categories || [])];
    $('#catChips').innerHTML = cats
      .map((c) => `<button class="chip ${filters.cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join('');
    const cities = ['Todas', ...new Set(S.publicEvents(data).map((e) => e.city).filter(Boolean))];
    $('#cityFilter').innerHTML = cities.map((c) => `<option value="${esc(c)}">${c === 'Todas' ? '📍 Todas las ciudades' : esc(c)}</option>`).join('');
    $('#cityFilter').value = filters.city;
  }

  function renderGrid() {
    let list = S.publicEvents(data).filter(
      (e) =>
        (filters.cat === 'Todos' || e.category === filters.cat) &&
        (filters.city === 'Todas' || e.city === filters.city) &&
        (!filters.q || [e.title, e.venue, e.city, e.category, e.tagline].join(' ').toLowerCase().includes(filters.q))
    );
    if (filters.sort === 'price') list = list.sort((a, b) => S.minPrice(a) - S.minPrice(b));
    $('#resultsInfo').innerHTML = filters.q
      ? `Resultados para “<b>${esc(filters.q)}</b>”: ${list.length} · <a href="index.html#eventos">Limpiar búsqueda</a>`
      : '';
    $('#evGrid').innerHTML = list.length
      ? list.map((ev) => U.eventCard(data, ev)).join('')
      : `<div class="empty"><img src="assets/mango-logo.svg" alt="" /><p>No encontramos eventos con esos filtros.</p><a class="btn btn-light btn-sm" href="index.html#eventos">Ver todos</a></div>`;
  }

  $('#catChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    filters.cat = b.dataset.cat;
    renderFilters();
    renderGrid();
  });
  $('#cityFilter').addEventListener('change', (e) => ((filters.city = e.target.value), renderGrid()));
  $('#sortFilter').addEventListener('change', (e) => ((filters.sort = e.target.value), renderGrid()));

  /* ---------- Contenido ---------- */
  function renderContent() {
    const st = data.settings;
    $('#stats').innerHTML = (st.stats || []).map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('');
    $('#testimonials').innerHTML = (st.testimonials || [])
      .map(
        (t) => `<figure class="testi">
          <div class="stars-row">★★★★★</div>
          <blockquote>“${esc(t.text)}”</blockquote>
          <figcaption><span class="avatar">${esc((t.name || '?').charAt(0))}</span><span><b>${esc(t.name)}</b><small>${esc(t.role)}</small></span></figcaption>
        </figure>`
      )
      .join('');
    $('#faq').innerHTML = (st.faqs || []).map((f, i) => `<details ${i === 0 ? 'open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
    $('#helpWa').href = U.waLink(data, '¡Hola! Necesito ayuda con mi compra');
    $('#sponsorCta').href = U.waLink(data, '¡Hola! Quiero información sobre paquetes de patrocinio');
  }

  $('#orgForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = `¡Hola! Quiero cotizar un evento.\nNombre: ${f.name.value}\nEmpresa: ${f.company.value || '-'}\nTipo: ${f.type.value}\nAsistentes: ${f.size.value}`;
    window.open(U.waLink(data, msg), '_blank', 'noopener');
  });

  $('#newsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    data = S.load();
    data.subscribers = data.subscribers || [];
    const email = e.target.email.value.trim().toLowerCase();
    if (!data.subscribers.some((s) => s.email === email)) {
      data.subscribers.push({ email, phone: e.target.phone.value.trim(), createdAt: new Date().toISOString() });
      S.save(data);
    }
    e.target.outerHTML = '<p class="news-ok">🎉 ¡Listo! Ya haces parte de la comunidad.</p>';
  });

  function render() {
    U.renderChrome(data);
    renderCarousel();
    renderSponsors();
    renderFilters();
    renderGrid();
    renderContent();
  }

  window.addEventListener('storage', () => {
    data = S.load();
    render();
  });
  render();
})();
