# Hera - Tienda Online

Catálogo con carrito, pago real con Mercado Pago (tarjeta débito/crédito/QR) y aviso por mail en cada venta.

## Qué incluye
- `/index.html` → tienda pública (catálogo + carrito)
- `/admin.html` → panel para vos: subir fotos, precios, zonas de envío, ver ventas
- `server.js` → el "motor" que conecta todo (Mongo, Cloudinary, Mercado Pago, mail)

---

## PASO A PASO PARA PONERLA ONLINE

### 1) Crear la base de datos (MongoDB Atlas — gratis)
1. Entrá a https://www.mongodb.com/cloud/atlas/register y creá una cuenta.
2. Creá un cluster **gratuito** (M0).
3. En "Database Access" creá un usuario y contraseña (anotalos).
4. En "Network Access" agregá `0.0.0.0/0` (permite conexión desde cualquier lado — necesario para Render).
5. En "Database" → "Connect" → "Drivers" copiá la cadena de conexión, se ve así:
   `mongodb+srv://usuario:password@cluster.mongodb.net/?retryWrites=true&w=majority`
   Agregale `hera` antes del `?` para que quede: `.../hera?retryWrites=true...`
   Esto va en la variable `MONGODB_URI`.

### 2) Crear cuenta de Cloudinary (fotos — gratis)
1. Entrá a https://cloudinary.com/users/register/free
2. En el Dashboard vas a ver: **Cloud name**, **API Key**, **API Secret**. Esos 3 van en el `.env`.

### 3) Conseguir el Access Token de Mercado Pago
1. Entrá a https://www.mercadopago.com.ar/developers/panel
2. "Tus integraciones" → creá una aplicación (cualquier nombre, ej: "Hera Tienda").
3. Andá a "Credenciales de producción" y copiá el **Access Token**. Va en `MP_ACCESS_TOKEN`.
   (Al principio podés usar las credenciales de **prueba** para testear sin cobrar de verdad, y cuando esté todo probado cambiás a producción.)

### 4) Crear la contraseña de aplicación de Gmail (para el aviso de venta)
1. Necesitás verificación en 2 pasos activada en tu cuenta de Gmail.
2. Andá a https://myaccount.google.com/apppasswords
3. Generá una contraseña de aplicación (16 letras, sin espacios). Va en `EMAIL_PASS`.
4. `EMAIL_USER` y `NOTIFY_EMAIL` son el mail desde el que se manda y a donde llega el aviso (pueden ser el mismo).

### 5) Subir el proyecto a GitHub
1. Creá una cuenta en https://github.com si no tenés.
2. Creá un repositorio nuevo (ej: `hera-tienda`) y subí todos estos archivos (podés arrastrarlos desde la web de GitHub, "Add file" → "Upload files").
   **IMPORTANTE:** no subas el archivo `.env` con tus claves reales — solo el `.env.example`.

### 6) Desplegar en Render (gratis)
1. Entrá a https://render.com y creá cuenta (podés entrar con GitHub).
2. "New +" → "Web Service" → conectá tu repositorio `hera-tienda`.
3. Configuración:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. En "Environment" cargá TODAS las variables del archivo `.env.example` con tus valores reales.
   - `SITE_URL` ponelo con la URL que Render te va a asignar (algo como `https://hera-tienda.onrender.com`) — la vas a ver arriba de todo una vez creado el servicio. Si no la sabés todavía, dejalo así, deployá, copiá la URL real, y volvé a Environment a corregirla (y hacé "Manual Deploy" de nuevo).
5. Dale a "Create Web Service" y esperá unos minutos.

### 7) Probar
- Entrá a `https://tu-sitio.onrender.com/admin.html`, poné la contraseña que elegiste en `ADMIN_PASSWORD`, y cargá tu primer producto con foto.
- Cargá al menos 1 zona de envío (si no hay ninguna, el carrito no va a poder cobrar el envío).
- Entrá a `https://tu-sitio.onrender.com`, agregá algo al carrito, y probá pagar.
- Con las credenciales de PRUEBA de Mercado Pago podés pagar con tarjetas de test (Mercado Pago te las da en su panel de desarrolladores) sin que se cobre plata real.

### Nota sobre el plan gratuito de Render
El plan free de Render "duerme" el sitio si nadie lo visita por 15 minutos, y tarda unos 30-50 segundos en despertar en la próxima visita. Para una tienda que recién arranca está bien; si más adelante te genera problemas (clientes que se van por la espera), existe el plan pago de Render (~7 USD/mes) que lo mantiene siempre activo.

---

## Cómo administrar el día a día
- **Agregar/sacar productos:** `/admin.html` → sección "Agregar producto" / botón "Borrar".
- **Cambiar precios:** por ahora hay que borrar y volver a cargar el producto (si querés, más adelante te agrego edición rápida de precio sin tener que subir la foto de nuevo).
- **Zonas de envío:** se agregan/borran desde el mismo panel.
- **Ver ventas:** abajo del todo en `/admin.html`, tabla "Últimas ventas". Además te llega un mail a `NOTIFY_EMAIL` en cada venta aprobada.
