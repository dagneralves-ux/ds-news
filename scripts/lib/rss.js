/**
 * TabNews: leitor de feeds RSS/Atom
 *
 * - IDs estáveis via SHA-256 da URL canônica (sem colisão entre notícias do mesmo domínio)
 * - Entidades HTML completas (&#8211;, &eacute;...) e encoding ISO-8859-1
 * - Datas em português ("seg, 28 set 2026 ...")
 * - Notícias com mais de 7 dias são ignoradas
 * - Retorna também o status de cada fonte (para o painel admin)
 */
import { classifyCategory, classifyImportance, passesFilter } from './classify.js';

const UA = 'Mozilla/5.0 (compatible; DSNewsPessoal/1.0; leitor RSS pessoal)';
const FETCH_TIMEOUT_MS = 8000;
const PER_FEED_LIMIT = 15;
const BATCH_SIZE = 10;
const MAX_AGE_MS = 7 * 86400000;
const MAX_BODY_BYTES = 1_500_000;

// ── API principal ────────────────────────────────────────────

export async function fetchAllFeeds(sources) {
  const list = sources;
  const collected = [];
  const status = [];

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(src => fetchFeed(src)));
    results.forEach((r, idx) => {
      const src = batch[idx];
      if (r.status === 'fulfilled') {
        collected.push(...r.value.items);
        status.push({ id: src.id, name: src.name, ok: true, count: r.value.items.length, entries: r.value.entries, filtered: Math.max(0, r.value.entries - r.value.items.length), ms: r.value.ms, mode: r.value.mode });
      } else {
        const message = r.reason?.message || String(r.reason);
        console.error(`[RSS] ${src.id}: ${message}`);
        status.push({ id: src.id, name: src.name, ok: false, count: 0, error: message.slice(0, 120) });
      }
    });
  }

  return { items: dedupe(collected), status, checkedAt: new Date().toISOString() };
}

// ── Download ─────────────────────────────────────────────────

async function fetchFeed(source) {
  const started = Date.now();
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await readBody(res);
  let parsed = await parseFeed(xml, source);
  let mode = 'rss';
  if (!parsed.entries && source.htmlFallback && /<html[\s>]|<!doctype html/i.test(xml)) {
    parsed = await parseHtmlListing(xml, source);
    mode = 'html-fallback';
  }
  if (!parsed.entries) {
    if (/<html[\s>]|<!doctype html/i.test(xml)) throw new Error('URL retornou página HTML, não um feed RSS/Atom');
    throw new Error('XML recebido, mas sem itens RSS/Atom reconhecíveis');
  }
  return { items: parsed.items, entries: parsed.entries, ms: Date.now() - started, mode };
}

