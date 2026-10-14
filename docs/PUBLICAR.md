# Publicar la landing hoy mismo (gratis)

Un enlace público que puedes compartir mientras compras el dominio.

- **Vercel** publica la página (rápida y gratis). También funciona igual en Netlify.
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

8. **Clave del panel de patrocinadores:** en el script, cambia `claveAdmin: 'CAMBIA-ESTA-CLAVE'` por una clave tuya y vuelve a implementar (ver la nota de abajo).

> Si más adelante cambias el script, usa **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión**. Así la URL no cambia.

## Paso 2 · Publicar en Vercel (3 min)

1. Entra a **https://vercel.com/signup** y regístrate con **GitHub** (plan *Hobby*, gratis).
2. Pulsa **Add New… → Project** y, en la lista de repositorios, **Import** en `mangosespaciales`.
   Si no aparece, elige *Adjust GitHub App Permissions* y dale acceso a ese repositorio.
3. En **Project Name** escribe, por ejemplo, `dondeeselafter`.
   No cambies nada más: el archivo `vercel.json` ya trae la configuración (Framework: *Other*, sin comandos que llenar).
4. Pulsa **Deploy**. En unos 30 segundos tienes tu enlace público:
   **https://dondeeselafter.vercel.app**

Cada cambio que se suba a GitHub se publica solo. En el panel de Vercel, en *Deployments*, ves cada publicación y puedes volver a una anterior con un clic (*Promote to Production*).

> Vercel publica solo la landing del evento y la página de términos. El panel /crm necesita el servidor propio.
>
> El plan gratis de Vercel es para proyectos no comerciales. Cuando el evento crezca o conectes tu dominio, pasa al plan *Pro* (20 USD/mes) o usa Netlify, que permite uso comercial gratis con la misma configuración (`netlify.toml`).

## Paso 3 · Probar antes de compartir

1. Abre tu enlace e inscríbete con tus datos.
2. Revisa que aparezca la fila en la pestaña **Inscritos** de la hoja.
3. Revisa que te llegue el correo con el QR. Mira también en spam o promociones.
4. Reserva una mesa de prueba y luego libérala: escribe **Cancelada** en la columna *Estado* de la pestaña **Mesas**.

---

## Patrocinadores

Entra a **tu-enlace.vercel.app/admin-patrocinadores.html** con la clave que pusiste en `claveAdmin`.

- **Agregar patrocinador:** sube el logo (PNG, JPG, WEBP o SVG). Se recorta solo el espacio vacío y, si el logo tiene fondo blanco, marca *Quitar fondo blanco*.
- **Por cada logo** defines el nombre, el **enlace** al tocarlo (web, Instagram, WhatsApp…), el **tamaño**, el **borde blanco**, el **fondo de la tarjeta**, si es **destacado** y si está visible.
- La **vista previa en vivo** muestra cómo queda antes de publicar. Pulsa **Guardar y publicar** y la landing se actualiza al instante.
- Dónde aparecen: banner superior, franja "Con el respaldo de", franja "Aliados del evento" (todas girando lento) y, los destacados, en grande en "Patrocinadores oficiales".
- Los logos subidos quedan en tu Google Drive, en la carpeta *Logos patrocinadores · After*, y la lista en la pestaña **Patrocinadores** de la hoja.

> Si ya habías instalado el script antes de esta versión: pega de nuevo `Codigo.gs` completo, cambia `claveAdmin`, ejecuta `prepararHojas` para aceptar el permiso de Drive y publica una **Nueva versión** (Implementar → Administrar implementaciones → ✏️).

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
4. En Vercel, **Settings → Domains** conecta tu dominio propio a la landing.
