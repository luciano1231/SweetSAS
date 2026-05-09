/* ============================================
   Sweet SAS — Dashboard JS
   ============================================ */

// ---- Sample Data (based on the Google Sheet screenshot) ----
const SAMPLE_DATA = [
    { fecha: '1/5/2026', panaderia: 5494290, sweetHiper: 7336165, chango: 2748900, mayoristas: 346829, cajaChicaPan: 0, cajaChicaSH: 66500, cajaChicaCh: 0, cajaSemanal: 4615300, obligaciones: 0, remitos: 0, gastosPerOblig: 0, invOblig: 0, gastosPerCaja: 0, invCaja: 0 },
    { fecha: '1/4/2026', panaderia: 6309488, sweetHiper: 14735670, chango: 7623600, mayoristas: 3938140, cajaChicaPan: 0, cajaChicaSH: 510600, cajaChicaCh: 5864790, cajaSemanal: 12753310, obligaciones: 15210950, remitos: 2628, gastosPerOblig: 2226590, invOblig: 0, gastosPerCaja: 0, invCaja: 0 },
    { fecha: '1/3/2024', panaderia: 7802960, sweetHiper: 17339070, chango: 7972244, mayoristas: 6753732, cajaChicaPan: 0, cajaChicaSH: 12113450, cajaChicaCh: 4992750, cajaSemanal: 14455390, obligaciones: 15367620, remitos: 3390, gastosPerOblig: 246590, invOblig: 0, gastosPerCaja: 0, invCaja: 0 },
    { fecha: '1/2/2024', panaderia: 8004649, sweetHiper: 21703278, chango: 10113555, mayoristas: 6235448, cajaChicaPan: 0, cajaChicaSH: 19991600, cajaChicaCh: 6314410, cajaSemanal: 23049950, obligaciones: 16681739, remitos: 2628, gastosPerOblig: 338377, invOblig: 0, gastosPerCaja: 0, invCaja: 0 },
    { fecha: '1/1/2024', panaderia: 10128768, sweetHiper: 25914804, chango: 11867469, mayoristas: 8585484, cajaChicaPan: 0, cajaChicaSH: 16435830, cajaChicaCh: 6786100, cajaSemanal: 27415312, obligaciones: 23242472, remitos: 43581, gastosPerOblig: 832430, invOblig: 0, gastosPerCaja: 82000, invCaja: 0 },
    { fecha: '1/8/2024', panaderia: 11509969, sweetHiper: 25603200, chango: 11879495, mayoristas: 8867181, cajaChicaPan: 0, cajaChicaSH: 13190450, cajaChicaCh: 5677650, cajaSemanal: 21989101, obligaciones: 37600396, remitos: 7008, gastosPerOblig: 159699, invOblig: 2385008, gastosPerCaja: 0, invCaja: 0 },
    { fecha: '1/9/2024', panaderia: 10925571, sweetHiper: 22424850, chango: 11641610, mayoristas: 8458070, cajaChicaPan: 0, cajaChicaSH: 12032600, cajaChicaCh: 4517980, cajaSemanal: 16031297, obligaciones: 56879824, remitos: 135551, gastosPerOblig: 4004560, invOblig: 336934, gastosPerCaja: 0, invCaja: 0 },
    { fecha: '1/10/2024', panaderia: 12121800, sweetHiper: 24572620, chango: 11869480, mayoristas: 9928608, cajaChicaPan: 0, cajaChicaSH: 13766390, cajaChicaCh: 8978880, cajaSemanal: 14424730, obligaciones: 54793368, remitos: 248790, gastosPerOblig: 1033312, invOblig: 239038, gastosPerCaja: 50000, invCaja: 0 },
    { fecha: '1/11/2024', panaderia: 11496918, sweetHiper: 26261225, chango: 14063945, mayoristas: 45894394, cajaChicaPan: 0, cajaChicaSH: 14071136, cajaChicaCh: 5035843, cajaSemanal: 16468468, obligaciones: 51821115, remitos: 4243791, gastosPerOblig: 288199, invOblig: 208670, gastosPerCaja: 0, invCaja: 0 },
    { fecha: '1/12/2024', panaderia: 11326195, sweetHiper: 33343265, chango: 17383975, mayoristas: 19459852, cajaChicaPan: 0, cajaChicaSH: 8783094, cajaChicaCh: 2663321, cajaSemanal: 21128670, obligaciones: 37978456, remitos: 42076, gastosPerOblig: 111029, invOblig: 0, gastosPerCaja: 0, invCaja: 0 },
];