async function readBody(res) {
  let buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) buf = buf.slice(0, MAX_BODY_BYTES);

  const contentType = res.headers.get('content-type') || '';
  let charset = (contentType.match(/charset=["']?([\w-]+)/i) || [])[1];
  if (!charset) {
    const head = new TextDecoder('utf-8').decode(buf.slice(0, 200));
    charset = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1];
  }
  try {
    return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

// ── Parser ───────────────────────────────────────────────────
// Alguns publishers mantêm uma página HTML de listagem no lugar de um RSS público.
// Só ativamos este fallback explicitamente por fonte; nunca interpretamos HTML genérico como feed.
async function parseHtmlListing(html, source) {
  const base = new URL(source.url);
  const anchors = html.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/a>/gi) || [];
  const seen = new Set();
  const items = [];
  for (const anchor of anchors) {
    const href = (anchor.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    let link;
    try { link = new URL(decodeEntities(href), base).toString(); } catch { continue; }
    if (link.startsWith('http:')) link = link.replace(/^http:/, 'https:');
    const u = new URL(link);
    if (u.hostname !== base.hostname && !u.hostname.endsWith('.' + base.hostname)) continue;
    if (seen.has(link)) continue;
    if (/\/(feed|tag|category|author|page|wp-content|wp-admin)(\/|$)/i.test(u.pathname)) continue;
    const inner = anchor.replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, '');
    const title = cleanText(inner, 220);
    if (title.length < 22 || /^(ler mais|saiba mais|ver mais|continue lendo)$/i.test(title)) continue;
    seen.add(link);
    const dateMatch = inner.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
    const dateStr = dateMatch ? `${dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}T12:00:00` : '';
    const item = await normalize({ title, link, dateStr, summaryRaw: '' }, source);
    if (item) items.push(item);
    if (items.length >= PER_FEED_LIMIT) break;
  }
  return { items, entries: seen.size };
}


async function parseFeed(xml, source) {
  // RSS 2.x, RDF/RSS 1.0, Atom e variantes com namespace.
  const isAtom = /<(?:[\w.-]+:)?feed[\s>]/i.test(xml) && !/<(?:[\w.-]+:)?rss[\s>]/i.test(xml);
  const tagName = isAtom ? '(?:[\w.-]+:)?entry' : '(?:[\w.-]+:)?item';
  const blocks = xml.match(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi')) || [];
  if (!blocks.length && /jsonfeed\.org/i.test(xml)) {
    try {
      const feed = JSON.parse(xml);
      const items = [];
      for (const entry of (feed.items || []).slice(0, PER_FEED_LIMIT)) {
        const item = await normalize({ title: entry.title, link: entry.url || entry.external_url, dateStr: entry.date_published || entry.date_modified, summaryRaw: entry.summary || entry.content_text || entry.content_html, image: entry.image || entry.banner_image || '' }, source);
        if (item) items.push(item);
      }
      return { items, entries: (feed.items || []).length };
    } catch { /* segue para diagnóstico padrão */ }
  }

  const out = [];
  const entries = blocks.length;
  for (const block of blocks.slice(0, PER_FEED_LIMIT)) {
    try {
      const raw = isAtom ? readAtomEntry(block) : readRssItem(block);
      const item = await normalize(raw, source);
      if (item) out.push(item);
    } catch (e) {
      console.error(`[RSS] item inválido em ${source.id}:`, e.message);
    }
  }
  return { items: out, entries };
}

function readRssItem(block) {
  const guid = unwrapCdata(getTag(block, 'guid'));
  const link =
    unwrapCdata(getTag(block, 'link')) ||
    unwrapCdata(getTag(block, 'feedburner:origLink')) ||
    (guid.startsWith('http') ? guid : '');
  const contentHtml = getTag(block, 'content:encoded');
  const descHtml = getTag(block, 'description');
  return {
    title: getTag(block, 'title'),
    link,
    dateStr: getTag(block, 'pubDate') || getTag(block, 'dc:date') || getTag(block, 'published'),
    summaryRaw: descHtml || contentHtml,
    image: extractImage(block, contentHtml || descHtml),
  };
}

function readAtomEntry(block) {
  const contentHtml = getTag(block, 'content');
  const summaryHtml = getTag(block, 'summary');
  return {
    title: getTag(block, 'title'),
    link: extractAtomLink(block),
    dateStr: getTag(block, 'published') || getTag(block, 'updated'),
    summaryRaw: summaryHtml || contentHtml,
    image: extractImage(block, contentHtml || summaryHtml),
  };
}

function getTag(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<(?:[\\w.-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${escaped}\\s*>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

function extractAtomLink(block) {
  const tags = block.match(/<(?:[\w.-]+:)?link\b[^>]*>/gi) || [];
  let fallback = '';
  for (const t of tags) {
    const href = attr(t, 'href');
    if (!href) continue;
    const rel = attr(t, 'rel');
    if (!rel || rel === 'alternate') return href;
    if (!fallback) fallback = href;
  }
  return fallback;
}

function extractImage(block, contentHtml) {
  for (const tag of block.match(/<media:content\b[^>]*>/gi) || []) {
    const url = attr(tag, 'url');
    const medium = attr(tag, 'medium');
    const type = attr(tag, 'type');
    if (url && (medium === 'image' || type.startsWith('image') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url))) {
      return toHttps(url);
    }
  }
  const thumb = (block.match(/<media:thumbnail\b[^>]*>/i) || [])[0];
  if (thumb && attr(thumb, 'url')) return toHttps(attr(thumb, 'url'));

  for (const tag of block.match(/<enclosure\b[^>]*>/gi) || []) {
    if (attr(tag, 'type').startsWith('image') && attr(tag, 'url')) return toHttps(attr(tag, 'url'));
  }

  if (contentHtml) {
    const html = decodeEntities(unwrapCdata(contentHtml));
    const m = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (m && !m[1].startsWith('data:') && !/pixel|1x1|tracking/i.test(m[1])) return toHttps(m[1]);
  }
  return '';
}

function toHttps(url) {
  const u = String(url).trim();
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http://')) return 'https://' + u.slice(7);
  return u.startsWith('https://') ? u : '';
}

// ── Texto ────────────────────────────────────────────────────

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™',
  lsaquo: '‹', rsaquo: '›', ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '', zwj: '', shy: '', times: '×', deg: '°',
  ordf: 'ª', ordm: 'º', sect: '§', para: '¶', euro: '€', pound: '£', cent: '¢', frac12: '½', frac14: '¼', frac34: '¾',
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', hearts: '♥', check: '✓', minus: '−', plusmn: '±', sbquo: '‚', bdquo: '„',
  iuml: 'ï', yacute: 'ý', yuml: 'ÿ', Egrave: 'È', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù', Auml: 'Ä', Euml: 'Ë', Iuml: 'Ï',
  Ouml: 'Ö', Ntilde: 'Ñ', Yacute: 'Ý', Icirc: 'Î', Ucirc: 'Û', Aring: 'Å', aring: 'å', szlig: 'ß', aelig: 'æ', AElig: 'Æ',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', ccedil: 'ç',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', iacute: 'í', igrave: 'ì', icirc: 'î',
  oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö', uacute: 'ú', ugrave: 'ù',
  ucirc: 'û', uuml: 'ü', ntilde: 'ñ',
  Aacute: 'Á', Agrave: 'À', Acirc: 'Â', Atilde: 'Ã', Ccedil: 'Ç', Eacute: 'É', Ecirc: 'Ê',
  Iacute: 'Í', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Uacute: 'Ú', Uuml: 'Ü',
};

export function decodeEntities(str) {
  return String(str)
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeCodePoint(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d) => safeCodePoint(parseInt(d, 10), m))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m));
}

function safeCodePoint(cp, fallback) {
  try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : fallback; }
  catch { return fallback; }
}

