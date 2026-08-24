// ============================================
// LISTA DE PRECIOS PUBLICADA — vista para imprimir
// ============================================

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const lista = params.get('lista') === 'mayoristas' ? 'mayoristas' : 'clientes';
  const nombreLista = lista === 'clientes' ? 'Clientes' : 'Mayoristas';

  async function cargar() {
    document.getElementById('header-titulo').textContent = `Lista de Precios — ${nombreLista}`;
    document.getElementById('sheet-titulo').textContent = `Lista de Precios · ${nombreLista}`;
    document.title = `Lista de Precios — ${nombreLista}`;

    const contenido = document.getElementById('sheet-contenido');

    let data;
    try {
      const res = await window.sweetAuth.fetch(`/api/listas-precios?lista=${lista}&modo=publicada`);
      data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar la lista publicada.');
    } catch (err) {
      contenido.innerHTML = `<div class="empty-state"><p class="empty-state__text">${err.message}</p></div>`;
      return;
    }

    const fecha = data.published_at ? new Date(data.published_at) : null;
    const textoFecha = fecha ? 'Vigente desde el ' + fecha.toLocaleDateString('es-AR') : 'Todavía no se publicó ninguna versión';
    document.getElementById('header-fecha').textContent = textoFecha;
    document.getElementById('sheet-fecha').textContent = textoFecha;

    if (!data.publicada || data.publicada.length === 0) {
      contenido.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__text">Todavía no se publicó ninguna versión de esta lista. Andá a "Listas de Precios" para armar el borrador y publicar.</p>
        </div>
      `;
      return;
    }

    let html = '<table class="print-table"><tbody>';
    data.publicada.forEach(p => {
      html += `<tr><td>${p.nombre}</td><td>${Utils.formatCurrency(p.precio_final)}</td></tr>`;
    });
    html += '</tbody></table>';
    contenido.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.sweetAuth.onReady(function () {
      document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
      cargar();
    });
  });
})();