// ---- State ----
let dashboardData = [];
let charts = {};
let currentView = 'overview';
// Direct connection to Google Sheet "Nuevo Balance" tab
const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Z07Z72qZIcMFg2hlZ71S7F7FQqxNbjBfZ3ltQ9vl81U/pub?gid=2069063828&single=true&output=csv';
let sheetUrl = localStorage.getItem('sweetSAS_sheetUrl') || DEFAULT_SHEET_URL;
let autoRefreshInterval = null;
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

// ---- Helpers ----
function formatMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toLocaleString('es-AR');
}

function formatMoneyFull(n) {
    if (n == null || isNaN(n)) return '$0';
    return '$' + n.toLocaleString('es-AR');
}

function parseNum(str) {
    if (!str) return 0;
    let s = String(str).trim();
    // Remove currency symbols, spaces, quotes
    s = s.replace(/["'$\s]/g, '');
    if (s === '' || s === '-') return 0;
    // Google Sheets CSV: numbers may use dots as thousands sep and comma as decimal
    // Or they may be plain numbers. Detect format:
    // If has both dots and commas, dots are thousands, comma is decimal
    if (s.includes('.') && s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    // If only commas and looks like thousands separator (groups of 3)
    else if (s.includes(',') && /,\d{3}/.test(s) && !/,\d{1,2}$/.test(s)) {
        s = s.replace(/,/g, '');
    }
    // If only comma and looks like decimal
    else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    // If only dots and looks like thousands separator
    else if (s.includes('.') && /\.\d{3}/.test(s) && (s.match(/\./g) || []).length > 1) {
        s = s.replace(/\./g, '');
    }
    return parseFloat(s) || 0;
}

function sumField(data, field) {
    return data.reduce((s, r) => s + (r[field] || 0), 0);
}

// ---- CSV Parser (handles Google Sheets quoted fields) ----
function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"'; i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Find header row (skip empty rows)
    let headerIdx = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('fecha') || line.includes('ingres')) {
            headerIdx = i;
            break;
        }
    }
    
    const rows = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
        const cols = splitCSVLine(lines[i]);
        if (cols.length < 5) continue;
        // Skip empty rows
        if (!cols[0] || cols[0].trim() === '') continue;
        
        rows.push({
            fecha: cols[0]?.replace(/"/g, '').trim() || '',
            panaderia: parseNum(cols[1]),
            sweetHiper: parseNum(cols[2]),
            chango: parseNum(cols[3]),
            mayoristas: parseNum(cols[4]),
            cajaChicaPan: parseNum(cols[5]),
            cajaChicaSH: parseNum(cols[6]),
            cajaChicaCh: parseNum(cols[7]),
            cajaSemanal: parseNum(cols[8]),
            obligaciones: parseNum(cols[9]),
            remitos: parseNum(cols[10]),
            gastosPerOblig: parseNum(cols[11]),
            invOblig: parseNum(cols[12]),
            gastosPerCaja: parseNum(cols[13]),
            invCaja: parseNum(cols[14]),
        });
    }
    return rows;
}

// ---- Data Fetching ----
async function fetchSheetData() {
    if (!sheetUrl) return null;
    try {
        const res = await fetch(sheetUrl);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const csv = await res.text();
        return parseCSV(csv);
    } catch (e) {
        console.warn('Error fetching sheet:', e);
        return null;
    }
}

async function loadData() {
    const liveData = await fetchSheetData();
    if (liveData && liveData.length > 0) {
        dashboardData = liveData;
        setConnectionStatus(true);
    } else {
        dashboardData = SAMPLE_DATA;
        setConnectionStatus(false);
    }
    renderAll();
}

function setConnectionStatus(online) {
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-text');
    if (online) {
        dot.className = 'status-dot online';
        text.textContent = 'Google Sheets conectado';
    } else {
        dot.className = 'status-dot offline';
        text.textContent = 'Datos de ejemplo';
    }
}

// ---- Chart Theme ----
const chartColors = {
    blue: '#3b82f6', purple: '#8b5cf6', green: '#10b981',
    amber: '#f59e0b', red: '#ef4444', cyan: '#06b6d4', pink: '#ec4899',
};

Chart.defaults.color = '#8b95a8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;
Chart.defaults.plugins.tooltip.backgroundColor = '#1a2035';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;

