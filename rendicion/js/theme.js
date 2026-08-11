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

  function updateToggleUI(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.textContent = theme === 'light' ? '🌙 Oscuro' : '☀️ Claro';
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
