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

  const DEFAULT_CONFIG = { height: 40, speed: 'lento', creditWeb: '', creditTickets: 'https://eventosid.com' };
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
    const half = (hidden) => Array.from({ length: reps }, () => cards(hidden).join('')).join('');
    const seconds = count * reps * (SECONDS_PER_LOGO[cfg.speed] || SECONDS_PER_LOGO.lento);
    el.innerHTML = `<div class="sp-track${opts.reverse ? ' reverse' : ''}" style="animation-duration:${seconds}s">${half(false)}${half(true)}</div>`;
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

  window.MangoSponsors = { marquee, featured, visible, borderFilter, DEFAULT_CONFIG };
})();
