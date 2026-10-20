/** Assuntos do momento: palavras e pares de palavras mais repetidos nos títulos das últimas 24h. */
import { normalizeText } from './classify.js';

const HOUR = 3600000;

// Palavras que sozinhas não dizem nada, mas formam assunto em par: "segundo turno", "Nossa Senhora".
const PAIR_OK_STOP = new Set(['primeiro', 'primeira', 'segundo', 'segunda', 'nossa', 'nosso', 'novo', 'nova']);

const STOP_WORDS = new Set(`sobre contra entre desde ainda mesmo todos todas apos durante segundo segue pode podem deve devem
  disse afirma veja saiba conheca entenda confira qual quais quando como mais menos muito muita maior menor primeiro primeira
  ultimo ultima novo nova novos novas sendo ficam pelo pela pelos pelas desta deste dessa esse essa isso esta este aqui entao
  caso casos pessoas anuncia brasil brasileiro brasileira brasileiros governo federal estado anos semana hoje ontem depois antes
  fazer feito quer quem onde porque diante tras final geral parte forma sobre nesta neste tambem alem cerca fala diz vira vai vao
  ficar fica apenas depois novas dados grupo mundo nacional nossa nosso nossos nossas dele dela deles delas projeto projetos eleicao eleicoes milhoes milhao bilhoes bilhao mil reais real`.split(/\s+/));

export function generateTrends(items) {
  const since = Date.now() - 24 * HOUR;
  const words = new Map();     // chave sem acento -> { count, display }
  const pairs = new Map();     // "chave1 chave2"  -> { count, display }

  const bump = (map, key, display) => {
    const entry = map.get(key) || { count: 0, display };
    entry.count += 1;
    map.set(key, entry);
  };

  for (const item of items) {
    if (new Date(item.date).getTime() < since) continue;

    // "1º turno" e "2º turno" viram "primeiro turno" e "segundo turno".
    const ORDINALS = { '1º': 'primeiro', '2º': 'segundo', '1ª': 'primeira', '2ª': 'segunda' };
    const tokens = (item.title.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
      .map(w => ORDINALS[w] || w)
      .map(w => ({ w, key: normalizeText(w) }));
    const usable = t => t.key.length >= 4 && !STOP_WORDS.has(t.key) && !/^\d+$/.test(t.key);

    const seen = new Set();
    tokens.forEach((t, i) => {
      if (t.key.length >= 5 && usable(t) && !seen.has(t.key)) { seen.add(t.key); bump(words, t.key, t.w); }
      const next = tokens[i + 1];
      const pairable = x => x.key.length >= 4 && !/^\d+$/.test(x.key) && (usable(x) || PAIR_OK_STOP.has(x.key));
      if (next && pairable(t) && pairable(next) && (usable(t) || usable(next))) {
        const pairKey = `${t.key} ${next.key}`;
        if (!seen.has(pairKey)) { seen.add(pairKey); bump(pairs, pairKey, `${t.w} ${next.w}`); }
      }
    });
  }

  // Pares frequentes vencem: "nossa senhora" no lugar de "nossa" e "senhora" separados.
  const candidates = [];
  const covered = new Set();
  for (const [key, e] of pairs) {
    if (e.count < 3) continue;
    candidates.push({ ...e, score: e.count + 0.5 });
    key.split(' ').forEach(k => covered.add(k));
  }
  for (const [key, e] of words) {
    if (e.count < 3 || covered.has(key)) continue;
    candidates.push({ ...e, score: e.count });
  }

  const titleCase = str => str.replace(/(^|\s)(\p{L})/gu, (m, sp, ch) => sp + ch.toUpperCase());
  const icons = ['🔥', '📈', '⚡', '💡', '🎯', '📌'];
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((e, i) => ({
      id: i + 1,
      title: titleCase(e.display),
      description: `${e.count} matérias nas últimas 24h`,
      icon: icons[i] || '📌',
      count: e.count,
    }));
}

