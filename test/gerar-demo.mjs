/** Gera docs de demonstração (dados fictícios) numa pasta temporária: node test/gerar-demo.mjs <destino> */
import { cpSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIES } from '../scripts/lib/categorias.js';
import { generateTrends } from '../scripts/lib/trends.js';
import { ASSUNTOS, topicsOf } from '../scripts/lib/classify.js';

const dest = process.argv[2];
cpSync(new URL('../docs', import.meta.url), dest, { recursive: true });
const now = Date.now();
const cats = Object.keys(CATEGORIES);
const titles = {
  futebol: ['Flamengo vence o Palmeiras e assume a liderança do Brasileirão', 'Seleção brasileira divulga convocação para os próximos jogos', 'Corinthians anuncia reforço para a Libertadores', 'Vasco decide vaga na Sul-Americana', 'Gol nos acréscimos garante virada do Santos FC'],
  politica: ['Senado aprova PEC em votação no plenário', 'STF julga recurso sobre decreto do governo federal', 'Câmara dos Deputados vota projeto de lei da reforma tributária', 'Lula sanciona lei e ministro comenta', 'URGENTE: Congresso convoca sessão extraordinária'],
  ia: ['Adobe lança novo recurso de IA no Photoshop','GitHub Copilot ganha agente que abre pull requests','CorelDRAW 2026 chega com ferramentas de IA','OpenAI lança novo modelo de inteligência artificial', 'Empresas brasileiras apostam em IA generativa', 'Gemini ganha novos recursos de agentes de IA', 'Nvidia anuncia chips para inteligência artificial', 'Anthropic apresenta atualização do assistente'],
  economia: ['Copom mantém a Selic e dólar fecha em alta','Inflação desacelera e IPCA vem abaixo do esperado','Ibovespa sobe com Petrobras e bancos','Haddad apresenta meta fiscal e orçamento','Desemprego cai e renda média bate recorde'],
};
const long = 'Trecho de apoio publicado pela fonte com informações suficientes para exibir um resumo e mostrar como o cartão fica quando há texto na descrição da matéria.';
const itens = [];
let n = 0;
for (let i = 0; i < 8; i++) for (const c of cats) {
  const t = titles[c][i % 5] + (i >= 5 ? ` (parte ${i})` : '');
  itens.push({
    id: `id${n++}`, title: t, link: 'https://exemplo.com.br/' + n, date: new Date(now - (n * 37 + 3) * 60000).toISOString(),
    summary: long, image: n % 7 === 0 ? 'https://exemplo.invalid/foto.jpg' : '', category: c, source: ['InfoMoney', 'Trivela', 'Agência Câmara', 'Tecnoblog'][cats.indexOf(c)],
    sourceId: 'x', importance: t.startsWith('URGENTE') ? 'urgent' : (i % 4 === 0 ? 'high' : 'medium'),
    aiSummary: i % 2 ? { summary: 'Resumo curto gerado por IA sobre a notícia.', points: ['Primeiro fato', 'Segundo fato'] } : null,
  });
}
// mesma notícia em outras fontes (demonstra o agrupamento)
['Outra Fonte A', 'Outra Fonte B'].forEach((src, k) => {
  cats.slice(0, 4).forEach((c, j) => {
    const base = itens.find(n => n.category === c && n.title === titles[c][0]);
    if (base) itens.push({ ...base, id: `dup${k}${j}`, link: 'https://exemplo.com.br/dup' + k + j, source: src, title: base.title + ' hoje', date: new Date(new Date(base.date).getTime() + (25 + k * 70) * 60000).toISOString(), aiSummary: null });
  });
});
itens.forEach(n => { n.topics = topicsOf(n.title, n.summary); });
mkdirSync(join(dest, 'data'), { recursive: true });
writeFileSync(join(dest, 'data', 'news.json'), JSON.stringify({ atualizadoEm: new Date(now - 600000).toISOString(), categorias: CATEGORIES, assuntos: ASSUNTOS.map(({ id, categoria, label }) => ({ id, categoria, label })), tendencias: generateTrends(itens), itens }));
writeFileSync(join(dest, 'data', 'status.json'), JSON.stringify({ verificadoEm: new Date().toISOString(), fontes: [
  { id: 'a', name: 'Trivela', ok: true, count: 8 }, { id: 'b', name: 'Adobe Blog', ok: false, count: 0, erro: 'HTTP 403' }, { id: 'c', name: 'Tecnoblog', ok: true, count: 12 }] }));
console.log('demo ok', itens.length);
