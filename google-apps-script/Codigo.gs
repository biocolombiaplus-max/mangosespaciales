/**
 * ¿Dónde es el After? · Inscripciones y mesas en Google Sheets
 *
 * Guarda las inscripciones gratis y las reservas de mesa en esta hoja de cálculo
 * y envía el correo de confirmación con el código QR desde tu Gmail.
 *
 * Instalación (5 minutos): ver docs/PUBLICAR.md
 *   1. Hoja nueva → Extensiones → Apps Script → pega este archivo completo.
 *   2. Implementar → Nueva implementación → Aplicación web.
 *      Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario.
 *   3. Copia la URL que termina en /exec y pégala en js/after-config.js.
 *   4. Cambia claveAdmin (abajo) por una clave tuya: es la que pide el panel
 *      de patrocinadores (admin-patrocinadores.html) para guardar cambios.
 */

const CONFIG = {
  evento: '¿Dónde es el After? Vol. 1',
  ciudad: 'Cúcuta',
  fecha: 'Sábado 24 de octubre',
  hora: '6:00 p. m.',
  lugar: 'Patín de la Fruta · Malecón',
  direccion: 'Malecón, Cúcuta, Norte de Santander',
  organiza: 'Mangos Espaciales',
  whatsapp: '573005081812',
  mesas: 30,
  personasPorMesa: 6,
  condicionesMesa: 'Reserva sin costo. Te escribimos por WhatsApp para confirmar los detalles de tu mesa.',
  // Dirección pública de la landing (para el botón "Inscribir a mis acompañantes")
  landing: '',
  enviarCorreos: true,
  // Clave del panel de patrocinadores. Mientras diga CAMBIA-ESTA-CLAVE el panel no guarda nada.
  claveAdmin: 'CAMBIA-ESTA-CLAVE',
};

const HOJA_INSCRITOS = 'Inscritos';
const HOJA_MESAS = 'Mesas';
// Las columnas nuevas van al final para no desordenar hojas creadas con versiones anteriores.
const COLS_INSCRITOS = ['Fecha', 'Código', 'Nombre', 'Tipo doc', 'Documento', 'Celular', 'Correo', 'Ciudad', 'Origen (ref)', 'Correo enviado', 'Ingresó', 'Barrio', 'Mayor de 18'];
const COLS_MESAS = ['Fecha', 'Código', 'Mesa', 'Personas', 'Nombre', 'Tipo doc', 'Documento', 'Celular', 'Correo', 'Comentarios', 'Origen (ref)', 'Correo enviado', 'Estado'];
const TIPOS_DOC = ['CC', 'CE', 'PPT', 'Pasaporte', 'Cédula venezolana'];
const HOJA_PATROCINADORES = 'Patrocinadores';
const COLS_PATROCINADORES = ['Orden', 'Nombre', 'Logo', 'Link', 'Tamaño', 'Borde', 'Fondo', 'Destacado', 'Activo', 'Id'];
const FONDOS = ['glass', 'white', 'dark', 'none'];
const VELOCIDADES = ['lento', 'normal', 'rapido'];

/* ---------- Entradas de la aplicación web ---------- */

