// ============================================
// GESTIÓN DE EMPLEADOS — Sweet SAS (panel del dueño)
// ============================================
(function () {
  'use strict';

  const LOCALES = [
    { id: 'rissione', nombre: 'Sweet Rissione' },
    { id: 'hiper', nombre: 'Sweet Hiper' },
    { id: 'changoMas', nombre: 'Sweet Chango Más' },
  ];

  // Misma clave que usuarios.js — si ya se ingresó en esta sesión, no se
  // vuelve a pedir al pasar de una pantalla a la otra.
  const TOKEN_KEY = 'sweetSAS_adminToken';
  let editingId = null;
  let allEmpleados = [];

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

    const ok = await loadEmpleados();
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
  // CARGAR / RENDERIZAR
  // ============================================
  async function loadEmpleados() {
    try {
      // Con el token de admin, /api/empleados también devuelve los inactivos.
      const res = await fetch('/api/empleados', { headers: adminHeaders() });
      if (res.status === 401) return false;
      const data = await res.json();
      if (!data.ok) return false;
      allEmpleados = data.empleados;
      renderLocales();
      return true;
    } catch (e) {
      return false;
    }
  }

  function renderLocales() {
    const container = document.getElementById('localesContainer');
    container.innerHTML = LOCALES.map(local => {
      const empleadosLocal = allEmpleados.filter(e => e.local_id === local.id);
      const rows = empleadosLocal.length
        ? empleadosLocal.map(e => `
            <div class="empleado-card ${e.activo ? '' : 'empleado-card--inactivo'}" data-id="${e.id}">
              <span class="empleado-card__name">${e.nombre}${e.activo ? '' : '<span class="empleado-card__badge">Inactivo</span>'}</span>
              <div class="empleado-card__actions">
                <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${e.id}">Editar</button>
              </div>
            </div>
          `).join('')
        : '<p class="empty-note">Todavía no hay empleados cargados para este local.</p>';

      return `
        <div class="local-section">
          <div class="local-section__header">
            <span class="local-section__title">${local.nombre}</span>
            <button class="local-section__add" data-action="add" data-local="${local.id}">+ Agregar empleado</button>
          </div>
          ${rows}
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => openModal(allEmpleados.find(e => e.id === btn.dataset.id)));
    });
    container.querySelectorAll('[data-action="add"]').forEach(btn => {
      btn.addEventListener('click', () => openModal(null, btn.dataset.local));
    });
  }

  // ============================================
  // MODAL CREAR / EDITAR
  // ============================================
  function populateLocalSelect(selected) {
    const sel = document.getElementById('fieldLocal');
    sel.innerHTML = LOCALES.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
    if (selected) sel.value = selected;
  }

  function openModal(empleado, preselectLocal) {
    editingId = empleado ? empleado.id : null;
    document.getElementById('empModalTitle').textContent = empleado ? 'Editar empleado' : 'Nuevo empleado';
    document.getElementById('fieldNombre').value = empleado ? empleado.nombre : '';
    populateLocalSelect(empleado ? empleado.local_id : preselectLocal);
    document.getElementById('modalError').textContent = '';

    const btnDelete = document.getElementById('btnDeleteEmp');
    const btnToggle = document.getElementById('btnToggleActivo');
    if (empleado) {
      btnDelete.style.display = 'inline-flex';
      btnToggle.style.display = 'inline-flex';
      btnToggle.textContent = empleado.activo ? 'Desactivar' : 'Reactivar';
    } else {
      btnDelete.style.display = 'none';
      btnToggle.style.display = 'none';
    }

    document.getElementById('empModal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('empModal').classList.remove('active');
    editingId = null;
  }

  async function saveEmpleado() {
    const nombre = document.getElementById('fieldNombre').value.trim();
    const local_id = document.getElementById('fieldLocal').value;
    const errEl = document.getElementById('modalError');
    errEl.textContent = '';

    if (!nombre) { errEl.textContent = 'Ingresá un nombre.'; return; }

    let res;
    if (editingId) {
      res = await fetch(`/api/empleados?id=${encodeURIComponent(editingId)}`, {
        method: 'PUT', headers: adminHeaders(), body: JSON.stringify({ nombre }),
      });
    } else {
      res = await fetch('/api/empleados?action=create', {
        method: 'POST', headers: adminHeaders(), body: JSON.stringify({ nombre, local_id }),
      });
    }

    const data = await res.json();
    if (!res.ok || !data.ok) {
      errEl.textContent = data.error || 'No se pudo guardar. Probá de nuevo.';
      return;
    }

    closeModal();
    loadEmpleados();
  }

  async function toggleActivo() {
    if (!editingId) return;
    const empleado = allEmpleados.find(e => e.id === editingId);
    if (!empleado) return;

    const res = await fetch(`/api/empleados?id=${encodeURIComponent(editingId)}`, {
      method: 'PUT', headers: adminHeaders(), body: JSON.stringify({ activo: !empleado.activo }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      document.getElementById('modalError').textContent = data.error || 'No se pudo actualizar.';
      return;
    }
    closeModal();
    loadEmpleados();
  }

  async function deleteEmpleado() {
    if (!editingId) return;
    if (!confirm('¿Eliminar este empleado? Sus rendiciones ya cargadas conservan su nombre igual, esto solo lo saca del desplegable.')) return;

    const res = await fetch(`/api/empleados?id=${encodeURIComponent(editingId)}`, {
      method: 'DELETE', headers: adminHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      document.getElementById('modalError').textContent = data.error || 'No se pudo eliminar.';
      return;
    }
    closeModal();
    loadEmpleados();
  }

  // ============================================
  // EVENTOS
  // ============================================
  document.getElementById('tokenSubmit').addEventListener('click', tryToken);
  document.getElementById('tokenInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryToken();
  });

  document.getElementById('btnCancelEmp').addEventListener('click', closeModal);
  document.getElementById('btnSaveEmp').addEventListener('click', saveEmpleado);
  document.getElementById('btnToggleActivo').addEventListener('click', toggleActivo);
  document.getElementById('btnDeleteEmp').addEventListener('click', deleteEmpleado);
  document.getElementById('empModal').addEventListener('click', e => {
    if (e.target.id === 'empModal') closeModal();
  });

  // Solo pedir la clave de administración una vez que el dueño ya pasó el
  // login del dashboard (auth-gate.js ya validó window.__PAGE_PERMISSION).
  window.sweetAuth.onReady(function () {
    const cachedToken = sessionStorage.getItem(TOKEN_KEY);
    if (cachedToken) {
      loadEmpleados().then(ok => {
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
