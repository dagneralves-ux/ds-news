/**
 * Classificação das notícias para os seus 5 assuntos:
 * futebol, politica, ia (inteligência artificial), design (design gráfico), marketing.
 *
 * - classifyCategory: usada em fontes "geral" (a editoria vem do conteúdo). Se nada casar, devolve
 *   null e a notícia é descartada (não é do seu interesse).
 * - passesFilter: fontes com "filtro" só deixam passar notícias do assunto indicado.
 * - classifyImportance: Urgente / Destaque (só pelo título).
 *
 * Para ajustar os assuntos, edite as listas abaixo (palavras sem acento, minúsculas).
 */

export function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const CATEGORY_TERMS = {
  futebol: [
    'futebol', 'gol', 'gols', 'brasileirao', 'serie a', 'serie b', 'libertadores', 'sul americana',
    'copa do brasil', 'copa do mundo', 'selecao brasileira', 'cbf', 'fifa', 'champions league',
    'premier league', 'la liga', 'zagueiro', 'goleiro', 'atacante',
    'artilheiro', 'rebaixamento', 'penalti', 'neymar', 'ancelotti', 'campeonato paulista',
    'campeonato carioca', 'flamengo', 'palmeiras', 'corinthians', 'santos fc', 'vasco', 'fluminense',
    'botafogo', 'gremio', 'cruzeiro', 'atletico mg', 'ec bahia', 'fortaleza ec', 'sport recife',
    'ceara sc', 'coritiba', 'athletico', 'red bull bragantino', 'mirassol', 'sao paulo fc', 'inter de porto alegre',
    'mercado da bola',
  ],
  politica: [
    'lula', 'bolsonaro', 'congresso', 'senado', 'senador', 'senadora', 'deputado', 'deputada',
    'camara dos deputados', 'stf', 'tse', 'eleicao', 'eleicoes', 'planalto', 'ministro',
    'ministra', 'governo federal', 'prefeito', 'governador', 'governadora', 'cpi',
    'base aliada', 'centrao', 'alckmin', 'moraes', 'pgr', 'impeachment', 'reforma tributaria',
    'politico', 'politicos', 'projeto de lei', 'medida provisoria',
  ],
  ia: [
    'inteligencia artificial', 'chatgpt', 'openai', 'anthropic', 'llm', 'machine learning',
    'aprendizado de maquina', 'ia generativa', 'deepseek', 'midjourney',
    'modelo de linguagem', 'agentes de ia', 'rede neural', 'redes neurais', 'deep learning',
    'perplexity', 'stable diffusion',
  ],
  design: [
    'design grafico', 'tipografia', 'logotipo', 'logomarca',
    'identidade visual', 'branding', 'ilustracao', 'ilustrador', 'figma', 'adobe', 'photoshop',
    'illustrator', 'ui design',
    'motion design', 'fontes gratuitas', 'diagramacao',
  ],
  marketing: [
    'marketing', 'publicidade', 'agencia de publicidade',
    'influenciador', 'influenciadores', 'influencer', 'seo', 'trafego pago',
    'copywriting', 'cannes lions', 'meta ads', 'google ads', 'e commerce',
    'marketing digital', 'marketing de conteudo',
  ],
};

/**
 * Termos ambíguos (também aparecem em assuntos que não são seus: "técnico" de informática,
 * "partida" de viagem, "ads" em qualquer contexto...). Cada um vale meia pontuação:
 * é preciso um termo forte, ou dois fracos, para a notícia entrar.
 */
export const WEAK_TERMS = {
  futebol: ['var', 'tecnico', 'torcida', 'clube', 'jogador', 'jogadores', 'partida', 'transferencia', 'rodada', 'volante', 'escalacao'],
  politica: ['partido', 'politica', 'votacao', 'oposicao', 'pec'],
  ia: ['robo', 'robos', 'automacao', 'gemini', 'sora', 'grok', 'nvidia', 'copilot'],
  design: ['design', 'designer', 'designers', 'ux', 'cartaz', 'embalagem', 'packaging', 'arte digital', 'paleta de cores', 'criacao visual', 'mockup', 'canva'],
  marketing: ['ads', 'lead', 'leads', 'consumidor', 'campanha', 'anuncios', 'conversao', 'engajamento', 'social media', 'propaganda', 'branding'],
};

// Empate: a primeira da lista vence.
const CATEGORY_PRIORITY = ['politica', 'futebol', 'ia', 'marketing', 'design'];

const compile = terms => terms.map(t => new RegExp(`(?:^| )${t}(?: |$)`));
const _compiled = Object.fromEntries(Object.entries(CATEGORY_TERMS).map(([k, v]) => [k, compile(v)]));
const _weak = Object.fromEntries(Object.entries(WEAK_TERMS).map(([k, v]) => [k, compile(v)]));

function score(cat, text, raw) {
  let n = 0;
  for (const re of _compiled[cat]) if (re.test(text)) n += 1;
  for (const re of _weak[cat] || []) if (re.test(text)) n += 0.5;
  // "IA" só conta em maiúsculas: em português "ia" também é o verbo "ir" (ele ia ao jogo).
  if (cat === 'ia' && /(^|[^A-Za-zÀ-ú])IA([^A-Za-zÀ-ú]|$)/.test(raw)) n += 2;
  return n;
}

/** Devolve a editoria, ou null se a notícia não for de nenhum dos seus assuntos. */
export function classifyCategory(title, summary = '') {
  const raw = `${title} ${summary}`;
  const text = normalizeText(raw);
  let best = null;
  let bestScore = 0;
  for (const cat of CATEGORY_PRIORITY) {
    const s = score(cat, text, raw);
    if (s > bestScore) { bestScore = s; best = cat; }
  }
  return bestScore >= 1 ? best : null;
}

/**
 * Fonte com "filtro": só passa a notícia que casar com o assunto (ex.: Agência Brasil Esportes
 * com filtro "futebol" deixa de fora vôlei, natação...). "palavras" é uma lista extra opcional.
 */
export function passesFilter(source, title, summary = '') {
  if (!source.filtro && !source.palavras?.length) return true;
  const raw = `${title} ${summary}`;
  const text = normalizeText(raw);
  if (source.filtro && _compiled[source.filtro] && score(source.filtro, text, raw) >= 1) return true;
  if (source.palavras?.length && compile(source.palavras.map(normalizeText)).some(re => re.test(text))) return true;
  return false;
}

/**
 * "Urgente" = só marcação editorial explícita no título (URGENTE, PLANTÃO, ÚLTIMA HORA).
 * "Destaque" = assuntos que costumam ser relevantes (poucos por dia).
 */
const IMPORTANCE_TERMS = {
  urgent: ['urgente', 'plantao', 'ultima hora', 'extra extra'],
  high: [
    'stf', 'tse', 'decreto', 'policia federal', 'cpi', 'sanciona', 'renuncia', 'impeachment',
    'golpe de estado', 'demite tecnico', 'demitido', 'convocacao da selecao', 'convocados',
    'lanca gpt', 'lanca gemini', 'nova versao do chatgpt', 'cannes lions',
  ],
};
const _imp = Object.fromEntries(Object.entries(IMPORTANCE_TERMS).map(([l, t]) => [l, compile(t)]));

export function classifyImportance(title) {
  const t = normalizeText(title);
  if (_imp.urgent.some(re => re.test(t))) return 'urgent';
  if (_imp.high.some(re => re.test(t))) return 'high';
  return 'medium';
}
