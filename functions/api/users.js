/**
 * Cloudflare Pages Function — /api/users
 *
 * Login unificado (contraseña del dueño + PIN de supervisor/local) y panel
 * de administración de usuarios (protegido con ADMIN_TOKEN).
 *
 * El login ya NO se valida en el navegador — antes la contraseña del dueño
 * se comparaba en el cliente contra un hash visible en el JS, lo que
 * permitía falsificar una sesión "dueño" abriendo la consola y escribiendo
 * a mano en sessionStorage. Ahora todo login (dueño o PIN) se verifica acá
 * y devuelve un token firmado (ver functions/lib/session.js) que el resto
 * de las APIs exige y valida en cada pedido.
 *
 * Requiere:
 *  - Binding KV: USERS_DATA (Cloudflare Dashboard → Pages → Settings → Bindings)
 *  - Secreto: SESSION_SECRET — firma los tokens de sesión.
 *  - Secreto: OWNER_PASSWORD_HASH — hash SHA-256 de la contraseña del dueño.
 *  - Variable de entorno: ADMIN_TOKEN — clave de administración de Gestión
 *    de Usuarios, separada de la contraseña del dueño.
 *
 * Endpoints:
 *  POST   /api/users?action=login   body: { password }              → público
 *  GET    /api/users                header: X-Admin-Token           → admin
 *  POST   /api/users?action=create  header: X-Admin-Token, body: {...} → admin
 *  PUT    /api/users?id=<id>        header: X-Admin-Token, body: {...} → admin
 *  DELETE /api/users?id=<id>        header: X-Admin-Token           → admin
 *
 * Nunca se devuelve el hash de la contraseña al cliente.
 */

import { firmarSesion } from '../lib/session.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

const KV_KEY = 'users';

// Locales válidos (mismos ids que functions/api/menu.js y rendicion/js/config.js)
const VALID_LOCALES = ['rissione', 'hiper', 'changoMas'];

// Permisos del dueño — fijos, no se editan desde Gestión de Usuarios.
// Única fuente de verdad ahora (antes también estaban hardcodeados en el
// cliente, en js/auth-gate.js). El acceso a Caja Chica/Obligaciones/
// planillas maestras no usa un flag acá — se decide por rol
// (owner/supervisor) en cada endpoint, ver functions/lib/session.js.
const PERMISOS_DUENO = { dashboard: true, menuEditor: true, locales: VALID_LOCALES, userAdmin: true };

