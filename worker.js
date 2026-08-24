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
import { onRequest as cajaChicaHandler } from './functions/api/caja-chica.js';
import { onRequest as cajaChicaItemsHandler } from './functions/api/caja-chica-items.js';
import { onRequest as obligacionesHandler } from './functions/api/obligaciones.js';
import { onRequest as obligacionesUploadHandler } from './functions/api/obligaciones-upload.js';
import { onRequest as obligacionesReferenciasHandler } from './functions/api/obligaciones-referencias.js';
import { onRequest as obligacionesArchivosHandler } from './functions/api/obligaciones-archivos.js';
import { onRequest as recetasHandler } from './functions/api/recetas.js';
import { onRequest as recetasCatalogoHandler } from './functions/api/recetas-catalogo.js';
import { onRequest as recetasItemsHandler } from './functions/api/recetas-items.js';
import { onRequest as listasPreciosHandler } from './functions/api/listas-precios.js';
import { onRequest as dataHandler } from './functions/data.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/menu') return menuHandler({ request, env, ctx });
    if (url.pathname === '/api/users') return usersHandler({ request, env, ctx });
    if (url.pathname === '/api/rendiciones') return rendicionesHandler({ request, env, ctx });
    if (url.pathname === '/api/caja-chica') return cajaChicaHandler({ request, env, ctx });
    if (url.pathname === '/api/caja-chica-items') return cajaChicaItemsHandler({ request, env, ctx });
    if (url.pathname === '/api/obligaciones') return obligacionesHandler({ request, env, ctx });
    if (url.pathname === '/api/obligaciones-upload') return obligacionesUploadHandler({ request, env, ctx });
    if (url.pathname === '/api/obligaciones-referencias') return obligacionesReferenciasHandler({ request, env, ctx });
    if (url.pathname === '/api/obligaciones-archivos') return obligacionesArchivosHandler({ request, env, ctx });
    if (url.pathname === '/api/recetas') return recetasHandler({ request, env, ctx });
    if (url.pathname === '/api/recetas-catalogo') return recetasCatalogoHandler({ request, env, ctx });
    if (url.pathname === '/api/recetas-items') return recetasItemsHandler({ request, env, ctx });
    if (url.pathname === '/api/listas-precios') return listasPreciosHandler({ request, env, ctx });
    if (url.pathname === '/data') return dataHandler({ request, env, ctx });

    // Cualquier otra ruta: archivo estático (html, css, js, imágenes, etc.)
    return env.ASSETS.fetch(request);
  },
};
