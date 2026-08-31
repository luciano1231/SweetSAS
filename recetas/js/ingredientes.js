// ============================================
// RECETAS — Catálogo de Ingredientes y Costos Fijos
// ============================================

(function () {
  'use strict';

  const ICON_PENCIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
  const ICON_TRASH  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
  const ICON_CHECK  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  const ICON_X      = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  const ICON_CAJA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>';
  const ICON_RELOJ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

  function formatearFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    // timeZone: 'UTC' — la fecha se guarda como día calendario puro
    // (ej: "2026-08-24"), sin hora. Sin esto, toLocaleDateString la
    // reinterpreta en el huso horario local y puede mostrar un día antes.
    return d.toLocaleDateString('es-AR', { timeZone: 'UTC' });
  }

  function hoyLocal() {
    // Fecha calendario de HOY según el reloj del navegador — new
    // Date().toISOString() da la fecha en UTC, que cerca de medianoche
    // puede ser un día distinto al de acá.
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fechaComoInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  const datos = { ingrediente: [], costofijo: [] };
  const CONTENEDOR = { ingrediente: 'ingredientes-list', costofijo: 'costosfijos-list' };
  const busqueda = { ingrediente: '', costofijo: '' };
  const VISTA_KEY = 'recetas_ingredientes_vista';
  let vistaActual = localStorage.getItem(VISTA_KEY) === 'costofijo' ? 'costofijo' : 'ingrediente';

  async function cargar(tipo) {
    const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      Utils.toast('No se pudo cargar: ' + (data.error || tipo), 'error');
      return;
    }
    datos[tipo] = data.items;
    render(tipo);
  }

  function render(tipo) {
    const el = document.getElementById(CONTENEDOR[tipo]);
    const L = tipo === 'ingrediente'
      ? { nombre: 'Ingrediente', costo: 'Costo Bulto', cantidad: 'Cant. x Bulto' }
      : { nombre: 'Costo Fijo', costo: 'Costo Total', cantidad: 'Unidades' };

    if (datos[tipo].length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted);padding:16px 4px;">Todavía no hay registros.</p>';
      return;
    }

    const q = busqueda[tipo].trim().toLowerCase();
    const items = q ? datos[tipo].filter(i => i.nombre.toLowerCase().includes(q)) : datos[tipo];

    if (items.length === 0) {
      el.innerHTML = `<p style="color:var(--text-muted);padding:16px 4px;">No hay ningún ${tipo === 'ingrediente' ? 'ingrediente' : 'costo fijo'} que coincida con "${busqueda[tipo]}".</p>`;
      return;
    }

    el.innerHTML = items.map(i => `
      <div class="ing-row" data-id="${i.id}">
        <span class="ing-row__valor" data-label="${L.nombre}">${i.nombre}</span>
        <span class="ing-row__valor" data-label="${L.costo}">${Utils.formatCurrency(i.costo_bulto)}</span>
        <span class="ing-row__valor" data-label="${L.cantidad}">${Utils.formatNumber(i.cantidad_bulto)}</span>
        <span class="ing-row__fraccion" data-label="Costo Fracción">${Utils.formatCurrency(i.costo_fraccion)}</span>
        <span class="ing-row__fecha" data-label="Actualizado">${formatearFecha(i.fecha_actualizacion)}</span>
        <span class="ing-row__valor" data-label="Observaciones" style="color:var(--text-muted);font-size:.82rem;" title="${(i.observaciones || '').replace(/"/g, '&quot;')}">${i.observaciones || ''}</span>
        <span class="ing-row__actions">
          <button type="button" class="btn-edit" title="Editar">${ICON_PENCIL}</button>
          <button type="button" class="btn-delete danger" title="Eliminar">${ICON_TRASH}</button>
        </span>
      </div>
    `).join('');

    el.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => iniciarEdicion(tipo, btn.closest('.ing-row')));
    });
    el.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => eliminar(tipo, btn.closest('.ing-row').dataset.id));
    });
  }

  function iniciarEdicion(tipo, fila) {
    const id = fila.dataset.id;
    const item = datos[tipo].find(i => i.id === id);
    const L = tipo === 'ingrediente'
      ? { nombre: 'Ingrediente', costo: 'Costo Bulto', cantidad: 'Cant. x Bulto' }
      : { nombre: 'Costo Fijo', costo: 'Costo Total', cantidad: 'Unidades' };

    fila.innerHTML = `
      <input type="text" value="${item.nombre.replace(/"/g, '&quot;')}" data-campo="nombre" data-label="${L.nombre}">
      <input type="number" value="${item.costo_bulto}" step="0.01" min="0" data-campo="costo_bulto" data-label="${L.costo}">
      <input type="number" value="${item.cantidad_bulto}" step="0.01" min="0" data-campo="cantidad_bulto" data-label="${L.cantidad}">
      <span class="ing-row__fraccion" id="fraccion-preview" data-label="Costo Fracción">${Utils.formatCurrency(item.costo_fraccion)}</span>
      <span class="ing-fecha-edit" data-label="Actualizado">
        <input type="date" value="${fechaComoInput(item.fecha_actualizacion)}" data-campo="fecha_actualizacion">
        <button type="button" class="btn-hoy" title="Poner la fecha de hoy">Hoy</button>
      </span>
      <input type="text" value="${(item.observaciones || '').replace(/"/g, '&quot;')}" data-campo="observaciones" data-label="Observaciones">
      <span class="ing-row__actions">
        <button type="button" class="btn-save" title="Guardar">${ICON_CHECK}</button>
        <button type="button" class="btn-cancel" title="Cancelar">${ICON_X}</button>
      </span>
    `;

    const inputCosto = fila.querySelector('[data-campo="costo_bulto"]');
    const inputCantidad = fila.querySelector('[data-campo="cantidad_bulto"]');
    const preview = fila.querySelector('#fraccion-preview');
    const actualizarPreview = () => {
      const c = Number(inputCosto.value) || 0;
      const q = Number(inputCantidad.value) || 0;
      preview.textContent = Utils.formatCurrency(q > 0 ? c / q : 0);
    };
    inputCosto.addEventListener('input', actualizarPreview);
    inputCantidad.addEventListener('input', actualizarPreview);

    const inputFecha = fila.querySelector('[data-campo="fecha_actualizacion"]');
    fila.querySelector('.btn-hoy').addEventListener('click', () => {
      inputFecha.value = hoyLocal();
    });

    fila.querySelector('[data-campo="nombre"]').focus();

    const guardar = () => guardarEdicion(tipo, id, {
      nombre: fila.querySelector('[data-campo="nombre"]').value.trim(),
      costo_bulto: fila.querySelector('[data-campo="costo_bulto"]').value,
      cantidad_bulto: fila.querySelector('[data-campo="cantidad_bulto"]').value,
      fecha_actualizacion: inputFecha.value || null,
      observaciones: fila.querySelector('[data-campo="observaciones"]').value.trim(),
    });

    fila.querySelector('.btn-save').addEventListener('click', guardar);
    fila.querySelector('.btn-cancel').addEventListener('click', () => render(tipo));
  }

  async function guardarEdicion(tipo, id, cambios) {
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}&id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.');
      Utils.toast('✓ Costo actualizado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function eliminar(tipo, id) {
    const confirmado = await Utils.confirm('¿Eliminar?', 'Esta acción no se puede deshacer.', 'Eliminar');
    if (!confirmado) return;
    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar.');
      Utils.toast('Eliminado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  async function crear(tipo) {
    const prefijo = tipo === 'ingrediente' ? 'new-ing-' : 'new-cf-';
    const elNombre = document.getElementById(`${prefijo}nombre`);
    const elCosto = document.getElementById(`${prefijo}costo`);
    const elCantidad = document.getElementById(`${prefijo}cantidad`);
    const elObs = document.getElementById(`${prefijo}obs`);

    const nombre = elNombre.value.trim();
    if (!nombre) { Utils.toast('Escribí un nombre', 'error'); return; }

    try {
      const res = await window.sweetAuth.fetch(`/api/recetas-catalogo?tipo=${tipo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          costo_bulto: elCosto.value,
          cantidad_bulto: elCantidad.value,
          observaciones: elObs.value.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo crear.');
      elNombre.value = ''; elCosto.value = ''; elCantidad.value = ''; elObs.value = '';
      Utils.toast('Agregado', 'success');
      await cargar(tipo);
    } catch (err) {
      Utils.toast(err.message, 'error');
    }
  }

  // ============================================
  // TOGGLE Ingredientes / Costos Fijos + buscador
  // ============================================
  function mostrarVista(tipo) {
    vistaActual = tipo;
    localStorage.setItem(VISTA_KEY, tipo);

    document.getElementById('seccion-ingrediente').hidden = tipo !== 'ingrediente';
    document.getElementById('seccion-costofijo').hidden = tipo !== 'costofijo';

    const btn = document.getElementById('btn-toggle-vista');
    if (tipo === 'ingrediente') {
      btn.innerHTML = ICON_RELOJ + ' Ver Costos Fijos';
      btn.title = 'Ver Costos Fijos';
    } else {
      btn.innerHTML = ICON_CAJA + ' Ver Ingredientes';
      btn.title = 'Ver Ingredientes';
    }

    const search = document.getElementById('ing-cf-search');
    search.placeholder = tipo === 'ingrediente' ? 'Buscar ingrediente...' : 'Buscar costo fijo...';
    search.value = busqueda[tipo];
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('btn-add-ing').addEventListener('click', () => crear('ingrediente'));
      document.getElementById('btn-add-cf').addEventListener('click', () => crear('costofijo'));
      document.getElementById('btn-toggle-vista').addEventListener('click', () => mostrarVista(vistaActual === 'ingrediente' ? 'costofijo' : 'ingrediente'));
      document.getElementById('ing-cf-search').addEventListener('input', (e) => {
        busqueda[vistaActual] = e.target.value;
        render(vistaActual);
      });
      mostrarVista(vistaActual);
      cargar('ingrediente');
      cargar('costofijo');
    });
  });
})();
