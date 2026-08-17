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
    const ICON_CAJACHICA = svg('<rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path>');

    const links = [];
    if (role === 'owner') links.push({ href: '/index.html', label: ICON_DASHBOARD + ' Dashboard' });
    links.push({ href: '/rendicion/index.html', label: ICON_CASH + ' Carga de Rendición' });
    links.push({ href: '/rendicion/historial.html', label: ICON_HISTORY + ' Historial' });
    if (session.permissions && session.permissions.cajaChica) {
      links.push({ href: '/caja-chica/index.html', label: ICON_CAJACHICA + ' Caja Chica' });
    }
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
    menu.innerHTML = links.map(l =>
      `<a href="${l.href}" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:9px;color:#e5e7eb;text-decoration:none;font-size:.86rem;font-weight:500;transition:background .15s;">${l.label}</a>`
    ).join('');
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

  // Botón fijo "Usuarios" en el header (además del menú flotante) — lo
  // declara cada página como <a id="navUsersBtn" style="display:none;">
  // y acá solo se revela si corresponde.
  function updateHeaderUsersButton(session) {
    const btn = document.getElementById('navUsersBtn');
    if (!btn) return;
    if (session.permissions && session.permissions.dashboard) {
      btn.style.display = '';
    }
  }

  function tryMount() {
    if (domReady && pendingSession) {
      mount(pendingSession);
      updateHeaderUsersButton(pendingSession);
    }
  }

  if (window.sweetAuth && window.sweetAuth.onReady) {
    window.sweetAuth.onReady(function (session) {
      pendingSession = session;
      tryMount();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { domReady = true; tryMount(); });
  } else {
    domReady = true;
    tryMount();
  }
})();
