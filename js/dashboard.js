/* Sweet SAS Dashboard JS — Rebuilt */
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const INCOME_COLS = [
  { key: 'panaderia', label: 'Ingreso Panadería', color: '#3b82f6', icon: '🍞' },
  { key: 'sweetHiper', label: 'Ingreso Sweet Hiper', color: '#8b5cf6', icon: '🛒' },
  { key: 'chango', label: 'Ingreso Chango', color: '#10b981', icon: '🏪' },
  { key: 'mayoristasExt', label: 'Ingreso Mayoristas Ext.', color: '#f59e0b', icon: '📦' },
  { key: 'mayoristasInt', label: 'Ingreso Mayoristas Int.', color: '#06b6d4', icon: '📋' }
];
const EXPENSE_COLS = [
  { key: 'cajaChicaPan', label: 'Caja Chica Panadería', color: '#ef4444' },
  { key: 'cajaChicaSH', label: 'Caja Chica Sweet Hiper', color: '#f97316' },
  { key: 'cajaChicaCh', label: 'Caja Chica Chango', color: '#ec4899' },
  { key: 'cajaSemanal', label: 'Caja Semanal', color: '#8b5cf6' },
  { key: 'obligaciones', label: 'Obligaciones', color: '#6366f1' }
];
const PERSONAL_COLS = [
  { key: 'gastosPerOblig', label: 'Gastos Pers. (Obligaciones)', color: '#eab308' },
  { key: 'invOblig', label: 'Inversiones Obligaciones', color: '#a3e635' },
  { key: 'gastosPerCaja', label: 'Gastos Pers. (Caja Chica)', color: '#facc15' },
  { key: 'invCaja', label: 'Inversiones (Caja Chica)', color: '#fde047' }
];

let dashboardData = [], filteredData = [], charts = {}, currentView = 'overview';
let activeFilters = { ingresos: {}, gastos: {}, personales: {} };
const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbx0XjF9A61J8G6f3DW9G5ral8AceS7UdhRQiMi9_k2QB-J0JnpHEdBC0y0no2KVRqJh/exec';
let sheetUrl = localStorage.getItem('sweetSAS_sheetUrl') || DEFAULT_SHEET_URL;