// Semilla inicial — solo se usa una vez, la primera vez que se lee/escribe la
// KV y todavía no tiene datos guardados. El PIN en texto plano vive acá
// nada más (esta función corre en el servidor, nunca se envía al navegador)
// y se hashea antes de guardarse.
const SEED_USERS = [
  {
    nombre: 'Supervisor',
    role: 'supervisor',
    pin: '325698',
    permissions: { menuEditor: true, locales: ['rissione', 'hiper', 'changoMas'] },
  },
  {
    nombre: 'Sweet Rissione',
    role: 'local',
    pin: '852741',
    permissions: { menuEditor: true, locales: ['rissione'] },
  },
  {
    nombre: 'Sweet Hiper',
    role: 'local',
    pin: '741852',
    permissions: { menuEditor: true, locales: ['hiper'] },
  },
  {
    nombre: 'Sweet Chango Más',
    role: 'local',
    pin: '852963',
    permissions: { menuEditor: true, locales: ['changoMas'] },
  },
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function hashStr(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function publicUser(u) {
  // Nunca exponer passHash al cliente
  const { passHash, ...rest } = u;
  return rest;
}

async function getUsers(env) {
  const raw = await env.USERS_DATA.get(KV_KEY);
  if (raw) return JSON.parse(raw);

  // Primera vez: sembrar con los usuarios iniciales
  const seeded = [];
  for (const u of SEED_USERS) {
    seeded.push({
      id: crypto.randomUUID(),
      nombre: u.nombre,
      role: u.role,
      permissions: u.permissions,
      passHash: await hashStr(u.pin),
    });
  }
  await env.USERS_DATA.put(KV_KEY, JSON.stringify(seeded));
  return seeded;
}

async function saveUsers(env, users) {
  await env.USERS_DATA.put(KV_KEY, JSON.stringify(users));
}

function isAdmin(request, env) {
  const token = request.headers.get('X-Admin-Token') || '';
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

function sanitizePermissions(input) {
  const locales = Array.isArray(input?.locales)
    ? input.locales.filter(l => VALID_LOCALES.includes(l))
    : [];
  return { menuEditor: !!input?.menuEditor, locales };
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!env.USERS_DATA) {
    return json({ error: 'KV binding "USERS_DATA" no encontrado. Configurarlo en Cloudflare Dashboard → Settings → Bindings.' }, 500);
  }

  const action = url.searchParams.get('action');

  // ── LOGIN (público) ──────────────────────────────────────────
  if (method === 'POST' && action === 'login') {
    if (!env.SESSION_SECRET) {
      return json({ error: 'Falta configurar el secreto SESSION_SECRET en Cloudflare.' }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    const password = (body.password || '').toString();
    if (!password) return json({ ok: false });

    const hash = await hashStr(password);

    // ¿Es la contraseña del dueño? (se verifica acá, ya no en el navegador)
    if (env.OWNER_PASSWORD_HASH && hash === env.OWNER_PASSWORD_HASH) {
      const datosSesion = { role: 'owner', userId: 'owner', userName: 'Dueño', permissions: PERMISOS_DUENO };
      const token = await firmarSesion(datosSesion, env.SESSION_SECRET);
      return json({ ok: true, token, user: datosSesion });
    }

    // ¿Es el PIN de un supervisor o local?
    const users = await getUsers(env);
    const match = users.find(u => u.passHash === hash);
    if (!match) return json({ ok: false });

    const datosSesion = { role: match.role, userId: match.id, userName: match.nombre, permissions: match.permissions };
    const token = await firmarSesion(datosSesion, env.SESSION_SECRET);
    return json({ ok: true, token, user: datosSesion });
  }

  // ── A partir de acá, todo requiere el token de administración ──
  if (!isAdmin(request, env)) {
    return json({ error: 'No autorizado.' }, 401);
  }

  // ── LISTAR ────────────────────────────────────────────────────
  if (method === 'GET') {
    const users = await getUsers(env);
    return json({ ok: true, users: users.map(publicUser) });
  }

  // ── CREAR ─────────────────────────────────────────────────────
  if (method === 'POST' && action === 'create') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    const { nombre, role, pin } = body;
    if (!nombre || !role || !pin) {
      return json({ error: 'Faltan campos: nombre, role y pin son requeridos.' }, 400);
    }
    if (!['supervisor', 'local'].includes(role)) {
      return json({ error: 'role inválido. Debe ser "supervisor" o "local".' }, 400);
    }
    if (!/^\d{4,8}$/.test(pin)) {
      return json({ error: 'El PIN debe ser numérico (4 a 8 dígitos).' }, 400);
    }

    const users = await getUsers(env);
    const newUser = {
      id: crypto.randomUUID(),
      nombre: String(nombre).trim(),
      role,
      permissions: sanitizePermissions(body.permissions),
      passHash: await hashStr(pin),
    };
    users.push(newUser);
    await saveUsers(env, users);

    return json({ ok: true, user: publicUser(newUser) });
  }

  // ── ACTUALIZAR ────────────────────────────────────────────────
  if (method === 'PUT') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body inválido.' }, 400);
    }

    const users = await getUsers(env);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return json({ error: 'Usuario no encontrado.' }, 404);

    if (body.nombre) users[idx].nombre = String(body.nombre).trim();
    if (body.permissions) users[idx].permissions = sanitizePermissions(body.permissions);
    if (body.pin) {
      if (!/^\d{4,8}$/.test(body.pin)) {
        return json({ error: 'El PIN debe ser numérico (4 a 8 dígitos).' }, 400);
      }
      users[idx].passHash = await hashStr(body.pin);
    }

    await saveUsers(env, users);
    return json({ ok: true, user: publicUser(users[idx]) });
  }

  // ── ELIMINAR ──────────────────────────────────────────────────
  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el parámetro id.' }, 400);

    const users = await getUsers(env);
    const next = users.filter(u => u.id !== id);
    if (next.length === users.length) return json({ error: 'Usuario no encontrado.' }, 404);

    await saveUsers(env, next);
    return json({ ok: true });
  }

  return json({ error: 'Método no permitido.' }, 405);
}