function doGet() {
  return json({
    ok: true,
    tablesTaken: mesasOcupadas(),
    tableCount: CONFIG.mesas,
    tableSeats: CONFIG.personasPorMesa,
    sponsors: leerPatrocinadores(true),
    sponsorConfig: configPatrocinadores(),
  });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ error: 'Solicitud inválida.' });
  }
  // un solo registro a la vez: evita que dos personas reserven la misma mesa
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (data.action === 'register') return json(inscribir(data));
    if (data.action === 'table') return json(reservarMesa(data));
    if (/^admin|^sponsors|^uploadLogo$/.test(String(data.action))) return json(accionAdmin(data));
    return json({ error: 'Acción desconocida.' });
  } catch (err) {
    return json({ error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Inscripción gratis ---------- */

function inscribir(body) {
  const p = leerPersona(body);
  if (p.error) return p;
  if (p.barrio.length < 2) return { error: 'Escribe tu barrio.' };
  const hoja = hojaCon(HOJA_INSCRITOS, COLS_INSCRITOS);
  const filas = hoja.getDataRange().getValues().slice(1);
  const iDoc = COLS_INSCRITOS.indexOf('Documento');
  const iCorreo = COLS_INSCRITOS.indexOf('Correo');
  const iCodigo = COLS_INSCRITOS.indexOf('Código');

  const previa = filas.find(function (f) { return limpio(f[iDoc]) === p.doc; });
  if (previa) {
    if (String(previa[iCorreo]).toLowerCase() !== p.email) {
      return { error: 'Este documento ya está inscrito. Si es tuyo, escríbenos por WhatsApp y te ayudamos.' };
    }
    const codigoPrevio = String(previa[iCodigo]);
    correoInscripcion({ code: codigoPrevio, name: p.name, email: p.email });
    return { code: codigoPrevio, name: p.name, email: p.email, existing: true };
  }

  const code = codigo('AFT');
  const fila = hoja.getLastRow() + 1;
  hoja.getRange(fila, 1, 1, COLS_INSCRITOS.length).setValues([[ahora(), code, p.name, p.docType, p.doc, p.phone, p.email, p.city, p.ref, 'enviando', '', p.barrio, 'Sí']]);
  const enviado = correoInscripcion({ code: code, name: p.name, email: p.email });
  hoja.getRange(fila, COLS_INSCRITOS.indexOf('Correo enviado') + 1).setValue(enviado);
  return { code: code, name: p.name, email: p.email };
}

/* ---------- Reserva de mesa ---------- */

function reservarMesa(body) {
  const p = leerPersona(body);
  if (p.error) return p;
  const mesa = Number(body.table);
  const personas = Number(body.people);
  if (!(mesa >= 1 && mesa <= CONFIG.mesas && Math.floor(mesa) === mesa)) return { error: 'Elige una mesa del mapa.' };
  if (!(personas >= 1 && personas <= CONFIG.personasPorMesa && Math.floor(personas) === personas)) {
    return { error: 'Cada mesa es para máximo ' + CONFIG.personasPorMesa + ' personas.' };
  }

  const hoja = hojaCon(HOJA_MESAS, COLS_MESAS);
  const activas = filasActivas(hoja);
  const iMesa = COLS_MESAS.indexOf('Mesa');
  const iDoc = COLS_MESAS.indexOf('Documento');
  const iCorreo = COLS_MESAS.indexOf('Correo');
  const iCodigo = COLS_MESAS.indexOf('Código');
  if (activas.some(function (f) { return Number(f[iMesa]) === mesa; })) return { error: 'La mesa ' + mesa + ' acaba de ser reservada. Elige otra.' };
  const mia = activas.find(function (f) { return limpio(f[iDoc]) === p.doc || String(f[iCorreo]).toLowerCase() === p.email; });
  if (mia) {
    return { error: 'Ya tienes la mesa ' + mia[iMesa] + ' reservada (código ' + mia[iCodigo] + '). Si necesitas cambiarla, escríbenos por WhatsApp.' };
  }

  const code = codigo('MESA');
  const notas = seguro(String(body.notes || '').replace(/\s+/g, ' ').trim().slice(0, 300));
  const fila = hoja.getLastRow() + 1;
  hoja.getRange(fila, 1, 1, COLS_MESAS.length).setValues([[ahora(), code, String(mesa), String(personas), p.name, p.docType, p.doc, p.phone, p.email, notas, p.ref, 'enviando', 'Confirmada']]);
  const enviado = correoMesa({ code: code, table: mesa, people: personas, name: p.name, email: p.email });
  hoja.getRange(fila, COLS_MESAS.indexOf('Correo enviado') + 1).setValue(enviado);
  return { code: code, table: mesa, people: personas, name: p.name, email: p.email };
}

// Para liberar una mesa, escribe "Cancelada" en la columna Estado de la hoja Mesas.
function filasActivas(hoja) {
  const iEstado = COLS_MESAS.indexOf('Estado');
  return hoja.getDataRange().getValues().slice(1).filter(function (f) {
    return f[0] !== '' && String(f[iEstado]).toLowerCase() !== 'cancelada';
  });
}

function mesasOcupadas() {
  const hoja = hojaCon(HOJA_MESAS, COLS_MESAS);
  const iMesa = COLS_MESAS.indexOf('Mesa');
  return filasActivas(hoja).map(function (f) { return Number(f[iMesa]); });
}

/* ---------- Patrocinadores (panel admin-patrocinadores.html) ---------- */

function accionAdmin(data) {
  if (!CONFIG.claveAdmin || CONFIG.claveAdmin === 'CAMBIA-ESTA-CLAVE') {
    return { error: 'Primero cambia claveAdmin en el script (Apps Script → CONFIG) y vuelve a implementar.' };
  }
  if (String(data.password || '') !== CONFIG.claveAdmin) return { error: 'Clave incorrecta.' };
  if (data.action === 'adminLogin') return { ok: true };
  if (data.action === 'sponsorsGet') return { ok: true, sponsors: leerPatrocinadores(false), sponsorConfig: configPatrocinadores() };
  if (data.action === 'sponsorsSave') return guardarPatrocinadores(data.sponsors, data.sponsorConfig);
  if (data.action === 'uploadLogo') return subirLogo(data);
  return { error: 'Acción desconocida.' };
}

const siNo = function (v) { return /^(s[ií]|true|x|1|yes)$/i.test(String(v).trim()); };
const urlSegura = function (u) { u = String(u || '').trim(); return /^https:\/\/[^\s]+$/i.test(u) ? u.slice(0, 500) : ''; };
const entre = function (v, min, max, def) { const n = Number(v); return isFinite(n) && String(v) !== '' ? Math.max(min, Math.min(max, Math.round(n))) : def; };

function leerPatrocinadores(soloActivos) {
  const hoja = hojaCon(HOJA_PATROCINADORES, COLS_PATROCINADORES);
  const c = function (n) { return COLS_PATROCINADORES.indexOf(n); };
  return hoja.getDataRange().getValues().slice(1)
    .filter(function (f) { return String(f[c('Logo')]).trim() !== ''; })
    .map(function (f) {
      return {
        id: String(f[c('Id')] || ''),
        order: Number(f[c('Orden')]) || 0,
        name: String(f[c('Nombre')] || '').replace(/^'/, ''),
        logo: urlSegura(f[c('Logo')]),
        link: urlSegura(f[c('Link')]),
        height: entre(f[c('Tamaño')], 16, 120, null),
        border: entre(f[c('Borde')], 0, 10, 0),
        bg: FONDOS.indexOf(String(f[c('Fondo')])) >= 0 ? String(f[c('Fondo')]) : 'glass',
        featured: siNo(f[c('Destacado')]),
        active: String(f[c('Activo')]).trim() === '' ? true : siNo(f[c('Activo')]),
      };
    })
    .filter(function (p) { return p.logo && (!soloActivos || p.active); })
    .sort(function (a, b) { return a.order - b.order; });
}

function configPatrocinadores() {
  let cfg = {};
  try { cfg = JSON.parse(PropertiesService.getScriptProperties().getProperty('sponsorConfig') || '{}'); } catch (e) { cfg = {}; }
  return { height: entre(cfg.height, 16, 120, 40), speed: VELOCIDADES.indexOf(cfg.speed) >= 0 ? cfg.speed : 'lento' };
}

function guardarPatrocinadores(lista, cfg) {
  if (!Array.isArray(lista)) return { error: 'Lista inválida.' };
  const filas = lista.slice(0, 80).map(function (p, i) {
    return [
      String(i + 1),
      seguro(String(p.name || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
      urlSegura(p.logo),
      urlSegura(p.link),
      p.height ? String(entre(p.height, 16, 120, 40)) : '',
      String(entre(p.border, 0, 10, 0)),
      FONDOS.indexOf(p.bg) >= 0 ? p.bg : 'glass',
      p.featured ? 'Sí' : 'No',
      p.active === false ? 'No' : 'Sí',
      String(p.id || codigo('SP')).replace(/[^\w-]/g, '').slice(0, 20),
    ];
  }).filter(function (f) { return f[2]; });
  const hoja = hojaCon(HOJA_PATROCINADORES, COLS_PATROCINADORES);
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, COLS_PATROCINADORES.length).clearContent();
  if (filas.length) hoja.getRange(2, 1, filas.length, COLS_PATROCINADORES.length).setValues(filas);
  if (cfg) {
    PropertiesService.getScriptProperties().setProperty('sponsorConfig', JSON.stringify({
      height: entre(cfg.height, 16, 120, 40),
      speed: VELOCIDADES.indexOf(cfg.speed) >= 0 ? cfg.speed : 'lento',
    }));
  }
  return { ok: true, sponsors: leerPatrocinadores(false), sponsorConfig: configPatrocinadores() };
}

// Guarda el logo en una carpeta de tu Google Drive y lo deja visible con enlace.
function subirLogo(data) {
  const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(String(data.dataUrl || ''));
  if (!m) return { error: 'Formato de imagen no válido.' };
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 3 * 1024 * 1024) return { error: 'El logo pesa más de 3 MB.' };
  const nombre = String(data.name || 'logo').replace(/[^\w.-]/g, '_').slice(0, 60) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  const carpetas = DriveApp.getFoldersByName('Logos patrocinadores · After');
  const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder('Logos patrocinadores · After');
  const archivo = carpeta.createFile(Utilities.newBlob(bytes, 'image/' + m[1], nombre));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://lh3.googleusercontent.com/d/' + archivo.getId() };
}

/* ---------- Validación ---------- */

function leerPersona(b) {
  const p = {
    name: seguro(String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
    docType: TIPOS_DOC.indexOf(b.docType) >= 0 ? b.docType : 'CC',
    doc: limpio(b.doc).slice(0, 15),
    phone: String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20),
    email: String(b.email || '').trim().toLowerCase(),
    city: seguro(String(b.city || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
    barrio: seguro(String(b.barrio || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
    ref: String(b.ref || '').replace(/[^\w-]/g, '').slice(0, 20),
  };
  if (b.docType && TIPOS_DOC.indexOf(b.docType) < 0) return { error: 'Tipo de documento no válido.' };
  if (p.name.length < 3) return { error: 'Escribe tu nombre completo.' };
  if (p.doc.length < 4) return { error: 'Escribe un número de documento válido.' };
  if (p.phone.replace(/\D/g, '').length < 7) return { error: 'Escribe un número de celular válido.' };
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(p.email)) return { error: 'Escribe un correo electrónico válido.' };
  if (b.adult !== true) return { error: 'El evento es solo para mayores de 18 años.' };
  if (b.consent !== true) return { error: 'Debes aceptar el tratamiento de datos para inscribirte.' };
  return p;
}

const limpio = function (v) { return String(v || '').replace(/[^0-9A-Za-z]/g, ''); };
// evita que un texto escrito en el formulario se convierta en fórmula en la hoja
const seguro = function (t) { return /^[=+\-@]/.test(t) ? "'" + t : t; };

/* ---------- Correos ---------- */

function correoInscripcion(r) {
  return enviarCorreo(r.email, 'Tu entrada para ' + CONFIG.evento + ' · ' + r.code, r.code,
    '<p style="margin:0 0 8px;font-size:18px;"><strong>¡Listo' + nombreCorto(r.name) + '! Tu entrada quedó registrada.</strong></p>' +
    '<p style="margin:0;">Tu ingreso es <strong>sin costo</strong>. Presenta este código QR y tu documento en la entrada.</p>',
    'Tu código de ingreso',
    '<p style="margin:18px 0 0;font-size:14px;color:#7A6F63;"><strong>Evento solo para mayores de 18 años.</strong> Te recomendamos llegar temprano. Cada persona debe tener su propia inscripción.</p>');
}

function correoMesa(t) {
  const acompanantes = CONFIG.landing
    ? '<p style="margin:12px 0 0;"><a href="' + CONFIG.landing + '" style="color:#E2231A;font-weight:bold;">Inscribir a mis acompañantes →</a></p>'
    : '';
  return enviarCorreo(t.email, 'Mesa ' + t.table + ' reservada · ' + CONFIG.evento + ' · ' + t.code, t.code,
    '<p style="margin:0 0 8px;font-size:18px;"><strong>¡Qué bien' + nombreCorto(t.name) + '! Ya tienes tu mesa.</strong></p>' +
    '<p style="margin:0;">Mesa <strong>#' + t.table + '</strong> para <strong>' + t.people + ' personas</strong>.</p>',
    'Código de tu mesa',
    '<p style="margin:0 0 12px;padding:12px 14px;background:#F4EBD9;border-radius:10px;font-size:14px;">' + esc(CONFIG.condicionesMesa) + '</p>' +
    '<p style="margin:0;">La entrada es <strong>sin costo</strong>, pero <strong>cada acompañante debe inscribirse</strong>. Evento solo para mayores de 18 años.</p>' + acompanantes);
}

// Devuelve el estado del envío para dejarlo en la hoja; nunca hace fallar la inscripción.
function enviarCorreo(para, asunto, code, intro, etiqueta, extra) {
  if (!CONFIG.enviarCorreos) return 'desactivado';
  try {
    if (MailApp.getRemainingDailyQuota() < 1) return 'sin cupo diario';
    const imagenes = {};
    let qr = '';
    try {
      // el QR va incrustado en el correo; si el servicio no responde, se envía solo el código
      imagenes.qr = UrlFetchApp.fetch('https://quickchart.io/qr?size=360&margin=1&text=' + encodeURIComponent(code)).getBlob().setName('qr.png');
      qr = '<img src="cid:qr" width="180" height="180" alt="Código QR" style="display:block;border:0;">';
    } catch (e) {
      qr = '';
    }
    const waLink = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent('Hola, tengo una pregunta sobre ' + CONFIG.evento);
    const html =
      '<div style="background:#F4EBD9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1B1530;">' +
      '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;">' +
      '<div style="height:6px;background:linear-gradient(90deg,#FCD116 0 50%,#003893 50% 75%,#CE1126 75%);background-color:#FCD116;"></div>' +
      '<div style="padding:28px 32px;font-size:16px;line-height:1.6;">' +
      '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#E2231A;font-weight:bold;">' + esc(CONFIG.organiza) + ' presenta</div>' +
      '<h1 style="margin:6px 0 4px;font-size:26px;line-height:1.2;">' + esc(CONFIG.evento) + '</h1>' +
      '<p style="margin:0 0 16px;color:#7A6F63;">' + esc(CONFIG.ciudad) + ' · De Venezuela para el mundo</p>' + intro +
      '<div style="margin:18px 0;padding:18px;background:#FFF6DA;border:2px dashed #E2231A;border-radius:14px;text-align:center;">' +
      '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7A6F63;">' + etiqueta + '</div>' +
      '<div style="font-size:28px;font-weight:bold;letter-spacing:3px;color:#E2231A;margin:4px 0 12px;">' + code + '</div>' +
      '<div style="display:inline-block;">' + qr + '</div></div>' +
      '<p style="margin:0;"><strong>Fecha:</strong> ' + esc(CONFIG.fecha) + '<br><strong>Hora:</strong> ' + esc(CONFIG.hora) +
      '<br><strong>Lugar:</strong> ' + esc(CONFIG.lugar) + ', ' + esc(CONFIG.direccion) + '</p>' + extra +
      '</div></div>' +
      '<p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#7A6F63;text-align:center;">Organiza ' + esc(CONFIG.organiza) +
      ' · ¿Dudas? Escríbenos por <a href="' + waLink + '" style="color:#7A6F63;">WhatsApp</a>.</p></div>';
    const texto = CONFIG.evento + '\n' + etiqueta + ': ' + code + '\n' + CONFIG.fecha + ' · ' + CONFIG.hora + '\n' + CONFIG.lugar + ', ' + CONFIG.direccion +
      '\nEvento solo para mayores de 18 años. Presenta tu código y tu documento en la entrada.';
    MailApp.sendEmail({ to: para, subject: asunto, htmlBody: html, body: texto, name: CONFIG.organiza, inlineImages: imagenes });
    return 'enviado';
  } catch (e) {
    return 'error: ' + String((e && e.message) || e).slice(0, 120);
  }
}

/* ---------- Utilidades ---------- */

function hojaCon(nombre, columnas) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(nombre);
  if (hoja) {
    // agrega los encabezados de columnas nuevas a hojas creadas con una versión anterior
    const actuales = hoja.getRange(1, 1, 1, columnas.length).getValues()[0];
    columnas.forEach(function (c, i) {
      if (!actuales[i]) hoja.getRange(1, i + 1).setValue(c).setFontWeight('bold').setBackground('#FFC72C');
    });
  } else {
    hoja = libro.insertSheet(nombre);
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]).setFontWeight('bold').setBackground('#FFC72C');
    hoja.setFrozenRows(1);
    // todo como texto: los documentos y celulares no pierden ceros ni el +
    hoja.getRange(2, 1, hoja.getMaxRows() - 1, columnas.length).setNumberFormat('@');
  }
  return hoja;
}

function codigo(prefijo) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += letras.charAt(Math.floor(Math.random() * letras.length));
  return prefijo + '-' + s;
}

function ahora() {
  return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
}

function nombreCorto(nombre) {
  const n = String(nombre || '').replace(/^'/, '').trim().split(/\s+/)[0] || '';
  return n ? ', ' + esc(n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()) : '';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Ejecuta esta función una vez desde el editor para crear las hojas y
   autorizar el envío de correos antes de publicar. */
function prepararHojas() {
  hojaCon(HOJA_INSCRITOS, COLS_INSCRITOS);
  hojaCon(HOJA_MESAS, COLS_MESAS);
  hojaCon(HOJA_PATROCINADORES, COLS_PATROCINADORES);
  DriveApp.getRootFolder(); // pide el permiso de Drive para guardar los logos
  Logger.log('Hojas listas. Correos disponibles hoy: ' + MailApp.getRemainingDailyQuota());
}
