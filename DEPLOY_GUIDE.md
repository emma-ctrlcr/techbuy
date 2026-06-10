# Guía de Despliegue — TechBuy en Render

## Estructura del proyecto

Hay **dos proyectos independientes** que deben desplegarse por separado:

| Proyecto | Puerto | Descripción |
|----------|--------|-------------|
| `M:\techbuy` | 4000 | API pública + frontend tienda |
| `M:\tech\modulo admin 5.0 - copia` | 3000 | Panel administrativo |

Ambos comparten la **misma base de datos PostgreSQL**.

---

## 1. Subir a GitHub

### Tienda (techbuy)

```bash
cd M:\techbuy
git init
git add .
git commit -m "feat: initial commit - techbuy store"
```

Crear repositorio en GitHub (ej: `techbuy-store`) y luego:

```bash
git remote add origin https://github.com/TU_USUARIO/techbuy-store.git
git branch -M main
git push -u origin main
```

### Admin (modulo admin 5.0 - copia)

```bash
cd "M:\tech\modulo admin 5.0 - copia"
# NOTA: Esta carpeta está FUERA del proyecto techbuy. Crea un repo separado en GitHub.
git init
git add .
git commit -m "feat: initial commit - techbuy admin"
git remote add origin https://github.com/TU_USUARIO/techbuy-admin.git
git branch -M main
git push -u origin main
```

---

## 2. Crear PostgreSQL en Render

1. En el dashboard de Render, ve a **Databases → New PostgreSQL**.
2. Configura:
   - **Name**: `techbuy-db`
   - **Region**: `Oregon`
   - **Plan**: `Free`
3. Espera a que se cree (2-3 min).
4. Copia los valores de **Connections** → **Internal Database URL** (o toma cada campo individual).
5. Render mostrará: Host, Port, Database, User, Password.

### Inicializar la base de datos

Conéctate a la BD de Render y ejecuta el schema:

```bash
# Opción A: Usando psql con Internal Database URL
psql "postgresql://usuario:password@host:5432/tbuy_db" -f M:\techbuy\migracion_techbuy.sql

# Opción B: Desde otra máquina usando External Database URL
psql "postgresql://usuario:password@host-externo:5432/tbuy_db" -f M:\techbuy\migracion_techbuy.sql
```

---

## 3. Desplegar la Tienda (techbuy-store) en Render

### Opción A: Usando render.yaml (Blueprints)

1. Conecta tu repositorio de GitHub a Render.
2. Ve a **Blueprints → New Blueprint**.
3. Selecciona el repo `techbuy-store`.
4. Render detectará automáticamente `render.yaml` y creará:
   - Un servicio web (`techbuy-api`)
   - Una base de datos (`techbuy-db`)
5. Configura el **Disk** (para uploads persistentes):
   - El `render.yaml` ya define un disk en `/data/uploads` de 1GB.
   - La variable `ADMIN_UPLOADS_DIR` se mapea a `/data/uploads`.

### Opción B: Manual (Web Service)

1. **New Web Service** → Connect repo.
2. Configura:
   - **Name**: `techbuy-api`
   - **Region**: `Oregon`
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Plan**: `Free`
3. Agrega un **Disk**:
   - **Name**: `uploads`
   - **Mount Path**: `/data/uploads`
   - **Size**: 1 GB
4. Agrega variables de entorno:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DB_HOST` | *(de Render PostgreSQL: Internal Host)* |
| `DB_PORT` | `5432` |
| `DB_NAME` | `tbuy_db` |
| `DB_USER` | *(de Render PostgreSQL)* |
| `DB_PASSWORD` | *(de Render PostgreSQL)* |
| `JWT_SECRET` | Click **Generate** |
| `JWT_REFRESH_SECRET` | Click **Generate** |
| `JWT_EXPIRES_IN` | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `FRONTEND_URL` | `https://techbuy.store` |
| `ADMIN_UPLOADS_DIR` | `/data/uploads` |

5. **Deploy**.

---

## 4. Desplegar el Admin (techbuy-admin) en Render

### Opción A: Usando render.yaml (Blueprints)

1. Conecta el repositorio `techbuy-admin` a Render.
2. **Blueprints → New Blueprint** → selecciona el repo.
3. Render creará el servicio `techbuy-admin`.

