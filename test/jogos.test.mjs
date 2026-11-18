/** Teste do coletor de jogos com resposta simulada: node test/jogos.test.mjs */
import assert from 'node:assert/strict';
import { buscarJogos, normalizarJogos, statusDe, hojeSP } from '../scripts/lib/jogos.js';

let n = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log('  ok  ', name); }, e => { console.error('  FALHOU', name, '\n', e.message); process.exitCode = 1; });

const fx = (id, liga, short, date, h, a, gh, ga, extra = {}) => ({
  fixture: { id, date, status: { short, elapsed: extra.min ?? null } },
  league: { id: liga, round: 'Regular Season - 33' },
  teams: { home: { name: h, logo: `https://media.api-sports.io/football/teams/${id}1.png` }, away: { name: a, logo: 'http://inseguro/x.png' } },
  goals: { home: gh, away: ga }, score: { penalty: extra.pen || { home: null, away: null } },
});
const resposta = { errors: [], response: [
  fx(3, 39, 'NS', '2026-11-18T17:00:00-03:00', 'Arsenal', 'Chelsea', null, null),
  fx(1, 71, 'FT', '2026-11-18T19:00:00-03:00', 'Flamengo', 'Palmeiras', 2, 1),
  fx(2, 71, '2H', '2026-11-18T16:00:00-03:00', 'Vasco', 'Santos', 0, 0, { min: 63 }),
  fx(9, 999, 'NS', '2026-11-18T16:00:00-03:00', 'Time X', 'Time Y', null, null),
  fx(4, 13, 'PST', '2026-11-18T21:30:00-03:00', 'River', 'Boca', null, null),
] };

await ok('status da API viram 4 estados', () => {
  assert.equal(statusDe('2H'), 'ao_vivo'); assert.equal(statusDe('HT'), 'ao_vivo');
  assert.equal(statusDe('FT'), 'encerrado'); assert.equal(statusDe('PEN'), 'encerrado');
  assert.equal(statusDe('NS'), 'agendado'); assert.equal(statusDe('PST'), 'outro');
});
await ok('só campeonatos escolhidos, ordenados por campeonato e horário', () => {
  const j = normalizarJogos(resposta);
  assert.deepEqual(j.map(x => x.id), [2, 1, 4, 3]);
  assert.equal(j[0].liga, 'Série A'); assert.equal(j[0].minuto, 63); assert.equal(j[0].status, 'ao_vivo');
  assert.equal(j[1].golsCasa, 2); assert.equal(j[1].status, 'encerrado');
  assert.equal(j[3].golsCasa, null);
});
await ok('logo http inseguro é descartado', () => assert.equal(normalizarJogos(resposta)[0].fora.logo, ''));
await ok('buscarJogos usa a chave e a data', async () => {
  let visto;
  const r = await buscarJogos({ key: 'K', data: '2026-11-18', fetchImpl: async (u, o) => { visto = { u, o }; return { ok: true, json: async () => resposta }; } });
  assert.equal(r.jogos.length, 4); assert.equal(r.data, '2026-11-18');
  assert.match(visto.u, /date=2026-11-18/); assert.equal(visto.o.headers['x-apisports-key'], 'K');
});
await ok('erro da API vira exceção legível', async () => {
  await assert.rejects(buscarJogos({ key: 'K', fetchImpl: async () => ({ ok: true, json: async () => ({ errors: { token: 'Error/Missing application key' }, response: [] }) }) }), /Missing application key/);
  await assert.rejects(buscarJogos({ key: 'K', fetchImpl: async () => ({ ok: false, status: 429 }) }), /HTTP 429/);
  await assert.rejects(buscarJogos({}), /sem chave/);
});
await ok('hojeSP no formato AAAA-MM-DD', () => assert.match(hojeSP(), /^\d{4}-\d{2}-\d{2}$/));
console.log(`${n} verificações ok`);
