// ============================================
// LÓGICA DEL FORMULARIO DE CARGA DE RENDICIÓN
// ============================================

(function () {
  'use strict';

  // --- Get local ID from URL ---
  const params = new URLSearchParams(window.location.search);
  const localId = params.get('local');

  if (!localId) {
    window.location.href = 'index.html';
    return;
  }

  const local = CONFIG.locales.find(l => l.id === localId);
  if (!local) {
    window.location.href = 'index.html';
    return;
  }

  // --- Permitir solo si este usuario tiene acceso a este local ---
  window.sweetAuth.onReady(function (session) {
    const permitidos = (session.permissions && session.permissions.locales) || [];
    if (!permitidos.includes(localId)) {
      window.location.href = 'index.html';
    }
  });

  // --- Set header ---
  document.getElementById('header-local').textContent = local.nombre;
  document.title = `Carga de Rendición — ${local.nombre}`;

  // --- State ---
  let billValues = {};   // { '10': 0, '20': 0, ... }
  let paymentValues = {}; // { 'debito': 0, 'credito': 0, ... }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    populateTurnos();
    setFechaHoy();
    generateBillFields();
    generatePaymentFields();
    bindEvents();
  }

  // --- Populate turnos dropdown ---
  function populateTurnos() {
    const select = document.getElementById('turno');
    CONFIG.turnos.forEach(turno => {
      const opt = document.createElement('option');
      opt.value = turno;
      opt.textContent = turno;
      select.appendChild(opt);
    });
  }

  // --- Set fecha to today ---
  function setFechaHoy() {
    document.getElementById('fecha').value = Utils.today();
    updateFechaDisplay();
  }

  // --- Update the overlaid text (with weekday) shown on top of the native date input ---
  function updateFechaDisplay() {
    const fecha = document.getElementById('fecha').value;
    document.getElementById('fecha-display').textContent = fecha ? Utils.formatDate(fecha) : '';
  }

  // ============================================
  // GENERATE BILL COUNTER FIELDS
  // ============================================

  function generateBillFields() {
    const grid = document.getElementById('bills-grid');

    CONFIG.denominaciones.forEach(denom => {
      billValues[denom] = 0;

      const field = document.createElement('div');
      field.className = 'bill-field';
      field.innerHTML = `
        <span class="bill-field__denom">$${Utils.formatNumber(denom)}</span>
        <input type="number" 
               class="bill-field__input" 
               data-denom="${denom}"
               placeholder="0"
               min="0"
               step="1"
               inputmode="numeric"
               id="bill-${denom}">
        <span class="bill-field__subtotal" id="subtotal-${denom}">$0</span>
      `;
      grid.appendChild(field);
    });
  }

  // ============================================
  // GENERATE PAYMENT FIELDS
  // ============================================

  function generatePaymentFields() {
    const grid = document.getElementById('payments-grid');

    CONFIG.mediosPago.forEach(medio => {
      paymentValues[medio.id] = 0;

      const field = document.createElement('div');
      field.className = 'payment-field';
      field.innerHTML = `
        <label class="payment-field__label" for="payment-${medio.id}">
          <span class="payment-field__icon">${medio.icono}</span>
          ${medio.nombre}
        </label>
        <div class="payment-field__input-wrapper">
          <span class="payment-field__prefix">$</span>
          <input type="number" 
                 class="payment-field__input" 
                 data-payment="${medio.id}"
                 placeholder="0"
                 min="0"
                 step="1"
                 inputmode="numeric"
                 id="payment-${medio.id}">
        </div>
      `;
      grid.appendChild(field);
    });
  }

  // ============================================
  // CALCULATIONS (Real-time)
  // ============================================

  function calculateTotalEfectivo() {
    let total = 0;
    for (const [denom, qty] of Object.entries(billValues)) {
      total += Number(denom) * qty;
    }
    return total;
  }

  function calculateTotalElectronico() {
    let total = 0;
    for (const amount of Object.values(paymentValues)) {
      total += amount;
    }
    return total;
  }

  function calculateTotalReal() {
    return calculateTotalEfectivo() + calculateTotalElectronico();
  }

  function calculateDiferencia() {
    const totalReal = calculateTotalReal();
    const registrado = Number(document.getElementById('registrado-sistema').value) || 0;
    return totalReal - registrado;
  }

  // --- Update all displayed totals ---
  function updateTotals() {
    const totalEfectivo = calculateTotalEfectivo();
    const totalReal = calculateTotalReal();
    const diferencia = calculateDiferencia();

    // Total Efectivo
    document.getElementById('total-efectivo').textContent = Utils.formatCurrency(totalEfectivo);

    // Total Real
    document.getElementById('total-real').textContent = Utils.formatCurrency(totalReal);

    // Diferencia
    const diffEl = document.getElementById('diferencia');
    const diffRow = document.getElementById('diff-row');

    diffEl.textContent = Utils.formatCurrency(diferencia);

    // Remove all state classes
    diffRow.classList.remove('summary-row--positive', 'summary-row--negative', 'summary-row--zero');

    // Add appropriate class
    if (diferencia > 0) {
      diffRow.classList.add('summary-row--positive');
    } else if (diferencia < 0) {
      diffRow.classList.add('summary-row--negative');
    } else {
      diffRow.classList.add('summary-row--zero');
    }

    // Trigger pulse animation
    diffEl.classList.remove('diff-pulse');
    void diffEl.offsetWidth; // Force reflow
    diffEl.classList.add('diff-pulse');
  }

  // ============================================
  // EVENT BINDINGS
  // ============================================

  function bindEvents() {
    // --- Bill inputs ---
    document.querySelectorAll('.bill-field__input').forEach(input => {
      input.addEventListener('input', (e) => {
        const denom = e.target.dataset.denom;
        const qty = Math.max(0, parseInt(e.target.value) || 0);
        billValues[denom] = qty;

        // Update subtotal for this denomination
        const subtotal = Number(denom) * qty;
        const subtotalEl = document.getElementById(`subtotal-${denom}`);
        subtotalEl.textContent = Utils.formatCurrency(subtotal);
        subtotalEl.classList.toggle('bill-field__subtotal--active', qty > 0);

        updateTotals();
      });

      // Select all text on focus for easier editing
      input.addEventListener('focus', (e) => e.target.select());
    });

    // --- Payment inputs ---
    document.querySelectorAll('.payment-field__input').forEach(input => {
      input.addEventListener('input', (e) => {
        const paymentId = e.target.dataset.payment;
        const amount = Math.max(0, parseFloat(e.target.value) || 0);
        paymentValues[paymentId] = amount;
        updateTotals();
      });

      input.addEventListener('focus', (e) => e.target.select());
    });

    // --- Fecha (update weekday display on change) ---
    document.getElementById('fecha').addEventListener('change', updateFechaDisplay);

    // --- Registrado en sistema ---
    document.getElementById('registrado-sistema').addEventListener('input', () => {
      updateTotals();
    });
    document.getElementById('registrado-sistema').addEventListener('focus', (e) => e.target.select());

    // --- Clear form ---
    document.getElementById('btn-limpiar').addEventListener('click', handleClear);

    // --- Submit form ---
    document.getElementById('rendicion-form').addEventListener('submit', handleSubmit);
  }

  // ============================================
  // FORM SUBMISSION
  // ============================================

  async function handleSubmit(e) {
    e.preventDefault();

    // Validate required fields
    const turno = document.getElementById('turno').value;
    const fecha = document.getElementById('fecha').value;
    const empleadoNombre = document.getElementById('empleado').value.trim();
    const empleado = empleadoNombre;

    if (!turno || !fecha || !empleado) {
      Utils.toast('Completá todos los campos obligatorios (turno, fecha, empleado)', 'error');

      // Highlight empty required fields
      ['turno', 'fecha', 'empleado'].forEach(id => {
        const el = document.getElementById(id);
        if (!el.value) {
          el.style.borderColor = 'var(--error)';
          el.addEventListener('change', () => {
            el.style.borderColor = '';
          }, { once: true });
        }
      });
      return;
    }

    const totalReal = calculateTotalReal();
    const registrado = Number(document.getElementById('registrado-sistema').value) || 0;
    const diferencia = calculateDiferencia();

    // Build rendicion object
    const rendicion = {
      local_id: localId,
      local_nombre: local.nombre,
      empleado_id: empleado,
      empleado_nombre: empleadoNombre,
      fecha: fecha,
      turno: turno,
      total_efectivo: calculateTotalEfectivo(),
      total_real: totalReal,
      registrado_sistema: registrado,
      diferencia: diferencia,
      observaciones: document.getElementById('observaciones').value.trim(),
    };

    // Add bill quantities
    CONFIG.denominaciones.forEach(denom => {
      rendicion[`billetes_${denom}`] = billValues[denom] || 0;
    });

    // Add payment amounts
    CONFIG.mediosPago.forEach(medio => {
      rendicion[medio.id] = paymentValues[medio.id] || 0;
    });

    // Build confirmation message
    const diffText = diferencia >= 0
      ? `+${Utils.formatCurrency(diferencia)}`
      : Utils.formatCurrency(diferencia);

    const diffColor = diferencia > 0 ? 'color: #22c55e' : diferencia < 0 ? 'color: #ef4444' : '';

    const confirmMsg = `
      <div class="modal__summary">
        <div class="modal__summary-item">
          <span>Local</span>
          <strong>${local.nombre}</strong>
        </div>
        <div class="modal__summary-item">
          <span>Turno</span>
          <strong>${turno}</strong>
        </div>
        <div class="modal__summary-item">
          <span>Fecha</span>
          <strong>${Utils.formatDate(fecha)}</strong>
        </div>
        <div class="modal__summary-item">
          <span>Empleado</span>
          <strong>${rendicion.empleado_nombre}</strong>
        </div>
        <div class="modal__summary-item">
          <span>Total Efectivo</span>
          <strong>${Utils.formatCurrency(rendicion.total_efectivo)}</strong>
        </div>
        <div class="modal__summary-item">
          <span>Total Real</span>
          <strong>${Utils.formatCurrency(totalReal)}</strong>
        </div>
        <div class="modal__summary-item">
          <span>Registrado en Sistema</span>
          <strong>${Utils.formatCurrency(registrado)}</strong>
        </div>
        <div class="modal__summary-item">
          <span>Diferencia</span>
          <strong style="${diffColor}">${diffText}</strong>
        </div>
      </div>
    `;

    const confirmed = await Utils.confirm(
      '¿Enviar rendición?',
      `Revisá el resumen antes de enviar:${confirmMsg}`,
      'Enviar'
    );

    if (!confirmed) return;

    // Save to storage
    const btnEnviar = document.getElementById('btn-enviar');
    btnEnviar.disabled = true;
    try {
      await Storage.save(rendicion);
      Utils.toast('✓ Rendición enviada correctamente', 'success');

      // Reset form after short delay
      setTimeout(() => {
        resetForm();
      }, 500);
    } catch (err) {
      Utils.toast('Error al guardar la rendición: ' + err.message, 'error');
    } finally {
      btnEnviar.disabled = false;
    }
  }

  // ============================================
  // CLEAR / RESET FORM
  // ============================================

  async function handleClear() {
    const confirmed = await Utils.confirm(
      '¿Limpiar formulario?',
      '¿Estás seguro de que querés limpiar todos los campos? Se perderán los datos ingresados.',
      'Limpiar'
    );
    if (confirmed) resetForm();
  }

  function resetForm() {
    // Reset bill values
    CONFIG.denominaciones.forEach(denom => {
      billValues[denom] = 0;
      const input = document.getElementById(`bill-${denom}`);
      if (input) input.value = '';
      const subtotal = document.getElementById(`subtotal-${denom}`);
      if (subtotal) {
        subtotal.textContent = '$0';
        subtotal.classList.remove('bill-field__subtotal--active');
      }
    });

    // Reset payment values
    CONFIG.mediosPago.forEach(medio => {
      paymentValues[medio.id] = 0;
      const input = document.getElementById(`payment-${medio.id}`);
      if (input) input.value = '';
    });

    // Reset other fields
    document.getElementById('registrado-sistema').value = '';
    document.getElementById('observaciones').value = '';
    document.getElementById('turno').selectedIndex = 0;
    document.getElementById('empleado').value = '';

    // Keep fecha as today
    setFechaHoy();

    // Update totals
    updateTotals();
  }

  // ============================================
  // INIT
  // ============================================

  document.addEventListener('DOMContentLoaded', init);
})();
