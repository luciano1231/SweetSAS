// ============================================
// GESTIÓN DE USUARIOS — Sweet SAS (panel del dueño)
// ============================================
(function () {
  'use strict';

  const LOCALES = [
    { id: 'rissione', nombre: 'Sweet Rissione' },
    { id: 'hiper', nombre: 'Sweet Hiper' },
    { id: 'changoMas', nombre: 'Sweet Chango Más' },
  ];

  const TOKEN_KEY = 'sweetSAS_adminToken';
  let editingId = null; // null = creando

  function localName(id) {
    const l = LOCALES.find(x => x.id === id);
    return l ? l.nombre : id;
  }

  function adminHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Admin-Token': sessionStorage.getItem(TOKEN_KEY) || '',
    };
  }

  // ============================================
  // CLAVE DE ADMINISTRACIÓN (segunda puerta)
  // ============================================
  function showTokenGate() {
    document.getElementById('tokenGate').style.display = 'flex';
    document.getElementById('tokenInput').focus();
  }

  async function tryToken() {
    const val = document.getElementById('tokenInput').value;
    sessionStorage.setItem(TOKEN_KEY, val);

    const ok = await loadUsers();
    if (ok) {
      document.getElementById('tokenGate').style.display = 'none';
      document.getElementById('pageContent').style.display = 'block';
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      const err = document.getElementById('tokenError');
      err.style.opacity = '1';
      document.getElementById('tokenInput').value = '';
      document.getElementById('tokenInput').focus();
      setTimeout(() => err.style.opacity = '0', 2000);
    }
  }

  // ============================================
  // CARGAR / RENDERIZAR USUARIOS
  // ============================================
  async function loadUsers() {
    try {
      const res = await fetch('/api/users', { headers: adminHeaders() });
      if (res.status === 401) return false;
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
      const locales = (u.permissions.locales || []).map(id =>
        `<span class="perm-chip">${localName(id)}</span>`
      ).join('');
      const menu = u.permissions.menuEditor
        ? `<span class="perm-chip perm-chip--menu">📋 Editor de Menú</span>` : '';
      const none = (!u.permissions.locales || u.permissions.locales.length === 0) && !u.permissions.menuEditor
        ? `<span class="perm-chip perm-chip--none">Sin accesos asignados</span>` : '';

      return `
        <div class="user-card" data-id="${u.id}">
          <div class="user-card__info">
            <div class="user-card__name">${u.nombre}</div>
            <div class="user-card__role">${u.role === 'supervisor' ? 'Supervisor' : 'Local'}</div>
            <div class="user-card__perms">${locales}${menu}${none}</div>
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
  function buildPermChecks(permissions) {
    const perms = permissions || { locales: [], menuEditor: false };
    const container = document.getElementById('permChecks');
    container.innerHTML = LOCALES.map(l => `
      <label class="perm-check-row">
        <input type="checkbox" value="${l.id}" class="perm-local" ${perms.locales?.includes(l.id) ? 'checked' : ''}>
        ${l.nombre}
      </label>
    `).join('') + `
      <label class="perm-check-row">
        <input type="checkbox" id="permMenuEditor" ${perms.menuEditor ? 'checked' : ''}>
        📋 Editor de Menú
      </label>
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
    buildPermChecks(user ? user.permissions : null);
    document.getElementById('userModal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('userModal').classList.remove('active');
    editingId = null;
  }

  function collectPermissions() {
    const locales = Array.from(document.querySelectorAll('.perm-local:checked')).map(el => el.value);
    const menuEditor = document.getElementById('permMenuEditor').checked;
    return { locales, menuEditor };
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
      res = await fetch(`/api/users?id=${encodeURIComponent(editingId)}`, {
        method: 'PUT', headers: adminHeaders(), body: JSON.stringify(body),
      });
    } else {
      body.role = role;
      res = await fetch('/api/users?action=create', {
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

    const res = await fetch(`/api/users?id=${encodeURIComponent(editingId)}`, {
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
  document.getElementById('tokenSubmit').addEventListener('click', tryToken);
  document.getElementById('tokenInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryToken();
  });

  document.getElementById('btnAddUser').addEventListener('click', () => openModal(null));
  document.getElementById('btnCancelUser').addEventListener('click', closeModal);
  document.getElementById('btnSaveUser').addEventListener('click', saveUser);
  document.getElementById('btnDeleteUser').addEventListener('click', deleteUser);
  document.getElementById('userModal').addEventListener('click', e => {
    if (e.target.id === 'userModal') closeModal();
  });

  // Solo pedir la clave de administración una vez que el dueño ya pasó el
  // login del dashboard (auth-gate.js ya validó window.__PAGE_PERMISSION).
  window.sweetAuth.onReady(function () {
    const cachedToken = sessionStorage.getItem(TOKEN_KEY);
    if (cachedToken) {
      loadUsers().then(ok => {
        if (ok) {
          document.getElementById('pageContent').style.display = 'block';
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
          showTokenGate();
        }
      });
    } else {
      showTokenGate();
    }
  });
})();
