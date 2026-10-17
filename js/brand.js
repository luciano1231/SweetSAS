// Marca LGNEX: marquita fija abajo a la derecha en todas las pantallas
(function () {
  if (document.getElementById('lgnex-brand')) return;
  var css = '#lgnex-brand{position:fixed;right:12px;bottom:10px;z-index:50;display:flex;align-items:center;'
    + 'padding:3px 8px;border-radius:999px;background:rgba(11,17,20,.82);opacity:.55;transition:opacity .2s}'
    + '#lgnex-brand:hover{opacity:1}#lgnex-brand img{height:22px;width:auto;display:block}'
    + '@media print{#lgnex-brand{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var a = document.createElement('a');
  a.id = 'lgnex-brand'; a.href = 'https://lgnex.com/'; a.target = '_blank'; a.rel = 'noopener';
  a.title = 'LGNEX Consultoría Informática';
  a.innerHTML = '<img src="/assets/lgnex.png" alt="LGNEX">';
  document.body.appendChild(a);
})();
