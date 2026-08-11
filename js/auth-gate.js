// ============================================
// AUTH GATE COMPARTIDO — Sweet SAS
// ============================================
// Protege cualquier página que incluya este script + el markup de #authGate
// (ver el bloque <div id="authGate">…</div> y el <style> de FOUC en index.html).
// Fuente única de verdad para el hash de contraseña: cambiarla acá se
// propaga a todas las páginas protegidas (dashboard, rendición, etc.).
(function () {
  'use strict';

  // Hash SHA-256 de la contraseña actual: "sweet2026"
  // Para generar un nuevo hash: sweetAdmin.changePassword('nueva') en consola
  const PASS_HASH = 'b330784a85b8b6f99303ea6929723bd9b8bb87e96b29fa1d2579124f2385adde';

  async function hashStr(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Exponer helper global para cambiar la contraseña desde consola
  window.sweetAdmin = {
    changePassword: async function (nueva) {
      const h = await hashStr(nueva);
      localStorage.setItem('sweetSAS_passHash', h);
      console.log('%c✓ Contraseña actualizada. Recargá la página.', 'color:#10b981;font-weight:bold');
      console.log('Hash guardado:', h);
    },
    logout: function () {
      sessionStorage.removeItem('sweetSAS_auth');
      location.reload();
    }
  };

  const isAuth = sessionStorage.getItem('sweetSAS_auth') === 'ok';
  if (isAuth) {
    document.documentElement.classList.add('authenticated');
  }

  // Si ya está autenticado en esta sesión, no mostrar pantalla
  if (isAuth) return;

  // Ocultar el body hasta autenticar
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('authGate').style.display = 'flex';
    document.getElementById('authPassword').focus();

    const storedHash = localStorage.getItem('sweetSAS_passHash') || PASS_HASH;

    async function tryLogin() {
      const val = document.getElementById('authPassword').value;
      const h = await hashStr(val);
      if (h === storedHash) {
        sessionStorage.setItem('sweetSAS_auth', 'ok');
        document.documentElement.classList.add('authenticated');
        const gate = document.getElementById('authGate');
        gate.style.opacity = '0';
        gate.style.transition = 'opacity 0.4s ease';
        setTimeout(() => gate.style.display = 'none', 420);
      } else {
        const box = document.getElementById('authBox');
        box.style.animation = 'none';
        void box.offsetWidth; // reflow
        box.style.animation = 'authShake 0.4s ease';
        document.getElementById('authError').style.opacity = '1';
        document.getElementById('authPassword').value = '';
        document.getElementById('authPassword').focus();
        setTimeout(() => document.getElementById('authError').style.opacity = '0', 2000);
      }
    }

    document.getElementById('authSubmit').addEventListener('click', tryLogin);
    document.getElementById('authPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') tryLogin();
    });
  });
})();
