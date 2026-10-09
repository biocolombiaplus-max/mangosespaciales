(function () {
  const S = window.MangoStore;
  let data = S.load();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => S.money(v, data.settings.currency);

  function persist(msg) {
    if (S.save(data)) toast(msg || 'Guardado ✅');
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2200);
  }

  /* ---------- Login ----------
     Nota: es una protección básica del lado del navegador. Al pasar a
     producción el acceso debe validarse en el servidor. */
  const SESSION = 'me_admin_ok';
  function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    renderAll();
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

  /* ---------- Tabs ---------- */
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
    renderAll();
  });

  function renderAll() {
    renderDashboard();
    renderEvent();
    renderImages();
    renderSponsors();
    renderTickets();
    renderReservations();
    renderSettings();
  }

  /* ---------- Resumen ---------- */
  function renderDashboard() {
    const active = data.reservations.filter((r) => r.status !== 'cancelada');
    const paid = active.filter((r) => r.status === 'pagada');
    const qty = active.reduce((n, r) => n + Number(r.qty), 0);
    const stats = [
      ['Reservas', active.length, '📋'],
      ['Boletas reservadas', qty, '🎟️'],
      ['Ingresos confirmados', money(paid.reduce((n, r) => n + r.total, 0)), '💰'],
      ['Por confirmar', money(active.filter((r) => r.status === 'pendiente').reduce((n, r) => n + r.total, 0)), '⏳'],
      ['Patrocinadores', data.sponsors.length, '🤝'],
    ];
    $('#stats').innerHTML = stats
      .map(([l, v, i]) => `<div class="stat"><span>${i}</span><b>${esc(v)}</b><small>${l}</small></div>`)
      .join('');
    $('#stockBars').innerHTML = data.tickets
      .map((t) => {
        const sold = S.sold(data, t.id);
        const pct = t.stock ? Math.min(100, Math.round((sold / t.stock) * 100)) : 0;
        return `<div class="bar"><div class="bar-label"><b>${esc(t.name)}</b><span>${sold} / ${t.stock} (${pct}%)</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
      })
      .join('') || '<p class="muted">Aún no hay boletas creadas.</p>';
  }

  /* ---------- Evento ---------- */
  function renderEvent() {
    const f = $('#eventForm');
    const ev = data.event;
    ['title', 'tagline', 'description', 'date', 'venue', 'city', 'mapUrl'].forEach((k) => (f[k].value = ev[k] || ''));
    const hls = [...(ev.highlights || [])];
    while (hls.length < 4) hls.push({ icon: '✨', title: '', text: '' });
    $('#highlightFields').innerHTML = hls
      .slice(0, 4)
      .map(
        (h, i) => `<div class="hl-field">
          <input name="hlIcon${i}" value="${esc(h.icon)}" maxlength="4" aria-label="Ícono" />
          <input name="hlTitle${i}" value="${esc(h.title)}" placeholder="Título" />
          <input name="hlText${i}" value="${esc(h.text)}" placeholder="Texto corto" />
        </div>`
      )
      .join('');
  }
  $('#eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    ['title', 'tagline', 'description', 'date', 'venue', 'city', 'mapUrl'].forEach((k) => (data.event[k] = f[k].value.trim()));
    data.event.highlights = [0, 1, 2, 3]
      .map((i) => ({ icon: f[`hlIcon${i}`].value, title: f[`hlTitle${i}`].value.trim(), text: f[`hlText${i}`].value.trim() }))
      .filter((h) => h.title);
    persist('Evento guardado ✅');
  });

  /* ---------- Imágenes ---------- */
  function renderImages() {
    const ev = data.event;
    $('#mainPreview').style.backgroundImage = ev.mainImage ? `url("${ev.mainImage}")` : '';
    $('#mainPreview').textContent = ev.mainImage ? '' : 'Sin imagen principal (se usará el degradado de marca)';
    $('#galThumbs').innerHTML = (ev.gallery || [])
      .map(
        (src, i) => `<div class="thumb">
          <img src="${esc(src)}" alt="" />
          <div class="thumb-actions">
            <button data-gal-move="${i}" data-dir="-1" title="Mover antes">◀</button>
            <button data-gal-main="${i}" title="Usar como principal">⭐</button>
            <button data-gal-del="${i}" title="Eliminar">🗑️</button>
            <button data-gal-move="${i}" data-dir="1" title="Mover después">▶</button>
          </div>
        </div>`
      )
      .join('') || '<p class="muted">No hay imágenes en la galería.</p>';
  }
  $('#mainFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    data.event.mainImage = await S.fileToDataUrl(file, { maxSize: 1920 });
    persist('Imagen principal actualizada ✅');
    renderImages();
    e.target.value = '';
  });
  $('#mainUrlBtn').addEventListener('click', () => {
    const u = $('#mainUrl').value.trim();
    if (!/^https?:\/\//.test(u)) return toast('Ingresa una URL válida (https://…)');
    data.event.mainImage = u;
    $('#mainUrl').value = '';
    persist('Imagen principal actualizada ✅');
    renderImages();
  });
  $('#mainClear').addEventListener('click', () => {
    data.event.mainImage = '';
    persist('Imagen principal eliminada');
    renderImages();
  });
  $('#galFile').addEventListener('change', async (e) => {
    for (const file of e.target.files) data.event.gallery.push(await S.fileToDataUrl(file, { maxSize: 1200 }));
    persist('Imágenes agregadas ✅');
    renderImages();
    e.target.value = '';
  });
  $('#galUrlBtn').addEventListener('click', () => {
    const u = $('#galUrl').value.trim();
    if (!/^https?:\/\//.test(u)) return toast('Ingresa una URL válida (https://…)');
    data.event.gallery.push(u);
    $('#galUrl').value = '';
    persist('Imagen agregada ✅');
    renderImages();
  });
  $('#galThumbs').addEventListener('click', (e) => {
    const g = data.event.gallery;
    const del = e.target.closest('[data-gal-del]');
    const move = e.target.closest('[data-gal-move]');
    const main = e.target.closest('[data-gal-main]');
    if (del) {
      if (!confirm('¿Eliminar esta imagen?')) return;
      g.splice(Number(del.dataset.galDel), 1);
    } else if (move) {
      const i = Number(move.dataset.galMove);
      const j = i + Number(move.dataset.dir);
      if (j < 0 || j >= g.length) return;
      [g[i], g[j]] = [g[j], g[i]];
    } else if (main) {
      data.event.mainImage = g[Number(main.dataset.galMain)];
    } else return;
    persist();
    renderImages();
  });

  /* ---------- Patrocinadores ---------- */
  const TIERS = { oro: '🥇 Oro', plata: '🥈 Plata', bronce: '🥉 Aliado' };
  const linkKind = (u) => {
    const m = /instagram|facebook|tiktok|linkedin|youtube|wa\.me|whatsapp|twitter|x\.com/i.exec(u || '');
    return m ? m[0].replace('wa.me', 'whatsapp').replace('x.com', 'X') : 'web';
  };

  function renderSponsors() {
    $('#spList').innerHTML = data.sponsors
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
            <button class="btn btn-cyan btn-sm" data-sp-edit="${esc(s.id)}">Editar</button>
            <button class="icon-btn danger" data-sp-del="${esc(s.id)}" title="Eliminar">🗑️</button>
          </div>
        </article>`
      )
      .join('') || '<div class="card muted">Aún no hay patrocinadores. ¡Agrega el primero!</div>';
  }

  function editSponsor(id) {
    const s = data.sponsors.find((x) => x.id === id) || { id: '', name: '', logo: '', url: '', tier: 'oro', inHero: true };
    let logo = s.logo;
    openModal(`
      <h2>${s.id ? 'Editar' : 'Nuevo'} patrocinador</h2>
      <form class="form" id="spForm">
        <label>Nombre<input name="name" value="${esc(s.name)}" required /></label>
        <label>Link al hacer clic en el logo (web, Instagram, Facebook, TikTok, WhatsApp…)
          <input name="url" type="url" value="${esc(s.url)}" placeholder="https://instagram.com/marca" required /></label>
        <div class="logo-edit">
          <div class="sp-logo big" id="spLogoPrev">${logo ? `<img src="${esc(logo)}" alt="" />` : 'Sin logo'}</div>
          <div class="logo-edit-actions">
            <label class="btn btn-pink btn-sm file-btn">📤 Subir logo (PNG/SVG/JPG)<input type="file" accept="image/*" id="spLogoFile" hidden /></label>
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
      $('#spLogoPrev').innerHTML = `<img src="${esc(src)}" alt="" />`;
    };
    $('#spLogoFile').addEventListener('change', async (e) => {
      if (e.target.files[0]) setLogo(await S.fileToDataUrl(e.target.files[0], { maxSize: 500, keepAlpha: true }));
    });
    $('#spLogoUrl').addEventListener('change', (e) => /^https?:\/\//.test(e.target.value) && setLogo(e.target.value.trim()));
    $('#spForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      if (!logo) return toast('Agrega el logo del patrocinador');
      const item = { id: s.id || S.uid(), name: f.name.value.trim(), url: f.url.value.trim(), logo, tier: f.tier.value, inHero: f.inHero.checked };
      const idx = data.sponsors.findIndex((x) => x.id === item.id);
      if (idx >= 0) data.sponsors[idx] = item;
      else data.sponsors.push(item);
      persist('Patrocinador guardado ✅');
      closeModal();
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

  /* ---------- Boletas ---------- */
  function renderTickets() {
    $('#tkList').innerHTML = data.tickets
      .map((t) => {
        const sold = S.sold(data, t.id);
        return `<article class="tk-row">
          <div><b>${esc(t.name)}</b> ${t.badge ? `<span class="tag tag-hero">${esc(t.badge)}</span>` : ''}
            <div class="muted small">${money(t.price)} · ${sold} reservadas de ${t.stock} · ${S.available(data, t)} disponibles</div></div>
          <div class="row-actions">
            <button class="btn btn-cyan btn-sm" data-tk-edit="${esc(t.id)}">Editar</button>
            <button class="icon-btn danger" data-tk-del="${esc(t.id)}" title="Eliminar">🗑️</button>
          </div>
        </article>`;
      })
      .join('') || '<div class="card muted">No hay boletas. Crea la primera.</div>';
  }

  function editTicket(id) {
    const t = data.tickets.find((x) => x.id === id) || { id: '', name: '', price: 0, stock: 100, perks: '', badge: '' };
    openModal(`
      <h2>${t.id ? 'Editar' : 'Nueva'} boleta</h2>
      <form class="form" id="tkForm">
        <label>Nombre<input name="name" value="${esc(t.name)}" placeholder="General, VIP…" required /></label>
        <div class="row">
          <label>Precio<input name="price" type="number" min="0" step="1000" value="${t.price}" required /></label>
          <label>Cupos totales<input name="stock" type="number" min="0" value="${t.stock}" required /></label>
        </div>
        <label>Etiqueta destacada (opcional)<input name="badge" value="${esc(t.badge)}" placeholder="Más vendida, Preventa…" /></label>
        <label>Beneficios (uno por línea)<textarea name="perks" rows="4">${esc(t.perks)}</textarea></label>
        <button class="btn btn-mango btn-block" type="submit">💾 Guardar boleta</button>
      </form>`);
    $('#tkForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const item = { id: t.id || S.uid(), name: f.name.value.trim(), price: Number(f.price.value), stock: Number(f.stock.value), badge: f.badge.value.trim(), perks: f.perks.value };
      const idx = data.tickets.findIndex((x) => x.id === item.id);
      if (idx >= 0) data.tickets[idx] = item;
      else data.tickets.push(item);
      persist('Boleta guardada ✅');
      closeModal();
      renderTickets();
    });
  }
  $('#tkNew').addEventListener('click', () => editTicket(null));
  $('#tkList').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-tk-edit]');
    const del = e.target.closest('[data-tk-del]');
    if (ed) return editTicket(ed.dataset.tkEdit);
    if (del && confirm('¿Eliminar esta boleta? Las reservas existentes se conservan.')) {
      data.tickets = data.tickets.filter((x) => x.id !== del.dataset.tkDel);
      persist();
      renderTickets();
    }
  });

  /* ---------- Reservas ---------- */
  const STATUS = ['pendiente', 'pagada', 'cancelada'];
  function renderReservations() {
    data = { ...data, reservations: S.load().reservations }; // trae reservas nuevas de la landing
    const q = $('#resSearch').value.trim().toLowerCase();
    const rows = [...data.reservations]
      .reverse()
      .filter((r) => !q || [r.code, r.name, r.doc, r.email, r.phone].join(' ').toLowerCase().includes(q));
    $('#resBody').innerHTML = rows
      .map(
        (r) => `<tr>
          <td><b>${esc(r.code)}</b></td>
          <td>${new Date(r.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
          <td>${esc(r.name)}<div class="muted small">Doc. ${esc(r.doc)}</div></td>
          <td><a href="https://wa.me/${esc(r.phone.replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(r.phone)}</a><div class="muted small">${esc(r.email)}</div></td>
          <td>${esc(r.ticketName)}</td>
          <td>${r.qty}</td>
          <td>${money(r.total)}</td>
          <td><select class="status status-${r.status}" data-res-status="${esc(r.id)}">${STATUS.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
          <td><button class="icon-btn danger" data-res-del="${esc(r.id)}" title="Eliminar">🗑️</button></td>
        </tr>`
      )
      .join('') || '<tr><td colspan="9" class="muted center">Aún no hay reservas.</td></tr>';
  }
  $('#resSearch').addEventListener('input', renderReservations);
  $('#resBody').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-res-status]');
    if (!sel) return;
    const r = data.reservations.find((x) => x.id === sel.dataset.resStatus);
    r.status = sel.value;
    persist('Estado actualizado ✅');
    renderReservations();
    renderDashboard();
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
    const head = ['Codigo', 'Fecha', 'Nombre', 'Documento', 'Celular', 'Correo', 'Boleta', 'Cantidad', 'Total', 'Estado'];
    const lines = data.reservations.map((r) =>
      [r.code, r.createdAt, r.name, r.doc, r.phone, r.email, r.ticketName, r.qty, r.total, r.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );
    download('reservas.csv', '﻿' + [head.join(';'), ...lines].join('\n'), 'text/csv');
  });

  /* ---------- Ajustes ---------- */
  function renderSettings() {
    const f = $('#settingsForm');
    ['brand', 'currency', 'whatsapp', 'email', 'instagram', 'facebook', 'tiktok'].forEach((k) => (f[k].value = data.settings[k] || ''));
    f.adminPin.value = '';
  }
  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    ['brand', 'currency', 'whatsapp', 'email', 'instagram', 'facebook', 'tiktok'].forEach((k) => (data.settings[k] = f[k].value.trim()));
    if (f.adminPin.value) data.settings.adminPin = f.adminPin.value;
    persist('Ajustes guardados ✅');
    renderSettings();
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
        if (!parsed.event || !Array.isArray(parsed.sponsors)) throw new Error();
        data = parsed;
        persist('Respaldo restaurado ✅');
        renderAll();
      } catch {
        toast('El archivo no es un respaldo válido');
      }
    };
    r.readAsText(file);
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Esto borra TODO (evento, patrocinadores y reservas) y vuelve a los datos de ejemplo. ¿Continuar?')) return;
    S.reset();
    data = S.load();
    renderAll();
    toast('Datos restablecidos');
  });

  /* ---------- Utilidades ---------- */
  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
  }
  function closeModal() {
    $('#modal').hidden = true;
  }
  $('#modal').addEventListener('click', (e) => (e.target.id === 'modal' || e.target.closest('#modalClose')) && closeModal());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

  if (sessionStorage.getItem(SESSION)) showApp();
})();