// ---- Render KPIs ----
function renderKPIs() {
    const totalIngresos = sumField(dashboardData, 'panaderia') + sumField(dashboardData, 'sweetHiper') +
        sumField(dashboardData, 'chango') + sumField(dashboardData, 'mayoristas');
    const totalGastos = sumField(dashboardData, 'cajaChicaPan') + sumField(dashboardData, 'cajaChicaSH') +
        sumField(dashboardData, 'cajaChicaCh') + sumField(dashboardData, 'obligaciones') +
        sumField(dashboardData, 'remitos') + sumField(dashboardData, 'gastosPerOblig') +
        sumField(dashboardData, 'invOblig') + sumField(dashboardData, 'gastosPerCaja') + sumField(dashboardData, 'invCaja');
    const balance = totalIngresos - totalGastos;
    const totalCaja = sumField(dashboardData, 'cajaSemanal');
    const promCaja = dashboardData.length ? totalCaja / dashboardData.length : 0;

    document.getElementById('kpiIngresos').textContent = formatMoney(totalIngresos);
    document.getElementById('kpiIngresosCount').textContent = dashboardData.length + ' registros';
    document.getElementById('kpiGastos').textContent = formatMoney(totalGastos);
    document.getElementById('kpiGastosCount').textContent = dashboardData.length + ' registros';
    document.getElementById('kpiBalance').textContent = formatMoney(balance);
    const pct = totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(1) : 0;
    document.getElementById('kpiBalancePct').textContent = 'Margen: ' + pct + '%';
    document.getElementById('kpiCaja').textContent = formatMoney(totalCaja);
    document.getElementById('kpiCajaProm').textContent = 'Promedio: ' + formatMoney(promCaja);
}

// ---- Render Charts ----
function destroyCharts() {
    Object.values(charts).forEach(c => c.destroy());
    charts = {};
}

