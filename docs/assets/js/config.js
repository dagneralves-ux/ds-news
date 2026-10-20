/**
 * DS Intelligence (pessoal): configuração do front-end.
 * As editorias vêm do arquivo data/news.json (geradas a partir de config/categorias.json).
 */
const CONFIG = {
  PAGE_SIZE: 24,

  // Mudou o formato dos dados: favoritos e histórico de versões antigas ficam de lado.
  CACHE_VERSION: 'v4',

  // Atualização automática da página inicial (5 minutos, só com a aba aberta)
  AUTO_REFRESH: 5 * 60 * 1000,
};

// Preenchido por api.js assim que data/news.json carrega.
const CATEGORIES = {
  all: { label: 'Todas', icon: '📰', color: '#7c84f0' },
};

// Só urgente e destaque ganham selo; o resto é notícia comum.
const IMPORTANCE = {
  urgent: { label: 'Urgente',  emoji: '🚨', cls: 'badge-urgent' },
  high:   { label: 'Destaque', emoji: '🔴', cls: 'badge-high' },
};
