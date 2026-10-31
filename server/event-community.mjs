import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const dataDir = process.env.EVENT_DATA_DIR || '/data';
const file = join(dataDir, 'event-community.json');
const limit = new Map();
let pending = Promise.resolve();

function clean(value, max = 140) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '';
}
function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
async function load() {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'));
    return { leads: data.leads || [], feedback: data.feedback || [], shares: data.shares || [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { leads: [], feedback: [], shares: [] };
    throw error;
  }
}
function mutate(updater) {
  const job = pending.then(async () => {
    const data = await load();
    const result = updater(data);
    await mkdir(dataDir, { recursive: true });
    const temp = file + '.' + randomBytes(8).toString('hex') + '.tmp';
    await writeFile(temp, JSON.stringify(data), { mode: 0o600 });
    await rename(temp, file);
    return result;
  });
  pending = job.catch(() => {});
  return job;
}
async function readBody(req) {
  const chunks = [];
  let n = 0;
  for await (const chunk of req) {
    n += chunk.length;
    if (n > 90000) throw Object.assign(new Error('Payload muito grande.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido.'), { status: 400 }); }
}
function permitted(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function throttle(req) {
  const ip = clean(req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown', 90);
  const now = Date.now();
  const bucket = limit.get(ip) || { count: 0, until: now + 5 * 60_000 };
  if (now > bucket.until) { bucket.count = 0; bucket.until = now + 5 * 60_000; }
  bucket.count++;
  limit.set(ip, bucket);
  if (limit.size > 5000) limit.clear();
  return bucket.count <= 120;
}
function email(value) {
  const e = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
}
function admin(req) {
  const expected = process.env.EVENT_ADMIN_KEY || '';
  const supplied = req.headers['x-admin-key'] || '';
  if (!expected || typeof supplied !== 'string' || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
function serialCard(item) {
  if (!item || typeof item !== 'object') return null;
  const name = clean(item.name, 140);
  if (!name) return null;
  const image = clean(item.image, 350);
  let safeImage = '';
  try {
    if (new URL(image).hostname === 'cards.scryfall.io' || new URL(image).hostname === 'c1.scryfall.com') {
      if (new URL(image).protocol === 'https:') safeImage = image;
    }
  } catch { /* image is optional */ }
  return { name, oracleId: clean(item.oracleId, 60), image: safeImage,
    setCode: clean(item.setCode, 15), collectorNumber: clean(item.collectorNumber, 20) };
}
export async function handleEventApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/event/health') {
      return reply(res, 200, { ok: true, storage: dataDir });
    }
    if (req.method === 'GET' && pathname === '/api/event/gallery') {
      await pending;
      const data = await load();
      return reply(res, 200, { shares: data.shares.filter((s) => s.public)
        .slice(-36).reverse().map(({ id, title, nickname, createdAt, cards }) => ({
          id, title, nickname, createdAt, count: cards.length, image: cards[0]?.image || '' })) });
    }
    if (req.method === 'GET' && /^\/api\/event\/shares\/[a-f0-9]{20}$/.test(pathname)) {
      await pending;
      const data = await load();
      const item = data.shares.find((s) => s.id === pathname.split('/').at(-1));
      return item ? reply(res, 200, { share: item }) : reply(res, 404, { error: 'Lista não encontrada.' });
    }
    if (req.method === 'GET' && pathname === '/api/event/admin') {
      if (!admin(req)) return reply(res, 401, { error: 'Acesso restrito.' });
      await pending;
      return reply(res, 200, await load());
    }
    if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });
    if (!permitted(req)) return reply(res, 403, { error: 'Origem não autorizada.' });
    if (!throttle(req)) return reply(res, 429, { error: 'Muitas tentativas. Tente novamente.' });
    const body = await readBody(req);
    if (body.website) return reply(res, 200, { ok: true });
    const now = new Date().toISOString();
    if (pathname === '/api/event/register') {
      const name = clean(body.name, 90), mail = email(body.email);
      if (!name || !mail || body.consent !== true) {
        return reply(res, 400, { error: 'Informe nome, email válido e aceite o contato.' });
      }
      await mutate((data) => {
        const existing = data.leads.find((x) => x.email === mail);
        if (existing) { existing.name = name; existing.nickname = clean(body.nickname, 50); existing.updatedAt = now; }
        else data.leads.push({ id: randomBytes(10).toString('hex'), name, email: mail,
          nickname: clean(body.nickname, 50), consentAt: now, createdAt: now, source: 'event-2026-10-31' });
        data.leads = data.leads.slice(-20000);
      });
      return reply(res, 201, { ok: true });
    }
    if (pathname === '/api/event/feedback') {
      const message = clean(body.message, 1500), rating = Number(body.rating);
      if (message.length < 8) return reply(res, 400, { error: 'Escreva pelo menos 8 caracteres.' });
      if (body.email && (!email(body.email) || body.consent !== true)) {
        return reply(res, 400, { error: 'Para informar email, autorize o contato.' });
      }
      await mutate((data) => {
        data.feedback.push({ id: randomBytes(10).toString('hex'), message,
          feature: clean(body.feature, 60), rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
          email: email(body.email), createdAt: now });
        data.feedback = data.feedback.slice(-20000);
      });
      return reply(res, 201, { ok: true });
    }
    if (pathname === '/api/event/shares') {
      const cards = Array.isArray(body.cards) ? body.cards.slice(0, 150).map(serialCard).filter(Boolean) : [];
      const title = clean(body.title, 90);
      if (!cards.length || !title) return reply(res, 400, { error: 'Escolha uma lista com cartas.' });
      const item = { id: randomBytes(10).toString('hex'), title, nickname: clean(body.nickname, 40) || 'Jogador',
        public: body.public === true, cards, createdAt: now };
      await mutate((data) => { data.shares.push(item); data.shares = data.shares.slice(-1000); });
      return reply(res, 201, { ok: true, id: item.id });
    }
    return reply(res, 404, { error: 'Não encontrado.' });
  } catch (error) {
    console.error('event_api_error', error.message);
    reply(res, error.status || 500, { error: error.status ? error.message : 'Erro ao salvar. Tente novamente.' });
  }
}
