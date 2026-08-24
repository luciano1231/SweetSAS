/**
 * SESIÓN FIRMADA POR EL SERVIDOR — Sweet SAS
 * ================================================================
 * Reemplaza la confianza ciega en lo que el navegador dice de sí mismo
 * (antes: sessionStorage con rol/permisos que cualquiera podía escribir a
 * mano desde la consola). Ahora el login devuelve un token firmado con
 * HMAC-SHA256 (clave secreta: env.SESSION_SECRET, nunca sale del server),
 * y cada endpoint que maneja datos lo verifica antes de hacer nada.
 *
 * Formato del token: "<payload en base64url>.<firma en base64url>"
 * (misma idea que un JWT, pero minimalista — no hace falta una librería).
 */

const DURACION_SESION_MS = 12 * 60 * 60 * 1000; // 12 horas

function base64url(bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Firma una sesión y devuelve el token. `datos` debe traer al menos
 * { role, userId, userName, permissions }.
 */
export async function firmarSesion(datos, secret) {
  const payload = { ...datos, iat: Date.now(), exp: Date.now() + DURACION_SESION_MS };
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey(secret);
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64url(firma)}`;
}

/**
 * Verifica un token. Devuelve el payload si es válido y no expiró, o null.
 */
export async function verificarToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [payloadB64, firmaB64] = partes;

  try {
    const key = await getKey(secret);
    const valido = await crypto.subtle.verify(
      'HMAC', key,
      base64urlDecode(firmaB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valido) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extrae y verifica la sesión de un Request (header Authorization: Bearer <token>).
 * Devuelve el payload verificado o null — nunca lanza.
 */
export async function obtenerSesion(request, env) {
  if (!env.SESSION_SECRET) return null;
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return verificarToken(auth.slice(7), env.SESSION_SECRET);
}

/** true si session.role está entre los roles permitidos */
export function tieneRol(session, ...rolesPermitidos) {
  return !!session && rolesPermitidos.includes(session.role);
}

/** true si session tiene ese local asignado (o es dueño/supervisor, que los tienen todos) */
export function tieneLocal(session, localId) {
  if (!session) return false;
  const locales = (session.permissions && session.permissions.locales) || [];
  return locales.includes(localId);
}
