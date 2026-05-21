# TechBuy API — Backend REST

API Node.js/Express con PostgreSQL para la web TechBuy.

---

## Estructura del proyecto

```
techbuy_api/
├── src/
│   ├── index.js              ← Entrada principal (Express)
│   ├── db/
│   │   └── pool.js           ← Pool de conexiones PostgreSQL
│   ├── middleware/
│   │   └── auth.js           ← Verificación de JWT
│   └── routes/
│       ├── auth.js           ← Registro / Login / Me
│       ├── usuarios.js       ← Perfil / Password
│       ├── productos.js      ← Catálogo de productos
│       ├── categorias.js     ← Categorías
│       ├── pedidos.js        ← Órdenes / Checkout
│       ├── favoritos.js      ← Favoritos del usuario
│       ├── cupones.js        ← Validar cupones
│       ├── envios.js         ← Costos de envío
│       ├── metodosPago.js    ← Tarjetas guardadas
│       └── carrusel.js       ← Slides del hero
├── seed_inicial.sql          ← Datos iniciales (correr 1 vez)
├── .env.example              ← Plantilla de variables de entorno
└── package.json
```

---

## Instalación

```bash
# 1. Clonar / copiar la carpeta techbuy_api/
cd techbuy_api

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# 4. Aplicar migración (si no la has aplicado aún)
psql -U postgres -d tbuy_db -f ../migracion_techbuy.sql

# 5. Poblar datos iniciales (envíos, cupones)
psql -U postgres -d tbuy_db -f seed_inicial.sql

# 6. Arrancar
npm run dev     # desarrollo (nodemon)
npm start       # producción
```

---

## Variables de entorno (.env)

| Variable        | Descripción                          | Ejemplo                  |
|-----------------|--------------------------------------|--------------------------|
| `DB_HOST`       | Host de PostgreSQL                   | `localhost`              |
| `DB_PORT`       | Puerto                               | `5432`                   |
| `DB_NAME`       | Nombre de la BD                      | `tbuy_db`                |
| `DB_USER`       | Usuario de PostgreSQL                | `postgres`               |
| `DB_PASSWORD`   | Contraseña                           | `mi_password`            |
| `JWT_SECRET`    | Secreto para firmar tokens           | `string_largo_aleatorio` |
| `JWT_EXPIRES_IN`| Duración del token                   | `7d`                     |
| `PORT`          | Puerto del servidor                  | `3000`                   |
| `FRONTEND_URL`  | Origen del frontend (CORS)           | `http://localhost:5500`  |

---

## Endpoints completos

### 🔐 Autenticación — `/api/auth`

| Método | Ruta            | Auth | Descripción                        |
|--------|-----------------|------|------------------------------------|
| POST   | `/register`     | ❌   | Registrar usuario nuevo            |
| POST   | `/login`        | ❌   | Iniciar sesión → devuelve token    |
| GET    | `/me`           | ✅   | Datos del usuario autenticado      |

**POST /api/auth/register**
```json
{
  "email": "juan@example.com",
  "password": "mipass123",
  "nombre": "Juan",
  "apellido": "Pérez",
  "tel": "88001234",
  "address": "Calle 5, Casa 10",
  "city": "Managua"
}
```
Respuesta `201`:
```json
{
  "token": "eyJ...",
  "user": { "id_usuario": 1, "email": "juan@example.com", ... }
}
```

**POST /api/auth/login**
```json
{ "email": "juan@example.com", "password": "mipass123" }
```
Respuesta `200`:
```json
{ "token": "eyJ...", "user": { ... } }
```

---

### 👤 Usuarios — `/api/usuarios`  *(requiere Bearer token)*

| Método | Ruta          | Descripción              |
|--------|---------------|--------------------------|
| GET    | `/perfil`     | Ver perfil del usuario   |
| PUT    | `/perfil`     | Editar perfil            |
| PUT    | `/password`   | Cambiar contraseña       |

