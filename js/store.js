/*
 * Capa de datos de Mangos Espaciales.
 * Hoy guarda todo en localStorage (navegador). Para producción se reemplazan
 * load()/save() por llamadas a un backend (Supabase, Firebase, API propia)
 * sin tocar el resto de la app.
 */
(function () {
  const KEY = 'me_data_v2';
  const OLD_KEY = 'me_data_v1';

  const svgLogo = (text, bg, fg) =>
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 90"><rect width="240" height="90" rx="18" fill="${bg}"/><text x="120" y="56" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="26" fill="${fg}">${text}</text></svg>`
    );

  const uid = () => Math.random().toString(36).slice(2, 10);
  const img = (id, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
  const ticket = (name, price, stock, perks, badge = '') => ({ id: uid(), name, price, stock, perks, badge });

  const CATEGORIES = ['Conciertos', 'Conferencias', 'Salud', 'Networking', 'Fiestas', 'Talleres'];

  const DEFAULTS = {
    settings: {
      brand: 'Mangos Espaciales',
      slogan: 'Eventos que se viven a otro nivel',
      adminPin: '1234',
      whatsapp: '573000000000',
      email: 'hola@mangosespaciales.com',
      phone: '+57 300 000 0000',
      address: 'Bogotá, Colombia',
      instagram: 'https://instagram.com/',
      facebook: 'https://facebook.com/',
      tiktok: 'https://tiktok.com/',
      youtube: '',
      currency: 'COP',
      paymentMethods: 'Nequi, Daviplata, PSE, Tarjeta de crédito, Transferencia, Efectivo',
      categories: CATEGORIES,
      stats: [
        { value: '+120', label: 'Eventos realizados' },
        { value: '+45K', label: 'Asistentes felices' },
        { value: '+80', label: 'Marcas aliadas' },
        { value: '4.9★', label: 'Calificación promedio' },
      ],
      testimonials: [
        { name: 'Laura Gómez', role: 'Asistente · Mango Fest', text: 'La mejor organización que he visto. Compré en 2 minutos y el ingreso fue rapidísimo.' },
        { name: 'Dr. Andrés Rojas', role: 'Organizador · Congreso de Salud', text: 'Se encargaron de boletería, patrocinadores y marketing. Llenamos el auditorio una semana antes.' },
        { name: 'Camila Torres', role: 'Marca patrocinadora', text: 'Nuestra marca tuvo una visibilidad increíble. Ya estamos listos para el próximo evento.' },
      ],
      faqs: [
        { q: '¿Cómo compro mis boletas?', a: 'Elige el evento, selecciona el tipo y la cantidad de boletas, completa tus datos y recibirás un código de reserva. Te enviamos los datos de pago por WhatsApp.' },
        { q: '¿Qué medios de pago aceptan?', a: 'Nequi, Daviplata, PSE, tarjetas de crédito, transferencia bancaria y efectivo en puntos autorizados.' },
        { q: '¿Cómo recibo mi boleta?', a: 'Una vez confirmado el pago, te enviamos tu boleta digital con código QR al correo y WhatsApp registrados.' },
        { q: '¿Puedo transferir mi boleta a otra persona?', a: 'Sí, escríbenos por WhatsApp con tu código de reserva y los datos de la nueva persona hasta 24 horas antes del evento.' },
        { q: '¿Hay devoluciones?', a: 'Las boletas no son reembolsables, salvo cancelación o cambio de fecha del evento, según la ley de protección al consumidor.' },
        { q: '¿Quiero organizar mi evento con ustedes, qué hago?', a: 'Escríbenos desde la sección "Organiza tu evento". Te ayudamos con producción, boletería, patrocinios y marketing.' },
      ],
    },
    events: [
      {
        id: uid(),
        title: 'Mango Fest 2026',
        category: 'Conciertos',
        tagline: 'La experiencia más jugosa del año 🥭🚀',
        description:
          'Música en vivo, experiencias inmersivas, zona gastronómica y activaciones de marca en una sola noche. Un festival creado para vivir, compartir y conectar con mucha energía.',
        date: '2026-12-12T18:00',
        doors: '16:00',
        venue: 'Centro de Eventos Galaxia',
        address: 'Av. Calle 26 # 68-00',
        city: 'Bogotá',
        ageLimit: '+18',
        mainImage: img('photo-1470229722913-7c0e2dbbafd3'),
        gallery: [img('photo-1501281668745-f7f57925c3b4', 1000), img('photo-1514525253161-7a46d19cd819', 1000), img('photo-1492684223066-81342ee5ff30', 1000), img('photo-1459749411175-04bf5292ceea', 1000)],
        agenda: [
          { time: '16:00', title: 'Apertura de puertas', text: 'Zona gastronómica y activaciones de marca.' },
          { time: '18:00', title: 'DJ set de apertura', text: 'Calentamiento con los mejores beats.' },
          { time: '20:00', title: 'Artista principal', text: 'Show en vivo de 90 minutos.' },
          { time: '22:00', title: 'After party', text: 'Fiesta hasta la 1:00 a. m.' },
        ],
        tickets: [
          ticket('General', 60000, 300, 'Acceso general\nZona de food trucks'),
          ticket('VIP', 150000, 80, 'Acceso preferencial\nZona VIP con vista frontal\nKit de bienvenida', 'Más vendida'),
          ticket('Platinum', 280000, 20, 'Todo lo VIP\nMeet & greet\nBarra libre de mango 🥭', 'Edición limitada'),
        ],
        featured: true,
        status: 'publicado',
      },
      {
        id: uid(),
        title: 'Congreso de Marketing Médico',
        category: 'Salud',
        tagline: 'Estrategias digitales para profesionales de la salud',
        description:
          'Un día completo con expertos en marketing médico, auditoría y posicionamiento de consultorios, clínicas y laboratorios. Incluye certificado de asistencia y networking con el sector salud.',
        date: '2026-11-21T08:00',
        doors: '07:30',
        venue: 'Hotel Gran Estelar',
        address: 'Calle 100 # 7-50',
        city: 'Bogotá',
        ageLimit: 'Todo público',
        mainImage: img('photo-1540575467063-178a50c2df87'),
        gallery: [img('photo-1505373877841-8d25f7d46678', 1000), img('photo-1475721027785-f74eccf877e2', 1000), img('photo-1515187029135-18ee286d815b', 1000)],
        agenda: [
          { time: '08:00', title: 'Registro y café', text: '' },
          { time: '09:00', title: 'Marca personal médica', text: 'Cómo construir confianza en redes.' },
          { time: '11:00', title: 'Auditoría médica y calidad', text: 'Procesos que generan reputación.' },
          { time: '14:00', title: 'Pauta digital para laboratorios', text: 'Casos reales y resultados.' },
        ],
        tickets: [ticket('Estudiante', 90000, 100, 'Acceso a conferencias\nCertificado digital'), ticket('Profesional', 180000, 200, 'Acceso a conferencias\nAlmuerzo\nCertificado', 'Recomendada')],
        featured: true,
        status: 'publicado',
      },
      {
        id: uid(),
        title: 'Noche de Emprendedores',
        category: 'Networking',
        tagline: 'Conecta, aprende y haz crecer tu negocio',
        description: 'Charlas cortas, ronda de negocios y networking con emprendedores, inversionistas y marcas.',
        date: '2026-11-07T18:30',
        doors: '18:00',
        venue: 'Hub Creativo 93',
        address: 'Carrera 13 # 93-40',
        city: 'Bogotá',
        ageLimit: '+18',
        mainImage: img('photo-1511578314322-379afb476865'),
        gallery: [],
        agenda: [],
        tickets: [ticket('Entrada', 45000, 120, 'Acceso al evento\nCóctel de bienvenida')],
        featured: false,
        status: 'publicado',
      },
      {
        id: uid(),
        title: 'Taller: Contenido que vende',
        category: 'Talleres',
        tagline: 'Crea contenido para redes en 1 día',
        description: 'Taller práctico de fotografía con celular, guiones para reels y calendario de contenido.',
        date: '2026-10-30T09:00',
        doors: '08:45',
        venue: 'Estudio Mango',
        address: 'Calle 85 # 11-20',
        city: 'Medellín',
        ageLimit: 'Todo público',
        mainImage: img('photo-1552664730-d307ca884978'),
        gallery: [],
        agenda: [],
        tickets: [ticket('Cupo taller', 120000, 30, 'Material incluido\nRefrigerio\nCertificado', 'Cupos limitados')],
        featured: false,
        status: 'publicado',
      },
    ],
    sponsors: [
      { id: uid(), name: 'BioMarketing', logo: svgLogo('BIOMARKETING', '#FF2E93', '#fff'), url: 'https://instagram.com/', tier: 'oro', inHero: true },
      { id: uid(), name: 'Lab Andino', logo: svgLogo('LAB ANDINO', '#00B8D9', '#fff'), url: 'https://facebook.com/', tier: 'oro', inHero: true },
      { id: uid(), name: 'Salud+', logo: svgLogo('SALUD+', '#7BC62D', '#fff'), url: 'https://example.com/', tier: 'plata', inHero: true },
      { id: uid(), name: 'Galaxia', logo: svgLogo('GALAXIA', '#6C2BD9', '#fff'), url: 'https://example.com/', tier: 'plata', inHero: true },
      { id: uid(), name: 'Tropic', logo: svgLogo('TROPIC', '#FFB800', '#1a1033'), url: 'https://tiktok.com/', tier: 'bronce', inHero: true },
    ],
    reservations: [],
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Convierte los datos de la primera versión (un solo evento) al formato actual.
  function migrateV1(old) {
    const d = clone(DEFAULTS);
    const ev = old.event || {};
    const first = d.events[0];
    Object.assign(first, {
      title: ev.title || first.title,
      tagline: ev.tagline || first.tagline,
      description: ev.description || first.description,
      date: ev.date || first.date,
      venue: ev.venue || first.venue,
      city: ev.city || first.city,
      mainImage: ev.mainImage ?? first.mainImage,
      gallery: ev.gallery || first.gallery,
      tickets: old.tickets || first.tickets,
    });
    d.sponsors = old.sponsors || d.sponsors;
    d.reservations = (old.reservations || []).map((r) => ({
      ...r,
      eventId: first.id,
      eventTitle: first.title,
      items: [{ ticketId: r.ticketId, name: r.ticketName, qty: r.qty, price: r.total / r.qty }],
    }));
    Object.assign(d.settings, old.settings || {});
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        // primera visita: se guardan los datos iniciales para que los IDs sean estables entre páginas
        const old = localStorage.getItem(OLD_KEY);
        const initial = old ? migrateV1(JSON.parse(old)) : clone(DEFAULTS);
        save(initial);
        return initial;
      }
      const data = JSON.parse(raw);
      return { ...clone(DEFAULTS), ...data, settings: { ...DEFAULTS.settings, ...data.settings } };
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
    localStorage.removeItem(OLD_KEY);
  }

  function money(value, currency) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: currency || 'COP', maximumFractionDigits: 0 }).format(value || 0);
  }

  function sold(data, ticketId) {
    return data.reservations
      .filter((r) => r.status !== 'cancelada')
      .reduce((n, r) => n + (r.items || []).filter((i) => i.ticketId === ticketId).reduce((m, i) => m + Number(i.qty), 0), 0);
  }

  function available(data, ticket) {
    return Math.max(0, Number(ticket.stock) - sold(data, ticket.id));
  }

  function minPrice(ev) {
    const prices = (ev.tickets || []).map((t) => Number(t.price));
    return prices.length ? Math.min(...prices) : 0;
  }

  function eventAvailable(data, ev) {
    return (ev.tickets || []).reduce((n, t) => n + available(data, t), 0);
  }

  // Eventos visibles al público, ordenados por fecha.
  function publicEvents(data) {
    return data.events.filter((e) => e.status !== 'borrador').sort((a, b) => new Date(a.date) - new Date(b.date));
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
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  window.MangoStore = { load, save, reset, uid, money, sold, available, minPrice, eventAvailable, publicEvents, fileToDataUrl, DEFAULTS };
})();
