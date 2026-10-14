# Publicar la landing hoy mismo (gratis)

Un enlace público que puedes compartir mientras compras el dominio.

- **Netlify** publica la página (rápida, gratis y permite uso comercial).
- **Google Sheets** guarda las inscripciones y las mesas, y envía el correo de confirmación con el QR desde tu Gmail.

Tiempo total: unos 10 minutos. No necesitas tarjeta de crédito.

---

## Paso 1 · Hoja de Google para las inscripciones (5 min)

1. Entra a **https://sheets.new** con tu cuenta de Gmail y ponle nombre a la hoja, por ejemplo *Inscripciones After Vol. 1*.
2. En el menú: **Extensiones → Apps Script**.
3. Borra todo lo que aparece y pega el contenido completo del archivo [`google-apps-script/Codigo.gs`](../google-apps-script/Codigo.gs). Guarda con el ícono 💾.
4. Arriba, en la lista de funciones, elige **`prepararHojas`** y pulsa **Ejecutar**.
   Google pedirá permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a … (no seguro) → Permitir**.
   Es normal: el script es tuyo y solo usa tu hoja y tu Gmail.
5. Pulsa **Implementar → Nueva implementación**. En el engranaje ⚙ elige **Aplicación web** y configura:
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier usuario
6. Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
7. Pon esa URL en [`js/after-config.js`](../js/after-config.js):
   ```js
   window.AFTER_CONFIG = {
     sheetsUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
   };
   ```
   Puedes editarlo en GitHub (abre el archivo → ✏️ → *Commit changes*) o enviarle la URL a Claude.

> Si más adelante cambias el script, usa **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión**. Así la URL no cambia.

## Paso 2 · Publicar en Netlify (3 min)

1. Entra a **https://app.netlify.com** y regístrate con **GitHub**.
2. **Add new site → Import an existing project → GitHub**. Autoriza el acceso al repositorio `mangosespaciales`.
3. Netlify lee la configuración del archivo `netlify.toml`, así que no tienes que llenar nada. Pulsa **Deploy**.
4. En **Site configuration → Change site name** escribe, por ejemplo, `dondeeselafter`.
   Tu enlace público queda así: **https://dondeeselafter.netlify.app**

Cada cambio que se suba a GitHub se publica solo en un minuto.

## Paso 3 · Probar antes de compartir

1. Abre tu enlace e inscríbete con tus datos.
2. Revisa que aparezca la fila en la pestaña **Inscritos** de la hoja.
3. Revisa que te llegue el correo con el QR. Mira también en spam o promociones.
4. Reserva una mesa de prueba y luego libérala: escribe **Cancelada** en la columna *Estado* de la pestaña **Mesas**.

---

## El día a día

| Necesito… | Cómo |
|---|---|
| Ver inscritos y mesas | En la hoja de Google, en tiempo real |
| Liberar una mesa | Columna *Estado* → `Cancelada` |
| Validar el ingreso en la puerta | Busca el código o el documento en la hoja (Ctrl + F o la lupa en el celular) y marca la columna *Ingresó* |
| Exportar a Excel | Archivo → Descargar → Microsoft Excel |

**Límite de correos:** una cuenta de Gmail gratis envía unos **100 correos al día** desde el script; Google Workspace envía 1.500. Si se alcanza el límite, la inscripción se guarda igual, la persona ve su QR en pantalla y la hoja marca *sin cupo diario* en la columna *Correo enviado*.

## Cuando tengas el servidor y el dominio

1. Publica el servidor de Node (ver el README): incluye el CRM, las campañas y el control de ingreso con cámara.
2. Deja `sheetsUrl: ''` en `js/after-config.js` para que la landing guarde en el servidor.
3. Descarga las pestañas de la hoja como CSV e impórtalas en **/crm → CRM → Importar base**. Quedan como contactos para tus próximas campañas.
4. En Netlify, **Domain management → Add a domain** conecta tu dominio propio a la landing.
