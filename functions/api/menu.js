/**
 * Cloudflare Pages Function — /api/menu
 * 
 * GET  /api/menu?store=rissione  → devuelve el JSON del menú de ese local
 * POST /api/menu                 → body: { store, data } → guarda en KV
 * 
 * Requiere el binding KV: MENU_DATA (configurar en Cloudflare Dashboard → Settings → Bindings)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  // Preflight CORS
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Verificar que el binding KV existe
  if (!env.MENU_DATA) {
    return new Response(
      JSON.stringify({ error: 'KV binding "MENU_DATA" no encontrado. Configurarlo en Cloudflare Dashboard → Settings → Bindings.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  // ── GET → leer menú ──────────────────────────────────────────
  if (method === 'GET') {
    const url = new URL(request.url);
    const store = url.searchParams.get('store') || 'rissione';
    const key = `menu_${store}`;

    const value = await env.MENU_DATA.get(key);

    if (!value) {
      // Primera vez: no hay datos guardados aún → devolver null para que el editor use los defaults
      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(value, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── POST → guardar menú ──────────────────────────────────────
  if (method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body inválido, se esperaba JSON.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const { store, data } = body;

    if (!store || !data) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos: store y data son requeridos.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que el store sea uno de los permitidos
    const VALID_STORES = ['rissione', 'hiper', 'changoMas'];
    if (!VALID_STORES.includes(store)) {
      return new Response(
        JSON.stringify({ error: `Store inválido. Debe ser uno de: ${VALID_STORES.join(', ')}` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const key = `menu_${store}`;
    await env.MENU_DATA.put(key, JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, store, key }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Método no permitido
  return new Response(JSON.stringify({ error: 'Método no permitido.' }), {
    status: 405,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
