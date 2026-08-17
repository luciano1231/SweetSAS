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
    const links = [];
    if (role === 'owner') links.push({ href: '/index.html', label: '📊 Dashboard' });
    links.push({ href: '/rendicion/index.html', label: '💵 Carga de Rendición' });
    links.push({ href: '/rendicion/historial.html', label: '📋 Historial' });
    links.push({ href: '/menu-editor.html', label: '🍽️ Editor de Menú' });
    if (role === 'owner') links.push({ href: '/usuarios.html', label: '👥 Gestión de Usuarios' });

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
    btn.textContent = '☰';
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

  function tryMount() {
    if (domReady && pendingSession) mount(pendingSession);
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
