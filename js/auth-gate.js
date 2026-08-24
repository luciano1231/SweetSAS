// ============================================
// AUTH GATE COMPARTIDO — Sweet SAS
// ============================================
// Protege cualquier página que incluya este script + el markup de #authGate.
//
// El login (contraseña del dueño O PIN de supervisor/local) se verifica
// SIEMPRE en el servidor, vía /api/users?action=login — este script ya no
// compara ninguna contraseña en el navegador. La respuesta trae un token
// firmado (HMAC, ver functions/lib/session.js) que:
//   - se guarda en sessionStorage,
//   - viaja como header "Authorization: Bearer <token>" en cada pedido a
//     una API protegida (usar window.sweetAuth.fetch en vez de fetch a
//     secas — ver más abajo),
//   - se vuelve a verificar en el servidor en cada una de esas APIs.
// Antes, el permiso de página se decidía solo en el navegador (bastaba
// abrir la consola y escribir en sessionStorage para "ser" el dueño); esa
// puerta seguía sirviendo para la UX (redirigir rápido sin esperar al
// servidor), pero la seguridad real ahora vive en el token verificado del
// lado del servidor en cada API.
//
// Cada página declara qué necesita ANTES de este <script>:
//   <script>window.__PAGE_PERMISSION = 'dashboard';</script>          // solo dueño
//   <script>window.__PAGE_PERMISSION = 'menuEditor';</script>         // editor de menú
//   <script>window.__PAGE_PERMISSION = 'rendicion';</script>          // al menos 1 local (cualquier rol)
//   <script>window.__PAGE_PERMISSION = 'cajaChica';</script>          // al menos 1 local (cualquier rol)
//   <script>window.__PAGE_PERMISSION = 'rendicionHistorial';</script> // planilla maestra: solo dueño/supervisor
//   <script>window.__PAGE_PERMISSION = 'cajaChicaHistorial';</script> // planilla maestra: solo dueño/supervisor
//   <script>window.__PAGE_PERMISSION = 'cajaChicaItems';</script>     // gestión de ítems: solo dueño/supervisor
//   <script>window.__PAGE_PERMISSION = 'obligaciones';</script>       // resúmenes bancarios: solo dueño/supervisor
//   <script>window.__PAGE_PERMISSION = 'recetas';</script>            // costos y precios de productos: solo dueño/supervisor
// Si el usuario logueado no tiene ese permiso, se lo redirige automáticamente
// al mejor destino posible para él (sin mostrar la página).
//
// API para el resto del código:
//   window.sweetAuth.getSession() / .onReady(cb)
//   window.sweetAuth.fetch(url, options)  ← usar esto en vez de fetch() a
//     secas para cualquier pedido a /api/* que necesite sesión.
(function () {
  'use strict';

  const AUTH_KEY = 'sweetSAS_auth';
  const ROLE_KEY = 'sweetSAS_role';
  const USERID_KEY = 'sweetSAS_userId';
  const USERNAME_KEY = 'sweetSAS_userName';
  const PERM_KEY = 'sweetSAS_permissions';
  const TOKEN_KEY = 'sweetSAS_token';

  function getSession() {
    if (sessionStorage.getItem(AUTH_KEY) !== 'ok') return null;
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return null; // sesión de un formato viejo (antes de esta versión) → forzar re-login
    let permissions = {};
    try { permissions = JSON.parse(sessionStorage.getItem(PERM_KEY) || '{}'); } catch (e) { /* noop */ }
    return {
      role: sessionStorage.getItem(ROLE_KEY) || '',
      userId: sessionStorage.getItem(USERID_KEY) || '',
      userName: sessionStorage.getItem(USERNAME_KEY) || '',
      permissions: permissions,
      token: token,
    };
  }

  function setSession(session, token) {
    sessionStorage.setItem(AUTH_KEY, 'ok');
    sessionStorage.setItem(ROLE_KEY, session.role);
    sessionStorage.setItem(USERID_KEY, session.userId);
    sessionStorage.setItem(USERNAME_KEY, session.userName);
    sessionStorage.setItem(PERM_KEY, JSON.stringify(session.permissions || {}));
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearSession() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(USERID_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(PERM_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function hasPagePermission(role, permissions, required) {
    if (!required) return true;
    if (required === 'dashboard') return !!permissions.dashboard;
    if (required === 'menuEditor') return !!permissions.menuEditor;
    if (required === 'rendicion' || required === 'cajaChica') {
      return Array.isArray(permissions.locales) && permissions.locales.length > 0;
    }
    // Planillas maestras y gestión del catálogo de ítems: solo dueño y supervisor.
    if (required === 'rendicionHistorial' || required === 'cajaChicaHistorial' || required === 'cajaChicaItems' || required === 'obligaciones' || required === 'recetas') {
      return role === 'owner' || role === 'supervisor';
    }
    return true;
  }

  function landingFor(permissions) {
    if (permissions.dashboard) return '/index.html';
    if (Array.isArray(permissions.locales) && permissions.locales.length === 1) {
      return '/rendicion/carga.html?local=' + encodeURIComponent(permissions.locales[0]);
    }
    if (Array.isArray(permissions.locales) && permissions.locales.length > 1) {
      return '/rendicion/index.html';
    }
    if (permissions.menuEditor) return '/menu-editor.html';
    return null;
  }

  // Exponer helpers globales
  window.sweetAdmin = {
    logout: function () {
      clearSession();
      location.reload();
    }
  };

  const readyCallbacks = [];
  window.sweetAuth = {
    getSession: getSession,
    // Ejecuta cb(session) apenas haya una sesión válida disponible: de
    // inmediato si ya estaba autenticado al cargar la página, o cuando el
    // usuario complete el login en esta misma carga.
    onReady: function (cb) {
      if (window.__SWEET_SESSION) { cb(window.__SWEET_SESSION); return; }
      readyCallbacks.push(cb);
    },
    // Wrapper de fetch que agrega el token de sesión — usar esto (en vez de
    // fetch a secas) para cualquier pedido a una API que requiera sesión.
    fetch: function (url, options) {
      options = options || {};
      const session = getSession();
      const headers = new Headers(options.headers || {});
      if (session && session.token) headers.set('Authorization', 'Bearer ' + session.token);
      return fetch(url, { ...options, headers });
    },
  };

  // Las tarjetas con la clase .animate-in usan una animación de entrada
  // (opacity + transform) que, mientras "animation-name" siga activo, crea
  // un contexto de apilamiento propio en cada tarjeta. Eso atrapa cualquier
  // desplegable (combobox, etc.) dentro de esa tarjeta: su z-index deja de
  // competir con el de las tarjetas siguientes, y el desplegable queda tapado
  // por la próxima tarjeta del formulario. La animación termina en menos de
  // 1s y no vuelve a usarse, así que apenas termina se saca la clase — el
  // elemento queda igual visualmente (ya estaba en su estado final) pero
  // deja de aislar su contenido en un contexto de apilamiento aparte.
  document.addEventListener('animationend', function (ev) {
    if (ev.target.classList && ev.target.classList.contains('animate-in')) {
      ev.target.classList.remove('animate-in');
    }
  });

  function markReady(session) {
    window.__SWEET_SESSION = session;
    readyCallbacks.splice(0).forEach(cb => cb(session));
  }

  const required = window.__PAGE_PERMISSION || null;
  const existing = getSession();

  // Ya había una sesión válida guardada (misma pestaña/ventana)
  if (existing) {
    if (hasPagePermission(existing.role, existing.permissions, required)) {
      document.documentElement.classList.add('authenticated');
      markReady(existing);
      return;
    }
    // Autenticado, pero esta página no es para su rol → mandarlo a la suya
    const dest = landingFor(existing.permissions);
    const here = location.pathname + location.search;
    if (dest && dest !== here) {
      location.replace(dest);
      return;
    }
    // Sin ningún permiso asignado: cae al gate para mostrar el error abajo
  }

  // No autenticado (o sin destino válido): mostrar la pantalla de acceso
  document.addEventListener('DOMContentLoaded', function () {
    const gate = document.getElementById('authGate');
    if (!gate) return; // esta página no tiene el markup del gate

    gate.style.display = 'flex';
    document.getElementById('authPassword').focus();

    if (existing) {
      // Estaba logueado pero sin ningún permiso asignado
      document.getElementById('authError').textContent = 'Tu usuario no tiene ningún acceso asignado. Consultá con el dueño.';
      document.getElementById('authError').style.opacity = '1';
    }

    async function tryLogin() {
      const val = document.getElementById('authPassword').value;
      if (!val) return;

      let session = null;
      let token = null;

      try {
        const res = await fetch('/api/users?action=login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: val }),
        });
        const data = await res.json();
        if (data && data.ok && data.user && data.token) {
          session = {
            role: data.user.role,
            userId: data.user.userId,
            userName: data.user.userName,
            permissions: data.user.permissions || {},
          };
          token = data.token;
        }
      } catch (e) {
        // sin conexión al API → tratar como credencial inválida abajo
      }

      if (!session) {
        const box = document.getElementById('authBox');
        box.style.animation = 'none';
        void box.offsetWidth; // reflow
        box.style.animation = 'authShake 0.4s ease';
        const errEl = document.getElementById('authError');
        errEl.textContent = 'Contraseña incorrecta';
        errEl.style.opacity = '1';
        document.getElementById('authPassword').value = '';
        document.getElementById('authPassword').focus();
        setTimeout(() => errEl.style.opacity = '0', 2000);
        return;
      }

      setSession(session, token);

      if (!hasPagePermission(session.role, session.permissions, required)) {
        const dest = landingFor(session.permissions);
        if (dest) { location.href = dest; return; }
        const errEl = document.getElementById('authError');
        errEl.textContent = 'Tu usuario no tiene ningún acceso asignado. Consultá con el dueño.';
        errEl.style.opacity = '1';
        return;
      }

      document.documentElement.classList.add('authenticated');
      gate.style.opacity = '0';
      gate.style.transition = 'opacity 0.4s ease';
      setTimeout(() => gate.style.display = 'none', 420);
      markReady(session);
    }

    document.getElementById('authSubmit').addEventListener('click', tryLogin);
    document.getElementById('authPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') tryLogin();
    });
  });
})();
