/**
 * Resumos por IA (factuais, em português do Brasil), em LOTE:
 * uma única chamada resume várias notícias de uma vez, o que cabe folgado na cota gratuita do Gemini.
 *
 * - Usa só o título e o trecho publicados pela fonte; se não houver informação, não inventa.
 * - Gemini (grátis) é o padrão. OpenAI é opcional. Sem nenhuma chave, o site funciona sem resumos.
 * - Modelo: GEMINI_MODEL, ou tenta em ordem gemini-2.5-flash → 2.5-flash-lite → 2.0-flash.
 */

const SYSTEM_PROMPT = `Você é editor de um portal de notícias brasileiro. Para CADA notícia recebida, resuma usando SOMENTE as informações do título e do trecho fornecidos.

Regras:
- Português do Brasil, tom neutro e factual.
- Sem opinião, sem adjetivos de avaliação, sem previsões.
- Não invente nomes, números, datas, locais ou causas que não estejam no texto.
- Se o trecho for curto, faça um resumo curto. Se não houver informação suficiente, devolva "summary" vazio.

Responda APENAS com um array JSON válido, sem markdown, neste formato (um objeto por notícia, mantendo o "id" recebido):
[{"id":"...","summary":"1 a 2 frases","points":["até 3 fatos curtos presentes no texto"]}]`;

const BATCH_SIZE = 6;
const MAX_FIELD = 600;

/**
 * @param {Array} items notícias sem resumo
 * @returns {{ summaries: Map<string,object>, attempted: Set<string>, error?: string }}
 */
export async function summarizeItems(items, env, maxItems = 12) {
  const summaries = new Map();
  const attempted = new Set();
  const provider = pickProvider(env);
  if (!provider) return { summaries, attempted, error: 'sem chave de IA' };

  const pool = items.slice(0, maxItems);
  for (let i = 0; i < pool.length; i += BATCH_SIZE) {
    const batch = pool.slice(i, i + BATCH_SIZE);
    try {
      const result = await provider.run(batch, env);
      for (const it of batch) {
        attempted.add(it.id);
        if (result.has(it.id)) summaries.set(it.id, result.get(it.id));
      }
    } catch (err) {
      console.error(`[IA] ${provider.name} falhou: ${err.message}`);
      return { summaries, attempted, error: err.message };   // erro de rede/cota: não conta tentativa
    }
    await sleep(1200);
  }
  return { summaries, attempted };
}

function pickProvider(env) {
  const forced = String(env.AI_PROVIDER || '').toLowerCase();
  const all = {
    gemini: env.GEMINI_API_KEY ? { name: 'gemini', run: runGemini } : null,
    openai: env.OPENAI_API_KEY ? { name: 'openai', run: runOpenAI } : null,
  };
  if (forced && all[forced]) return all[forced];
  return all.gemini || all.openai || null;
}

function buildPrompt(batch) {
  return JSON.stringify(batch.map(n => ({
    id: n.id,
    titulo: String(n.title).slice(0, 220),
    trecho: String(n.summary || '').slice(0, MAX_FIELD),
  })));
}

async function runGemini(batch, env) {
  const models = env.GEMINI_MODEL
    ? [env.GEMINI_MODEL]
    : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  let lastErr;
  for (const model of models) {
    const res = await fetch(
      `${env.GEMINI_BASE || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: buildPrompt(batch) }] }],
          generationConfig: { maxOutputTokens: 2500, temperature: 0.2, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(45000),
      }
    );
    if (res.status === 404 || res.status === 400) { lastErr = new Error(`Gemini ${model} HTTP ${res.status}`); continue; }
    if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}`);
    const data = await res.json();
    return parseBatchResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || '', batch);
  }
  throw lastErr || new Error('Gemini indisponível');
}

async function runOpenAI(batch, env) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\nEnvolva o array em {"resumos": [...]}.' },
        { role: 'user', content: buildPrompt(batch) },
      ],
      max_tokens: 2500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = await res.json();
  return parseBatchResponse(data.choices?.[0]?.message?.content || '', batch);
}

/** Devolve Map id -> {summary, points, generatedAt}. Ignora ids que não estavam no lote. */
export function parseBatchResponse(text, batch) {
  const out = new Map();
  const ids = new Set(batch.map(n => n.id));
  let arr;
  try {
    const clean = String(text).replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    arr = Array.isArray(parsed) ? parsed : (parsed.resumos || parsed.summaries || []);
  } catch {
    const m = String(text).match(/\[[\s\S]*\]/);
    try { arr = m ? JSON.parse(m[0]) : []; } catch { arr = []; }
  }
  for (const r of arr) {
    if (!r || !ids.has(String(r.id))) continue;
    const summary = String(r.summary || '').replace(/[<>]/g, '').trim().slice(0, 400);
    const points = (Array.isArray(r.points) ? r.points : [])
      .map(p => String(p).replace(/[<>]/g, '').trim().slice(0, 180)).filter(Boolean).slice(0, 3);
    if (!summary && !points.length) continue;
    out.set(String(r.id), { summary, points, generatedAt: new Date().toISOString() });
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