**PUT /api/usuarios/perfil**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "tel": "88001234",
  "email": "nuevo@example.com",
  "address": "Nueva dirección",
  "city": "Masaya"
}
```

**PUT /api/usuarios/password**
```json
{ "password_actual": "vieja123", "password_nueva": "nueva456" }
```

---

### 🛒 Productos — `/api/productos`

| Método | Ruta                     | Auth | Descripción                       |
|--------|--------------------------|------|-----------------------------------|
| GET    | `/`                      | ❌   | Listar con filtros                |
| GET    | `/:id`                   | ❌   | Detalle de un producto            |
| GET    | `/categoria/:key`        | ❌   | Productos por categoría (slug)    |

**Query params en GET /api/productos:**
- `cat=gamer` — filtrar por key de categoría
- `q=logitech` — búsqueda por nombre/marca
- `badge=sale` — filtrar por badge (new | sale)
- `sort=precio_asc` — ordenar (precio_asc, precio_desc, nombre, default)
- `limit=20&offset=0` — paginación

---

### 🏷️ Categorías — `/api/categorias`

| Método | Ruta | Auth | Descripción       |
|--------|------|------|-------------------|
| GET    | `/`  | ❌   | Listar categorías |

---

### 📦 Pedidos — `/api/pedidos`  *(requiere Bearer token)*

| Método | Ruta    | Descripción                     |
|--------|---------|---------------------------------|
| GET    | `/`     | Historial de pedidos            |
| GET    | `/:id`  | Detalle de un pedido + items    |
| POST   | `/`     | Crear pedido (checkout)         |

**POST /api/pedidos** — Crea el pedido, valida stock, aplica cupón y calcula totales:
```json
{
  "tel":     "88001234",
  "address": "Calle 5, Casa 10",
  "city":    "Managua",
  "dept":    "Managua",
  "zip":     "10000",
  "cupon":   "TECHBUY10",
  "items": [
    { "id_producto": 3, "cantidad": 2 },
    { "id_producto": 11, "cantidad": 1 }
  ]
}
```
Respuesta `201`:
```json
{
  "message": "Pedido creado correctamente",
  "pedido": {
    "id_pedido": 42,
    "total": 358.85,
    "iva": "46.95",
    "discount": "35.75",
    "shipping": 60,
    "status": "pagado",
    "items": [ { "name": "Teclado Logitech MX Keys", "qty": 2, ... } ]
  }
}
```

---

### ❤️ Favoritos — `/api/favoritos`  *(requiere Bearer token)*

| Método | Ruta              | Descripción              |
|--------|-------------------|--------------------------|
| GET    | `/`               | Listar favoritos         |
| POST   | `/`               | Agregar favorito         |
| DELETE | `/:id_producto`   | Quitar favorito          |

**POST /api/favoritos**
```json
{ "id_producto": 17 }
```

---

### 🏷️ Cupones — `/api/cupones`  *(requiere Bearer token)*

| Método | Ruta        | Descripción                    |
|--------|-------------|--------------------------------|
| POST   | `/validar`  | Validar código y ver descuento |

**POST /api/cupones/validar**
```json
{ "codigo": "TECHBUY10" }
```
Respuesta:
```json
{ "valid": true, "codigo": "TECHBUY10", "descuento": 0.10, "porcentaje": 10 }
```

---

### 🚚 Envíos — `/api/envios`

| Método | Ruta              | Descripción                      |
|--------|-------------------|----------------------------------|
| GET    | `/`               | Todos los departamentos y costos |
| GET    | `/:departamento`  | Costo de un departamento         |

---

### 💳 Métodos de pago — `/api/metodos-pago`  *(requiere Bearer token)*

| Método | Ruta    | Descripción                  |
|--------|---------|------------------------------|
| GET    | `/`     | Tarjetas guardadas           |
| POST   | `/`     | Guardar tarjeta              |
| DELETE | `/:id`  | Eliminar tarjeta             |

**POST /api/metodos-pago**
```json
{ "alias": "Visa *4242", "tipo": "card", "ultimos4": "4242" }
```
> ⚠️ Nunca enviar el número completo de la tarjeta.

---

### 🖼️ Carrusel — `/api/carrusel`

| Método | Ruta | Descripción                         |
|--------|------|-------------------------------------|
| GET    | `/`  | Slides activos del carrusel hero     |

---

### ❤️ Health check

```
GET /api/health
→ { "status": "ok", "db": "connected", "time": "..." }
```

---

## Autenticación en el frontend

Guarda el token y envíalo en cada request protegido:

```javascript
// Al hacer login
const { token, user } = await response.json();
localStorage.setItem('techbuy_token', token);
localStorage.setItem('techbuy_user', JSON.stringify(user));

// En cada request autenticado
const token = localStorage.getItem('techbuy_token');
fetch('http://localhost:3000/api/pedidos', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Cupones válidos (pre-cargados)

| Código       | Descuento |
|--------------|-----------|
| TECHBUY10    | 10%       |
| OFERTA15     | 15%       |
| BIENVENIDO   | 5% (1 uso)|