function renderCharts() {
    destroyCharts();
    const labels = dashboardData.map(r => r.fecha);

    // Line chart — Ingresos por local
    charts.ingresos = new Chart(document.getElementById('chartIngresos'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Panadería', data: dashboardData.map(r => r.panaderia), borderColor: chartColors.blue, backgroundColor: chartColors.blue + '20', tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 6 },
                { label: 'Sweet Hiper', data: dashboardData.map(r => r.sweetHiper), borderColor: chartColors.purple, backgroundColor: chartColors.purple + '20', tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 6 },
                { label: 'Chango', data: dashboardData.map(r => r.chango), borderColor: chartColors.green, backgroundColor: chartColors.green + '20', tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 6 },
                { label: 'Mayoristas', data: dashboardData.map(r => r.mayoristas), borderColor: chartColors.amber, backgroundColor: chartColors.amber + '20', tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 6 },
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: { y: { ticks: { callback: v => formatMoney(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } }
    });

    // Donut — Distribution
    const totalPan = sumField(dashboardData, 'panaderia');
    const totalSH = sumField(dashboardData, 'sweetHiper');
    const totalCh = sumField(dashboardData, 'chango');
    const totalMay = sumField(dashboardData, 'mayoristas');

    charts.distribucion = new Chart(document.getElementById('chartDistribucion'), {
        type: 'doughnut',
        data: {
            labels: ['Panadería', 'Sweet Hiper', 'Chango', 'Mayoristas'],
            datasets: [{ data: [totalPan, totalSH, totalCh, totalMay], backgroundColor: [chartColors.blue, chartColors.purple, chartColors.green, chartColors.amber], borderWidth: 0, hoverOffset: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%',
            plugins: { tooltip: { callbacks: { label: ctx => ctx.label + ': ' + formatMoneyFull(ctx.raw) } } } }
    });

    // Donut — Gastos
    const gLabels = ['Caja Panadería', 'Caja Sweet Hiper', 'Caja Chango', 'Obligaciones', 'Remitos', 'Gastos Pers.', 'Inversiones'];
    const gData = [sumField(dashboardData, 'cajaChicaPan'), sumField(dashboardData, 'cajaChicaSH'), sumField(dashboardData, 'cajaChicaCh'),
        sumField(dashboardData, 'obligaciones'), sumField(dashboardData, 'remitos'),
        sumField(dashboardData, 'gastosPerOblig') + sumField(dashboardData, 'gastosPerCaja'),
        sumField(dashboardData, 'invOblig') + sumField(dashboardData, 'invCaja')];

    charts.gastos = new Chart(document.getElementById('chartGastos'), {
        type: 'doughnut',
        data: { labels: gLabels, datasets: [{ data: gData, backgroundColor: [chartColors.blue, chartColors.purple, chartColors.green, chartColors.red, chartColors.cyan, chartColors.pink, chartColors.amber], borderWidth: 0, hoverOffset: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%',
            plugins: { tooltip: { callbacks: { label: ctx => ctx.label + ': ' + formatMoneyFull(ctx.raw) } } } }
    });

    // Bar — Balance
    const ingresosArr = dashboardData.map(r => r.panaderia + r.sweetHiper + r.chango + r.mayoristas);
    const gastosArr = dashboardData.map(r => r.cajaChicaPan + r.cajaChicaSH + r.cajaChicaCh + r.obligaciones + r.remitos + r.gastosPerOblig + r.invOblig + r.gastosPerCaja + r.invCaja);

    charts.balance = new Chart(document.getElementById('chartBalance'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: ingresosArr, backgroundColor: chartColors.green + 'cc', borderRadius: 6, barPercentage: 0.6 },
                { label: 'Gastos', data: gastosArr, backgroundColor: chartColors.red + 'cc', borderRadius: 6, barPercentage: 0.6 },
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index' },
            scales: { y: { ticks: { callback: v => formatMoney(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }, x: { grid: { display: false } } } }
    });

    // Detail charts
    charts.ingresosDetalle = new Chart(document.getElementById('chartIngresosDetalle'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Panadería', data: dashboardData.map(r => r.panaderia), backgroundColor: chartColors.blue + 'cc', borderRadius: 4 },
                { label: 'Sweet Hiper', data: dashboardData.map(r => r.sweetHiper), backgroundColor: chartColors.purple + 'cc', borderRadius: 4 },
                { label: 'Chango', data: dashboardData.map(r => r.chango), backgroundColor: chartColors.green + 'cc', borderRadius: 4 },
                { label: 'Mayoristas', data: dashboardData.map(r => r.mayoristas), backgroundColor: chartColors.amber + 'cc', borderRadius: 4 },
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { stacked: true, ticks: { callback: v => formatMoney(v) } }, x: { stacked: true, grid: { display: false } } } }
    });

    charts.gastosDetalle = new Chart(document.getElementById('chartGastosDetalle'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Caja Chica SH', data: dashboardData.map(r => r.cajaChicaSH), backgroundColor: chartColors.purple + 'cc', borderRadius: 4 },
                { label: 'Caja Chica Chango', data: dashboardData.map(r => r.cajaChicaCh), backgroundColor: chartColors.green + 'cc', borderRadius: 4 },
                { label: 'Obligaciones', data: dashboardData.map(r => r.obligaciones), backgroundColor: chartColors.red + 'cc', borderRadius: 4 },
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { stacked: true, ticks: { callback: v => formatMoney(v) } }, x: { stacked: true, grid: { display: false } } } }
    });
}

// ---- Render Performers ----
function renderPerformers() {
    let bestIdx = 0, bestVal = 0;
    dashboardData.forEach((r, i) => {
        const total = r.panaderia + r.sweetHiper + r.chango + r.mayoristas;
        if (total > bestVal) { bestVal = total; bestIdx = i; }
    });
    document.getElementById('bestWeek').textContent = formatMoney(bestVal);
    document.getElementById('bestWeekDetail').textContent = dashboardData[bestIdx]?.fecha || '—';

    const totals = { 'Panadería': sumField(dashboardData, 'panaderia'), 'Sweet Hiper': sumField(dashboardData, 'sweetHiper'), 'Chango': sumField(dashboardData, 'chango'), 'Mayoristas': sumField(dashboardData, 'mayoristas') };
    const best = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('bestLocal').textContent = best[0];
    document.getElementById('bestLocalDetail').textContent = formatMoneyFull(best[1]);

    const last = dashboardData[dashboardData.length - 1];
    document.getElementById('lastRecord').textContent = last?.fecha || '—';
    const lastTotal = last ? last.panaderia + last.sweetHiper + last.chango + last.mayoristas : 0;
    document.getElementById('lastRecordDetail').textContent = 'Total: ' + formatMoney(lastTotal);
}

// ---- Render Locals Detail ----
function renderLocals() {
    const pan = sumField(dashboardData, 'panaderia');
    const sh = sumField(dashboardData, 'sweetHiper');
    const ch = sumField(dashboardData, 'chango');
    const may = sumField(dashboardData, 'mayoristas');
    const max = Math.max(pan, sh, ch, may) || 1;

    document.getElementById('totalPanaderia').textContent = formatMoneyFull(pan);
    document.getElementById('totalSweetHiper').textContent = formatMoneyFull(sh);
    document.getElementById('totalChango').textContent = formatMoneyFull(ch);
    document.getElementById('totalMayoristas').textContent = formatMoneyFull(may);

    setTimeout(() => {
        document.getElementById('barPanaderia').style.width = (pan / max * 100) + '%';
        document.getElementById('barSweetHiper').style.width = (sh / max * 100) + '%';
        document.getElementById('barChango').style.width = (ch / max * 100) + '%';
        document.getElementById('barMayoristas').style.width = (may / max * 100) + '%';
    }, 300);
}

// ---- Render Gastos Detail ----
function renderGastosDetail() {
    document.getElementById('gastoCajaPanaderia').textContent = formatMoneyFull(sumField(dashboardData, 'cajaChicaPan'));
    document.getElementById('gastoCajaSweetHiper').textContent = formatMoneyFull(sumField(dashboardData, 'cajaChicaSH'));
    document.getElementById('gastoCajaChango').textContent = formatMoneyFull(sumField(dashboardData, 'cajaChicaCh'));
    document.getElementById('gastoObligaciones').textContent = formatMoneyFull(sumField(dashboardData, 'obligaciones'));
    document.getElementById('gastoRemitos').textContent = formatMoneyFull(sumField(dashboardData, 'remitos'));
    document.getElementById('gastoPersonalesOblig').textContent = formatMoneyFull(sumField(dashboardData, 'gastosPerOblig'));
    document.getElementById('gastoInvOblig').textContent = formatMoneyFull(sumField(dashboardData, 'invOblig'));
    document.getElementById('gastoPersonalesCaja').textContent = formatMoneyFull(sumField(dashboardData, 'gastosPerCaja'));
    document.getElementById('gastoInvCaja').textContent = formatMoneyFull(sumField(dashboardData, 'invCaja'));
}

// ---- Render Table ----
function renderTable(filter = '') {
    const tbody = document.getElementById('tableBody');
    const filtered = filter ? dashboardData.filter(r => r.fecha.toLowerCase().includes(filter.toLowerCase())) : dashboardData;
    tbody.innerHTML = filtered.map(r => `<tr>
        <td>${r.fecha}</td><td>${formatMoneyFull(r.panaderia)}</td><td>${formatMoneyFull(r.sweetHiper)}</td>
        <td>${formatMoneyFull(r.chango)}</td><td>${formatMoneyFull(r.mayoristas)}</td>
        <td>${formatMoneyFull(r.cajaSemanal)}</td><td>${formatMoneyFull(r.obligaciones)}</td>
    </tr>`).join('');
}

// ---- Render All ----
function renderAll() {
    renderKPIs();
    renderCharts();
    renderPerformers();
    renderLocals();
    renderGastosDetail();
    renderTable();
}

// ---- Navigation ----
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const viewMap = { overview: 'viewOverview', ingresos: 'viewIngresos', gastos: 'viewGastos', tabla: 'viewTabla' };
    const titleMap = { overview: 'Resumen General', ingresos: 'Ingresos por Local', gastos: 'Gastos & Obligaciones', tabla: 'Tabla Detallada' };

    document.getElementById(viewMap[view]).classList.add('active');
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    document.getElementById('viewTitle').textContent = titleMap[view];

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    // Date display
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => { e.preventDefault(); switchView(item.dataset.view); });
    });

    // Mobile sidebar
    document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('sidebarClose').addEventListener('click', () => document.getElementById('sidebar').classList.remove('open'));

    // Table search
    document.getElementById('tableSearch').addEventListener('input', e => renderTable(e.target.value));

    // Refresh button
    document.getElementById('btnRefresh').addEventListener('click', () => {
        document.getElementById('btnRefresh').classList.add('spinning');
        loadData().then(() => {
            setTimeout(() => document.getElementById('btnRefresh').classList.remove('spinning'), 500);
        });
    });

    // Config modal
    document.getElementById('connectionStatus').addEventListener('click', () => {
        document.getElementById('sheetUrl').value = sheetUrl;
        document.getElementById('configModal').classList.add('active');
    });
    document.getElementById('btnCloseModal').addEventListener('click', () => document.getElementById('configModal').classList.remove('active'));
    document.getElementById('btnConnect').addEventListener('click', () => {
        sheetUrl = document.getElementById('sheetUrl').value.trim();
        if (sheetUrl) {
            localStorage.setItem('sweetSAS_sheetUrl', sheetUrl);
        }
        document.getElementById('configModal').classList.remove('active');
        loadData();
    });

    // Load data & start auto-refresh
    loadData().then(() => {
        setTimeout(() => document.getElementById('loadingOverlay').classList.add('hidden'), 600);
    });

    // Auto-refresh every 5 minutes
    autoRefreshInterval = setInterval(() => {
        console.log('[Dashboard] Auto-refreshing data...');
        loadData();
    }, AUTO_REFRESH_MS);
});

