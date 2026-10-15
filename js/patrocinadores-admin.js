/* Panel administrativo: patrocinadores e inscritos. En Vercel guarda en Cloudinary
   (funciones de /api); con el servidor propio, en su base de datos. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SP = window.MangoSponsors;
  const BG = { glass: 'Vidrio', white: 'Blanco', dark: 'Oscuro', none: 'Sin fondo' };

  let sponsors = [];
  let config = { ...SP.DEFAULT_CONFIG };
  let saved = '';
  let secret = sessionStorage.getItem('pa_secret') || '';
  let regs = null;

  /* ---------- Conexión ---------- */
  const OFFLINE = 'No se pudo conectar con el servidor. Revisa tu internet e inténtalo de nuevo.';

  async function call(method, path, body) {
    let res;
    try {
      res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error(OFFLINE);
    }
    const d = await res.json().catch(() => ({ error: res.status === 404 ? 'Esta función no está disponible aquí.' : OFFLINE }));
    if (res.status === 503 && d.code === 'not_configured') showSetup();
    if (res.status === 401 && path !== '/api/admin/login') logout();
    if (!res.ok) throw Object.assign(new Error(d.error || 'Error inesperado'), { status: res.status });
    return d;
  }

  // Los logos van directo del navegador a Cloudinary con una firma temporal del servidor.
  async function upload(dataUrl, name) {
    let sig;
    try {
      sig = await call('POST', '/api/admin/upload-signature');
    } catch (e) {
      if (e.status !== 404) throw e;
      return call('POST', '/api/admin/uploads', { dataUrl, name }); // servidor propio
    }
    const fd = new FormData();
    fd.append('file', dataUrl);
    fd.append('api_key', sig.apiKey);
    fd.append('timestamp', sig.timestamp);
    fd.append('folder', sig.folder);
    fd.append('signature', sig.signature);
    let d;
    try {
      d = await (await fetch(sig.uploadUrl, { method: 'POST', body: fd })).json();
    } catch (e) {
      throw new Error('No se pudo subir el logo a Cloudinary. Revisa tu internet.');
    }
    if (!d.secure_url) throw new Error('Cloudinary no aceptó el logo' + (d.error ? `: ${d.error.message}` : '.'));
    // f_auto,q_auto: Cloudinary entrega el formato más liviano para cada navegador (con transparencia).
    return { url: d.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/') };
  }

  const api = {
    async login(password) {
      secret = (await call('POST', '/api/admin/login', { password })).token;
      sessionStorage.setItem('pa_secret', secret);
    },
    load: () => call('GET', '/api/admin/sponsors'),
    save: (list, cfg) => call('PUT', '/api/admin/sponsors', { sponsors: list, sponsorConfig: cfg }),
    upload,
    registrations: () => call('GET', '/api/admin/registrations'),
  };

  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'pa-toast' + (bad ? ' bad' : '');
    t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (t.hidden = true), bad ? 5000 : 2600);
  }

  /* ---------- Sesión ---------- */
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginError').textContent = '';
    try {
      await api.login($('#password').value);
      await enter();
    } catch (err) {
      $('#loginError').textContent = err.message;
    }
  });
  function logout() {
    secret = '';
    sessionStorage.removeItem('pa_secret');
    regs = null;
    $('#app').hidden = $('#regs').hidden = $('#tabs').hidden = true;
    $('#logout').hidden = true;
    $('#login').hidden = false;
  }
  $('#logout').addEventListener('click', logout);

  async function enter() {
    const d = await api.load();
    apply(d);
    $('#login').hidden = true;
    $('#tabs').hidden = false;
    $('#logout').hidden = false;
    showView(sessionStorage.getItem('pa_view') || 'sponsors');
  }

  /* ---------- Vistas ---------- */
  function showView(v) {
    sessionStorage.setItem('pa_view', v);
    $$('#tabs [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    $('#app').hidden = v !== 'sponsors';
    $('#regs').hidden = v !== 'regs';
    if (v === 'regs' && !regs) loadRegs();
  }
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) showView(b.dataset.view);
  });

  /* ---------- Inscritos ---------- */
  const REG_COLS = [
    ['createdAt', 'Fecha'], ['code', 'Código'], ['name', 'Nombre'], ['docType', 'Tipo doc'], ['doc', 'Documento'],
    ['phone', 'Celular'], ['email', 'Correo'], ['barrio', 'Barrio'], ['city', 'Ciudad'], ['ref', 'Origen'],
  ];
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
  };
  const waLink = (phone) => {
    let n = String(phone || '').replace(/\D/g, '');
    if (n.length === 10 && n.startsWith('3')) n = '57' + n;
    return `https://wa.me/${n}`;
  };

  async function loadRegs() {
    $('#regsNote').textContent = 'Cargando inscritos…';
    $('#regsBody').innerHTML = '';
    try {
      regs = (await api.registrations()).registrations || [];
      renderRegs();
    } catch (err) {
      regs = null;
      $('#regsNote').textContent = err.status === 404 ? 'Con el servidor propio, los inscritos se ven en el centro de control /crm.' : err.message;
    }
  }

  function renderRegs() {
    const list = regs || [];
    const today = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
    $('#stTotal').textContent = list.length;
    $('#stToday').textContent = list.filter((r) => new Date(r.createdAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) === today).length;
    $('#stBarrios').textContent = new Set(list.map((r) => (r.barrio || '').trim().toLowerCase()).filter(Boolean)).size;
    $('#regsCount').textContent = list.length || '';
    const q = $('#regsSearch').value.trim().toLowerCase();
    const shown = q ? list.filter((r) => REG_COLS.some(([k]) => String(r[k] || '').toLowerCase().includes(q))) : list;
    $('#regsBody').innerHTML = shown
      .map(
        (r) => `<tr>
          <td data-l="Fecha">${esc(fmtDate(r.createdAt))}</td>
          <td data-l="Código"><b class="pa-code">${esc(r.code)}</b></td>
          <td data-l="Nombre">${esc(r.name)}</td>
          <td data-l="Documento">${esc(r.docType)} ${esc(r.doc)}</td>
          <td data-l="Celular"><a href="${waLink(r.phone)}" target="_blank" rel="noopener">💬 ${esc(r.phone)}</a></td>
          <td data-l="Correo"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
          <td data-l="Barrio">${esc(r.barrio)}</td>
          <td data-l="Ciudad">${esc(r.city)}</td>
        </tr>`
      )
      .join('');
    $('#regsNote').textContent = !list.length ? 'Aún no hay inscritos. Cuando alguien se inscriba en la landing aparecerá aquí.' : q ? `${shown.length} de ${list.length} inscritos` : '';
  }
  $('#regsSearch').addEventListener('input', renderRegs);
  $('#regsReload').addEventListener('click', loadRegs);
  $('#regsExport').addEventListener('click', () => {
    if (!regs || !regs.length) return toast('No hay inscritos para exportar', true);
    const cell = (v) => {
      v = String(v ?? '');
      if (/^[=+\-@]/.test(v)) v = "'" + v; // evita fórmulas al abrir en Excel
      return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const rows = [REG_COLS.map(([, h]) => h), ...regs.map((r) => REG_COLS.map(([k]) => (k === 'createdAt' ? fmtDate(r[k]) : r[k])))];
    const csv = '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `inscritos-after-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  function apply(d) {
    sponsors = (d.sponsors || []).map((s) => ({ ...s }));
    config = { ...SP.DEFAULT_CONFIG, ...(d.sponsorConfig || {}) };
    saved = snapshot();
    renderAll();
  }
  const snapshot = () => JSON.stringify([sponsors, config]);

  /* ---------- Procesar el logo en el navegador ----------
     Recorta los márgenes vacíos, puede quitar el fondo blanco y lo reduce a un
     tamaño liviano. Siempre sale en PNG (o WEBP si es muy pesado). */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => reject(new Error('No se pudo leer la imagen. Usa PNG, JPG, WEBP o SVG.'));
      img.src = url;
    });
  }

  async function processLogo(file, { trim, removeWhite }) {
    const { img, url } = await loadImage(file);
    let w = img.naturalWidth || 800;
    let h = img.naturalHeight || 400;
    const pre = Math.min(1, 1600 / Math.max(w, h));
    w = Math.max(1, Math.round(w * pre));
    h = Math.max(1, Math.round(h * pre));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;

    if (removeWhite) {
      for (let i = 0; i < px.length; i += 4) {
        const min = Math.min(px[i], px[i + 1], px[i + 2]);
        if (min >= 245) px[i + 3] = 0;
        else if (min >= 220) px[i + 3] = Math.round(px[i + 3] * ((245 - min) / 25)); // borde suave
      }
      ctx.putImageData(data, 0, 0);
    }

    let box = { x: 0, y: 0, w, h };
    if (trim) {
      let x0 = w;
      let y0 = h;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (px[(y * w + x) * 4 + 3] > 10) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 >= 0) {
        const pad = 2;
        box = { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: Math.min(w, x1 + pad + 1) - Math.max(0, x0 - pad), h: Math.min(h, y1 + pad + 1) - Math.max(0, y0 - pad) };
      }
    }

    const scale = Math.min(1, 900 / box.w, 360 / box.h);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(box.w * scale));
    out.height = Math.max(1, Math.round(box.h * scale));
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
    let dataUrl = out.toDataURL('image/png');
    if (dataUrl.length > 1.5e6) dataUrl = out.toDataURL('image/webp', 0.92);
    return dataUrl;
  }

  /* ---------- Render ---------- */
  function renderAll() {
    renderConfig();
    renderList();
    renderPreview();
  }

  function renderConfig() {
    $('#cfgHeight').value = config.height;
    $('#cfgHeightVal').textContent = config.height + ' px';
    $('#cfgSpeed').value = config.speed;
    $('#cfgCreditWeb').value = config.creditWeb || '';
    $('#cfgCreditTickets').value = config.creditTickets || '';
    renderCreditLogos();
  }

  function card(s, i) {
    const h = s.height || config.height;
    return `<article class="pa-sp ${s.active === false ? 'off' : ''}" data-i="${i}">
      <div class="pa-sp-top">
        <div class="pa-order">
          <button type="button" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
          <button type="button" data-move="1" ${i === sponsors.length - 1 ? 'disabled' : ''} aria-label="Bajar">▼</button>
        </div>
        <input type="text" data-f="name" value="${esc(s.name)}" placeholder="Nombre del patrocinador" />
        <button type="button" class="pa-icon danger" data-del aria-label="Eliminar">✕</button>
      </div>
      <div class="pa-sp-body">
        <div>
          <div class="pa-logo-box bg-${esc(s.bg || 'glass')}">${s.logo ? `<img src="${esc(s.logo)}" alt="" style="filter:${SP.borderFilter(s.border)}" />` : '<span>Sin logo</span>'}</div>
          <div class="pa-upload">
            <label class="btn btn-red btn-sm pa-file">📤 ${s.logo ? 'Cambiar logo' : 'Subir logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-file /></label>
            <label class="pa-check"><input type="checkbox" data-opt="trim" checked /> Recortar márgenes vacíos</label>
            <label class="pa-check"><input type="checkbox" data-opt="white" /> Quitar fondo blanco</label>
          </div>
        </div>
        <div class="pa-fields">
          <label>Enlace al tocar el logo <input type="url" data-f="link" value="${esc(s.link)}" placeholder="https://instagram.com/marca" /></label>
          <label>…o pega la URL del logo <input type="url" data-f="logo" value="${esc(/^https?:/.test(s.logo || '') ? s.logo : '')}" placeholder="https://…/logo.png" /></label>
          <label class="pa-range">Tamaño del logo <b>${h} px${s.height ? '' : ' (general)'}</b>
            <input type="range" data-f="height" min="16" max="120" step="2" value="${h}" />
          </label>
          <label class="pa-range">Borde blanco <b>${s.border ? s.border + ' px' : 'sin borde'}</b>
            <input type="range" data-f="border" min="0" max="10" step="1" value="${s.border || 0}" />
          </label>
          <div><label>Fondo de la tarjeta</label>
            <div class="pa-seg">${Object.entries(BG).map(([k, v]) => `<button type="button" data-bg="${k}" class="${(s.bg || 'glass') === k ? 'on' : ''}">${v}</button>`).join('')}</div>
          </div>
          <div class="pa-toggles">
            <label class="pa-toggle"><input type="checkbox" data-f="featured" ${s.featured ? 'checked' : ''} /> ⭐ Destacado <small>(grande y fijo)</small></label>
            <label class="pa-toggle"><input type="checkbox" data-f="active" ${s.active !== false ? 'checked' : ''} /> Visible en la landing</label>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderList() {
    $('#count').textContent = sponsors.length ? `(${sponsors.length})` : '';
    $('#list').innerHTML = sponsors.length ? sponsors.map(card).join('') : '<div class="pa-empty">Aún no hay patrocinadores. Pulsa <b>Agregar patrocinador</b> y sube el primer logo.</div>';
  }

  function renderPreview() {
    SP.marquee($('#pvTop'), sponsors, config, { minItems: 8 });
    SP.marquee($('#pvMid'), sponsors, config, { minItems: 6, scale: 1.35 });
    SP.marquee($('#pvLow'), sponsors, config, { minItems: 6, scale: 1.2, reverse: true });
    const any = SP.featured($('#pvFeatured'), sponsors, config);
    $('#pvFeaturedEmpty').hidden = any;
    const dirty = snapshot() !== saved;
    $('#savebar').classList.toggle('dirty', dirty);
    $('#saveState').textContent = dirty ? '● Cambios sin guardar' : '✓ Todo guardado';
  }

  // Cambios que no necesitan volver a dibujar la tarjeta (para no perder el foco al escribir).
  function updateCard(i) {
    const el = $(`.pa-sp[data-i="${i}"]`);
    if (el) el.outerHTML = card(sponsors[i], i);
  }

  /* ---------- Eventos ---------- */
  $('#cfgHeight').addEventListener('input', (e) => {
    config.height = Number(e.target.value);
    $('#cfgHeightVal').textContent = config.height + ' px';
    renderPreview();
  });
  $('#cfgHeight').addEventListener('change', renderList);
  [['#cfgCreditWeb', 'creditWeb'], ['#cfgCreditTickets', 'creditTickets']].forEach(([sel, key]) =>
    $(sel).addEventListener('input', (e) => {
      config[key] = e.target.value.trim();
      renderPreview();
    })
  );
  function renderCreditLogos() {
    $$('[data-credit]').forEach((box) => {
      const url = config[box.dataset.credit + 'Logo'];
      $('.pa-credit-logo', box).innerHTML = url ? `<img src="${esc(url)}" alt="" />` : '<span>Sin logo · se ve el ícono</span>';
      $('[data-credit-clear]', box).hidden = !url;
    });
  }
  $('#creditWebWa').addEventListener('click', () => {
    config.creditWeb = SP.BIOMARKETING_WA;
    $('#cfgCreditWeb').value = config.creditWeb;
    renderPreview();
    toast('Enlace de WhatsApp listo ✅ Recuerda guardar');
  });
  $$('[data-credit]').forEach((box) => {
    const key = box.dataset.credit + 'Logo';
    $('[data-credit-clear]', box).addEventListener('click', () => {
      config[key] = '';
      renderCreditLogos();
      renderPreview();
    });
    $('[data-credit-file]', box).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const logoBox = $('.pa-credit-logo', box);
      logoBox.classList.add('busy');
      try {
        const dataUrl = await processLogo(file, { trim: true, removeWhite: false });
        config[key] = (await api.upload(dataUrl, box.dataset.credit)).url;
        renderCreditLogos();
        renderPreview();
        toast('Logo listo ✅ Recuerda guardar');
      } catch (err) {
        toast(err.message, true);
      } finally {
        logoBox.classList.remove('busy');
      }
    });
  });
  $('#cfgSpeed').addEventListener('change', (e) => {
    config.speed = e.target.value;
    renderPreview();
  });

  $('#addSponsor').addEventListener('click', () => {
    sponsors.push({ id: 'SP-' + Math.random().toString(36).slice(2, 8).toUpperCase(), name: '', logo: '', link: '', height: null, border: 0, bg: 'white', featured: false, active: true });
    renderList();
    renderPreview();
    $(`.pa-sp[data-i="${sponsors.length - 1}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#list').addEventListener('input', (e) => {
    const el = e.target.closest('[data-f]');
    const box = e.target.closest('.pa-sp');
    if (!el || !box) return;
    const i = Number(box.dataset.i);
    const s = sponsors[i];
    const f = el.dataset.f;
    if (f === 'name' || f === 'link') s[f] = el.value.trim();
    if (f === 'logo') {
      if (/^https:\/\/\S+$/i.test(el.value.trim())) s.logo = el.value.trim();
      else return;
    }
    if (f === 'height') {
      s.height = Number(el.value);
      el.parentElement.querySelector('b').textContent = `${s.height} px`;
    }
    if (f === 'border') {
      s.border = Number(el.value);
      el.parentElement.querySelector('b').textContent = s.border ? `${s.border} px` : 'sin borde';
      const img = $('.pa-logo-box img', box);
      if (img) img.style.filter = SP.borderFilter(s.border);
    }
    if (f === 'featured') s.featured = el.checked;
    if (f === 'active') {
      s.active = el.checked;
      box.classList.toggle('off', !s.active);
    }
    renderPreview();
  });
  $('#list').addEventListener('change', (e) => {
    const box = e.target.closest('.pa-sp');
    if (box && e.target.dataset.f === 'logo') updateCard(Number(box.dataset.i));
  });

  $('#list').addEventListener('click', (e) => {
    const box = e.target.closest('.pa-sp');
    if (!box) return;
    const i = Number(box.dataset.i);
    const mv = e.target.closest('[data-move]');
    const bg = e.target.closest('[data-bg]');
    if (e.target.closest('[data-del]')) {
      if (!confirm(`¿Eliminar ${sponsors[i].name || 'este patrocinador'}?`)) return;
      sponsors.splice(i, 1);
    } else if (mv) {
      const j = i + Number(mv.dataset.move);
      if (j < 0 || j >= sponsors.length) return;
      [sponsors[i], sponsors[j]] = [sponsors[j], sponsors[i]];
    } else if (bg) {
      sponsors[i].bg = bg.dataset.bg;
      updateCard(i);
      return renderPreview();
    } else return;
    renderList();
    renderPreview();
  });

  $('#list').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-file]')) return;
    const file = e.target.files[0];
    if (!file) return;
    const box = e.target.closest('.pa-sp');
    const i = Number(box.dataset.i);
    const logoBox = $('.pa-logo-box', box);
    logoBox.classList.add('busy');
    try {
      const dataUrl = await processLogo(file, { trim: $('[data-opt=trim]', box).checked, removeWhite: $('[data-opt=white]', box).checked });
      const name = (sponsors[i].name || file.name.replace(/\.[^.]+$/, '') || 'logo').slice(0, 40);
      const r = await api.upload(dataUrl, name);
      sponsors[i].logo = r.url;
      if (!sponsors[i].name) sponsors[i].name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      updateCard(i);
      renderPreview();
      toast('Logo listo ✅ Recuerda guardar');
    } catch (err) {
      logoBox.classList.remove('busy');
      toast(err.message, true);
    }
  });

  $('#save').addEventListener('click', async () => {
    const missing = sponsors.findIndex((s) => !s.logo);
    if (missing >= 0) return toast(`Al patrocinador #${missing + 1} le falta el logo`, true);
    const bad = sponsors.find((s) => s.link && !/^https?:\/\//i.test(s.link));
    if (bad) return toast(`El enlace de ${bad.name || 'un patrocinador'} debe empezar por https://`, true);
    const btn = $('#save');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      apply(await api.save(sponsors, config));
      toast('Publicado ✅ La landing ya muestra los cambios');
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Guardar y publicar';
    }
  });
  $('#discard').addEventListener('click', () => {
    if (snapshot() !== saved && !confirm('¿Descartar los cambios sin guardar?')) return;
    apply({ sponsors: JSON.parse(saved)[0], sponsorConfig: JSON.parse(saved)[1] });
  });
  window.addEventListener('beforeunload', (e) => {
    if (saved && snapshot() !== saved) e.preventDefault();
  });

  /* ---------- Conexión inicial ---------- */
  function showSetup() {
    $('#login').hidden = $('#app').hidden = $('#regs').hidden = $('#tabs').hidden = true;
    $('#setup').hidden = false;
    $('#backend').textContent = '⚪ Sin conectar';
  }

  async function status() {
    const res = await fetch('/api/public/event', { cache: 'no-store' }).catch(() => null);
    if (!res || !res.ok) return 'offline';
    const d = await res.json().catch(() => ({}));
    return d.storage === null ? 'setup' : d.storage || 'server';
  }

  $('#setupCheck').addEventListener('click', async () => {
    const err = $('#setupError');
    err.textContent = 'Comprobando…';
    const st = await status();
    if (st === 'setup') return (err.textContent = 'Todavía no aparece la variable CLOUDINARY_URL. Revisa que la guardaste y que hiciste Redeploy (tarda 1 minuto).');
    if (st === 'offline') return (err.textContent = 'No se pudo comprobar. Revisa tu internet.');
    location.reload();
  });

  async function init() {
    const st = await status();
    if (st === 'setup') return showSetup();
    $('#backend').textContent = st === 'cloudinary' ? '☁️ Guardando en Cloudinary' : st === 'server' ? '🟢 Servidor propio' : '';
    if (secret) enter().catch(() => logout());
  }
  init();
})();
