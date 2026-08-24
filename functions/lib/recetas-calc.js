/**
 * functions/lib/recetas-calc.js
 *
 * Cálculo de costo/precio de productos de Recetas, compartido entre
 * /api/recetas (listado con costos en vivo) y /api/listas-precios (que
 * necesita el mismo precio_con_utilidad como "precio base" antes de
 * aplicarle el ajuste de cada lista).
 */

export function calcularTotales(producto, totalIngredientes, totalCostosFijos) {
  const costoTotal = Math.round((totalIngredientes + totalCostosFijos) * 100) / 100;
  const unidades = Number(producto.unidades_por_tanda) || 1;
  const costoUnitario = Math.round((costoTotal / unidades) * 100) / 100;
  const utilidadPct = Number(producto.utilidad_deseada_pct) || 0;
  const precioConUtilidad = Math.round(costoUnitario * (1 + utilidadPct / 100) * 100) / 100;
  return { costo_total: costoTotal, costo_unitario: costoUnitario, precio_con_utilidad: precioConUtilidad };
}

// Devuelve todos los productos de recetas_productos con sus totales
// calculados en vivo (mismo resultado que arma /api/recetas para el listado).
export async function listarProductosConTotales(db) {
  const { results: productos } = await db.prepare('SELECT * FROM recetas_productos ORDER BY nombre COLLATE NOCASE').all();

  const { results: sumasIng } = await db.prepare(
    `SELECT pi.producto_id, SUM(pi.cantidad * i.costo_fraccion) as total
     FROM recetas_producto_ingredientes pi JOIN recetas_ingredientes i ON i.id = pi.ingrediente_id
     GROUP BY pi.producto_id`
  ).all();
  const { results: sumasCF } = await db.prepare(
    `SELECT pc.producto_id, SUM(pc.cantidad * c.costo_fraccion) as total
     FROM recetas_producto_costos_fijos pc JOIN recetas_costos_fijos c ON c.id = pc.costo_fijo_id
     GROUP BY pc.producto_id`
  ).all();

  const mapaIng = Object.fromEntries(sumasIng.map(r => [r.producto_id, r.total || 0]));
  const mapaCF = Object.fromEntries(sumasCF.map(r => [r.producto_id, r.total || 0]));

  return productos.map(p => ({
    ...p,
    ...calcularTotales(p, mapaIng[p.id] || 0, mapaCF[p.id] || 0),
  }));
}

// Precio final aplicando el ajuste de una lista de precios sobre el precio
// base (precio_con_utilidad) de la receta.
export function aplicarAjuste(precioBase, ajusteTipo, ajusteValor) {
  const base = Number(precioBase) || 0;
  const valor = Number(ajusteValor) || 0;
  const final = ajusteTipo === 'porcentaje' ? base * (1 + valor / 100) : base + valor;
  return Math.round(final * 100) / 100;
}
