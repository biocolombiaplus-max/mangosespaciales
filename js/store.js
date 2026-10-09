/*
 * Capa de datos de Mangos Espaciales.
 * Hoy guarda todo en localStorage (navegador). Para producción se reemplazan
 * load()/save() por llamadas a un backend (Supabase, Firebase, API propia)
 * sin tocar el resto de la app.
 */
(function () {
  const KEY = 'me_data_v1';

  const svgLogo = (text, bg, fg) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><rect width="240" height="90" rx="18" fill="${bg}"/><text x="120" y="56" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="${fg}">${text}</text></svg>`
    );

  const uid = () => Math.random().toString(36).slice(2, 10);

  const DEFAULTS = {
    settings: {
      brand: 'Mangos Espaciales',
      adminPin: '1234',
      whatsapp: '573000000000',
      email: 'hola@mangosespaciales.com',
      instagram: 'https://instagram.com/',
      facebook: 'https://facebook.com/',
      tiktok: 'https://tiktok.com/',
      currency: 'COP',
    },
    event: {
      title: 'MANGO FEST 2026',
      tagline: 'La experiencia más jugosa del año 🥭🚀',
      description:
        'Música en vivo, conferencias, experiencias inmersivas y networking en un solo lugar. Un evento creado para conectar marcas, emprendedores y profesionales con mucha energía.',
      date: '2026-12-12T18:00',
      venue: 'Centro de Eventos Galaxia',
      city: 'Bogotá, Colombia',
      mapUrl: 'https://maps.google.com/',
      mainImage:
        'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1800&q=80',
      gallery: [
        'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=80',
      ],
      highlights: [
        { icon: '🎤', title: 'Artistas en vivo', text: 'Line-up sorpresa con los artistas del momento.' },
        { icon: '💡', title: 'Charlas top', text: 'Expertos en marketing, salud y emprendimiento.' },
        { icon: '🤝', title: 'Networking', text: 'Conecta con marcas, aliados y nuevos clientes.' },
        { icon: '🎁', title: 'Sorpresas', text: 'Regalos, activaciones y experiencias de patrocinadores.' },
      ],
    },
    tickets: [
      { id: uid(), name: 'General', price: 60000, stock: 300, perks: 'Acceso general\nZona de food trucks', badge: '' },
      { id: uid(), name: 'VIP', price: 150000, stock: 80, perks: 'Acceso preferencial\nZona VIP\nKit de bienvenida', badge: 'Más vendida' },
      { id: uid(), name: 'Platinum', price: 280000, stock: 20, perks: 'Todo lo VIP\nMeet & greet\nBarra libre de mango 🥭', badge: 'Edición limitada' },
    ],
    sponsors: [
      { id: uid(), name: 'BioMarketing', logo: svgLogo('BIOMARKETING', '#FF2E93', '#fff'), url: 'https://instagram.com/', tier: 'oro', inHero: true },
      { id: uid(), name: 'Lab Andino', logo: svgLogo('LAB ANDINO', '#00E5FF', '#0D0221'), url: 'https://facebook.com/', tier: 'oro', inHero: true },
      { id: uid(), name: 'Salud+', logo: svgLogo('SALUD+', '#B6FF3B', '#0D0221'), url: 'https://example.com/', tier: 'plata', inHero: true },
      { id: uid(), name: 'Galaxia', logo: svgLogo('GALAXIA', '#7B2FFF', '#fff'), url: 'https://example.com/', tier: 'plata', inHero: true },
      { id: uid(), name: 'Tropic', logo: svgLogo('TROPIC', '#FFB800', '#0D0221'), url: 'https://tiktok.com/', tier: 'bronce', inHero: false },
    ],
    reservations: [],
  };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      const data = JSON.parse(raw);
      // completa campos nuevos si la estructura cambió
      return {
        ...clone(DEFAULTS),
        ...data,
        settings: { ...DEFAULTS.settings, ...data.settings },
        event: { ...DEFAULTS.event, ...data.event },
      };
    } catch (e) {
      return clone(DEFAULTS);
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      alert('No hay espacio suficiente para guardar. Usa imágenes más livianas o pega una URL en lugar de subir el archivo.');
      return false;
    }
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  function money(value, currency) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function sold(data, ticketId) {
    return data.reservations
      .filter((r) => r.ticketId === ticketId && r.status !== 'cancelada')
      .reduce((n, r) => n + Number(r.qty), 0);
  }

  function available(data, ticket) {
    return Math.max(0, Number(ticket.stock) - sold(data, ticket.id));
  }

  /* Reduce imágenes subidas para no llenar el almacenamiento. Los logos se
     guardan en PNG para conservar transparencia. */
  function fileToDataUrl(file, { maxSize = 1600, keepAlpha = false } = {}) {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/svg+xml') {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  window.MangoStore = { load, save, reset, uid, money, sold, available, fileToDataUrl, DEFAULTS };
})();
