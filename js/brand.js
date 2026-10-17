// Marca LGNEX: "Desarrollado por" fijo abajo al centro en todas las pantallas
(function () {
  if (document.getElementById('lgnex-brand')) return;
  var css = '#lgnex-brand{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:50;'
    + 'display:flex;align-items:center;gap:6px;padding:3px 10px 3px 12px;border-radius:999px;'
    + 'background:#0b1114;border:1px solid #1d2a2e;color:#aab4b8;text-decoration:none;'
    + 'font:500 10px/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)}'
    + '#lgnex-brand:hover{border-color:#2fe8c6}#lgnex-brand img{height:20px;width:auto;display:block}'
    + '@media print{#lgnex-brand{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var a = document.createElement('a');
  a.id = 'lgnex-brand'; a.href = 'https://lgnex.com/'; a.target = '_blank'; a.rel = 'noopener';
  a.title = 'LGNEX Consultoría Informática';
  a.innerHTML = '<span>Desarrollado por</span><img src="/assets/lgnex.png" alt="LGNEX">';
  document.body.appendChild(a);
})();
