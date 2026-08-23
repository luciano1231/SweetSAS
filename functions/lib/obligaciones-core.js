/**
 * OBLIGACIONES — motor de lectura y clasificación (compartido)
 * ================================================================
 * Puerto a Cloudflare Workers del clasificador que antes vivía en Google
 * Apps Script (Galicia CSV + Mercado Pago Excel → planilla Obligaciones,
 * con aprendizaje). La lógica de extracción por banco es la misma
 * (mismas columnas, mismos umbrales) — lo que cambia es de dónde vienen
 * los datos: acá el archivo lo sube el cliente desde el navegador en vez
 * de dejarlo en una carpeta de Drive.
 */

import * as XLSX from 'xlsx';

// Ítems que se agrupan y suman en un solo movimiento por resumen
export const ITEMS_A_AGRUPAR = [
  'Imp. Cre. Ley 25413',
  'Anulac. Acred. Firstdata. Comercios',
  'Iva',
  'Percep. Iva',
  'Imp. Deb. Ley 25413 Gral.',
  'Pago de impuestos',
];

// ============================================
// DETECCIÓN DE FORMATO
// ============================================
export function tipoDeArchivo(nombre, mimeType) {
  const n = (nombre || '').toLowerCase();
  const esCSV = n.endsWith('.csv') || mimeType === 'text/csv';
  const esExcel =
    n.endsWith('.xlsx') || n.endsWith('.xls') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel';
  if (esCSV) return 'csv';
  if (esExcel) return 'excel';
  return null;
}

// ============================================
// LECTURA DE ARCHIVO → ARRAY (igual forma que getDataRange().getValues())
// ============================================
export function decodificarTexto(buffer) {
  let texto = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  // Los resúmenes de bancos argentinos suelen venir en Latin-1/Windows-1252.
  // Si el UTF-8 dejó caracteres de reemplazo, reintentamos con esa codificación.
  if (texto.includes('�')) {
    texto = new TextDecoder('windows-1252').decode(buffer);
  }
  return texto;
}

export function parseCSVTexto(texto, delimitador = ';') {
  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else entreComillas = false;
      } else {
        campo += c;
      }
      continue;
    }
    if (c === '"') { entreComillas = true; }
    else if (c === delimitador) { fila.push(campo); campo = ''; }
    else if (c === '\r') { /* ignorar, se maneja en \n */ }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas;
}

export function leerExcelComoArray(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  let hojaElegida = null;
  let maxFilas = 0;

  wb.SheetNames.forEach(nombre => {
    const sheet = wb.Sheets[nombre];
    if (!sheet['!ref']) return;
    const rango = XLSX.utils.decode_range(sheet['!ref']);
    const filas = rango.e.r - rango.s.r + 1;
    if (filas > maxFilas) { maxFilas = filas; hojaElegida = sheet; }
  });

  if (!hojaElegida) return [];
  return XLSX.utils.sheet_to_json(hojaElegida, { header: 1, raw: true, defval: '' });
}

export function leerArchivoComoArray(buffer, tipo) {
  if (tipo === 'csv') return parseCSVTexto(decodificarTexto(buffer), ';');
  if (tipo === 'excel') return leerExcelComoArray(buffer);
  return [];
}

// ============================================
// EXTRACCIÓN DE FILAS — BANCO GALICIA
// ============================================
export function extraerFilasGalicia(datos) {
  const filas = [];
  if (!datos || datos.length === 0) return filas;

  let inicioDatos = 0;
  for (let i = 0; i < datos.length; i++) {
    const celdaA = String(datos[i][0] || '').toLowerCase();
    const celdaB = String(datos[i][1] || '').toLowerCase();
    if (celdaA.includes('fecha') || celdaB.includes('descripci')) {
      inicioDatos = i + 1;
      break;
    }
  }

  let ultimaFechaValida = new Date();

  for (let i = inicioDatos; i < datos.length; i++) {
    const fila = datos[i];
    if (!fila || fila.length < 4) continue;

    const debito = parseNumero(fila[3]);
    if (debito <= 0) continue;

    const descripcionB = limpiar(fila[1]);
    const leyendaH = fila[7] ? limpiar(fila[7]) : '';
    const leyendaI = fila[8] ? limpiar(fila[8]) : '';
    const leyendaJ = fila[9] ? limpiar(fila[9]) : '';
    const leyendaK = fila[10] ? limpiar(fila[10]) : '';

    if (!descripcionB && !leyendaH && !leyendaK) continue;

    let fecha = parseFecha(fila[0]);
    if (!fecha || isNaN(fecha.getTime())) fecha = ultimaFechaValida;
    else ultimaFechaValida = fecha;

    const observacion = leyendaK ? `${descripcionB} | ${leyendaK}` : descripcionB;

    filas.push({
      fecha, descripcion: descripcionB, descripcionB,
      leyendaH, leyendaI, leyendaJ, leyendaK,
      monto: debito, observacion,
    });
  }

  return filas;
}

