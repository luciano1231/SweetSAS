// ============================================
// TOGGLE DE TEMA (Claro / Oscuro) — Sistema de Rendición
// ============================================
// El estado se guarda en localStorage y es independiente del dashboard
// principal de Sweet SAS. La aplicación temprana (antes de pintar la
// página) ocurre en el <script> inline al inicio del <head> de cada
// página — este archivo solo maneja el botón y su ícono.
(function () {
  'use strict';

  const STORAGE_KEY = 'rendicion_theme';

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  const ICON_SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>';
  const ICON_MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>';

  function updateToggleUI(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.innerHTML = (theme === 'light' ? ICON_MOON : ICON_SUN) + (theme === 'light' ? ' Oscuro' : ' Claro');
    btn.title = theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateToggleUI(getTheme());

    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      const next = getTheme() === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(STORAGE_KEY, next);
      updateToggleUI(next);
    });
  });
})();
