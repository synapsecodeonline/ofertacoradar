// Auto-atendente do Chatwoot — responde mensagens recebidas via OpenRouter.
// Recebe webhooks do Agent Bot (message_created), chama a LLM e responde
// como o bot na conversa. Node puro, sem dependências.
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const CW_BASE = (process.env.CHATWOOT_BASE_URL || 'http://rails:3000').replace(/\/$/, '');
const CW_TOKEN = process.env.CHATWOOT_API_TOKEN || ''; // token de usuário (leitura)
const BOT_TOKEN = process.env.CHATWOOT_BOT_TOKEN || CW_TOKEN; // token do agent bot (responder como bot)
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || '1';
const BOT_SECRET = process.env.CHATWOOT_BOT_SECRET || '';
const OR_KEY = process.env.OPENROUTER_API_KEY || '';
const OR_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free';
const MAX_HISTORY = 40;

const SYSTEM_PROMPT = `Você é o assistente virtual do Ofertaço Radar, um site brasileiro de ofertas e comparador de preços.

Regras:
- Responda SEMPRE em português do Brasil, de forma curta e cordial.
- Responda APENAS à ÚLTIMA mensagem do cliente — no máximo ~500 caracteres, sem markdown pesado (nada de ** ou títulos).
- O site reúne ofertas de Amazon, Mercado Livre, Lomadee e Awin — cupons, promoções e descontos.
- Ajude o cliente a encontrar ofertas, explicar como comprar pelo site, tirar dúvidas sobre cupons, frete, troca e devolução.
- Se o cliente pedir para falar com um humano/atendente, diga que já vai transferir para a equipe e se coloque à disposição.
- NUNCA invente preços, prazos ou promessas de desconto específicas que não estejam no histórico da conversa.
- Se não souber a resposta, seja honesto e ofereça buscar ajuda da equipe.`;

const seen = new Set();
const MAX_SEEN = 5000;

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function verifySignature(headers, rawBody) {
  if (!BOT_SECRET) return true;
  const sig = headers['x-chatwoot-signature'] || '';
  const ts = headers['x-chatwoot-timestamp'] || '';
  if (!sig || !ts) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', BOT_SECRET).update(`${ts}.${rawBody}`).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function cwFetch(path, options = {}) {
  const res = await fetch(`${CW_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: CW_TOKEN,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Chatwoot ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function getMessages(displayId) {
  const data = await cwFetch(`/api/v1/accounts/${ACCOUNT_ID}/conversations/${displayId}/messages`);
  return Array.isArray(data) ? data : (data.payload || data.messages || []);
}

async function askLLM(history) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OR_KEY}` },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      max_tokens: 250,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  return (msg.content || '').trim();
}

async function handleIncoming(payload) {
  const conv = payload.conversation || {};
  const displayId = conv.id; // webhook_data usa display_id como id
  if (!displayId) { log('sem conversation.id, ignorando'); return; }

  const messages = await getMessages(displayId);
  const chat = (messages || [])
    .filter(m => !m.private && (m.message_type === 0 || m.message_type === 1 || m.message_type === 'incoming' || m.message_type === 'outgoing') && m.content)
    .slice(-MAX_HISTORY)
    .map(m => ({
      role: (m.message_type === 0 || m.message_type === 'incoming') ? 'user' : 'assistant',
      content: String(m.content).slice(0, 2000),
    }));

  if (!chat.length) { log(`conv ${displayId}: sem mensagens de texto`); return; }
  // Se a última mensagem já é do atendente/bot, não duplica resposta
  const last = chat[chat.length - 1];
  if (last.role === 'assistant') { log(`conv ${displayId}: última msg já é resposta, skip`); return; }

  const reply = await askLLM(chat);
  if (!reply) { log(`conv ${displayId}: LLM retornou vazio`); return; }

  await fetch(`${CW_BASE}/api/v1/accounts/${ACCOUNT_ID}/conversations/${displayId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', api_access_token: BOT_TOKEN },
    body: JSON.stringify({ content: reply }),
    signal: AbortSignal.timeout(30000),
  }).then(async res => {
    if (!res.ok) throw new Error(`Chatwoot POST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  });
  log(`conv ${displayId}: respondeu (${reply.length} chars)`);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url.endsWith('/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  if (req.method !== 'POST' || !req.url.endsWith('/hook')) {
    res.writeHead(404); return res.end();
  }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    if (!verifySignature(req.headers, body)) {
      res.writeHead(401); return res.end('bad signature');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    try {
      const payload = JSON.parse(body);
      if (payload.event !== 'message_created') return;
      const isIncoming = payload.message_type === 0 || payload.message_type === 'incoming';
      if (!isIncoming || payload.private) return; // só msgs recebidas de clientes
      const mid = payload.id;
      if (seen.has(mid)) return;
      seen.add(mid);
      if (seen.size > MAX_SEEN) seen.clear();
      await handleIncoming(payload);
    } catch (e) {
      log('ERRO:', e.message);
    }
  });
});

server.listen(PORT, () => log(`bot ouvindo na porta ${PORT} (model=${OR_MODEL})`));
