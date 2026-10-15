/*
 * Patrocinadores: dibuja los logos en las franjas animadas y en la sección de
 * destacados. Lo usan la landing y la vista previa del panel de patrocinadores.
 *
 * Cada patrocinador: { id, name, logo, link, height, border, bg, featured, active }
 *  - height: alto del logo en px (vacío = tamaño general)
 *  - border: borde blanco alrededor del logo, en px (0 = sin borde)
 *  - bg: fondo de la tarjeta: 'glass' | 'white' | 'dark' | 'none'
 */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') || /^\/(?!\/)/.test(u || '') || /^data:image\//i.test(u || '') ? u : '');

  // creditWeb: WhatsApp de Biomarketing con mensaje que indica que el contacto viene del evento.
  const BIOMARKETING_WA = 'https://wa.me/573505457420?text=%C2%A1Hola%2C%20Biomarketing%21%20%F0%9F%91%8B%20Vi%20su%20trabajo%20en%20la%20p%C3%A1gina%20del%20evento%20%2A%C2%BFD%C3%B3nde%20es%20el%20After%3F%20Vol.%201%2A%20de%20Mangos%20Espaciales%20y%20me%20gustar%C3%ADa%20recibir%20informaci%C3%B3n%20sobre%20sus%20servicios%20de%20dise%C3%B1o%20web%20y%20marketing%20digital.%20%C2%A1Gracias%21';
  const DEFAULT_CONFIG = { height: 40, speed: 'lento', creditWeb: BIOMARKETING_WA, creditWebLogo: '', creditTickets: 'https://eventosid.com', creditTicketsLogo: '' };
  const SECONDS_PER_LOGO = { lento: 6, normal: 4, rapido: 2.6 };

  // Borde blanco que sigue la silueta del logo (funciona mejor con PNG transparentes).
  function borderFilter(px) {
    const shadow = 'drop-shadow(0 3px 8px rgba(0,0,0,.28))';
    const b = Math.max(0, Math.min(10, Number(px) || 0));
    if (!b) return shadow;
    return [`${b}px 0`, `-${b}px 0`, `0 ${b}px`, `0 -${b}px`].map((o) => `drop-shadow(${o} 0 #fff)`).join(' ') + ' ' + shadow;
  }

  function visible(list) {
    return (list || []).filter((s) => s && s.active !== false && safeUrl(s.logo));
  }

  function logo(s, cfg, scale = 1) {
    const h = Math.round((Number(s.height) || cfg.height || DEFAULT_CONFIG.height) * scale);
    return `<img class="sp-img" src="${esc(safeUrl(s.logo))}" alt="${esc(s.name || 'Patrocinador')}" loading="lazy" decoding="async" style="height:${h}px;filter:${borderFilter(s.border)}" />`;
  }

  function wrap(s, cls, inner, hidden) {
    const link = safeUrl(s.link);
    const attrs = `class="${cls} sp-bg-${esc(s.bg || 'glass')}" title="${esc(s.name || '')}"${hidden ? ' aria-hidden="true" tabindex="-1"' : ''}`;
    return link
      ? `<a ${attrs} href="${esc(link)}" target="_blank" rel="noopener sponsored">${inner}</a>`
      : `<div ${attrs}>${inner}</div>`;
  }

  /* Franja que gira lentamente. Se repiten los logos para que la cinta nunca quede vacía.
     Sin patrocinadores se muestran opts.placeholders (espacios "Tu marca aquí"). */
  function marquee(el, list, config, opts = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const items = visible(list);
    if (!el) return false;
    const cards = items.length
      ? (hidden) => items.map((s) => wrap(s, 'sp-item', logo(s, cfg, opts.scale || 1), hidden))
      : (hidden) => (opts.placeholders || []).map((html) => (hidden ? html.replace(/^<a /, '<a aria-hidden="true" tabindex="-1" ') : html));
    const count = cards(false).length;
    if (!count) {
      el.innerHTML = '';
      return false;
    }
    const reps = Math.max(1, Math.ceil((opts.minItems || 10) / count));
    // un pequeño espacio al inicio de cada mitad: el primer logo no queda bajo el difuminado del borde
    const half = (hidden) => '<span class="sp-gap" aria-hidden="true"></span>' + Array.from({ length: reps }, () => cards(hidden).join('')).join('');
    const seconds = count * reps * (SECONDS_PER_LOGO[cfg.speed] || SECONDS_PER_LOGO.lento);
    // opts.hold: segundos quietos al empezar, para que se vean bien los primeros logos
    const delay = opts.hold ? `;animation-delay:${opts.hold}s` : '';
    el.innerHTML = `<div class="sp-track${opts.reverse ? ' reverse' : ''}" style="animation-duration:${seconds}s${delay}">${half(false)}${half(true)}</div>`;
    return true;
  }

  /* Tarjetas grandes y fijas para los patrocinadores destacados. */
  function featured(el, list, config, opts = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const items = visible(list).filter((s) => s.featured);
    if (!el) return false;
    if (!items.length && opts.placeholders) {
      el.dataset.count = String(opts.placeholders.length);
      el.innerHTML = opts.placeholders.join('');
      return false;
    }
    el.dataset.count = String(items.length);
    el.innerHTML = items
      .map((s) =>
        wrap(
          s,
          'sp-card',
          `<div class="sp-card-logo">${logo(s, cfg, 1.9)}</div>
           <div class="sp-card-foot"><span>${esc(s.name || 'Patrocinador oficial')}</span>${safeUrl(s.link) ? '<em>Visitar ↗</em>' : '<em>Oficial</em>'}</div>`
        )
      )
      .join('');
    return items.length > 0;
  }

  window.MangoSponsors = { marquee, featured, visible, borderFilter, DEFAULT_CONFIG, BIOMARKETING_WA };
})();
