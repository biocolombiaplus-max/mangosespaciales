/* Generador de historias de patrocinadores (Instagram y TikTok).
 * Dibuja en un lienzo de 1080×1920 (o 1080×1350 para post) el fondo, el logo de
 * Mangos Espaciales, el título del evento, el logo del patrocinador y las frases.
 * Cada elemento se arrastra en la vista previa, se escala y se edita en el panel.
 * Lee los patrocinadores del panel administrativo (window.PA). */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const canvas = $('#stCanvas');
  if (!canvas) return;
  let ctx = canvas.getContext('2d'); // apunta al lienzo que se está dibujando (vista previa o exportación)

  const W = 1080;
  const FORMATS = { story: 1920, post: 1350 };
  const SAVE_KEY = 'pa_story_v1';
  const COLORS = { yellow: '#FCD116', blue: '#0A3D91', red: '#CE1126', ink: '#1B1530', cream: '#FFF8E7', pink: '#FF2D7A' };
  const FONTS = { display: 'Anton, Impact, sans-serif', title: 'Shrikhand, Georgia, serif', body: '"Plus Jakarta Sans", Arial, sans-serif' };

  /* ---------- Diseño inicial (posiciones en % del alto para servir a los dos formatos) ---------- */
  const DEFAULT_LAYERS = () => ({
    brand: { label: 'Logo Mangos Espaciales', kind: 'brand', x: 540, y: 0.11, size: 250, visible: true },
    title: { label: 'Título del evento', kind: 'title', x: 540, y: 0.27, size: 118, color: COLORS.yellow, visible: true, text: '¿Dónde es\nel After?', sub: 'VOL. 1 · CÚCUTA', useLogo: false, logo: '', logoW: 820 },
    eyebrow: { label: 'Texto "Patrocinador oficial"', kind: 'pill', x: 540, y: 0.42, size: 44, color: COLORS.ink, fill: COLORS.yellow, visible: true, text: 'PATROCINADOR OFICIAL' },
    sponsor: { label: 'Logo del patrocinador', kind: 'sponsor', x: 540, y: 0.585, size: 700, visible: true, card: true, colorMode: 'original', border: 0 },
    phrase: { label: 'Frase', kind: 'text', x: 540, y: 0.75, size: 54, color: '#FFFFFF', visible: true, weight: 800, font: 'body', text: '¡Gracias por hacer posible la fiesta! 🎉' },
    info: { label: 'Fecha y lugar', kind: 'text', x: 540, y: 0.84, size: 44, color: COLORS.yellow, visible: true, weight: 400, font: 'display', text: 'SÁB 24 OCT · 6:00 PM\nPATÍN DE LA FRUTA · MALECÓN · CÚCUTA' },
  });
  const DEFAULTS = () => ({
    mode: 'one', format: 'story', sponsorId: '', bg: 'tricolor', bgColor: '#1b1530', dark: 45, bgs: [], bgUrl: '',
    bar: true, barText: 'Entrada GRATIS con inscripción', barColor: COLORS.red, barTextColor: '#FFFFFF',
    layers: DEFAULT_LAYERS(),
  });

  let S = load();
  let selected = 'sponsor';
  const bounds = {};
  const images = new Map(); // url -> { img, failed }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && d.layers) {
        const base = DEFAULTS();
        Object.keys(base.layers).forEach((k) => (base.layers[k] = { ...base.layers[k], ...(d.layers[k] || {}) }));
        const out = { ...base, ...d, layers: base.layers };
        if (out.bg === 'imagen') out.bg = 'tricolor'; // versión anterior: fondo solo de la sesión
        return out;
      }
    } catch (e) {
      /* sin diseño guardado */
    }
    return DEFAULTS();
  }
  const save = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    } catch (e) {
      /* el diseño no se recuerda, pero todo funciona */
    }
  };
  const H = () => FORMATS[S.format] || FORMATS.story;
  const py = (l) => l.y * H(); // posición vertical en píxeles

  /* ---------- Patrocinadores disponibles (los del panel + créditos) ---------- */
  function options() {
    const PA = window.PA;
    if (!PA) return [];
    const list = PA.sponsors().filter((s) => s.logo).map((s) => ({ id: s.id, name: s.name || 'Patrocinador', logo: s.logo, link: s.link }));
    const cfg = PA.config();
    if (cfg.creditWebLogo) list.push({ id: '_web', name: 'Biomarketing · Diseño web', logo: cfg.creditWebLogo, link: '' });
    if (cfg.creditTicketsLogo) list.push({ id: '_tickets', name: 'SID · Boletería', logo: cfg.creditTicketsLogo, link: cfg.creditTickets });
    return list;
  }
  const current = () => {
    const o = options();
    return o.find((s) => s.id === S.sponsorId) || o[0] || null;
  };
  const prettyLink = (u) =>
    String(u || '')
      .replace(/^https?:\/\/(www\.)?/i, '')
      .replace(/^instagram\.com\/([^/?#]+).*/i, '@$1')
      .replace(/^tiktok\.com\/@?([^/?#]+).*/i, '@$1')
      .replace(/^wa\.me\/.*/i, 'WhatsApp')
      .replace(/\/$/, '');

  /* ---------- Imágenes ---------- */
  function proxied(url) {
    const t = window.PA ? window.PA.token() : '';
    return `/api/admin/image-proxy?url=${encodeURIComponent(url)}&t=${encodeURIComponent(t)}`;
  }
  // Primero directo (Cloudinary permite CORS); si falla, por el servidor.
  function getImage(url) {
    if (!url) return null;
    const hit = images.get(url);
    if (hit) return hit.img;
    const entry = { img: null, failed: false };
    images.set(url, entry);
    const tryLoad = (src, fallback) => {
      const img = new Image();
      if (/^https?:/.test(src) || src.startsWith('/api/')) img.crossOrigin = 'anonymous';
      img.onload = () => {
        entry.img = img;
        draw();
      };
      img.onerror = () => {
        if (fallback) tryLoad(fallback, null);
        else {
          entry.failed = true;
          draw();
        }
      };
      img.src = src;
    };
    tryLoad(url, /^https:/.test(url) ? proxied(url) : null);
    return null;
  }

  /* ---------- Dibujo ---------- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function cover(img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2, img.width * s, img.height * s);
  }
  function fitBox(img, maxW, maxH) {
    const s = Math.min(maxW / img.width, maxH / img.height);
    return { w: img.width * s, h: img.height * s };
  }
  // Logo en color plano (blanco, negro…) o con borde tipo sticker que sigue su forma.
  function tinted(img, w, h, color) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function drawLogo(img, cx, cy, w, h, l) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    if (l.border > 0) {
      const sil = tinted(img, w, h, '#FFFFFF');
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        ctx.drawImage(sil, x + Math.cos(a) * l.border, y + Math.sin(a) * l.border, w, h);
      }
    }
    if (l.colorMode && l.colorMode !== 'original') ctx.drawImage(tinted(img, w, h, l.colorMode), x, y, w, h);
    else ctx.drawImage(img, x, y, w, h);
  }

  function drawBackground(h) {
    const bg = S.bg;
    if (bg === 'tricolor') {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0A3D91');
      g.addColorStop(0.55, '#2a2470');
      g.addColorStop(1, '#4a1f6b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, h);
      glow(W * 0.85, h * 0.12, 520, 'rgba(252,209,22,0.30)');
      glow(W * 0.1, h * 0.8, 560, 'rgba(206,17,38,0.35)');
      dots(h, 'rgba(255,255,255,0.07)');
    } else if (bg === 'noche') {
      ctx.fillStyle = '#120e24';
      ctx.fillRect(0, 0, W, h);
      glow(W * 0.12, h * 0.2, 620, 'rgba(226,35,26,0.45)');
      glow(W * 0.9, h * 0.8, 680, 'rgba(10,61,145,0.75)');
      dots(h, 'rgba(255,255,255,0.05)');
    } else if (bg === 'amarillo') {
      ctx.fillStyle = COLORS.yellow;
      ctx.fillRect(0, 0, W, h);
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#FFFFFF';
      ctx.translate(W / 2, h / 2);
      ctx.rotate(-Math.PI / 4);
      for (let x = -h * 1.5; x < h * 1.5; x += 56) ctx.fillRect(x, -h * 1.5, 28, h * 3);
      ctx.restore();
    } else if (bg === 'afiche' || bg === 'url') {
      const img = getImage(bg === 'afiche' ? 'assets/after/afiche-evento.jpg' : S.bgUrl);
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(0, 0, W, h);
      if (img) cover(img, 0, 0, W, h);
      ctx.fillStyle = `rgba(10,8,25,${S.dark / 100})`;
      ctx.fillRect(0, 0, W, h);
    } else {
      ctx.fillStyle = S.bgColor;
      ctx.fillRect(0, 0, W, h);
    }
    // franja tricolor arriba, como en la página
    [COLORS.yellow, COLORS.blue, COLORS.red].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((W / 3) * i, 0, W / 3 + 1, 16);
    });
  }
  function glow(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function dots(h, color) {
    ctx.fillStyle = color;
    for (let y = 30; y < h; y += 34) for (let x = (y / 34) % 2 ? 17 : 0; x < W; x += 34) ctx.fillRect(x, y, 3, 3);
  }

  function wrapLines(text, maxW) {
    const out = [];
    String(text || '')
      .split('\n')
      .forEach((para) => {
        let line = '';
        para.split(' ').forEach((word) => {
          const test = line ? line + ' ' + word : word;
          if (ctx.measureText(test).width > maxW && line) {
            out.push(line);
            line = word;
          } else line = test;
        });
        out.push(line);
      });
    return out;
  }

  // Cada función dibuja su elemento y devuelve su caja (para moverlo con el dedo).
  const drawers = {
    brand(l) {
      const img = getImage('assets/mangos-espaciales.webp');
      const s = l.size;
      const y = py(l);
      if (img) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(img, l.x - s / 2, y - s / 2, s, s);
        ctx.restore();
      }
      return { x: l.x - s / 2, y: y - s / 2, w: s, h: s };
    },
    title(l) {
      // con logo subido, se dibuja la imagen en lugar del texto
      const logoImg = l.useLogo && l.logo ? getImage(l.logo) : null;
      if (l.useLogo && l.logo) {
        const y = py(l);
        let box = { x: l.x - l.logoW / 2, y: y - l.logoW * 0.25, w: l.logoW, h: l.logoW * 0.5 };
        if (logoImg) {
          const f = fitBox(logoImg, l.logoW, l.logoW * 1.2);
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = 30;
          ctx.shadowOffsetY = 12;
          ctx.drawImage(logoImg, l.x - f.w / 2, y - f.h / 2, f.w, f.h);
          ctx.restore();
          box = { x: l.x - f.w / 2, y: y - f.h / 2, w: f.w, h: f.h };
        }
        if (l.sub) box.h += ribbon(l, box.y + box.h, Math.round(l.logoW * 0.055)) - (box.y + box.h);
        return box;
      }
      const size = l.size;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `400 ${size}px ${FONTS.title}`;
      const lines = String(l.text || '').split('\n');
      const lh = size * 1.02;
      const top = py(l) - (lines.length * lh) / 2;
      let maxW = 0;
      lines.forEach((t, i) => {
        const yy = top + lh * (i + 0.82);
        maxW = Math.max(maxW, ctx.measureText(t).width);
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * 0.12;
        ctx.strokeStyle = COLORS.ink;
        ctx.fillStyle = COLORS.pink;
        ctx.fillText(t, l.x + size * 0.06, yy + size * 0.06);
        ctx.strokeText(t, l.x, yy);
        ctx.fillStyle = l.color;
        ctx.fillText(t, l.x, yy);
      });
      let bottom = top + lines.length * lh;
      if (l.sub) bottom = ribbon(l, bottom, Math.round(size * 0.36));
      return { x: l.x - maxW / 2 - 20, y: top, w: maxW + 40, h: bottom - top };
    },
    pill(l) {
      return drawPill(l);
    },
  };
  // Cinta roja bajo el título (VOL. 1 · CÚCUTA). Devuelve dónde termina.
  function ribbon(l, bottom, ss) {
    ctx.font = `400 ${ss}px ${FONTS.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(l.sub).width + ss * 1.4;
    const by = bottom + ss * 0.35;
    ctx.save();
    ctx.translate(l.x, by + ss * 0.7);
    ctx.rotate(-0.025);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(-tw / 2, -ss * 0.7, tw, ss * 1.4);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(l.sub, 0, ss * 0.36);
    ctx.restore();
    return by + ss * 1.4;
  }
  function drawPill(l) {
    {
      const size = l.size;
      ctx.font = `400 ${size}px ${FONTS.display}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = String(l.text || '').toUpperCase();
      const spaced = text.split('').join(' ');
      const tw = ctx.measureText(spaced).width + size * 1.6;
      const h = size * 1.7;
      const y = py(l);
      ctx.save();
      ctx.translate(l.x, y);
      ctx.rotate(-0.02);
      ctx.fillStyle = COLORS.ink;
      roundRect(-tw / 2 + 8, -h / 2 + 8, tw, h, 14);
      ctx.fill();
      ctx.fillStyle = l.fill;
      roundRect(-tw / 2, -h / 2, tw, h, 14);
      ctx.fill();
      ctx.fillStyle = l.color;
      ctx.fillText(spaced, 0, size * 0.04);
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
      return { x: l.x - tw / 2, y: y - h / 2, w: tw + 8, h: h + 8 };
    }
  }
  Object.assign(drawers, {
    text(l) {
      const size = l.size;
      ctx.font = `${l.weight || 700} ${size}px ${FONTS[l.font] || FONTS.body}`;
      ctx.textAlign = 'center';
      const lines = wrapLines(l.text, 940);
      const lh = size * 1.22;
      const top = py(l) - (lines.length * lh) / 2;
      let maxW = 0;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = l.color;
      lines.forEach((t, i) => {
        maxW = Math.max(maxW, ctx.measureText(t).width);
        ctx.fillText(t, l.x, top + lh * i + size * 0.95);
      });
      ctx.restore();
      return { x: l.x - maxW / 2 - 10, y: top, w: maxW + 20, h: lines.length * lh + 6 };
    },
    sponsor(l) {
      const y = py(l);
      if (S.mode === 'all') return drawGrid(l, y);
      const sp = current();
      const img = sp && getImage(sp.logo);
      const boxW = l.size;
      const boxH = l.size * 0.62;
      if (l.card) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 16;
        ctx.fillStyle = '#FFFFFF';
        roundRect(l.x - boxW / 2, y - boxH / 2, boxW, boxH, 36);
        ctx.fill();
        ctx.restore();
      }
      if (img) {
        const pad = l.card ? boxW * 0.1 : 0;
        const f = fitBox(img, boxW - pad * 2, boxH - pad * 2);
        drawLogo(img, l.x, y, f.w, f.h, l);
      } else if (!l.card) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.setLineDash([16, 12]);
        ctx.lineWidth = 4;
        roundRect(l.x - boxW / 2, y - boxH / 2, boxW, boxH, 36);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return { x: l.x - boxW / 2, y: y - boxH / 2, w: boxW, h: boxH };
    },
  });

  function drawGrid(l, cy) {
    const list = options().filter((s) => !s.id.startsWith('_'));
    const n = Math.max(1, list.length);
    const cols = n === 1 ? 1 : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const gap = 26;
    // la grilla no pasa de ~30% del alto, para no tapar frases ni la barra
    const maxH = H() * 0.3;
    let cellW = (l.size + 160 - gap * (cols - 1)) / cols;
    if (rows * cellW * 0.62 + gap * (rows - 1) > maxH) cellW = (maxH - gap * (rows - 1)) / rows / 0.62;
    const cellH = cellW * 0.62;
    const totalW = cols * cellW + gap * (cols - 1);
    const totalH = rows * cellH + gap * (rows - 1);
    const x0 = l.x - totalW / 2;
    const y0 = cy - totalH / 2;
    list.forEach((s, i) => {
      const x = x0 + (i % cols) * (cellW + gap);
      const y = y0 + Math.floor(i / cols) * (cellH + gap);
      if (l.card) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#FFFFFF';
        roundRect(x, y, cellW, cellH, 26);
        ctx.fill();
        ctx.restore();
      }
      const img = getImage(s.logo);
      if (img) {
        const f = fitBox(img, cellW * 0.8, cellH * 0.72);
        drawLogo(img, x + cellW / 2, y + cellH / 2, f.w, f.h, l);
      }
    });
    return { x: x0, y: y0, w: totalW, h: totalH };
  }

  function drawBar(h) {
    if (!S.bar) return;
    const bh = S.format === 'post' ? 120 : 170;
    ctx.fillStyle = S.barColor;
    ctx.fillRect(0, h - bh, W, bh);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, h - bh, W, 6);
    if (S.barText.trim()) {
      ctx.fillStyle = S.barTextColor;
      ctx.font = `800 ${S.format === 'post' ? 40 : 46}px ${FONTS.body}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(S.barText.trim(), W / 2, h - bh / 2 + 4, W - 100);
      ctx.textBaseline = 'alphabetic';
    }
  }

  const ORDER = ['brand', 'title', 'eyebrow', 'sponsor', 'phrase', 'info'];
  function render(target, forExport) {
    const h = H();
    if (target.height !== h) target.height = h;
    const prev = ctx;
    const c = target.getContext('2d');
    ctx = c;
    c.clearRect(0, 0, W, h);
    c.imageSmoothingQuality = 'high';
    drawBackground(h);
    ORDER.forEach((k) => {
      const l = S.layers[k];
      if (!l.visible) return;
      const kind = l.kind === 'brand' ? 'brand' : l.kind;
      bounds[k] = drawers[kind](l);
    });
    drawBar(h);
    if (!forExport && bounds[selected] && S.layers[selected].visible) {
      const b = bounds[selected];
      c.save();
      c.strokeStyle = COLORS.yellow;
      c.lineWidth = 5;
      c.setLineDash([18, 12]);
      c.strokeRect(b.x - 12, b.y - 12, b.w + 24, b.h + 24);
      c.restore();
    }
    ctx = prev;
  }

  let pending = false;
  function draw() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render(canvas, false);
      notes();
    });
  }

  function notes() {
    const sp = current();
    const failed = [...images.entries()].filter(([, v]) => v.failed).length;
    $('#stNote').textContent = !options().length
      ? 'Primero agrega patrocinadores con logo en la pestaña ⭐ Patrocinadores.'
      : failed
        ? 'Algún logo no se pudo cargar. Súbelo como archivo en ⭐ Patrocinadores en lugar de pegar un enlace.'
        : sp && S.mode === 'one'
          ? `Historia de ${sp.name} · ${W}×${H()} px`
          : `Todos los patrocinadores · ${W}×${H()} px`;
  }

  /* ---------- Panel de controles ---------- */
  function seg(el, value) {
    $$('button', el).forEach((b) => b.classList.toggle('on', b.dataset.v === value));
  }
  function syncControls() {
    seg($('#stMode'), S.mode);
    seg($('#stFormat'), S.format);
    $$('#stBg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.bg));
    renderMyBgs();
    $('#stSponsorWrap').hidden = S.mode !== 'one';
    $('#stBgColorWrap').hidden = S.bg !== 'color';
    $('#stDarkWrap').hidden = !['afiche', 'url'].includes(S.bg);
    $('#stBgColor').value = S.bgColor;
    $('#stDark').value = S.dark;
    $('#stDarkVal').textContent = S.dark + '%';
    $('#stBar').checked = S.bar;
    $('#stBarText').value = S.barText;
    $('#stBarColor').value = S.barColor;
    $('#stBarTextColor').value = S.barTextColor;
    const o = options();
    $('#stSponsor').innerHTML = o.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    const sp = current();
    if (sp) $('#stSponsor').value = sp.id;
    renderLayers();
  }

  function renderLayers() {
    $('#stLayers').innerHTML = ORDER.map((k) => {
      const l = S.layers[k];
      return `<button type="button" class="st-layer ${k === selected ? 'on' : ''} ${l.visible ? '' : 'off'}" data-k="${k}">
        <span class="st-eye" data-eye="${k}" title="Mostrar u ocultar">${l.visible ? '👁' : '🚫'}</span>${esc(l.label)}</button>`;
    }).join('');
    renderEdit();
  }

  function renderEdit() {
    const l = S.layers[selected];
    const k = selected;
    const range = (key, label, min, max, step = 1, unit = 'px') =>
      `<label class="st-field">${label} <b>${Math.round(l[key])}${unit}</b><input type="range" data-p="${key}" min="${min}" max="${max}" step="${step}" value="${l[key]}" /></label>`;
    let html = `<div class="st-edit-top"><p class="st-edit-title">✏️ ${esc(l.label)}</p>
      <button type="button" class="btn btn-sm ${l.visible ? 'btn-red' : 'btn-blue'}" data-vis>${l.visible ? '🗑 Quitar de la imagen' : '👁 Volver a mostrar'}</button></div>`;
    if (!l.visible) {
      $('#stEdit').innerHTML = html + '<p class="st-hidden-note">Este elemento no sale en la imagen. Pulsa "Volver a mostrar" para recuperarlo.</p>';
      return;
    }
    if (k === 'title') {
      html += `<div class="st-field">Mostrar como<div class="st-seg st-seg-sm" data-title-mode>
        <button type="button" data-v="text" class="${l.useLogo ? '' : 'on'}">Texto</button><button type="button" data-v="logo" class="${l.useLogo ? 'on' : ''}">Logo (imagen)</button></div></div>`;
    }
    if (k === 'title' && l.useLogo) {
      html += `<div class="st-title-logo">${l.logo ? `<img src="${esc(l.logo)}" alt="" />` : '<span>Sube el logo de ¿Dónde es el After?</span>'}</div>
        <label class="btn btn-red btn-sm pa-file">📤 ${l.logo ? 'Cambiar logo' : 'Subir logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-title-file /></label>
        <label class="pa-check"><input type="checkbox" id="stTitleClean" checked /> Quitar fondo y márgenes al subir</label>`;
      html += range('logoW', 'Ancho del logo', 300, 1040);
    } else if (k === 'title' || l.kind === 'text' || l.kind === 'pill') {
      html += `<label class="st-field">Texto<textarea data-p="text" rows="${l.kind === 'pill' ? 1 : 2}">${esc(l.text)}</textarea></label>`;
    }
    if (k === 'title') html += `<label class="st-field">Cinta debajo <small>(vacía = sin cinta)</small><input type="text" data-p="sub" value="${esc(l.sub)}" /></label>`;
    if (k === 'brand') html += range('size', 'Tamaño', 120, 600);
    else if (k === 'sponsor') {
      html += range('size', 'Tamaño', 300, 980);
      html += `<label class="pa-check"><input type="checkbox" data-p="card" ${l.card ? 'checked' : ''} /> Tarjeta blanca detrás del logo</label>`;
      html += `<div class="st-field">Color del logo<div class="st-seg st-seg-sm" data-color>
        ${[['original', 'Original'], ['#FFFFFF', 'Blanco'], ['#000000', 'Negro'], [COLORS.yellow, 'Amarillo']].map(([v, t]) => `<button type="button" data-v="${v}" class="${l.colorMode === v ? 'on' : ''}">${t}</button>`).join('')}
      </div></div>`;
      html += range('border', 'Borde blanco tipo sticker', 0, 24, 1);
    } else if (!(k === 'title' && l.useLogo)) {
      html += range('size', 'Tamaño de letra', 20, k === 'title' ? 200 : 110);
      html += `<label class="st-field">Color<input type="color" data-p="color" value="${l.color}" /></label>`;
      if (l.kind === 'pill') html += `<label class="st-field">Color de la cinta<input type="color" data-p="fill" value="${l.fill}" /></label>`;
    }
    html += `<div class="st-pos"><button type="button" class="btn btn-ghost-dark btn-sm" data-center>↔ Centrar</button><button type="button" class="btn btn-ghost-dark btn-sm" data-up>▲ Subir</button><button type="button" class="btn btn-ghost-dark btn-sm" data-down>▼ Bajar</button></div>`;
    $('#stEdit').innerHTML = html;
  }

  function change() {
    save();
    draw();
  }

  $('#stLayers').addEventListener('click', (e) => {
    const eye = e.target.closest('[data-eye]');
    if (eye) {
      const l = S.layers[eye.dataset.eye];
      l.visible = !l.visible;
      renderLayers();
      return change();
    }
    const b = e.target.closest('[data-k]');
    if (!b) return;
    selected = b.dataset.k;
    renderLayers();
    draw();
  });
  $('#stEdit').addEventListener('input', (e) => {
    const p = e.target.dataset.p;
    if (!p) return;
    const l = S.layers[selected];
    l[p] = e.target.type === 'range' ? Number(e.target.value) : e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (e.target.type === 'range') e.target.parentElement.querySelector('b').textContent = Math.round(l[p]) + 'px';
    change();
  });
  $('#stEdit').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-title-file]')) return;
    const file = e.target.files[0];
    if (!file || !window.PA) return;
    const clean = $('#stTitleClean') ? $('#stTitleClean').checked : true;
    const box = $('.st-title-logo');
    box.classList.add('busy');
    try {
      S.layers.title.logo = await window.PA.uploadImage(file, { trim: clean, removeWhite: clean });
      S.layers.title.useLogo = true;
      renderEdit();
      change();
      window.PA.toast('Logo del evento listo ✅');
    } catch (err) {
      box.classList.remove('busy');
      window.PA.toast(err.message, true);
    }
  });
  $('#stEdit').addEventListener('click', (e) => {
    const l = S.layers[selected];
    if (e.target.closest('[data-vis]')) {
      l.visible = !l.visible;
      renderLayers();
      return change();
    }
    const tm = e.target.closest('[data-title-mode] [data-v]');
    if (tm) {
      l.useLogo = tm.dataset.v === 'logo';
      renderEdit();
      return change();
    }
    const c = e.target.closest('[data-color] [data-v]');
    if (c) {
      l.colorMode = c.dataset.v;
      renderEdit();
      return change();
    }
    if (e.target.closest('[data-center]')) l.x = W / 2;
    else if (e.target.closest('[data-up]')) l.y = Math.max(0.03, l.y - 0.01);
    else if (e.target.closest('[data-down]')) l.y = Math.min(0.97, l.y + 0.01);
    else return;
    change();
  });

  $('#stMode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    S.mode = b.dataset.v;
    S.layers.eyebrow.text = S.mode === 'all' ? 'PATROCINADORES OFICIALES' : 'PATROCINADOR OFICIAL';
    syncControls();
    change();
  });
  $('#stFormat').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    S.format = b.dataset.v;
    syncControls();
    change();
  });
  $('#stBg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    S.bg = b.dataset.v;
    syncControls();
    change();
  });
  $('#stBgColor').addEventListener('input', (e) => {
    S.bgColor = e.target.value;
    change();
  });
  $('#stDark').addEventListener('input', (e) => {
    S.dark = Number(e.target.value);
    $('#stDarkVal').textContent = S.dark + '%';
    change();
  });
  /* ---------- Mis fondos: imágenes subidas a Cloudinary y guardadas en la lista ---------- */
  function renderMyBgs() {
    const list = S.bgs || [];
    $('#stMyBgs').innerHTML =
      list
        .map(
          (u, i) => `<button type="button" class="${S.bg === 'url' && S.bgUrl === u ? 'on' : ''}" data-bgurl="${esc(u)}">
            <i style="background-image:url('${esc(u)}')"></i>Fondo ${i + 1}<span class="st-del" data-delbg="${i}" title="Quitar de la lista">✕</span></button>`
        )
        .join('') +
      `<label class="st-addbg" id="stAddBg"><i>＋</i>Agregar fondo<input type="file" accept="image/*" id="stBgFile" /></label>`;
  }
  $('#stMyBgs').addEventListener('click', (e) => {
    const del = e.target.closest('[data-delbg]');
    if (del) {
      e.preventDefault();
      const [u] = S.bgs.splice(Number(del.dataset.delbg), 1);
      if (S.bg === 'url' && S.bgUrl === u) S.bg = 'tricolor';
      syncControls();
      return change();
    }
    const b = e.target.closest('[data-bgurl]');
    if (!b) return;
    S.bg = 'url';
    S.bgUrl = b.dataset.bgurl;
    syncControls();
    change();
  });
  $('#stMyBgs').addEventListener('change', async (e) => {
    if (e.target.id !== 'stBgFile') return;
    const f = e.target.files[0];
    if (!f || !window.PA) return;
    const tile = $('#stAddBg');
    tile.classList.add('busy');
    tile.firstElementChild.textContent = '…';
    try {
      const url = await window.PA.uploadPhoto(f);
      S.bgs = [url, ...(S.bgs || []).filter((u) => u !== url)].slice(0, 12);
      S.bg = 'url';
      S.bgUrl = url;
      syncControls();
      change();
      window.PA.toast('Fondo agregado ✅');
    } catch (err) {
      renderMyBgs();
      window.PA.toast(err.message, true);
    }
  });
  function pickSponsor(id) {
    S.sponsorId = id;
    const sp = current();
    if (sp && sp.link && !/wa\.me/.test(sp.link)) S.barText = prettyLink(sp.link);
    syncControls();
    change();
  }
  $('#stSponsor').addEventListener('change', (e) => pickSponsor(e.target.value));
  const step = (d) => {
    const o = options();
    if (!o.length) return;
    const i = Math.max(0, o.findIndex((s) => s.id === (current() || {}).id));
    pickSponsor(o[(i + d + o.length) % o.length].id);
  };
  $('#stPrev').addEventListener('click', () => step(-1));
  $('#stNext').addEventListener('click', () => step(1));
  $('#stBar').addEventListener('change', (e) => {
    S.bar = e.target.checked;
    change();
  });
  [['#stBarText', 'barText'], ['#stBarColor', 'barColor'], ['#stBarTextColor', 'barTextColor']].forEach(([sel, key]) =>
    $(sel).addEventListener('input', (e) => {
      S[key] = e.target.value;
      change();
    })
  );
  $('#stReset').addEventListener('click', () => {
    if (!confirm('¿Volver al diseño inicial? Se pierden las posiciones y textos que cambiaste.')) return;
    const keep = { sponsorId: S.sponsorId, mode: S.mode, format: S.format, bgs: S.bgs || [] };
    S = { ...DEFAULTS(), ...keep };
    selected = 'sponsor';
    syncControls();
    change();
  });

  /* ---------- Arrastrar en la vista previa ---------- */
  let drag = null;
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H() };
  };
  const hit = (p) =>
    [...ORDER].reverse().find((k) => {
      const b = bounds[k];
      return S.layers[k].visible && b && p.x >= b.x - 20 && p.x <= b.x + b.w + 20 && p.y >= b.y - 20 && p.y <= b.y + b.h + 20;
    });
  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const k = hit(p);
    if (!k) return;
    e.preventDefault();
    if (k !== selected) {
      selected = k;
      renderLayers();
    }
    const l = S.layers[k];
    drag = { k, dx: p.x - l.x, dy: p.y - py(l), id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      canvas.style.cursor = hit(toCanvas(e)) ? 'grab' : 'default';
      return;
    }
    const p = toCanvas(e);
    const l = S.layers[drag.k];
    let x = p.x - drag.dx;
    if (Math.abs(x - W / 2) < 18) x = W / 2; // se pega al centro
    l.x = Math.max(0, Math.min(W, x));
    l.y = Math.max(0.02, Math.min(0.98, (p.y - drag.dy) / H()));
    canvas.style.cursor = 'grabbing';
    draw();
  });
  const end = () => {
    if (!drag) return;
    drag = null;
    canvas.style.cursor = 'grab';
    save();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener(
    'wheel',
    (e) => {
      const k = hit(toCanvas(e));
      if (!k) return;
      e.preventDefault();
      const l = S.layers[k];
      const f = e.deltaY < 0 ? 1.05 : 0.95;
      if (k === 'title' && l.useLogo) l.logoW = Math.max(300, Math.min(1040, l.logoW * f));
      else {
        const max = k === 'sponsor' ? 980 : k === 'brand' ? 600 : k === 'title' ? 200 : 110;
        l.size = Math.max(20, Math.min(max, l.size * f));
      }
      selected = k;
      renderLayers();
      change();
    },
    { passive: false }
  );
  document.addEventListener('keydown', (e) => {
    if ($('#stories').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const l = S.layers[selected];
    const d = e.shiftKey ? 20 : 4;
    if (e.key === 'ArrowLeft') l.x -= d;
    else if (e.key === 'ArrowRight') l.x += d;
    else if (e.key === 'ArrowUp') l.y -= d / H();
    else if (e.key === 'ArrowDown') l.y += d / H();
    else return;
    e.preventDefault();
    change();
  });

  /* ---------- Descargar y compartir ---------- */
  function fileName() {
    const sp = current();
    const base = S.mode === 'all' ? 'patrocinadores' : (sp && sp.name) || 'patrocinador';
    return `${base.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${S.format === 'post' ? 'post' : 'historia'}.png`;
  }
  function exportBlob() {
    return new Promise((resolve, reject) => {
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H();
      render(out, true);
      try {
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen.'))), 'image/png');
      } catch (e) {
        reject(new Error('Un logo bloquea la descarga. Súbelo como archivo en ⭐ Patrocinadores y vuelve a intentar.'));
      }
    });
  }
  $('#stDownload').addEventListener('click', async () => {
    try {
      const blob = await exportBlob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      window.PA && window.PA.toast('Imagen descargada ✅ Lista para subir a historias');
    } catch (err) {
      window.PA && window.PA.toast(err.message, true);
    }
  });
  // En el celular se comparte directo a Instagram, TikTok o WhatsApp.
  const canShareFiles = (() => {
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }));
    } catch (e) {
      return false;
    }
  })();
  $('#stShare').hidden = !canShareFiles;
  $('#stShare').addEventListener('click', async () => {
    try {
      const blob = await exportBlob();
      await navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })], title: '¿Dónde es el After? Vol. 1' });
    } catch (err) {
      if (err.name !== 'AbortError') window.PA && window.PA.toast(err.message, true);
    }
  });

  /* ---------- Inicio ---------- */
  let ready = false;
  async function open() {
    if (!ready) {
      ready = true;
      try {
        await Promise.all(['400 100px Shrikhand', '400 100px Anton', '800 50px "Plus Jakarta Sans"', '400 50px "Plus Jakarta Sans"'].map((f) => document.fonts.load(f)));
      } catch (e) {
        /* se dibuja con letras de respaldo */
      }
    }
    syncControls();
    draw();
  }

  window.MangoStories = { open };
})();
