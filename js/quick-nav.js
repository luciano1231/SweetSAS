// ============================================
// MENÚ FLOTANTE DE ACCESOS RÁPIDOS — Sweet SAS
// ============================================
// Se agrega solo, sin tocar el HTML de cada página. Aparece nada más para
// dueño y supervisor (los roles que usan más de una herramienta), en las
// páginas "secundarias" (Carga, Historial, Editor de Menú) para no tener
// que volver al Dashboard cada vez. "Gestión de Usuarios" solo se muestra
// si el rol es dueño, porque es el único con ese permiso.
//
// Requiere que /js/auth-gate.js ya esté cargado antes (expone window.sweetAuth).
(function () {
  'use strict';

  let pendingSession = null;
  let domReady = false;
  let mounted = false;

  // Cloudflare sirve las páginas sin ".html" y colapsa "/index" al
  // directorio (ej: "/menu-editor.html" y "/menu-editor" son la misma
  // página) — normalizamos antes de comparar para no listar la actual.
  function normalizePath(path) {
    const stripped = path.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '');
    return stripped || '/';
  }

  function buildLinks(session) {
    const role = session.role;
    if (role !== 'owner' && role !== 'supervisor') return null;

    const here = normalizePath(location.pathname);
    const svg = (inner) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;vertical-align:-3px;margin-right:9px;">${inner}</svg>`;
    const ICON_DASHBOARD = svg('<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>');
    const ICON_CASH = svg('<rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path>');
    const ICON_HISTORY = svg('<line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line>');
    const ICON_MENU = svg('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>');
    const ICON_USERS = svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>');
    const ICON_CAJACHICA = svg('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>');
    const ICON_LIST = svg('<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>');
    const ICON_BANK = svg('<line x1="3" y1="21" x2="21" y2="21"></line><line x1="5" y1="21" x2="5" y2="10"></line><line x1="19" y1="21" x2="19" y2="10"></line><polygon points="12 3 22 9 2 9"></polygon>');
    const ICON_RECETAS = svg('<rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M9 12h6"></path><path d="M9 16h6"></path>');

    const links = [];
    if (role === 'owner') links.push({ href: '/index.html', label: ICON_DASHBOARD + ' Dashboard' });
    // "Locales": el mismo local da acceso a cargar tanto Ingresos (Rendición)
    // como Egresos (Caja Chica) — se agrupan acá bajo un mismo encabezado.
    links.push({ group: 'Locales', href: '/rendicion/index.html', label: ICON_CASH + ' Ingresos (Rendición)' });
    links.push({ group: 'Locales', href: '/caja-chica/index.html', label: ICON_CAJACHICA + ' Egresos (Caja Chica)' });
    links.push({ href: '/rendicion/historial.html', label: ICON_HISTORY + ' Historial de Rendición' });
    links.push({ href: '/caja-chica/historial.html', label: ICON_HISTORY + ' Historial de Caja Chica' });
    links.push({ href: '/caja-chica/items.html', label: ICON_LIST + ' Ítems de Caja Chica' });
    links.push({ href: '/obligaciones/index.html', label: ICON_BANK + ' Obligaciones' });
    links.push({ href: '/recetas/index.html', label: ICON_RECETAS + ' Precios' });
    links.push({ href: '/menu-editor.html', label: ICON_MENU + ' Editor de Menú' });
    if (role === 'owner') links.push({ href: '/usuarios.html', label: ICON_USERS + ' Gestión de Usuarios' });

    // No listar la página en la que ya estamos
    return links.filter(l => normalizePath(l.href) !== here);
  }

  function mount(session) {
    if (mounted) return;
    const links = buildLinks(session);
    if (!links || links.length === 0) return;
    mounted = true;

    const root = document.createElement('div');
    root.id = 'quickNavRoot';
    root.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9990;font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;';

    const menu = document.createElement('div');
    menu.id = 'quickNavMenu';
    menu.style.cssText = 'display:none;position:absolute;bottom:64px;right:0;min-width:230px;background:#151b2e;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:8px;box-shadow:0 16px 48px rgba(0,0,0,0.5);';
    let menuHtml = '';
    let lastGroup = null;
    links.forEach(function (l) {
      if (l.group && l.group !== lastGroup) {
        menuHtml += `<div style="padding:10px 14px 4px;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;">${l.group}</div>`;
      }
      lastGroup = l.group || null;
      const indent = l.group ? 'padding-left:26px;' : '';
      menuHtml += `<a href="${l.href}" style="display:flex;align-items:center;gap:10px;padding:11px 14px;${indent}border-radius:9px;color:#e5e7eb;text-decoration:none;font-size:.86rem;font-weight:500;transition:background .15s;">${l.label}</a>`;
    });
    menu.innerHTML = menuHtml;
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('mouseenter', () => a.style.background = 'rgba(255,255,255,0.07)');
      a.addEventListener('mouseleave', () => a.style.background = 'transparent');
    });

    const btn = document.createElement('button');
    btn.id = 'quickNavBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Accesos rápidos');
    btn.title = 'Accesos rápidos';
    btn.style.cssText = 'width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#1d8a63,#0e4538);color:white;font-size:1.35rem;box-shadow:0 8px 24px rgba(29,138,99,0.45);display:flex;align-items:center;justify-content:center;transition:transform .2s;';
    btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.08)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => { menu.style.display = 'none'; });

    root.appendChild(menu);
    root.appendChild(btn);
    document.body.appendChild(root);
  }

  // Botones fijos en el header que solo aplican a ciertos roles (ej. el
  // link a Historial, reservado a dueño/supervisor). Cada página los
  // declara con style="display:none" y data-role-gate="owner,supervisor";
  // acá se revelan si el rol de la sesión está en esa lista.
  function applyRoleGates(session) {
    document.querySelectorAll('[data-role-gate]').forEach(function (el) {
      const allowed = el.dataset.roleGate.split(',').map(function (s) { return s.trim(); });
      if (allowed.indexOf(session.role) !== -1) el.style.display = '';
    });
  }

  function tryMount() {
    if (domReady && pendingSession) {
      mount(pendingSession);
      applyRoleGates(pendingSession);
    }
  }

  // Colapsa la fila de nav-link del header (Dashboard, Locales, Historial,
  // etc.) dentro de un botón "hamburguesa", dejando el toggle de tema
  // suelto y compacto. Es puro reordenamiento de DOM — no depende de la
  // sesión, así que corre apenas el header existe. Los nav-link con
  // data-role-gate siguen ocultos/visibles igual que antes (ver
  // applyRoleGates), solo cambia dónde viven.
  function setupHeaderHamburger() {
    const nav = document.querySelector('.app-header__nav');
    if (!nav || nav.dataset.hamburgerReady) return;
    nav.dataset.hamburgerReady = '1';

    const themeBtn = document.getElementById('theme-toggle');
    const resto = Array.from(nav.children).filter(function (el) { return el !== themeBtn; });
    if (resto.length === 0) return;

    if (themeBtn) themeBtn.classList.add('nav-link--icon');

    const panel = document.createElement('div');
    panel.className = 'header-menu__panel';
    panel.hidden = true;
    resto.forEach(function (el) { panel.appendChild(el); });

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'header-menu__toggle';
    toggle.setAttribute('aria-label', 'Más opciones');
    toggle.title = 'Más opciones';
    toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      toggle.classList.toggle('is-active', !panel.hidden);
    });
    document.addEventListener('click', function () {
      panel.hidden = true;
      toggle.classList.remove('is-active');
    });

    const wrap = document.createElement('div');
    wrap.className = 'header-menu';
    wrap.appendChild(toggle);
    wrap.appendChild(panel);
    nav.appendChild(wrap);
  }

  if (window.sweetAuth && window.sweetAuth.onReady) {
    window.sweetAuth.onReady(function (session) {
      pendingSession = session;
      tryMount();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { domReady = true; setupHeaderHamburger(); tryMount(); });
  } else {
    domReady = true;
    setupHeaderHamburger();
    tryMount();
  }
})();
