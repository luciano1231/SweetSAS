// ============================================
// UTILIDADES COMPARTIDAS
// ============================================

const Utils = {
  /**
   * Formatea un número como moneda argentina
   * @param {number} value
   * @returns {string}
   */
  formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '$0';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  },

  /**
   * Formatea un número con separadores de miles
   * @param {number} value
   * @returns {string}
   */
  formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('es-AR').format(value);
  },

  /**
   * Parsea un string de moneda a número
   * @param {string} value
   * @returns {number}
   */
  parseCurrency(value) {
    if (!value) return 0;
    // Remove currency symbol, dots (thousands), and replace comma with dot for decimals
    const cleaned = String(value).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  },

  /**
   * Obtiene la fecha actual en formato YYYY-MM-DD
   * @returns {string}
   */
  today() {
    // Fecha local (no UTC): con toISOString, después de las 21 hs en
    // Argentina ya es "mañana" en UTC y la rendición quedaba con el día siguiente.
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * Formatea una fecha ISO a formato legible argentino
   * @param {string} isoDate
   * @returns {string}
   */
  formatDate(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate + 'T12:00:00');
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dia = dias[date.getDay()];
    const num = date.getDate();
    const mes = meses[date.getMonth()];
    const anio = date.getFullYear();
    return `${dia} ${num}/${mes}/${anio}`;
  },

  /**
   * Muestra una notificación toast
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration - ms
   */
  toast(message, type = 'info', duration = 4000) {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    const icons = {
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    };

    toast.innerHTML = `
      <span class="toast__icon">${icons[type]}</span>
      <span class="toast__message">${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Muestra un modal de confirmación
   * @param {string} title
   * @param {string} message
   * @param {string} confirmText
   * @returns {Promise<boolean>}
   */
  confirm(title, message, confirmText = 'Confirmar') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal__header">
            <h3 class="modal__title">${title}</h3>
          </div>
          <div class="modal__body">
            <p>${message}</p>
          </div>
          <div class="modal__footer">
            <button class="btn btn--ghost" id="modal-cancel">Cancelar</button>
            <button class="btn btn--primary" id="modal-confirm">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

      const cleanup = (result) => {
        overlay.classList.remove('modal-overlay--visible');
        setTimeout(() => overlay.remove(), 300);
        resolve(result);
      };

      overlay.querySelector('#modal-cancel').addEventListener('click', () => cleanup(false));
      overlay.querySelector('#modal-confirm').addEventListener('click', () => cleanup(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(false);
      });
    });
  },

  /**
   * Obtiene el nombre de un local por ID
   * @param {string} localId
   * @returns {string}
   */
  getLocalName(localId) {
    const local = CONFIG.locales.find(l => l.id === localId);
    return local ? local.nombre : localId;
  },

  /**
   * Fallback si un registro viejo no tiene empleado_nombre guardado
   * (los nuevos siempre lo traen directo desde el formulario de carga).
   * @param {string} empleadoId
   * @returns {string}
   */
  getEmpleadoName(empleadoId) {
    return empleadoId || 'Sin especificar';
  },

  /**
   * Debounce function
   */
  debounce(fn, delay = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
};
