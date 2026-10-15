/*
 * Configuración de la landing.
 *
 * registroUrl: módulo externo de inscripción (eventosid.com). Allí se registran
 *   las personas, se genera el QR y se recupera con documento + correo. Los botones
 *   "Inscribirme" lo abren dentro de la página. Déjalo vacío ('') para volver al
 *   formulario propio.
 * sheetsUrl: alternativa con Google Sheets (sin uso por ahora).
 */
window.AFTER_CONFIG = {
  registroUrl: 'https://eventosid.com/evento/donde-es-el-after/embed',
  sheetsUrl: '',
};
