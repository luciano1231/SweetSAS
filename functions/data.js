import { obtenerSesion, tieneRol } from './lib/session.js';

// Proxy a la planilla de Google (datos financieros). Ninguna pantalla lo usa
// hoy, pero estaba abierto a cualquiera sin login: ahora exige sesión de dueño.
export async function onRequest(context) {
    const { request, env } = context;
    const session = await obtenerSesion(request, env);
    if (!tieneRol(session, 'owner')) {
        return new Response(JSON.stringify({ error: 'No autorizado.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx0XjF9A61J8G6f3DW9G5ral8AceS7UdhRQiMi9_k2QB-J0JnpHEdBC0y0no2KVRqJh/exec';

    const response = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
    const data = await response.text();

    return new Response(data, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
