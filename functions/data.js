export async function onRequest(context) {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx0XjF9A61J8G6f3DW9G5ral8AceS7UdhRQiMi9_k2QB-J0JnpHEdBC0y0no2KVRqJh/exec';

    const response = await fetch(APPS_SCRIPT_URL, { redirect: 'follow' });
    const data = await response.text();

    return new Response(data, {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}