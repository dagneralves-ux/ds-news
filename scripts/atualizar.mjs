/**
 * DS Intelligence (pessoal): atualiza as notícias.
 *
 *   node scripts/atualizar.mjs            → busca os feeds, resume com IA e grava docs/data/news.json
 *
 * Variável opcional (no GitHub: Settings > Secrets): GEMINI_API_KEY. Para testes: FONTES_FILE, DATA_DIR.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAllFeeds } from './lib/rss.js';
import { summarizeItems } from './lib/ai.js';
import { generateTrends } from './lib/trends.js';
import { CATEGORIES } from './lib/categorias.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTES_FILE = process.env.FONTES_FILE || join(ROOT, 'fontes.json');
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'docs', 'data');
const NEWS_FILE = join(DATA_DIR, 'news.json');
const STATUS_FILE = join(DATA_DIR, 'status.json');

const HOUR = 3600000;
const MAX_AGE_MS = 7 * 24 * HOUR;
const MAX_ITEMS = 400;
const AI_PER_RUN = 12;

const readJson = (file, fallback) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; } };
const env = process.env;

async function main() {
  const current = readJson(NEWS_FILE, { itens: [] });
  const existing = Array.isArray(current.itens) ? current.itens : [];

  const sources = readJson(FONTES_FILE, []).filter(s => s.ativo !== false && s.url);
  const { items: fetched, status } = await fetchAllFeeds(sources);
  const okCount = status.filter(s => s.ok).length;
  console.log(`[Feeds] ${fetched.length} itens de ${okCount}/${status.length} fontes`);

  const knownIds = new Set(existing.map(n => n.id));
  const newOnes = fetched.filter(n => !knownIds.has(n.id));

  // junta, ordena (mais novas primeiro), tira o que passou de 7 dias e limita o total
  const now = Date.now();
  const merged = [...existing, ...newOnes]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter((n, i) => i < 30 || now - new Date(n.date) <= MAX_AGE_MS)
    .slice(0, MAX_ITEMS);

  // IA: notícias novas primeiro, depois as antigas que ficaram sem resumo (até 2 tentativas)
  const pool = merged
    .filter(n => !n.aiSummary && (n.aiAttempts || 0) < 2 && (n.summary || '').length >= 60)
    .slice(0, 40);
  const { summaries, attempted, error: aiError } = await summarizeItems(pool, env, AI_PER_RUN);
  let aiTouched = false;
  for (const n of merged) {
    if (summaries.has(n.id)) { n.aiSummary = summaries.get(n.id); aiTouched = true; }
    else if (attempted.has(n.id)) { n.aiAttempts = (n.aiAttempts || 0) + 1; aiTouched = true; }
  }
  if (aiError && aiError !== 'sem chave de IA') console.warn('[IA] aviso:', aiError);

  // Só grava (e portanto só gera commit) quando algo mudou
  const changed = newOnes.length > 0 || aiTouched || merged.length !== existing.length;
  mkdirSync(DATA_DIR, { recursive: true });
  if (changed || !existsSync(NEWS_FILE)) {
    const out = {
      atualizadoEm: new Date().toISOString(),
      categorias: CATEGORIES,
      tendencias: generateTrends(merged),
      itens: merged.map(({ classified, ...rest }) => rest),
    };
    writeFileSync(NEWS_FILE, JSON.stringify(out));
    console.log(`[Gravado] ${merged.length} notícias (${newOnes.length} novas, ${summaries.size} resumos)`);
  } else {
    console.log('[Sem novidades] nada a gravar.');
  }

  // Saúde das fontes: só regrava se alguma fonte mudou de "funciona" para "falha" (ou vice-versa)
  const brief = status.map(s => ({ id: s.id, name: s.name, ok: s.ok, count: s.count, erro: s.error || undefined }));
  const prev = readJson(STATUS_FILE, { fontes: [] });
  const sig = list => JSON.stringify((list || []).map(s => [s.id, s.ok]));
  if (sig(prev.fontes) !== sig(brief)) {
    writeFileSync(STATUS_FILE, JSON.stringify({ verificadoEm: new Date().toISOString(), fontes: brief }));
  }
}

main().catch(err => { console.error('[Falhou]', err); process.exit(1); });
