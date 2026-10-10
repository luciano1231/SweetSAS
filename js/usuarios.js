// ============================================
// GESTIÓN DE USUARIOS — Sweet SAS (panel del dueño)
// ============================================
(function () {
  'use strict';

  const ICON_MENU = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>';
  const ICON_RECETAS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M9 12h6"></path><path d="M9 16h6"></path></svg>';
  const ICON_PRECIOS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>';
  const ICON_MAYORISTAS = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>';

  const LOCALES = [
    { id: 'rissione', nombre: 'Sweet Rissione' },
    { id: 'hiper', nombre: 'Sweet Hiper' },
    { id: 'changoMas', nombre: 'Sweet Chango Más' },
  ];

  let editingId = null; // null = creando

  function localName(id) {
    const l = LOCALES.find(x => x.id === id);
    return l ? l.nombre : id;
  }

  const adminHeaders = () => ({ 'Content-Type': 'application/json' });

  // ============================================
  // CARGAR / RENDERIZAR USUARIOS
  // ============================================
  async function loadUsers() {
    try {
      const res = await window.sweetAuth.fetch('/api/users', { headers: adminHeaders() });
      if (res.status === 403) return false;
      const data = await res.json();
      if (!data.ok) return false;
      renderUsers(data.users);
      return true;
    } catch (e) {
      return false;
    }
  }

  function renderUsers(users) {
    const list = document.getElementById('usersList');

    if (users.length === 0) {
      list.innerHTML = '<p class="empty-note">Todavía no hay usuarios creados.</p>';
      return;
    }

    list.innerHTML = users.map(u => {
      // Supervisor ya tiene Recetas/Precios/Mayoristas por rol (siempre),
      // sin necesidad de tildar nada — reflejar eso acá para no confundir.
      const esSupervisor = u.role === 'supervisor';
      const locales = (u.permissions.locales || []).map(id =>
        `<span class="perm-chip">${localName(id)}</span>`
      ).join('');
      const menu = u.permissions.menuEditor
        ? `<span class="perm-chip perm-chip--menu">${ICON_MENU}Editor de Menú</span>` : '';
      const recetas = (esSupervisor || u.permissions.recetas)
        ? `<span class="perm-chip perm-chip--recetas">${ICON_RECETAS}Recetas</span>` : '';
      const precios = (esSupervisor || u.permissions.listasPrecios)
        ? `<span class="perm-chip perm-chip--precios">${ICON_PRECIOS}Precios</span>` : '';
      const mayoristas = (esSupervisor || u.permissions.mayoristas)
        ? `<span class="perm-chip perm-chip--mayoristas">${ICON_MAYORISTAS}Mayoristas</span>` : '';
      const none = !locales && !menu && !recetas && !precios && !mayoristas
        ? `<span class="perm-chip perm-chip--none">Sin accesos asignados</span>` : '';

      return `
        <div class="user-card" data-id="${u.id}">
          <div class="user-card__info">
            <div class="user-card__name">${u.nombre}</div>
            <div class="user-card__role">${esSupervisor ? 'Supervisor' : 'Local'}</div>
            <div class="user-card__perms">${locales}${menu}${recetas}${precios}${mayoristas}${none}</div>
          </div>
          <div class="user-card__actions">
            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${u.id}">Editar</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => openModal(users.find(u => u.id === btn.dataset.id)));
    });
  }

  // ============================================
  // MODAL CREAR / EDITAR
  // ============================================
  function buildPermChecks(permissions, role) {
    const perms = permissions || { locales: [], menuEditor: false, recetas: false, listasPrecios: false, mayoristas: false };
    const esSupervisor = role === 'supervisor';
    const container = document.getElementById('permChecks');
    container.innerHTML = LOCALES.map(l => `
      <label class="perm-check-row">
        <input type="checkbox" value="${l.id}" class="perm-local" ${perms.locales?.includes(l.id) ? 'checked' : ''}>
        ${l.nombre}
      </label>
    `).join('') + `
      <label class="perm-check-row">
        <input type="checkbox" id="permMenuEditor" ${perms.menuEditor ? 'checked' : ''}>
        ${ICON_MENU}Editor de Menú
      </label>
      <label class="perm-check-row" id="rowPermRecetas" ${esSupervisor ? 'title="Los supervisores ya tienen acceso a todo."' : ''}>
        <input type="checkbox" id="permRecetas" ${(esSupervisor || perms.recetas) ? 'checked' : ''} ${esSupervisor ? 'disabled' : ''}>
        ${ICON_RECETAS}Recetas (costos e ingredientes)
      </label>
      <label class="perm-check-row" id="rowPermListasPrecios" ${esSupervisor ? 'title="Los supervisores ya tienen acceso a todo."' : ''}>
        <input type="checkbox" id="permListasPrecios" ${(esSupervisor || perms.listasPrecios) ? 'checked' : ''} ${esSupervisor ? 'disabled' : ''}>
        ${ICON_PRECIOS}Listas de Precios
      </label>
      <label class="perm-check-row" id="rowPermMayoristas" ${esSupervisor ? 'title="Los supervisores ya tienen acceso a todo."' : ''}>
        <input type="checkbox" id="permMayoristas" ${(esSupervisor || perms.mayoristas) ? 'checked' : ''} ${esSupervisor ? 'disabled' : ''}>
        ${ICON_MAYORISTAS}Mayoristas (listas, clientes y remitos)
      </label>
      ${esSupervisor ? '<div class="field-hint">Los supervisores ya tienen acceso a Recetas, Precios y Mayoristas por su rol.</div>' : ''}
    `;
  }

  function openModal(user) {
    editingId = user ? user.id : null;
    document.getElementById('userModalTitle').textContent = user ? 'Editar usuario' : 'Nuevo usuario';
    document.getElementById('fieldNombre').value = user ? user.nombre : '';
    document.getElementById('fieldRole').value = user ? user.role : 'local';
    document.getElementById('fieldPin').value = '';
    document.getElementById('pinHint').textContent = user
      ? 'Dejalo vacío para mantener el PIN actual.'
      : 'El usuario va a ingresar este PIN para loguearse.';
    document.getElementById('modalError').textContent = '';
    document.getElementById('btnDeleteUser').style.display = user ? 'inline-flex' : 'none';
    buildPermChecks(user ? user.permissions : null, user ? user.role : 'local');
    document.getElementById('userModal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('userModal').classList.remove('active');
    editingId = null;
  }

  function collectPermissions() {
    const locales = Array.from(document.querySelectorAll('.perm-local:checked')).map(el => el.value);
    const menuEditor = document.getElementById('permMenuEditor').checked;
    const recetas = document.getElementById('permRecetas').checked;
    const listasPrecios = document.getElementById('permListasPrecios').checked;
    const mayoristas = document.getElementById('permMayoristas').checked;
    return { locales, menuEditor, recetas, listasPrecios, mayoristas };
  }

  async function saveUser() {
    const nombre = document.getElementById('fieldNombre').value.trim();
    const role = document.getElementById('fieldRole').value;
    const pin = document.getElementById('fieldPin').value.trim();
    const permissions = collectPermissions();
    const errEl = document.getElementById('modalError');
    errEl.textContent = '';

    if (!nombre) { errEl.textContent = 'Ingresá un nombre.'; return; }
    if (!editingId && !pin) { errEl.textContent = 'Ingresá un PIN para el nuevo usuario.'; return; }
    if (pin && !/^\d{4,8}$/.test(pin)) { errEl.textContent = 'El PIN debe ser numérico (4 a 8 dígitos).'; return; }

    const body = { nombre, permissions };
    if (pin) body.pin = pin;

    let res;
    if (editingId) {
      res = await window.sweetAuth.fetch(`/api/users?id=${encodeURIComponent(editingId)}`, {
        method: 'PUT', headers: adminHeaders(), body: JSON.stringify(body),
      });
    } else {
      body.role = role;
      res = await window.sweetAuth.fetch('/api/users?action=create', {
        method: 'POST', headers: adminHeaders(), body: JSON.stringify(body),
      });
    }

    const data = await res.json();
    if (!res.ok || !data.ok) {
      errEl.textContent = data.error || 'No se pudo guardar. Probá de nuevo.';
      return;
    }

    closeModal();
    loadUsers();
  }

  async function deleteUser() {
    if (!editingId) return;
    if (!confirm('¿Eliminar este usuario? No va a poder volver a loguearse.')) return;

    const res = await window.sweetAuth.fetch(`/api/users?id=${encodeURIComponent(editingId)}`, {
      method: 'DELETE', headers: adminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      document.getElementById('modalError').textContent = data.error || 'No se pudo eliminar.';
      return;
    }
    closeModal();
    loadUsers();
  }

  // ============================================
  // EVENTOS
  // ============================================
  document.getElementById('btnAddUser').addEventListener('click', () => openModal(null));
  document.getElementById('btnCancelUser').addEventListener('click', closeModal);
  document.getElementById('btnSaveUser').addEventListener('click', saveUser);
  document.getElementById('btnDeleteUser').addEventListener('click', deleteUser);
  document.getElementById('userModal').addEventListener('click', e => {
    if (e.target.id === 'userModal') closeModal();
  });
  document.getElementById('fieldRole').addEventListener('change', () => {
    buildPermChecks(collectPermissions(), document.getElementById('fieldRole').value);
  });

  // auth-gate.js ya exigió el login del dueño (window.__PAGE_PERMISSION =
  // 'dashboard', solo el dueño tiene ese permiso) — con eso alcanza, no
  // hace falta pedir nada más acá.
  window.sweetAuth.onReady(function () {
    loadUsers().then(ok => {
      if (ok) document.getElementById('pageContent').style.display = 'block';
    });
  });
})();