function unwrapCdata(str) {
  return String(str || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/**
 * Texto puro e seguro: sem tags, sem "<" ou ">" sobrando.
 * (O front também escapa tudo; isto é a segunda camada.)
 */
// Tag HTML que respeita aspas: um ">" dentro de atributo (alt="a > b") não encerra a tag.
const TAG_RE = /<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;

function stripTags(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(TAG_RE, ' ');
}

/**
 * Texto puro e seguro: sem tags, sem "<" ou ">" sobrando.
 * (O front também escapa tudo; isto é a segunda camada.)
 *
 * Ordem importa: se o HTML é "de verdade" (CDATA), remove as tags ANTES de decodificar
 * entidades, senão um &lt;p&gt; dentro de um atributo vira ">" e quebra a remoção.
 * Se o HTML vem escapado (&lt;p&gt;), decodifica primeiro.
 */
export function cleanText(raw, max = 600) {
  if (!raw) return '';
  let t = unwrapCdata(raw);
  if (/<[a-zA-Z!\/]/.test(t)) {
    t = stripTags(t);
    t = decodeEntities(t);
    if (/<[a-zA-Z!\/]/.test(t)) t = stripTags(t);       // sobrou HTML escapado dentro do HTML
  } else {
    t = stripTags(decodeEntities(t));
  }
  t = decodeEntities(t);                                  // dupla codificação (&amp;#8211;)
  t = t.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  // Boilerplate de WordPress: "O post X apareceu primeiro em Y."
  t = t.replace(/\s*(O post|The post|A matéria|A notícia)\s[\s\S]{0,300}?(apareceu primeiro em|appeared first on)[\s\S]*$/i, '').trim();
  return truncate(t, max);
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

// ── Datas ────────────────────────────────────────────────────

const PT_MONTHS = { jan: 'Jan', fev: 'Feb', mar: 'Mar', abr: 'Apr', mai: 'May', jun: 'Jun', jul: 'Jul', ago: 'Aug', set: 'Sep', out: 'Oct', nov: 'Nov', dez: 'Dec' };

export function parseDate(str) {
  if (!str) return null;
  let s = unwrapCdata(str).trim();
  let d = new Date(s);
  if (!isNaN(d)) return d;
  // RFC 822 em português: "seg, 28 set 2026 09:02:37 -0300"
  s = s.replace(/^[A-Za-zÀ-ú]{3,7},?\s*/, '')
       .replace(/\b([A-Za-zçÇ]{3})[a-zçÇ]*\b/, (m, a) => PT_MONTHS[a.toLowerCase()] || m);
  d = new Date(s);
  return isNaN(d) ? null : d;
}

// ── URL e ID ─────────────────────────────────────────────────

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|igshid$|cmpid$|ref_src$|xtor$|at_)/i;

function stripTracking(link) {
  try {
    const u = new URL(link);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    u.hash = '';
    return u.toString();
  } catch {
    return '';
  }
}

function canonicalForId(cleanLink) {
  let s = cleanLink.replace(/^http:/, 'https:');
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s.toLowerCase();
}

export async function hashId(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf).slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Normalização ─────────────────────────────────────────────

async function normalize(raw, source) {
  const title = cleanText(raw.title, 220);
  const link = stripTracking(decodeEntities(raw.link || '').trim());
  if (!title || !link) return null;

  const parsed = parseDate(raw.dateStr);
  const now = Date.now();
  let ts = parsed ? parsed.getTime() : now;
  if (ts > now + 10 * 60000) ts = now;                     // data no futuro: usa agora
  if (parsed && now - ts > MAX_AGE_MS) return null;        // velha demais

  let summary = cleanText(raw.summaryRaw, 500);
  if (summary.length < 20 || summary.toLowerCase() === title.toLowerCase()) summary = '';

  const isGeneral = source.category === 'geral';
  const category = isGeneral ? classifyCategory(title, summary) : source.category;
  if (!category) return null;                                     // fonte geral: fora dos seus assuntos
  if (!passesFilter(source, title, summary)) return null;

  return {
    id: await hashId(canonicalForId(link)),
    title,
    link,
    date: new Date(ts).toISOString(),
    summary,
    image: raw.image || '',
    category,
    source: source.name,
    sourceId: source.id,
    importance: classifyImportance(title),
    aiSummary: null,
    classified: isGeneral,
  };
}

/** Remove duplicatas por link e por (fonte + título), preferindo a categoria mais específica. */
function dedupe(items) {
  const specificity = it => (it.classified ? 0 : it.category === 'brasil' ? 1 : 2);
  const byId = new Map();
  for (const it of items) {
    const prev = byId.get(it.id);
    if (!prev || specificity(it) > specificity(prev)) byId.set(it.id, it);
  }

  const seenTitle = new Map();
  const result = [];
  for (const it of [...byId.values()].sort((a, b) => new Date(b.date) - new Date(a.date))) {
    const key = `${it.source}|${it.title.toLowerCase().replace(/[^a-z0-9à-ú]+/g, ' ').trim()}`;
    if (seenTitle.has(key)) continue;
    seenTitle.set(key, true);
    result.push(it);
  }
  return result;
}