// ============================================
// EXTRACCIÓN DE FILAS — MERCADO PAGO
// ============================================
export function extraerFilasMercadoPago(datos) {
  const filas = [];
  if (!datos || datos.length === 0) return filas;

  let ultimaFechaValida = new Date();

  for (let i = 4; i < datos.length; i++) {
    const fila = datos[i];
    if (!fila || fila.length < 4) continue;

    const montoStr = String(fila[3] || '0').replace(/\./g, '').replace(',', '.');
    const monto = parseFloat(montoStr) || 0;
    if (monto >= 0) continue;

    const descripcion = limpiar(fila[1]);
    if (!descripcion) continue;

    let fecha = parseFecha(fila[0]);
    if (!fecha || isNaN(fecha.getTime())) fecha = ultimaFechaValida;
    else ultimaFechaValida = fecha;

    const leyendaH = fila[7] ? limpiar(fila[7]) : '';
    const leyendaI = fila[8] ? limpiar(fila[8]) : '';
    const leyendaJ = fila[9] ? limpiar(fila[9]) : '';
    const leyendaK = fila[10] ? limpiar(fila[10]) : '';

    filas.push({
      fecha, descripcion, descripcionB: descripcion,
      leyendaH, leyendaI, leyendaJ, leyendaK,
      monto: Math.abs(monto), observacion: descripcion,
    });
  }

  return filas;
}

// ============================================
// AGRUPAR ÍTEMS CONSOLIDABLES
// ============================================
export function agruparItems(filas) {
  const grupos = {};
  const normales = [];

  filas.forEach(fila => {
    const conceptoEncontrado = ITEMS_A_AGRUPAR.find(item =>
      fila.descripcion.toUpperCase().includes(item.toUpperCase())
    );

    if (conceptoEncontrado) {
      const clave = conceptoEncontrado.toUpperCase();
      if (!grupos[clave]) {
        grupos[clave] = {
          ...fila,
          descripcion: conceptoEncontrado,
          descripcionB: conceptoEncontrado,
          observacion: conceptoEncontrado,
          monto: 0,
        };
      }
      grupos[clave].monto += fila.monto;
      grupos[clave].fecha = fila.fecha;
    } else {
      normales.push(fila);
    }
  });

  return [...normales, ...Object.values(grupos)];
}

// ============================================
// CLASIFICACIÓN
// ============================================
export function buscarCategoria(texto, referencias) {
  if (!texto) return null;
  const upper = texto.toUpperCase();
  if (referencias[upper]) return referencias[upper];
  for (const clave in referencias) {
    if (upper.includes(clave)) return referencias[clave];
  }
  return null;
}

export function clasificarFilas(filas, referencias, aprendizaje) {
  return filas.map(fila => {
    let categoria = buscarCategoria(fila.descripcionB, referencias);

    if (!categoria || categoria === 'SIN CLASIFICAR' || categoria.toUpperCase() === 'GASTOS VARIOS') {
      const categoriaProfunda =
        buscarCategoria(fila.leyendaH, referencias) ||
        buscarCategoria(fila.leyendaI, referencias) ||
        buscarCategoria(fila.leyendaJ, referencias) ||
        buscarCategoria(fila.leyendaK, referencias);
      if (categoriaProfunda) categoria = categoriaProfunda;
    }

    if (!categoria) categoria = 'SIN CLASIFICAR';

    let observacionFinal = fila.observacion;
    const catUpper = categoria.toUpperCase();

    if (catUpper === 'SIN CLASIFICAR' || catUpper === 'GASTOS VARIOS' || catUpper === 'IMPUESTOS') {
      const partes = [fila.descripcionB, fila.leyendaH, fila.leyendaK]
        .map(p => String(p || '').trim())
        .filter(p => p !== '');
      observacionFinal = [...new Set(partes)].join(' - ');
    }

    if (ITEMS_A_AGRUPAR.some(i => i.toUpperCase() === fila.descripcion.toUpperCase())) {
      observacionFinal = fila.descripcion;
    }

    if (categoria === 'SIN CLASIFICAR' && aprendizaje[observacionFinal]) {
      categoria = aprendizaje[observacionFinal];
    }

    return { ...fila, categoria, observacion: observacionFinal };
  });
}

// ============================================
// UTILIDADES
// ============================================
export function parseFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  if (typeof valor === 'number') {
    const d = new Date((valor - 25569) * 86400 * 1000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  const str = String(valor).trim();
  if (!str) return null;

  if (str.includes('T')) {
    const soloFecha = str.split('T')[0];
    const partes = soloFecha.split('-');
    if (partes.length === 3) {
      return new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
    }
  }

  return parseFechaStr(str);
}

export function parseFechaStr(str) {
  const partes = str.trim().split(/[-/]/);
  if (partes.length === 3) {
    const p0 = parseInt(partes[0], 10);
    const p1 = parseInt(partes[1], 10);
    const p2 = parseInt(partes[2], 10);
    if (partes[0].length === 4) return new Date(p0, p1 - 1, p2);
    const anio = p2 < 100 ? p2 + 2000 : p2;
    return new Date(anio, p1 - 1, p0);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function parseNumero(valor) {
  if (typeof valor === 'number') return valor;
  const str = String(valor || '0').replace(/\./g, '').replace(',', '.');
  return parseFloat(str) || 0;
}

export function limpiar(valor) {
  return String(valor || '').trim();
}

export function fechaISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fingerprintDe(fila) {
  return `${fechaISO(fila.fecha)}|${fila.monto}|${fila.observacion}`;
}