function fmt(n) { if (n == null || isNaN(n)) return '$0'; if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + n.toLocaleString('es-AR'); }
function fmtFull(n) { if (n == null || isNaN(n)) return '$0'; return '$' + n.toLocaleString('es-AR'); }
function parseNum(s) { if (!s) return 0; s = String(s).trim().replace(/["'$\s]/g, ''); if (s === '' || s === '-') return 0; if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (s.includes(',') && /,\d{3}/.test(s) && !/,\d{1,2}$/.test(s)) s = s.replace(/,/g, ''); else if (s.includes(',')) s = s.replace(',', '.'); else if (s.includes('.') && /\.\d{3}/.test(s) && (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, ''); return parseFloat(s) || 0; }
function sumF(d, k) { return d.reduce((a, r) => a + (r[k] || 0), 0); }
function formatDateLabel(f) {
  if (!f) return '';
  let parts = f.replace(/\//g, '-').split('-');
  let d;
  if (parts.length >= 2) {
    if (parts[0].length === 4) d = new Date(+parts[0], +parts[1] - 1, 1);
    else if (parts.length === 3) d = new Date(+parts[2], +parts[1] - 1, 1);
    else d = new Date(+parts[1], +parts[0] - 1, 1);
  } else return f;
  if (isNaN(d)) return f;
  return MONTHS_ES[d.getMonth()] + ' ' + d.getFullYear();
}

function splitCSV(line) { const r = []; let c = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && i + 1 < line.length && line[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { r.push(c.trim()); c = ''; } else c += ch; } r.push(c.trim()); return r; }

function parseCSV(csv) {
  const lines = csv.trim().split('\n'); if (lines.length < 2) return [];
  let hi = 0; for (let i = 0; i < lines.length; i++) { if (lines[i].toLowerCase().match(/fecha|mes|ingres/)) { hi = i; break; } }
  const rows = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const c = splitCSV(lines[i]); if (c.length < 5 || !c[0] || !c[0].trim()) continue;
    rows.push({ fecha: c[0].replace(/"/g, '').trim(), panaderia: parseNum(c[1]), sweetHiper: parseNum(c[2]), chango: parseNum(c[3]), mayoristasExt: parseNum(c[4]), cajaChicaPan: parseNum(c[5]), cajaChicaSH: parseNum(c[6]), cajaChicaCh: parseNum(c[7]), cajaSemanal: parseNum(c[8]), obligaciones: parseNum(c[9]), mayoristasInt: parseNum(c[10]), gastosPerOblig: parseNum(c[11]), invOblig: parseNum(c[12]), gastosPerCaja: parseNum(c[13]), invCaja: parseNum(c[14]) });
  }
  return rows;
}

function parseJSONSheet(rows) {
  if (!rows || rows.length < 2) return [];
  let hi = 0;
  for (let i = 0; i < rows.length; i++) { if (String(rows[i][0]).toLowerCase().match(/fecha|mes|ingres/)) { hi = i; break; } }
  const result = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const c = rows[i].map(v => String(v));
    if (c.length < 5 || !c[0] || !c[0].trim()) continue;
    result.push({ fecha: c[0].trim(), panaderia: parseNum(c[1]), sweetHiper: parseNum(c[2]), chango: parseNum(c[3]), mayoristasExt: parseNum(c[4]), cajaChicaPan: parseNum(c[5]), cajaChicaSH: parseNum(c[6]), cajaChicaCh: parseNum(c[7]), cajaSemanal: parseNum(c[8]), obligaciones: parseNum(c[9]), mayoristasInt: parseNum(c[10]), gastosPerOblig: parseNum(c[11]), invOblig: parseNum(c[12]), gastosPerCaja: parseNum(c[13]), invCaja: parseNum(c[14]) });
  }
  return result;
}

async function fetchData() {
  if (!sheetUrl) return null;
  try { const r = await fetch(sheetUrl); if (!r.ok) throw 0; return parseJSONSheet(await r.json()); } catch (e) { console.warn('Fetch error', e); return null; }
}

async function loadData() {
  const d = await fetchData();
  if (d && d.length > 0) { dashboardData = d; setConn(true); }
  else { dashboardData = []; setConn(false); }
  populateDateFilters(); applyDateFilter();
}

function setConn(on) {
  const dot = document.querySelector('.status-dot'), txt = document.querySelector('.status-text');
  if (on) { dot.className = 'status-dot online'; txt.textContent = 'Google Sheets conectado'; }
  else { dot.className = 'status-dot offline'; txt.textContent = 'Sin conexión'; }
}

function populateDateFilters() {
  const from = document.getElementById('filterFrom'), to = document.getElementById('filterTo');
  from.innerHTML = '<option value="">Inicio</option>'; to.innerHTML = '<option value="">Fin</option>';
  dashboardData.forEach((r, i) => {
    const lbl = formatDateLabel(r.fecha);
    from.innerHTML += `<option value="${i}">${lbl}</option>`;
    to.innerHTML += `<option value="${i}">${lbl}</option>`;
  });
}

function applyDateFilter() {
  const fi = document.getElementById('filterFrom').value, ti = document.getElementById('filterTo').value;
  let start = fi === '' ? 0 : +fi, end = ti === '' ? dashboardData.length - 1 : +ti;
  if (start > end) [start, end] = [end, start];
  filteredData = dashboardData.slice(start, end + 1);
  renderAll();
}

// Init column filters
function initFilters(type, cols, containerId) {
  const c = document.getElementById(containerId); if (!c) return; c.innerHTML = '';
  activeFilters[type] = {};
  cols.forEach(col => {
    activeFilters[type][col.key] = true;
    const chip = document.createElement('button');
    chip.className = 'filter-chip active'; chip.dataset.key = col.key; chip.dataset.type = type;
    chip.style.setProperty('--chip-color', col.color);
    chip.textContent = col.label;
    chip.onclick = () => {
      activeFilters[type][col.key] = !activeFilters[type][col.key];
      chip.classList.toggle('active');
      renderViewCharts(type);
    };
    c.appendChild(chip);
  });
}

Chart.defaults.color = '#8b95a8'; Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter',sans-serif"; Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.tooltip.backgroundColor = '#1a2035'; Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1; Chart.defaults.plugins.tooltip.padding = 12; Chart.defaults.plugins.tooltip.cornerRadius = 8;

function destroyChart(k) { if (charts[k]) { charts[k].destroy(); delete charts[k]; } }
function destroyAll() { Object.keys(charts).forEach(k => destroyChart(k)); }

function getLabels() { return filteredData.map(r => formatDateLabel(r.fecha)); }
function getActiveCols(type, allCols) { return allCols.filter(c => activeFilters[type]?.[c.key] !== false); }
function sumCols(row, cols) { return cols.reduce((s, c) => s + (row[c.key] || 0), 0); }
function totalIncome(r) { return INCOME_COLS.reduce((s, c) => s + (r[c.key] || 0), 0); }
function totalExpense(r) { return EXPENSE_COLS.reduce((s, c) => s + (r[c.key] || 0), 0); }
function totalPersonal(r) { return PERSONAL_COLS.reduce((s, c) => s + (r[c.key] || 0), 0); }

function renderKPIs() {
  const ti = filteredData.reduce((s, r) => s + totalIncome(r), 0);
  const te = filteredData.reduce((s, r) => s + totalExpense(r), 0);
  const tp = filteredData.reduce((s, r) => s + totalPersonal(r), 0);
  const bal = ti - te;
  document.getElementById('kpiIngresos').textContent = fmt(ti);
  document.getElementById('kpiIngresosCount').textContent = filteredData.length + ' meses';
  document.getElementById('kpiGastos').textContent = fmt(te);
  document.getElementById('kpiGastosCount').textContent = filteredData.length + ' meses';
  document.getElementById('kpiBalance').textContent = fmt(bal);
  document.getElementById('kpiBalancePct').textContent = 'Margen: ' + (ti > 0 ? ((bal / ti) * 100).toFixed(1) : 0) + '%';
  document.getElementById('kpiPersonales').textContent = fmt(tp);
  document.getElementById('kpiPersonalesCount').textContent = filteredData.length + ' meses';
}

function renderOverviewCharts() {
  const labels = getLabels();
  destroyChart('overviewBalance'); destroyChart('overviewDonut');
  const ingArr = filteredData.map(r => totalIncome(r)), gasArr = filteredData.map(r => totalExpense(r));
  charts.overviewBalance = new Chart(document.getElementById('chartOverviewBalance'), {
    type: 'bar', data: {
      labels, datasets: [
        { label: 'Ingresos', data: ingArr, backgroundColor: '#10b981cc', borderRadius: 6, barPercentage: .6 },
        { label: 'Gastos Empresa', data: gasArr, backgroundColor: '#ef4444cc', borderRadius: 6, barPercentage: .6 }
      ]
    }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index' }, scales: { y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } }
  });

  const incTotals = INCOME_COLS.map(c => sumF(filteredData, c.key));
  charts.overviewDonut = new Chart(document.getElementById('chartOverviewDonut'), { type: 'doughnut', data: { labels: INCOME_COLS.map(c => c.label), datasets: [{ data: incTotals, backgroundColor: INCOME_COLS.map(c => c.color), borderWidth: 0, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmtFull(ctx.raw) } } } } });
}

function renderIngresosView() {
  const labels = getLabels(); const cols = getActiveCols('ingresos', INCOME_COLS);
  destroyChart('ingresosDetalle');
  const type = document.querySelector('.chart-type-btn.active[data-chart="ingresosDetalle"]')?.dataset.type || 'bar';
  charts.ingresosDetalle = new Chart(document.getElementById('chartIngresosDetalle'), {
    type, data: {
      labels, datasets: cols.map(c => ({
        label: c.label, data: filteredData.map(r => r[c.key]),
        backgroundColor: c.color + 'cc', borderColor: c.color, borderRadius: type === 'bar' ? 4 : 0,
        tension: .4, fill: type === 'line', pointRadius: type === 'line' ? 3 : 0, pointHoverRadius: 6
      }))
    }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { stacked: type === 'bar', ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { stacked: type === 'bar', grid: { display: false } } } }
  });

  const grid = document.getElementById('ingresosCards'); grid.innerHTML = '';
  const totals = INCOME_COLS.map(c => ({ ...c, total: sumF(filteredData, c.key) }));
  const mx = Math.max(...totals.map(t => t.total)) || 1;
  totals.forEach(t => { grid.innerHTML += `<div class="local-card" style="--card-color:${t.color}"><h4>${t.icon} ${t.label}</h4><div class="local-total" style="color:${t.color}">${fmtFull(t.total)}</div><div class="local-bar"><div class="local-bar-fill" style="width:${(t.total / mx * 100)}%;background:linear-gradient(90deg,${t.color},${t.color}88)"></div></div></div>`; });
}

function renderGastosView() {
  const labels = getLabels(); const cols = getActiveCols('gastos', EXPENSE_COLS);
  destroyChart('gastosDetalle'); destroyChart('gastosDonut');
  const type = document.querySelector('.chart-type-btn.active[data-chart="gastosDetalle"]')?.dataset.type || 'bar';
  charts.gastosDetalle = new Chart(document.getElementById('chartGastosDetalle'), {
    type, data: {
      labels, datasets: cols.map(c => ({
        label: c.label, data: filteredData.map(r => r[c.key]),
        backgroundColor: c.color + 'cc', borderColor: c.color, borderRadius: type === 'bar' ? 4 : 0,
        tension: .4, fill: type === 'line', pointRadius: type === 'line' ? 3 : 0, pointHoverRadius: 6
      }))
    }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { stacked: type === 'bar', ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { stacked: type === 'bar', grid: { display: false } } } }
  });

  const totals = EXPENSE_COLS.map(c => sumF(filteredData, c.key));
  charts.gastosDonut = new Chart(document.getElementById('chartGastosDonut'), { type: 'doughnut', data: { labels: EXPENSE_COLS.map(c => c.label), datasets: [{ data: totals, backgroundColor: EXPENSE_COLS.map(c => c.color), borderWidth: 0, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmtFull(ctx.raw) } } } } });

  const grid = document.getElementById('gastosSummary'); grid.innerHTML = '';
  EXPENSE_COLS.forEach(c => { grid.innerHTML += `<div class="gasto-item"><span class="gasto-label"><span class="gasto-dot" style="background:${c.color}"></span>${c.label}</span><span class="gasto-value">${fmtFull(sumF(filteredData, c.key))}</span></div>`; });
}

function renderPersonalesView() {
  const labels = getLabels(); const cols = getActiveCols('personales', PERSONAL_COLS);
  destroyChart('personalesDetalle'); destroyChart('personalesDonut');
  const type = document.querySelector('.chart-type-btn.active[data-chart="personalesDetalle"]')?.dataset.type || 'bar';
  charts.personalesDetalle = new Chart(document.getElementById('chartPersonalesDetalle'), {
    type, data: {
      labels, datasets: cols.map(c => ({
        label: c.label, data: filteredData.map(r => r[c.key]),
        backgroundColor: c.color + 'cc', borderColor: c.color, borderRadius: type === 'bar' ? 4 : 0,
        tension: .4, fill: type === 'line', pointRadius: type === 'line' ? 3 : 0, pointHoverRadius: 6
      }))
    }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { stacked: type === 'bar', ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { stacked: type === 'bar', grid: { display: false } } } }
  });

  const totals = PERSONAL_COLS.map(c => sumF(filteredData, c.key));
  charts.personalesDonut = new Chart(document.getElementById('chartPersonalesDonut'), { type: 'doughnut', data: { labels: PERSONAL_COLS.map(c => c.label), datasets: [{ data: totals, backgroundColor: PERSONAL_COLS.map(c => c.color), borderWidth: 0, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { tooltip: { callbacks: { label: ctx => ctx.label + ': ' + fmtFull(ctx.raw) } } } } });

  const grid = document.getElementById('personalesSummary'); grid.innerHTML = '';
  PERSONAL_COLS.forEach(c => { grid.innerHTML += `<div class="gasto-item gasto-personal"><span class="gasto-label"><span class="gasto-dot" style="background:${c.color}"></span>${c.label}</span><span class="gasto-value gasto-value-yellow">${fmtFull(sumF(filteredData, c.key))}</span></div>`; });
}

function renderComparativoView() {
  const labels = getLabels();
  destroyChart('comparativo'); destroyChart('balanceNeto');
  const ingArr = filteredData.map(r => totalIncome(r)), gasArr = filteredData.map(r => totalExpense(r)), balArr = filteredData.map(r => totalIncome(r) - totalExpense(r));

  charts.comparativo = new Chart(document.getElementById('chartComparativo'), {
    type: 'bar', data: {
      labels, datasets: [
        { label: 'Ingresos', data: ingArr, backgroundColor: '#10b981cc', borderRadius: 6, barPercentage: .35, categoryPercentage: .8 },
        { label: 'Gastos Empresa', data: gasArr, backgroundColor: '#ef4444cc', borderRadius: 6, barPercentage: .35, categoryPercentage: .8 }
      ]
    }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index' }, plugins: { tooltip: { callbacks: { afterBody: items => { const i = items[0].dataIndex; return 'Balance: ' + fmtFull(balArr[i]); } } } }, scales: { y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } }
  });

  charts.balanceNeto = new Chart(document.getElementById('chartBalanceNeto'), { type: 'bar', data: { labels, datasets: [{ label: 'Balance Neto', data: balArr, backgroundColor: balArr.map(v => v >= 0 ? '#10b981cc' : '#ef4444cc'), borderRadius: 6, barPercentage: .6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } } });

  const ti = ingArr.reduce((a, v) => a + v, 0), te = gasArr.reduce((a, v) => a + v, 0), bal = ti - te, mx = Math.max(ti, te) || 1;
  document.getElementById('compIngresos').textContent = fmtFull(ti);
  document.getElementById('compGastos').textContent = fmtFull(te);
  document.getElementById('compBalance').textContent = fmtFull(bal);
  document.getElementById('compBalance').style.color = bal >= 0 ? '#10b981' : '#ef4444';
  document.getElementById('compMargin').textContent = (ti > 0 ? ((bal / ti) * 100).toFixed(1) : 0) + '%';
  document.getElementById('compBarIng').style.width = (ti / mx * 100) + '%';
  document.getElementById('compBarGas').style.width = (te / mx * 100) + '%';
}

function renderPerformers() {
  let bi = 0, bv = 0; filteredData.forEach((r, i) => { const t = totalIncome(r); if (t > bv) { bv = t; bi = i; } });
  document.getElementById('bestMonth').textContent = fmt(bv);
  document.getElementById('bestMonthDetail').textContent = formatDateLabel(filteredData[bi]?.fecha) || '—';
  const tots = INCOME_COLS.map(c => ({ label: c.label, total: sumF(filteredData, c.key) })).sort((a, b) => b.total - a.total);
  document.getElementById('bestSource').textContent = tots[0]?.label || '—';
  document.getElementById('bestSourceDetail').textContent = fmtFull(tots[0]?.total || 0);
  const last = filteredData[filteredData.length - 1];
  document.getElementById('lastRecord').textContent = formatDateLabel(last?.fecha) || '—';
  document.getElementById('lastRecordDetail').textContent = 'Total: ' + fmt(last ? totalIncome(last) : 0);
}

function renderTable(filter = '') {
  const allCols = [{ key: 'fecha', label: 'Mes y Año' }, ...INCOME_COLS, ...EXPENSE_COLS, ...PERSONAL_COLS];
  document.getElementById('tableHead').innerHTML = allCols.map(c => `<th>${c.label}</th>`).join('');
  const data = filter ? filteredData.filter(r => formatDateLabel(r.fecha).toLowerCase().includes(filter.toLowerCase())) : filteredData;
  document.getElementById('tableBody').innerHTML = data.map(r => '<tr>' + allCols.map(c => c.key === 'fecha' ? `<td>${formatDateLabel(r.fecha)}</td>` : `<td>${fmtFull(r[c.key])}</td>`).join('') + '</tr>').join('');
}

function renderViewCharts(type) {
  if (type === 'ingresos') renderIngresosView();
  else if (type === 'gastos') renderGastosView();
  else if (type === 'personales') renderPersonalesView();
}

function renderAll() {
  destroyAll(); renderKPIs(); renderOverviewCharts(); renderPerformers();
  renderIngresosView(); renderGastosView(); renderPersonalesView(); renderComparativoView(); renderTable();
}

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const map = { overview: 'viewOverview', ingresos: 'viewIngresos', gastos: 'viewGastos', personales: 'viewPersonales', comparativo: 'viewComparativo', tabla: 'viewTabla' };
  const titles = { overview: 'Resumen General', ingresos: 'Ingresos', gastos: 'Gastos Empresa', personales: 'Gastos Personales', comparativo: 'Comparativo', tabla: 'Tabla Detallada' };
  document.getElementById(map[v]).classList.add('active');
  document.querySelector(`[data-view="${v}"]`).classList.add('active');
  document.getElementById('viewTitle').textContent = titles[v];
  document.getElementById('sidebar').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.querySelectorAll('.nav-item').forEach(i => i.addEventListener('click', e => { e.preventDefault(); switchView(i.dataset.view); }));
  document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('sidebarClose').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));
  document.getElementById('tableSearch').addEventListener('input', e => renderTable(e.target.value));
  document.getElementById('filterFrom').addEventListener('change', applyDateFilter);
  document.getElementById('filterTo').addEventListener('change', applyDateFilter);
  document.getElementById('btnResetDates').addEventListener('click', () => { document.getElementById('filterFrom').value = ''; document.getElementById('filterTo').value = ''; applyDateFilter(); });
  document.getElementById('btnRefresh').addEventListener('click', () => { document.getElementById('btnRefresh').classList.add('spinning'); loadData().then(() => setTimeout(() => document.getElementById('btnRefresh').classList.remove('spinning'), 500)); });

  // Chart type toggles
  document.querySelectorAll('.chart-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const chart = btn.dataset.chart;
      document.querySelectorAll(`.chart-type-btn[data-chart="${chart}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (chart === 'ingresosDetalle') renderIngresosView();
      else if (chart === 'gastosDetalle') renderGastosView();
      else if (chart === 'personalesDetalle') renderPersonalesView();
    });
  });

  // Init column filter chips
  initFilters('ingresos', INCOME_COLS, 'ingresosChips');
  initFilters('gastos', EXPENSE_COLS, 'gastosChips');
  initFilters('personales', PERSONAL_COLS, 'personalesChips');

  // Config modal
  document.getElementById('connectionStatus').addEventListener('click', () => { document.getElementById('sheetUrl').value = sheetUrl; document.getElementById('configModal').classList.add('active'); });
  document.getElementById('btnCloseModal').addEventListener('click', () => document.getElementById('configModal').classList.remove('active'));
  document.getElementById('btnConnect').addEventListener('click', () => { sheetUrl = document.getElementById('sheetUrl').value.trim(); if (sheetUrl) localStorage.setItem('sweetSAS_sheetUrl', sheetUrl); document.getElementById('configModal').classList.remove('active'); loadData(); });

  loadData().then(() => setTimeout(() => document.getElementById('loadingOverlay').classList.add('hidden'), 600));
  setInterval(() => loadData(), 300000);
});