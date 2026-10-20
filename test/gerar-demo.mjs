/** Gera docs de demonstração (dados fictícios) numa pasta temporária: node test/gerar-demo.mjs <destino> */
import { cpSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIES } from '../scripts/lib/categorias.js';
import { generateTrends } from '../scripts/lib/trends.js';

const dest = process.argv[2];
cpSync(new URL('../docs', import.meta.url), dest, { recursive: true });
const now = Date.now();
const cats = Object.keys(CATEGORIES);
const titles = {
  futebol: ['Flamengo vence o Palmeiras e assume a liderança do Brasileirão', 'Seleção brasileira divulga convocação para os próximos jogos', 'Corinthians anuncia reforço para a Libertadores', 'Vasco decide vaga na Sul-Americana', 'Gol nos acréscimos garante virada do Santos FC'],
  politica: ['Senado aprova PEC em votação no plenário', 'STF julga recurso sobre decreto do governo federal', 'Câmara dos Deputados vota projeto de lei da reforma tributária', 'Lula sanciona lei e ministro comenta', 'URGENTE: Congresso convoca sessão extraordinária'],
  ia: ['OpenAI lança novo modelo de inteligência artificial', 'Empresas brasileiras apostam em IA generativa', 'Gemini ganha novos recursos de agentes de IA', 'Nvidia anuncia chips para inteligência artificial', 'Anthropic apresenta atualização do assistente'],
  design: ['Tendências de tipografia para 2027', 'Nova identidade visual de banco brasileiro divulgada', 'Figma lança recursos de design com IA', '36 fontes gratuitas para projetos de branding', 'Ilustração digital: como montar um portfólio'],
  marketing: ['Campanha de marketing digital bate recorde de engajamento', 'Cannes Lions: agências brasileiras levam prêmios', 'Como usar tráfego pago para vender mais', 'Influenciadores mudam estratégia das marcas', 'SEO em 2027: o que muda para as empresas'],
};
const long = 'Trecho de apoio publicado pela fonte com informações suficientes para exibir um resumo e mostrar como o cartão fica quando há texto na descrição da matéria.';
const itens = [];
let n = 0;
for (let i = 0; i < 8; i++) for (const c of cats) {
  const t = titles[c][i % 5] + (i >= 5 ? ` (parte ${i})` : '');
  itens.push({
    id: `id${n++}`, title: t, link: 'https://exemplo.com.br/' + n, date: new Date(now - (n * 37 + 3) * 60000).toISOString(),
    summary: long, image: '', category: c, source: ['Trivela', 'Agência Câmara', 'Tecnoblog', 'Designerd', 'Meio & Mensagem'][cats.indexOf(c)],
    sourceId: 'x', importance: t.startsWith('URGENTE') ? 'urgent' : (i % 4 === 0 ? 'high' : 'medium'),
    aiSummary: i % 2 ? { summary: 'Resumo curto gerado por IA sobre a notícia.', points: ['Primeiro fato', 'Segundo fato'] } : null,
  });
}
mkdirSync(join(dest, 'data'), { recursive: true });
writeFileSync(join(dest, 'data', 'news.json'), JSON.stringify({ atualizadoEm: new Date(now - 600000).toISOString(), categorias: CATEGORIES, tendencias: generateTrends(itens), itens }));
writeFileSync(join(dest, 'data', 'status.json'), JSON.stringify({ verificadoEm: new Date().toISOString(), fontes: [
  { id: 'a', name: 'Trivela', ok: true, count: 8 }, { id: 'b', name: 'Propmark', ok: false, count: 0, erro: 'HTTP 403' }, { id: 'c', name: 'Tecnoblog', ok: true, count: 12 }] }));
console.log('demo ok', itens.length);
