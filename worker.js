// ============================================
// PUNTO DE ENTRADA DEL WORKER — Sweet SAS
// ============================================
// Este proyecto se despliega como Worker (con "assets": sitio estático)
// en vez de como Pages clásico, así que la carpeta functions/ no se
// enruta sola: acá conectamos manualmente cada endpoint a su handler
// (sin duplicar lógica, solo se reusan tal cual) y todo lo demás se
// sirve como archivo estático.

import { onRequest as menuHandler } from './functions/api/menu.js';
import { onRequest as usersHandler } from './functions/api/users.js';
import { onRequest as rendicionesHandler } from './functions/api/rendiciones.js';
import { onRequest as empleadosHandler } from './functions/api/empleados.js';
import { onRequest as dataHandler } from './functions/data.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/menu') return menuHandler({ request, env, ctx });
    if (url.pathname === '/api/users') return usersHandler({ request, env, ctx });
    if (url.pathname === '/api/rendiciones') return rendicionesHandler({ request, env, ctx });
    if (url.pathname === '/api/empleados') return empleadosHandler({ request, env, ctx });
    if (url.pathname === '/data') return dataHandler({ request, env, ctx });

    // Cualquier otra ruta: archivo estático (html, css, js, imágenes, etc.)
    return env.ASSETS.fetch(request);
  },
};