### Opción B: Manual (Web Service)

1. **New Web Service** → Connect repo.
2. Configura:
   - **Name**: `techbuy-admin`
   - **Region**: `Oregon`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
3. Agrega un **Disk**:
   - **Name**: `uploads`
   - **Mount Path**: `/data/uploads`
   - **Size**: 1 GB
4. Agrega variables de entorno:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DB_HOST` | *(mismo que tienda)* |
| `DB_PORT` | `5432` |
| `DB_NAME` | `tbuy_db` |
| `DB_USER` | *(mismo que tienda)* |
| `DB_PASSWORD` | *(mismo que tienda)* |
| `SESSION_SECRET` | Click **Generate** |
| `CORS_ORIGIN` | `https://techbuy.store` |
| `STORE_SOCKET_URL` | `https://techbuy-api.onrender.com` |

5. **Deploy**.

---

## 5. Conectar el Dominio techbuy.store

### Configurar DNS

1. En Render, ve al servicio `techbuy-api` → **Settings** → **Custom Domain**.
2. Agrega `techbuy.store` como dominio.
3. Render mostrará un **CNAME** target (ej: `techbuy-api.onrender.com`).
4. En tu proveedor de DNS (Cloudflare, Namecheap, etc.), crea:

| Tipo | Nombre | Valor |
|------|--------|-------|
| `CNAME` | `@` | `techbuy-api.onrender.com` |
| `CNAME` | `www` | `techbuy-api.onrender.com` |

### Rutas del dominio

Una vez configurado:

- `https://techbuy.store` → **Tienda** (HTML estático servido por techbuy-api)
- `https://techbuy.store/api/...` → **API de la tienda**
- `https://admin.techbuy.store` → **Panel admin** (crea un subdominio)

Para el admin con subdominio:

| Tipo | Nombre | Valor |
|------|--------|-------|
| `CNAME` | `admin` | `techbuy-admin.onrender.com` |

### Configurar FRONTEND_URL

Luego de conectar el dominio, actualiza en **ambos servicios**:

- **techbuy-api** → `FRONTEND_URL = https://techbuy.store`
- **techbuy-admin** → `CORS_ORIGIN = https://techbuy.store` y `STORE_SOCKET_URL = https://techbuy.store`

---

## 6. Manejo de Imágenes (Uploads)

Render tiene **filesystem efímero**: los archivos subidos se pierden al hacer deploy.

### Solución 1: Render Disk (recomendado)
El `render.yaml` ya configura un Disk de 1GB. Los uploads se persisten en `/data/uploads`. Ambos servicios (tienda y admin) deben montar el **mismo Disk** para compartir imágenes.

### Solución 2: Cloud Storage (para producción seria)
Migrar a Cloudinary, AWS S3 o similar. Esto requiere modificar `optimizeImage()` en `utils/image-optimizer.js`.

---

## 7. Post-Deploy Checklist

- [ ] Visitar `https://techbuy-api.onrender.com/api/health` → debe responder `{ status: "ok", db: "connected" }`
- [ ] Visitar `https://techbuy-api.onrender.com/` → debe redirigir a la tienda
- [ ] Visitar `https://techbuy-admin.onrender.com/` → debe mostrar el login
- [ ] Iniciar sesión en admin con `admin / admin123 / 12345`
- [ ] Probar subir una imagen de producto
- [ ] Probar crear un pedido en la tienda
- [ ] Verificar que los mensajes de contacto lleguen al admin
- [ ] Probar el dominio personalizado: `https://techbuy.store`

---

## 8. Variables de Entorno — Resumen Completo

### techbuy-api (.env)

```
PORT=4000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tbuy_db
DB_USER=postgres
DB_PASSWORD=tu_password
JWT_SECRET=secret
JWT_REFRESH_SECRET=secret2
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
FRONTEND_URL=*
ADMIN_UPLOADS_DIR=
```

### techbuy-admin (.env)

```
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tbuy_db
DB_USER=postgres
DB_PASSWORD=tu_password
SESSION_SECRET=secret
CORS_ORIGIN=*
STORE_SOCKET_URL=http://localhost:4000
```
