// Marca LGNEX: "Desarrollado por" fijo abajo al centro en todas las pantallas
(function () {
  if (document.getElementById('lgnex-brand')) return;
  var css = '#lgnex-brand{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:50;'
    + 'display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;'
    + 'background:#0b1114;border:1px solid #1d2a2e;color:#aab4b8;text-decoration:none;'
    + 'font:500 10px/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)}'
    + '#lgnex-brand:hover{border-color:#2fe8c6}#lgnex-brand b{font:700 13px/1 Inter,system-ui,sans-serif;letter-spacing:.12em;color:#fff}#lgnex-brand b i{font-style:normal;color:#2fe8c6}'
    + '@media print{#lgnex-brand{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var a = document.createElement('a');
  a.id = 'lgnex-brand'; a.href = 'https://lgnex.com/'; a.target = '_blank'; a.rel = 'noopener';
  a.title = 'LGNEX Consultoría Informática';
  a.innerHTML = '<span>Desarrollado por</span><b>LG<i>NEX</i></b>';
  document.body.appendChild(a);
})();
