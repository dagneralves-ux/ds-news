// Aplica o tema salvo antes de a página aparecer (evita piscar). Sem preferência salva, segue o sistema.
try {
  const t = localStorage.getItem('ds_theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) { /* ignore */ }
