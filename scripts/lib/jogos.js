/**
 * Jogos do dia (API-Football, plano grátis: 100 chamadas/dia).
 * Uma única chamada por execução: /fixtures?date=AAAA-MM-DD traz todos os jogos do dia, e aqui
 * ficam só os campeonatos de config/campeonatos.json.
 */
import { readFileSync } from 'node:fs';

export const CAMPEONATOS = JSON.parse(readFileSync(new URL('../../config/campeonatos.json', import.meta.url), 'utf8'));

const API = 'https://v3.football.api-sports.io';
const TZ = 'America/Sao_Paulo';

const AO_VIVO = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const ENCERRADO = new Set(['FT', 'AET', 'PEN']);
const AGENDADO = new Set(['NS', 'TBD']);

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
export function hojeSP(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function statusDe(short) {
  if (AO_VIVO.has(short)) return 'ao_vivo';
  if (ENCERRADO.has(short)) return 'encerrado';
  if (AGENDADO.has(short)) return 'agendado';
  return 'outro';   // adiado, cancelado, suspenso, W.O.
}

const num = v => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null);
const url = v => (typeof v === 'string' && v.startsWith('https://') ? v : '');
const txt = (v, max = 60) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

/** Converte a resposta da API no formato enxuto que o site usa. */
export function normalizarJogos(resposta, campeonatos = CAMPEONATOS) {
  const ordem = new Map(campeonatos.map((c, i) => [c.id, i]));
  const nomes = new Map(campeonatos.map(c => [c.id, c]));
  const lista = Array.isArray(resposta?.response) ? resposta.response : [];
  return lista
    .filter(j => ordem.has(j?.league?.id) && j?.fixture?.id && j?.teams?.home && j?.teams?.away)
    .map(j => {
      const camp = nomes.get(j.league.id);
      const short = j.fixture.status?.short || '';
      return {
        id: j.fixture.id,
        ligaId: j.league.id,
        liga: camp.curto,
        rodada: txt(j.league.round, 40),
        inicio: new Date(j.fixture.date).toISOString(),
        status: statusDe(short),
        statusTxt: short,
        minuto: num(j.fixture.status?.elapsed),
        casa: { nome: txt(j.teams.home.name), logo: url(j.teams.home.logo) },
        fora: { nome: txt(j.teams.away.name), logo: url(j.teams.away.logo) },
        golsCasa: num(j.goals?.home),
        golsFora: num(j.goals?.away),
        penaltis: j.score?.penalty?.home != null ? [num(j.score.penalty.home), num(j.score.penalty.away)] : undefined,
      };
    })
    .sort((a, b) => ordem.get(a.ligaId) - ordem.get(b.ligaId) || new Date(a.inicio) - new Date(b.inicio));
}

/** Busca os jogos do dia. Lança erro com mensagem clara quando a API recusa. */
export async function buscarJogos({ key, data = hojeSP(), fetchImpl = fetch, campeonatos = CAMPEONATOS } = {}) {
  if (!key) throw new Error('sem chave API_FOOTBALL_KEY');
  const res = await fetchImpl(`${API}/fixtures?date=${data}&timezone=${encodeURIComponent(TZ)}`, {
    headers: { 'x-apisports-key': key },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const erros = json?.errors;
  const msg = Array.isArray(erros) ? erros.join('; ') : Object.values(erros || {}).join('; ');
  if (msg) throw new Error(`API recusou: ${msg}`);
  return { data, jogos: normalizarJogos(json, campeonatos) };
}
