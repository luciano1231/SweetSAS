// Qué gastos no son de la empresa (personales, internos, inversiones).
// Lo usan el Tablero (/api/gastos-mensual) y la pantalla de Gastos de
// Obligaciones, así los dos cuentan exactamente lo mismo.
//
// Reglas de "gasto extra" (se comparan sin acentos ni mayúsculas, por
// fragmento). Lo que no cae en ninguna es gasto de la empresa.
// 'GASTOS EXTRA' es la clasificación de caja chica para cosas no
// empresariales (mascota, veterinaria), por eso va con los personales.
export const REGLAS_EXTRA = [
  { col: 'personales', fragmentos: ['PERSONAL', 'GASTOS EXTRA'] },
  { col: 'internos', fragmentos: ['INTERNO', 'INTERNA'] },
  { col: 'inversiones', fragmentos: ['INVERSION'] },
];

function normalizar(s) {
  return (s || '').toString().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Devuelve 'personales' | 'internos' | 'inversiones', o null si es gasto
// de la empresa. Se le pasa la clasificación y, de respaldo, el nombre.
export function columnaExtra(...textos) {
  const t = textos.map(normalizar).filter(Boolean);
  for (const regla of REGLAS_EXTRA) {
    if (t.some(txt => regla.fragmentos.some(f => txt.includes(f)))) return regla.col;
  }
  return null;
}
