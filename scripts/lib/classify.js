/**
 * Classificação das notícias para as suas 4 editorias:
 * economia, futebol, politica e ia (inteligência artificial e tecnologia: Adobe, Corel, GitHub etc.).
 *
 * - classifyCategory: usada em fontes "geral" (a editoria vem do conteúdo). Se nada casar, devolve
 *   null e a notícia é descartada (não é do seu interesse).
 * - passesFilter: fontes com "filtro" só deixam passar notícias do assunto indicado.
 * - classifyImportance: Urgente / Destaque (só pelo título).
 *
 * Para ajustar os assuntos, edite as listas abaixo (palavras sem acento, minúsculas).
 */

import { readFileSync } from 'node:fs';

export function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bbolsa familia\b/g, 'bolsafamilia');   // programa social: não é "bolsa de valores"
}

export const CATEGORY_TERMS = {
  futebol: [
    'futebol', 'gol', 'gols', 'brasileirao', 'serie a', 'serie b', 'libertadores', 'sul americana',
    'copa do brasil', 'copa do mundo', 'selecao brasileira', 'cbf', 'fifa', 'champions league',
    'premier league', 'la liga', 'rodada', 'zagueiro', 'goleiro', 'atacante', 'volante', 'escalacao',
    'artilheiro', 'rebaixamento', 'penalti', 'var', 'neymar', 'ancelotti', 'campeonato paulista',
    'campeonato carioca', 'flamengo', 'palmeiras', 'corinthians', 'santos fc', 'vasco', 'fluminense',
    'botafogo', 'gremio', 'cruzeiro', 'atletico mg', 'ec bahia', 'fortaleza ec', 'sport recife',
    'ceara sc', 'coritiba', 'athletico', 'red bull bragantino', 'mirassol', 'sao paulo fc', 'inter de porto alegre',
    'tecnico', 'torcida', 'clube', 'jogador', 'jogadores', 'partida', 'transferencia', 'mercado da bola',
  ],
  politica: [
    'lula', 'bolsonaro', 'congresso', 'senado', 'senador', 'senadora', 'deputado', 'deputada',
    'camara dos deputados', 'stf', 'tse', 'eleicao', 'eleicoes', 'partido', 'planalto', 'ministro',
    'ministra', 'governo federal', 'prefeito', 'governador', 'governadora', 'pec', 'cpi', 'oposicao',
    'base aliada', 'centrao', 'alckmin', 'moraes', 'pgr', 'impeachment', 'reforma tributaria',
    'politica', 'politico', 'politicos', 'bolsafamilia', 'votacao', 'projeto de lei', 'medida provisoria',
  ],
  economia: [
    'economia', 'economico', 'economica', 'pib', 'inflacao', 'ipca', 'igpm', 'selic', 'copom', 'juros',
    'taxa basica', 'banco central', 'galipolo', 'dolar', 'cambio', 'bolsa', 'ibovespa', 'b3', 'mercado financeiro',
    'investimento', 'investimentos', 'investidor', 'investidores', 'acoes', 'fii', 'fiis', 'renda fixa',
    'tesouro direto', 'dividendos', 'orcamento', 'deficit', 'superavit', 'divida publica', 'arcabouco fiscal',
    'meta fiscal', 'fazenda', 'haddad', 'imposto', 'impostos', 'tributo', 'tributos', 'receita federal',
    'petrobras', 'petroleo', 'commodities', 'desemprego', 'emprego', 'caged', 'pnad', 'salario minimo',
    'varejo', 'industria', 'agronegocio', 'exportacoes', 'importacoes', 'balanca comercial', 'tarifa', 'tarifas',
    'recessao', 'credito', 'financiamento', 'bitcoin', 'criptomoeda', 'criptomoedas', 'cripto', 'ethereum',
    'pix', 'bancos', 'lucro', 'balanco', 'fed', 'consumo', 'endividamento', 'inadimplencia',
  ],
  ia: [
    'inteligencia artificial', 'chatgpt', 'openai', 'gemini', 'anthropic', 'claude', 'llm', 'machine learning',
    'aprendizado de maquina', 'ia generativa', 'copilot', 'deepseek', 'midjourney', 'grok', 'sora',
    'modelo de linguagem', 'agentes de ia', 'rede neural', 'redes neurais', 'deep learning',
    'nvidia', 'perplexity', 'stable diffusion', 'robo', 'robos', 'automacao',
    // ferramentas e programação
    'adobe', 'photoshop', 'illustrator', 'premiere', 'after effects', 'lightroom', 'indesign', 'firefly',
    'creative cloud', 'acrobat', 'coreldraw', 'corel draw', 'corel', 'figma', 'canva', 'framer', 'webflow',
    'github', 'git', 'gitlab', 'pull request', 'open source', 'codigo aberto', 'vs code', 'visual studio',
    'programacao', 'programador', 'programadores', 'desenvolvedor', 'desenvolvedores', 'python', 'javascript',
    'typescript', 'react', 'linux', 'devops', 'api', 'software', 'ciberseguranca', 'vazamento de dados',
  ],
};

// Empate: a primeira da lista vence.
const CATEGORY_PRIORITY = ['politica', 'futebol', 'economia', 'ia'];

const compile = terms => terms.map(t => new RegExp(`(?:^| )${t}(?: |$)`));
const _compiled = Object.fromEntries(Object.entries(CATEGORY_TERMS).map(([k, v]) => [k, compile(v)]));

function score(cat, text, raw) {
  let n = 0;
  for (const re of _compiled[cat]) if (re.test(text)) n += 1;
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
    'lanca gpt', 'lanca gemini', 'nova versao do chatgpt', 'copom', 'selic',
  ],
};
const _imp = Object.fromEntries(Object.entries(IMPORTANCE_TERMS).map(([l, t]) => [l, compile(t)]));

export function classifyImportance(title) {
  const t = normalizeText(title);
  if (_imp.urgent.some(re => re.test(t))) return 'urgent';
  if (_imp.high.some(re => re.test(t))) return 'high';
  return 'medium';
}


/** Assuntos dentro de cada editoria (config/assuntos.json): Adobe, CorelDRAW, GitHub, Selic... */
export const ASSUNTOS = JSON.parse(readFileSync(new URL('../../config/assuntos.json', import.meta.url), 'utf8'));
const _assuntos = ASSUNTOS.map(a => ({ id: a.id, res: compile(a.termos.map(normalizeText)) }));

/** Devolve os ids dos assuntos citados no título/trecho (um item pode ter vários). */
export function topicsOf(title, summary = '') {
  const text = normalizeText(`${title} ${summary}`);
  return _assuntos.filter(a => a.res.some(re => re.test(text))).map(a => a.id);
}
