// ============================================
// OBLIGACIONES — Gastos por fecha, clasificación y tipo de gasto
// ============================================
// Fecha y banco se filtran en el servidor; el resto (texto, tipo de gasto,
// clasificación, fila del resumen) es en el navegador, al toque. El tipo de
// gasto lo calcula el servidor con la misma regla que el Tablero.

(function () {
  'use strict';

  const TIPOS = [
    { key: 'empresa', label: 'Gasto empresa', color: '#6366f1' },
    { key: 'personales', label: 'Gastos personales', color: '#eab308' },
    { key: 'internos', label: 'Movimientos internos', color: '#38bdf8' },
    { key: 'inversiones', label: 'Inversiones', color: '#a3e635' },
  ];
  const TIPO = Object.fromEntries(TIPOS.map(t => [t.key, t]));
  const PALETA = ['#6366f1', '#10b981', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#0ea5e9', '#f43f5e', '#64748b', '#d946ef'];
  const SIN_CLASIF_GENERAL = '(Sin clasificación general)';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const LIMITE_FILAS = 300;

  let movimientos = [];
  const tiposOff = new Set();
  const clasifOff = new Set();
  let grupoSel = null; // { campo, valor, label }
  let mostrarTodas = false;
  const colorClasif = {};

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clasifDe = m => m.clasificacion || SIN_CLASIF_GENERAL;
  const suma = arr => arr.reduce((s, m) => s + (m.monto || 0), 0);
  const mesLabel = ym => { const [a, m] = ym.split('-'); return `${MESES[Number(m) - 1]} ${a}`; };

  // Las clasificaciones extra llevan el color de su tipo de gasto (igual que
  // en el Tablero); las de empresa, uno de la paleta.
  const tipoDeClasif = {};
  function colorDe(clasif) {
    const tipo = tipoDeClasif[clasif];
    if (tipo && tipo !== 'empresa') return TIPO[tipo].color;
    if (!colorClasif[clasif]) colorClasif[clasif] = clasif === SIN_CLASIF_GENERAL ? '#94a3b8' : PALETA[Object.keys(colorClasif).length % PALETA.length];
    return colorClasif[clasif];
  }

  // ============================================
  // PERÍODO
  // ============================================
  function iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function aplicarPeriodo() {
    const p = document.getElementById('filter-periodo').value;
    if (p === 'personalizado') return;
    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth();
    let desde = '', hasta = '';
    if (p === 'mes') { desde = iso(new Date(y, m, 1)); hasta = iso(hoy); }
    if (p === 'mes-anterior') { desde = iso(new Date(y, m - 1, 1)); hasta = iso(new Date(y, m, 0)); }
    if (p === '3meses') { desde = iso(new Date(y, m - 2, 1)); hasta = iso(hoy); }
    if (p === 'anio') { desde = iso(new Date(y, 0, 1)); hasta = iso(hoy); }
    if (p === 'anio-anterior') { desde = iso(new Date(y - 1, 0, 1)); hasta = iso(new Date(y - 1, 11, 31)); }
    document.getElementById('filter-desde').value = desde;
    document.getElementById('filter-hasta').value = hasta;
  }

  // ============================================
  // CARGA
  // ============================================
  async function cargar() {
    const params = new URLSearchParams();
    const desde = document.getElementById('filter-desde').value;
    const hasta = document.getElementById('filter-hasta').value;
    const banco = document.getElementById('filter-banco').value;
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (banco) params.set('banco', banco);

    document.getElementById('detalle-wrapper').innerHTML = '<div class="empty-state"><p class="empty-state__text">Cargando...</p></div>';
    try {
      const res = await window.sweetAuth.fetch(`/api/obligaciones?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los movimientos.');
      movimientos = data.movimientos;
      movimientos.forEach(m => { tipoDeClasif[clasifDe(m)] = m.tipo_gasto; });
    } catch (err) {
      document.getElementById('detalle-wrapper').innerHTML = `<div class="empty-state"><p class="empty-state__text">${esc(err.message)}</p></div>`;
      return;
    }
    grupoSel = null;
    render();
  }

  // ============================================
  // FILTROS
  // ============================================
  function base() {
    const q = document.getElementById('filter-texto').value.trim().toLowerCase();
    if (!q) return movimientos;
    return movimientos.filter(m =>
      `${m.observacion || ''} ${m.obligacion} ${m.clasificacion || ''} ${m.de_quien_la_deuda || ''} ${m.origen_del_dinero || ''}`.toLowerCase().includes(q)
    );
  }

  function valorGrupo(m, campo) {
    if (campo === 'clasificacion') return clasifDe(m);
    if (campo === 'obligacion') return m.obligacion;
    if (campo === 'tipo') return m.tipo_gasto;
    if (campo === 'mes') return (m.fecha || '').slice(0, 7);
    return '';
  }

  function render() {
    const b = base();
    const porTipo = b.filter(m => !tiposOff.has(m.tipo_gasto));
    const filtrados = porTipo.filter(m => !clasifOff.has(clasifDe(m)));
    renderChipsTipo(b);
    renderChipsClasif(porTipo);
    renderKPIs(filtrados);
    renderResumen(filtrados);
    renderDetalle(grupoSel ? filtrados.filter(m => valorGrupo(m, grupoSel.campo) === grupoSel.valor) : filtrados);
  }

  function chipHTML(grupo, key, label, color, monto, off) {
    return `<button type="button" class="chip ${off ? 'chip--off' : ''}" data-grupo="${grupo}" data-key="${esc(key)}">
      <span class="chip__dot" style="background:${color}"></span>${esc(label)}<span class="chip__monto">${Utils.formatCurrency(monto)}</span></button>`;
  }

  function renderChipsTipo(b) {
    document.getElementById('chips-tipo').innerHTML = TIPOS
      .map(t => chipHTML('tipo', t.key, t.label, t.color, suma(b.filter(m => m.tipo_gasto === t.key)), tiposOff.has(t.key)))
      .join('');
  }

  function renderChipsClasif(porTipo) {
    const totales = {};
    porTipo.forEach(m => { const c = clasifDe(m); totales[c] = (totales[c] || 0) + (m.monto || 0); });
    // También las apagadas que ya no tienen movimientos, para poder prenderlas
    clasifOff.forEach(c => { if (!(c in totales)) totales[c] = 0; });
    const claves = Object.keys(totales).sort((a, b) => totales[b] - totales[a]);
    document.getElementById('chips-clasif').innerHTML = claves.length
      ? claves.map(c => chipHTML('clasif', c, c, colorDe(c), totales[c], clasifOff.has(c))).join('')
      : '<span class="cell--muted" style="font-size:.85rem;">No hay movimientos en este período.</span>';
  }

  function renderKPIs(f) {
    const empresa = suma(f.filter(m => m.tipo_gasto === 'empresa'));
    const extras = suma(f.filter(m => m.tipo_gasto !== 'empresa'));
    const sinClasif = f.filter(m => m.obligacion === 'SIN CLASIFICAR');
    document.getElementById('kpi-total').textContent = Utils.formatCurrency(empresa + extras);
    document.getElementById('kpi-total-sub').textContent = `${f.length} movimiento(s)`;
    document.getElementById('kpi-empresa').textContent = Utils.formatCurrency(empresa);
    document.getElementById('kpi-extras').textContent = Utils.formatCurrency(extras);
    document.getElementById('kpi-sinclasif').textContent = Utils.formatCurrency(suma(sinClasif));
    document.getElementById('kpi-sinclasif-sub').textContent = `${sinClasif.length} movimiento(s) para clasificar`;
  }

  function renderResumen(f) {
    const campo = document.getElementById('agrupar').value;
    const wrapper = document.getElementById('resumen-wrapper');
    if (f.length === 0) { wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">No hay gastos con estos filtros.</p></div>'; return; }

    const grupos = {};
    f.forEach(m => {
      const v = valorGrupo(m, campo);
      if (!grupos[v]) grupos[v] = { valor: v, total: 0, cant: 0, tipo: m.tipo_gasto, clasif: clasifDe(m) };
      grupos[v].total += m.monto || 0;
      grupos[v].cant++;
    });
    const lista = Object.values(grupos);
    if (campo === 'mes') lista.sort((a, b) => b.valor.localeCompare(a.valor));
    else lista.sort((a, b) => b.total - a.total);
    const total = suma(f);
    const max = Math.max(...lista.map(g => g.total), 1);

    const etiqueta = g => campo === 'tipo' ? TIPO[g.valor].label : campo === 'mes' ? mesLabel(g.valor) : g.valor;
    const color = g => campo === 'tipo' ? TIPO[g.valor].color : campo === 'clasificacion' ? colorDe(g.valor) : campo === 'obligacion' ? TIPO[g.tipo].color : 'var(--accent-primary)';
    const titulo = { clasificacion: 'Clasificación', obligacion: 'Obligación', tipo: 'Tipo de gasto', mes: 'Mes' }[campo];

    wrapper.innerHTML = `
      <table class="data-table data-table--stack">
        <thead><tr><th>${titulo}</th>${campo === 'obligacion' ? '<th>Clasificación</th>' : ''}<th>Movimientos</th><th>Total</th><th>%</th><th></th></tr></thead>
        <tbody>
          ${lista.map(g => {
            const activa = grupoSel && grupoSel.campo === campo && grupoSel.valor === g.valor;
            const pct = total > 0 ? (g.total / total) * 100 : 0;
            return `<tr class="fila-grupo ${activa ? 'activa' : ''}" data-valor="${esc(g.valor)}">
              <td class="cell--title" data-label="${titulo}"><span class="${g.valor === 'SIN CLASIFICAR' ? 'sin-clasif' : ''}">${esc(etiqueta(g))}</span></td>
              ${campo === 'obligacion' ? `<td data-label="Clasificación" class="cell--muted">${esc(g.clasif)}</td>` : ''}
              <td data-label="Movimientos">${g.cant}</td>
              <td class="cell--currency" data-label="Total">${Utils.formatCurrency(g.total)}</td>
              <td data-label="%">${pct.toFixed(1)}%</td>
              <td data-label=""><div class="barra"><span style="width:${(g.total / max) * 100}%;background:${color(g)}"></span></div></td>
            </tr>`;
          }).join('')}
          <tr class="fila-total"><td data-label="Total"><strong>Total</strong></td>${campo === 'obligacion' ? '<td></td>' : ''}<td data-label="Movimientos"><strong>${f.length}</strong></td><td class="cell--currency" data-label="Total"><strong>${Utils.formatCurrency(total)}</strong></td><td></td><td></td></tr>
        </tbody>
      </table>`;

    wrapper.querySelectorAll('tr.fila-grupo').forEach(tr => {
      tr.addEventListener('click', () => {
        const valor = tr.dataset.valor;
        const g = grupos[valor];
        grupoSel = (grupoSel && grupoSel.campo === campo && grupoSel.valor === valor) ? null : { campo, valor, label: `${titulo}: ${etiqueta(g)}` };
        mostrarTodas = false;
        render();
        if (grupoSel) document.getElementById('detalle-wrapper').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function bancoBadge(banco) {
    return `<span class="banco-badge ${banco === 'Banco Galicia' ? 'banco-badge--galicia' : 'banco-badge--mp'}">${esc(banco)}</span>`;
  }
  function tipoBadge(tipo) {
    const t = TIPO[tipo];
    return `<span class="tipo-badge" style="background:${t.color}24;color:${t.color}">${t.label}</span>`;
  }

  let ultimoDetalle = [];
  function renderDetalle(f) {
    ultimoDetalle = f;
    document.getElementById('filtro-activo-wrap').innerHTML = grupoSel
      ? `<span class="filtro-activo">${esc(grupoSel.label)} <button type="button" id="btn-quitar-grupo" title="Quitar filtro">×</button></span>`
      : '';
    const btnQuitar = document.getElementById('btn-quitar-grupo');
    if (btnQuitar) btnQuitar.addEventListener('click', () => { grupoSel = null; render(); });

    const wrapper = document.getElementById('detalle-wrapper');
    if (f.length === 0) { wrapper.innerHTML = '<div class="empty-state"><p class="empty-state__text">No hay movimientos con estos filtros.</p></div>'; return; }

    const visibles = mostrarTodas ? f : f.slice(0, LIMITE_FILAS);
    wrapper.innerHTML = `
      <table class="data-table data-table--stack">
        <thead><tr><th>Fecha</th><th>Banco</th><th>Obligación</th><th>Clasificación</th><th>Tipo</th><th>Monto</th><th>Observación</th></tr></thead>
        <tbody>
          ${visibles.map(m => `<tr>
            <td data-label="Fecha">${Utils.formatDate(m.fecha)}</td>
            <td data-label="Banco">${bancoBadge(m.banco)}</td>
            <td data-label="Obligación"><span class="${m.obligacion === 'SIN CLASIFICAR' ? 'sin-clasif' : ''}">${esc(m.obligacion)}</span></td>
            <td data-label="Clasificación" class="${m.clasificacion ? '' : 'cell--muted'}">${esc(clasifDe(m))}</td>
            <td data-label="Tipo">${tipoBadge(m.tipo_gasto)}</td>
            <td class="cell--currency" data-label="Monto">${Utils.formatCurrency(m.monto)}</td>
            <td data-label="Observación" title="${esc(m.observacion)}">${esc(m.observacion)}</td>
          </tr>`).join('')}
          <tr class="fila-total"><td colspan="5" data-label="Total"><strong>Total (${f.length} movimientos)</strong></td><td class="cell--currency" data-label="Monto"><strong>${Utils.formatCurrency(suma(f))}</strong></td><td></td></tr>
        </tbody>
      </table>
      ${f.length > visibles.length ? `<div style="text-align:center;padding:var(--space-md);"><button type="button" class="btn btn--ghost" id="btn-mostrar-todas">Mostrar los ${f.length} movimientos (se ven ${visibles.length})</button></div>` : ''}`;

    const btnTodas = document.getElementById('btn-mostrar-todas');
    if (btnTodas) btnTodas.addEventListener('click', () => { mostrarTodas = true; renderDetalle(f); });
  }

  // ============================================
  // EXPORTAR
  // ============================================
  function exportarCSV() {
    if (ultimoDetalle.length === 0) { Utils.toast('No hay movimientos para exportar', 'error'); return; }
    const celda = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['Fecha', 'Banco', 'Obligación', 'Clasificación', 'Tipo de gasto', 'Monto', 'Observación']]
      .concat(ultimoDetalle.map(m => [m.fecha, m.banco, m.obligacion, clasifDe(m), TIPO[m.tipo_gasto].label, String(m.monto ?? 0).replace('.', ','), m.observacion]));
    const csv = '﻿' + filas.map(f => f.map(celda).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const desde = document.getElementById('filter-desde').value || 'inicio';
    const hasta = document.getElementById('filter-hasta').value || 'hoy';
    a.download = `gastos-obligaciones_${desde}_${hasta}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ============================================
  // INIT
  // ============================================
  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('filter-periodo').addEventListener('change', () => { aplicarPeriodo(); cargar(); });
      ['filter-desde', 'filter-hasta'].forEach(id => document.getElementById(id).addEventListener('change', () => {
        document.getElementById('filter-periodo').value = 'personalizado';
        cargar();
      }));
      document.getElementById('filter-banco').addEventListener('change', cargar);
      document.getElementById('filter-texto').addEventListener('input', Utils.debounce(() => { grupoSel = null; render(); }, 250));
      document.getElementById('agrupar').addEventListener('change', () => { grupoSel = null; render(); });
      document.getElementById('btn-exportar').addEventListener('click', exportarCSV);

      document.addEventListener('click', e => {
        const chip = e.target.closest('.chip[data-grupo]');
        if (chip) {
          const set = chip.dataset.grupo === 'tipo' ? tiposOff : clasifOff;
          const key = chip.dataset.key;
          if (set.has(key)) set.delete(key); else set.add(key);
          grupoSel = null;
          render();
          return;
        }
        const todos = e.target.closest('[data-todos]');
        if (todos) { (todos.dataset.todos === 'tipo' ? tiposOff : clasifOff).clear(); grupoSel = null; render(); return; }
        const ninguno = e.target.closest('[data-ninguno]');
        if (ninguno) {
          if (ninguno.dataset.ninguno === 'tipo') TIPOS.forEach(t => tiposOff.add(t.key));
          else document.querySelectorAll('#chips-clasif .chip').forEach(c => clasifOff.add(c.dataset.key));
          grupoSel = null;
          render();
        }
      });

      aplicarPeriodo();
      cargar();
    });
  });
})();
