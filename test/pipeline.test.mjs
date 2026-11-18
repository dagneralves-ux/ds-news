/**
 * Teste do motor de notícias com feeds simulados (não usa a internet).
 * Rode: node test/pipeline.test.mjs
 */
import http from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { classifyCategory, passesFilter, classifyImportance } from '../scripts/lib/classify.js';
import { parseBatchResponse } from '../scripts/lib/ai.js';

let passed = 0;
const ok = (name, fn) => { try { fn(); passed++; console.log('  ok  ', name); } catch (e) { console.error('  FALHOU', name, '\n', e.message); process.exitCode = 1; } };

// ── classificação ──
ok('Lula/STF → política', () => assert.equal(classifyCategory('Lula sanciona lei e STF comenta'), 'politica'));
ok('Flamengo/Brasileirão → futebol', () => assert.equal(classifyCategory('Flamengo vence no Brasileirão'), 'futebol'));
ok('OpenAI → ia', () => assert.equal(classifyCategory('OpenAI lança novo modelo'), 'ia'));
ok('"IA" maiúsculo → ia', () => assert.equal(classifyCategory('Empresas apostam em IA para vender mais'), 'ia'));
ok('"ia" verbo não é IA', () => assert.equal(classifyCategory('Ele ia ao mercado todo dia'), null));
ok('clima não é dos seus assuntos', () => assert.equal(classifyCategory('Previsão do tempo para o fim de semana'), null));
ok('Figma/branding → design', () => assert.equal(classifyCategory('Nova identidade visual e tipografia da marca'), 'design'));
ok('campanha → marketing', () => assert.equal(classifyCategory('Campanha de marketing digital bate recorde'), 'marketing'));
ok('filtro futebol deixa vôlei de fora', () => assert.equal(passesFilter({ filtro: 'futebol' }, 'Vôlei: Brasil vence a Itália', ''), false));
ok('filtro futebol deixa gol passar', () => assert.equal(passesFilter({ filtro: 'futebol' }, 'Gol do Corinthians decide', ''), true));
ok('URGENTE vira urgent', () => assert.equal(classifyImportance('URGENTE: Senado aprova PEC'), 'urgent'));
ok('resposta da IA em lote', () => {
  const m = parseBatchResponse('```json\n[{"id":"a","summary":"Resumo <b>","points":["x"]},{"id":"zzz","summary":"fora"}]\n```', [{ id: 'a' }, { id: 'b' }]);
  assert.equal(m.size, 1); assert.equal(m.get('a').summary, 'Resumo b');
});

