// ============================================
// AUTH GATE COMPARTIDO — Sweet SAS
// ============================================
// Protege cualquier página que incluya este script + el markup de #authGate.
// Reconoce dos tipos de credencial:
//   1) La contraseña del dueño (chequeo local, como siempre) → acceso total.
//   2) Los PINs de supervisor/local, verificados contra /api/users?action=login
//      (Cloudflare KV) → acceso solo a lo que el dueño les haya asignado
//      desde Gestión de Usuarios.
//
// Cada página declara qué necesita ANTES de este <script>:
//   <script>window.__PAGE_PERMISSION = 'dashboard';</script>   // solo dueño
//   <script>window.__PAGE_PERMISSION = 'menuEditor';</script>  // editor de menú
//   <script>window.__PAGE_PERMISSION = 'rendicion';</script>   // al menos 1 local
//   <script>window.__PAGE_PERMISSION = 'cajaChica';</script>   // permiso explícito + al menos 1 local
// Si el usuario logueado no tiene ese permiso, se lo redirige automáticamente
// al mejor destino posible para él (sin mostrar la página).
//
// API para el resto del código: window.sweetAuth.getSession() / .onReady(cb)
(function () {
  'use strict';

  // Hash SHA-256 de la contraseña actual del dueño: "sweet2026"
  // Para generar un nuevo hash: sweetAdmin.changePassword('nueva') en consola
  const PASS_HASH = 'b330784a85b8b6f99303ea6929723bd9b8bb87e96b29fa1d2579124f2385adde';

  const AUTH_KEY = 'sweetSAS_auth';
  const ROLE_KEY = 'sweetSAS_role';
  const USERID_KEY = 'sweetSAS_userId';
  const USERNAME_KEY = 'sweetSAS_userName';
  const PERM_KEY = 'sweetSAS_permissions';

  async function hashStr(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getSession() {
    if (sessionStorage.getItem(AUTH_KEY) !== 'ok') return null;
    let permissions = {};
    try { permissions = JSON.parse(sessionStorage.getItem(PERM_KEY) || '{}'); } catch (e) { /* noop */ }
    return {
      role: sessionStorage.getItem(ROLE_KEY) || '',
      userId: sessionStorage.getItem(USERID_KEY) || '',
      userName: sessionStorage.getItem(USERNAME_KEY) || '',
      permissions: permissions,
    };
  }

  function setSession(session) {
    sessionStorage.setItem(AUTH_KEY, 'ok');
    sessionStorage.setItem(ROLE_KEY, session.role);
    sessionStorage.setItem(USERID_KEY, session.userId);
    sessionStorage.setItem(USERNAME_KEY, session.userName);
    sessionStorage.setItem(PERM_KEY, JSON.stringify(session.permissions || {}));
  }

  function clearSession() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(USERID_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(PERM_KEY);
  }

  function hasPagePermission(permissions, required) {
    if (!required) return true;
    if (required === 'dashboard') return !!permissions.dashboard;
    if (required === 'menuEditor') return !!permissions.menuEditor;
    if (required === 'rendicion') return Array.isArray(permissions.locales) && permissions.locales.length > 0;
    if (required === 'cajaChica') return !!permissions.cajaChica && Array.isArray(permissions.locales) && permissions.locales.length > 0;
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
    changePassword: async function (nueva) {
      const h = await hashStr(nueva);
      localStorage.setItem('sweetSAS_passHash', h);
      console.log('%c✓ Contraseña actualizada. Recargá la página.', 'color:#10b981;font-weight:bold');
      console.log('Hash guardado:', h);
    },
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
    }
  };

  function markReady(session) {
    window.__SWEET_SESSION = session;
    readyCallbacks.splice(0).forEach(cb => cb(session));
  }

  const required = window.__PAGE_PERMISSION || null;
  const existing = getSession();

  // Ya había una sesión válida guardada (misma pestaña/ventana)
  if (existing) {
    if (hasPagePermission(existing.permissions, required)) {
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
      const hash = await hashStr(val);
      const storedOwnerHash = localStorage.getItem('sweetSAS_passHash') || PASS_HASH;

      let session = null;

      if (hash === storedOwnerHash) {
        session = {
          role: 'owner',
          userId: 'owner',
          userName: 'Dueño',
          permissions: { dashboard: true, menuEditor: true, cajaChica: true, locales: ['rissione', 'hiper', 'changoMas'], userAdmin: true },
        };
      } else {
        try {
          const res = await fetch('/api/users?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: val }),
          });
          const data = await res.json();
          if (data && data.ok && data.user) {
            session = {
              role: data.user.role,
              userId: data.user.id,
              userName: data.user.nombre,
              permissions: data.user.permissions || {},
            };
          }
        } catch (e) {
          // sin conexión al API → tratar como credencial inválida abajo
        }
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

      setSession(session);

      if (!hasPagePermission(session.permissions, required)) {
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