// ── pipeline completo com feeds falsos ──
const now = Date.now();
const rfc = ms => new Date(ms).toUTCString();
const item = (t, ms, d = '') => `<item><title><![CDATA[${t}]]></title><link>https://exemplo.com.br/${encodeURIComponent(t).slice(0, 40)}-${ms}</link><pubDate>${rfc(ms)}</pubDate><description><![CDATA[${d}]]></description></item>`;
const rss = items => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>t</title>${items.join('')}</channel></rss>`;
const long = 'Texto de apoio suficientemente longo para que o resumo automático seja gerado a partir deste trecho publicado. ';

const FEEDS = {
  '/futebol.xml': rss([item('Flamengo vence o Palmeiras no Brasileirão', now - 5 * 60000, long), item('Gol nos acréscimos garante virada do Corinthians', now - 20 * 60000, long)]),
  '/esportes.xml': rss([item('Vôlei: seleção vence a Itália', now - 3 * 60000, long), item('Zagueiro do Vasco é convocado para a seleção brasileira', now - 8 * 60000, long)]),
  '/geral.xml': rss([
    item('URGENTE: Senado aprova PEC em votação no plenário', now - 10 * 60000, long),
    item('OpenAI lança novo modelo de inteligência artificial', now - 15 * 60000, long),
    item('Previsão do tempo para o fim de semana', now - 12 * 60000, long),
    item('Ele ia ao mercado todo dia', now - 14 * 60000, long),
    item('Notícia muito antiga sobre Lula', now - 30 * 86400000, long),
  ]),
  '/atom.xml': `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Nova identidade visual e tipografia para a marca</title><link href="https://exemplo.com.br/atom1"/><published>${new Date(now - 30 * 60000).toISOString()}</published><summary>${long}</summary></entry></feed>`,
};

const server = http.createServer((req, res) => {
  if (req.url === '/gemini/v1beta/models/gemini-2.5-flash:generateContent') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const parts = JSON.parse(body).contents[0].parts[0].text;
      const list = JSON.parse(parts);
      const out = list.map(n => ({ id: n.id, summary: `Resumo de: ${n.titulo}`, points: ['ponto'] }));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }));
    });
    return;
  }
  const body = FEEDS[req.url];
  if (!body) { res.statusCode = 404; return res.end('nao'); }
  res.setHeader('content-type', 'application/rss+xml; charset=utf-8'); res.end(body);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const dir = mkdtempSync(join(tmpdir(), 'dsnews-'));
const fontes = [
  { id: 'fut', name: 'Futebol FC', url: `${base}/futebol.xml`, category: 'futebol' },
  { id: 'esp', name: 'Esportes', url: `${base}/esportes.xml`, category: 'futebol', filtro: 'futebol' },
  { id: 'ger', name: 'Geral', url: `${base}/geral.xml`, category: 'geral' },
  { id: 'atom', name: 'Atom', url: `${base}/atom.xml`, category: 'design' },
  { id: 'off', name: 'Fora do ar', url: `${base}/nao-existe.xml`, category: 'marketing' },
];
writeFileSync(join(dir, 'fontes.json'), JSON.stringify(fontes));
const run = (extra = {}) => {
  // spawn assíncrono não é necessário: o servidor roda neste processo, então usamos um subprocesso com espera ativa
  return new Promise(resolve => {
    import('node:child_process').then(({ spawn }) => {
      const p = spawn('node', [new URL('../scripts/atualizar.mjs', import.meta.url).pathname], {
        env: { ...process.env, FONTES_FILE: join(dir, 'fontes.json'), DATA_DIR: join(dir, 'data'),
               GEMINI_API_KEY: 'k', GEMINI_BASE: `${base}/gemini`, ...extra },
      });
      let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
      p.on('close', code => resolve({ code, out }));
    });
  });
};

const r1 = await run();
console.log(r1.out.trim().split('\n').map(l => '    ' + l).join('\n'));
ok('1ª execução termina sem erro', () => assert.equal(r1.code, 0));
const news = JSON.parse(readFileSync(join(dir, 'data', 'news.json'), 'utf8'));
const titles = news.itens.map(n => n.title);
ok('guarda notícias dos seus assuntos', () => assert.ok(titles.includes('Flamengo vence o Palmeiras no Brasileirão')));
ok('filtro de futebol tira o vôlei', () => assert.ok(!titles.some(t => t.includes('Vôlei'))));
ok('fonte geral classifica e descarta o que não interessa', () => {
  assert.ok(titles.some(t => t.startsWith('URGENTE')));
  assert.ok(titles.some(t => t.startsWith('OpenAI')));
  assert.ok(!titles.some(t => t.includes('Previsão do tempo')));
  assert.ok(!titles.some(t => t.includes('Ele ia ao mercado')));
});
ok('notícia com mais de 7 dias fica de fora', () => assert.ok(!titles.some(t => t.includes('muito antiga'))));
ok('Atom funciona e vai para design', () => assert.equal(news.itens.find(n => n.title.includes('identidade visual')).category, 'design'));
ok('categorias corretas', () => {
  const by = t => news.itens.find(n => n.title.startsWith(t)).category;
  assert.equal(by('URGENTE'), 'politica'); assert.equal(by('OpenAI'), 'ia'); assert.equal(by('Zagueiro'), 'futebol');
});
ok('urgente marcado', () => assert.equal(news.itens.find(n => n.title.startsWith('URGENTE')).importance, 'urgent'));
ok('resumos de IA gravados', () => assert.ok(news.itens.every(n => n.aiSummary?.summary?.startsWith('Resumo de:'))));
ok('fonte fora do ar vai para status', () => {
  const st = JSON.parse(readFileSync(join(dir, 'data', 'status.json'), 'utf8'));
  assert.equal(st.fontes.find(f => f.id === 'off').ok, false);
  assert.equal(st.fontes.find(f => f.id === 'fut').ok, true);
});
ok('categorias vão junto no arquivo', () => assert.ok(news.categorias.ia && news.categorias.futebol));

// 2ª execução: sem novidades → não regrava
const mtime1 = statSync(join(dir, 'data', 'news.json')).mtimeMs;
await new Promise(r => setTimeout(r, 50));
const r2 = await run();
ok('2ª execução sem novidades não regrava o arquivo', () => {
  assert.equal(r2.code, 0); assert.ok(r2.out.includes('Sem novidades'));
  assert.equal(statSync(join(dir, 'data', 'news.json')).mtimeMs, mtime1);
});

// 3ª execução: chega uma notícia nova → entra na lista e as antigas continuam
FEEDS['/geral.xml'] = rss([item('PLANTÃO: STF decide sobre Lula agora', Date.now() - 60000, long)]);
const r3 = await run();
ok('notícia nova entra e as antigas ficam', () => {
  const n3 = JSON.parse(readFileSync(join(dir, 'data', 'news.json'), 'utf8'));
  assert.equal(r3.code, 0);
  assert.ok(n3.itens.some(n => n.title.startsWith('PLANTÃO') && n.importance === 'urgent'));
  assert.ok(n3.itens.some(n => n.title.startsWith('Flamengo')));
});

server.close();
console.log(`\n${passed} verificações ok`);
