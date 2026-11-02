import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  randomBytes,
  timingSafeEqual,
  createHash,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);

const dataDir = process.env.EVENT_DATA_DIR || "/data";
const file = join(dataDir, "event-community.json");
const limit = new Map();
let pending = Promise.resolve();

function clean(value, max = 140) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f<>]/g, "")
        .trim()
        .slice(0, max)
    : "";
}
function reply(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
async function load() {
  try {
    const data = JSON.parse(await readFile(file, "utf8"));
    return {
      ...data,
      leads: data.leads || [],
      feedback: data.feedback || [],
      shares: data.shares || [],
      users: data.users || [],
      sessions: data.sessions || [],
    };
  } catch (error) {
    if (error.code === "ENOENT")
      return { leads: [], feedback: [], shares: [], users: [], sessions: [] };
    throw error;
  }
}
function mutate(updater) {
  const job = pending.then(async () => {
    const data = await load();
    const result = await updater(data);
    await mkdir(dataDir, { recursive: true });
    const temp = file + "." + randomBytes(8).toString("hex") + ".tmp";
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
    if (n > 2_000_000)
      throw Object.assign(new Error("Payload muito grande."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON inválido."), { status: 400 });
  }
}
function permitted(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}
function throttle(req) {
  const ip = clean(
    req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown",
    90,
  );
  const now = Date.now();
  const bucket = limit.get(ip) || { count: 0, until: now + 5 * 60_000 };
  if (now > bucket.until) {
    bucket.count = 0;
    bucket.until = now + 5 * 60_000;
  }
  bucket.count++;
  limit.set(ip, bucket);
  if (limit.size > 5000) limit.clear();
  return bucket.count <= 120;
}
function email(value) {
  const e = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}
function admin(req) {
  const expected = process.env.EVENT_ADMIN_KEY || "";
  const supplied = req.headers["x-admin-key"] || "";
  if (
    !expected ||
    typeof supplied !== "string" ||
    expected.length !== supplied.length
  )
    return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
function serialCard(item) {
  if (!item || typeof item !== "object") return null;
  const name = clean(item.name, 140);
  if (!name) return null;
  const image = clean(item.image, 350);
  let safeImage = "";
  try {
    if (
      new URL(image).hostname === "cards.scryfall.io" ||
      new URL(image).hostname === "c1.scryfall.com"
    ) {
      if (new URL(image).protocol === "https:") safeImage = image;
    }
  } catch {
    /* image is optional */
  }
  return {
    name,
    quantity: Math.max(
      1,
      Math.min(999, Math.floor(Number(item.quantity) || 1)),
    ),
    section: ["commander", "sideboard", "main"].includes(item.section)
      ? item.section
      : "main",
    oracleId: clean(item.oracleId, 60),
    image: safeImage,
    setCode: clean(item.setCode, 15),
    collectorNumber: clean(item.collectorNumber, 20),
  };
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
function safeEqual(a, b) {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
function sessionUser(req, data) {
  const token = /(?:^|;\s*)magic_session=([a-f0-9]{64})(?:;|$)/.exec(
    req.headers.cookie || "",
  )?.[1];
  if (!token) return null;
  const session = data.sessions.find(
    (s) => s.hash === hash(token) && s.expires > Date.now(),
  );
  return session
    ? data.users.find((u) => u.id === session.userId) || null
    : null;
}
function owns(req, data, item) {
  const user = sessionUser(req, data);
  return (
    !!(user && item.userId === user.id) ||
    !!(
      item.ownerHash &&
      safeEqual(hash(req.headers["x-owner-token"] || ""), item.ownerHash)
    )
  );
}
function publicShare(item) {
  const { ownerHash, userId, ...share } = item;
  return share;
}
function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}
function cookie(req, token, age = 2592000) {
  const secure =
    req.headers["x-forwarded-proto"] === "https" || req.socket.encrypted;
  return `magic_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? "; Secure" : ""}`;
}

export async function handleEventApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/event/health") {
      return reply(res, 200, { ok: true, storage: dataDir });
    }
    if (req.method === "GET" && pathname === "/api/event/gallery") {
      await pending;
      const data = await load();
      return reply(res, 200, {
        shares: data.shares
          .filter((s) => s.public && !s.deletedAt)
          .slice(-36)
          .reverse()
          .map(({ id, title, nickname, createdAt, cards }) => ({
            id,
            title,
            nickname,
            createdAt,
            count: cards.reduce((n, c) => n + (c.quantity || 1), 0),
            image: cards[0]?.image || "",
          })),
      });
    }
    if (
      req.method === "GET" &&
      /^\/api\/event\/shares\/[a-f0-9]{20}$/.test(pathname)
    ) {
      await pending;
      const data = await load();
      const item = data.shares.find(
        (s) => s.id === pathname.split("/").at(-1) && !s.deletedAt,
      );
      return item
        ? reply(res, 200, { share: publicShare(item) })
        : reply(res, 404, { error: "Lista não encontrada." });
    }
    if (
      req.method === "GET" &&
      ["/api/event/session", "/api/event/workspace"].includes(pathname)
    ) {
      await pending;
      const data = await load();
      const user = sessionUser(req, data);
      if (pathname.endsWith("/session"))
        return reply(res, 200, { user: publicUser(user) });
      if (!user)
        return reply(res, 401, {
          error: "Entre para acessar seus decks salvos na conta.",
        });
      return reply(res, 200, { decks: user.decks || [] });
    }
    if (req.method === "GET" && pathname === "/api/event/admin") {
      if (!admin(req)) return reply(res, 401, { error: "Acesso restrito." });
      await pending;
      const data = await load();
      return reply(res, 200, {
        leads: data.leads,
        feedback: data.feedback,
        shares: data.shares.map(publicShare),
      });
    }
    if (!["POST", "PUT", "DELETE"].includes(req.method))
      return reply(res, 405, { error: "Método não permitido." });
    if (!permitted(req))
      return reply(res, 403, { error: "Origem não autorizada." });
    if (!throttle(req))
      return reply(res, 429, { error: "Muitas tentativas. Tente novamente." });
    const body = req.method === "DELETE" ? {} : await readBody(req);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply(res, 400, { error: "Objeto JSON esperado." });
    if (body.website) return reply(res, 200, { ok: true });
    const now = new Date().toISOString();
    if (pathname === "/api/event/auth/logout" && req.method === "POST") {
      await mutate((data) => {
        const token = /(?:^|;\s*)magic_session=([a-f0-9]{64})/.exec(
          req.headers.cookie || "",
        )?.[1];
        if (token)
          data.sessions = data.sessions.filter((s) => s.hash !== hash(token));
      });
      res.setHeader("Set-Cookie", cookie(req, "", 0));
      return reply(res, 200, { ok: true });
    }
    if (
      ["/api/event/auth/signup", "/api/event/auth/login"].includes(pathname) &&
      req.method === "POST"
    ) {
      const mail = email(body.email),
        password = typeof body.password === "string" ? body.password : "";
      if (!mail || password.length < 10 || password.length > 128)
        return reply(res, 400, {
          error: "Use email válido e senha de 10 a 128 caracteres.",
        });
      // A separate, small budget prevents the general form throttle from permitting expensive password attacks.
      const authKey = "auth:" + (req.socket.remoteAddress || "") + ":" + mail;
      const attempt = limit.get(authKey) || {
        count: 0,
        until: Date.now() + 900000,
      };
      if (Date.now() > attempt.until) {
        attempt.count = 0;
        attempt.until = Date.now() + 900000;
      }
      attempt.count++;
      limit.set(authKey, attempt);
      if (attempt.count > 12)
        return reply(res, 429, {
          error: "Muitas tentativas. Aguarde 15 minutos.",
        });
      const signup = pathname.endsWith("/signup");
      const token = randomBytes(32).toString("hex");
      const user = await mutate(async (data) => {
        let user = data.users.find((u) => u.email === mail);
        if (signup) {
          if (user)
            throw Object.assign(
              new Error("Não foi possível criar a conta. Tente entrar."),
              { status: 409 },
            );
          const name = clean(body.name, 60);
          if (!name)
            throw Object.assign(new Error("Informe seu nome."), {
              status: 400,
            });
          const salt = randomBytes(16).toString("hex");
          const derived = (await scrypt(password, salt, 64)).toString("hex");
          user = {
            id: randomBytes(12).toString("hex"),
            name,
            email: mail,
            salt,
            passwordHash: derived,
            decks: [],
            createdAt: now,
          };
          data.users.push(user);
        } else {
          const derived = (
            await scrypt(password, user?.salt || "invalid-user-salt", 64)
          ).toString("hex");
          if (!user || !safeEqual(derived, user.passwordHash))
            throw Object.assign(new Error("Email ou senha incorretos."), {
              status: 401,
            });
        }
        data.sessions = data.sessions.filter((s) => s.expires > Date.now());
        data.sessions.push({
          hash: hash(token),
          userId: user.id,
          expires: Date.now() + 2592000000,
        });
        return publicUser(user);
      });
      res.setHeader("Set-Cookie", cookie(req, token));
      return reply(res, signup ? 201 : 200, { user });
    }
    if (pathname === "/api/event/workspace" && req.method === "PUT") {
      await mutate((data) => {
        const user = sessionUser(req, data);
        if (!user)
          throw Object.assign(
            new Error("Sua sessão expirou. Entre novamente."),
            { status: 401 },
          );
        if (!Array.isArray(body.decks) || body.decks.length > 100)
          throw Object.assign(new Error("Limite de 100 decks por conta."), {
            status: 400,
          });
        for (const deck of body.decks) {
          if (
            !deck ||
            typeof deck.id !== "string" ||
            !Array.isArray(deck.cards) ||
            deck.cards.length > 250
          )
            throw Object.assign(
              new Error("Deck inválido ou acima de 250 cartas diferentes."),
              { status: 400 },
            );
        }
        // Merge by deck and timestamp: stale tabs cannot overwrite newer edits or deletion tombstones.
        const merged = new Map((user.decks || []).map((d) => [d.id, d]));
        for (const deck of body.decks)
          if (
            !merged.has(deck.id) ||
            Number(deck.updatedAt) > Number(merged.get(deck.id).updatedAt)
          )
            merged.set(deck.id, deck);
        if (merged.size > 100)
          throw Object.assign(new Error("Limite de 100 decks por conta."), {
            status: 400,
          });
        user.decks = [...merged.values()];
      });
      const data = await load();
      return reply(res, 200, {
        ok: true,
        decks: sessionUser(req, data)?.decks || [],
      });
    }
    if (
      /^\/api\/event\/shares\/[a-f0-9]{20}$/.test(pathname) &&
      ["PUT", "DELETE"].includes(req.method)
    ) {
      const id = pathname.split("/").at(-1);
      const result = await mutate((data) => {
        const item = data.shares.find((s) => s.id === id);
        if (!item)
          throw Object.assign(new Error("Lista não encontrada."), {
            status: 404,
          });
        if (!owns(req, data, item) && !admin(req))
          throw Object.assign(new Error("Você não pode alterar esta lista."), {
            status: 403,
          });
        if (req.method === "DELETE") {
          item.deletedAt = now;
          item.public = false;
          return { ok: true };
        }
        if (body.restore === true) {
          delete item.deletedAt;
          return { ok: true, id };
        }
        if (item.deletedAt)
          throw Object.assign(new Error("Este link foi removido."), {
            status: 404,
          });
        const cards = Array.isArray(body.cards)
          ? body.cards.map(serialCard).filter(Boolean)
          : item.cards;
        if (!cards.length || cards.length > 250)
          throw Object.assign(new Error("Use de 1 a 250 cartas diferentes."), {
            status: 400,
          });
        const title = clean(body.title, 90);
        if (body.title !== undefined && !title)
          throw Object.assign(new Error("Informe o nome do deck."), {
            status: 400,
          });
        if (title) item.title = title;
        if (body.nickname !== undefined)
          item.nickname = clean(body.nickname, 40) || "Jogador";
        if (body.public !== undefined) item.public = body.public === true;
        item.cards = cards;
        item.updatedAt = now;
        return { ok: true, id };
      });
      return reply(res, 200, result);
    }
    if (req.method !== "POST")
      return reply(res, 405, { error: "Método não permitido." });
    if (pathname === "/api/event/register") {
      const name = clean(body.name, 90),
        mail = email(body.email);
      if (!name || !mail || body.consent !== true) {
        return reply(res, 400, {
          error: "Informe nome, email válido e aceite o contato.",
        });
      }
      await mutate((data) => {
        const existing = data.leads.find((x) => x.email === mail);
        if (existing) {
          existing.name = name;
          existing.nickname = clean(body.nickname, 50);
          existing.updatedAt = now;
        } else
          data.leads.push({
            id: randomBytes(10).toString("hex"),
            name,
            email: mail,
            nickname: clean(body.nickname, 50),
            consentAt: now,
            createdAt: now,
            source: "event-2026-10-31",
          });
        data.leads = data.leads.slice(-20000);
      });
      return reply(res, 201, { ok: true });
    }
    if (pathname === "/api/event/feedback") {
      const message = clean(body.message, 1500),
        rating = Number(body.rating);
      if (message.length < 8)
        return reply(res, 400, { error: "Escreva pelo menos 8 caracteres." });
      if (body.email && (!email(body.email) || body.consent !== true)) {
        return reply(res, 400, {
          error: "Para informar email, autorize o contato.",
        });
      }
      await mutate((data) => {
        data.feedback.push({
          id: randomBytes(10).toString("hex"),
          message,
          feature: clean(body.feature, 60),
          rating:
            Number.isInteger(rating) && rating >= 1 && rating <= 5
              ? rating
              : null,
          email: email(body.email),
          createdAt: now,
        });
        data.feedback = data.feedback.slice(-20000);
      });
      return reply(res, 201, { ok: true });
    }
    if (pathname === "/api/event/shares") {
      const cards = Array.isArray(body.cards)
        ? body.cards.map(serialCard).filter(Boolean)
        : [];
      const title = clean(body.title, 90);
      if (!cards.length || cards.length > 250 || !title)
        return reply(res, 400, { error: "Escolha uma lista com cartas." });
      const ownerToken = randomBytes(32).toString("hex");
      const item = {
        ownerHash: hash(ownerToken),
        id: randomBytes(10).toString("hex"),
        title,
        nickname: clean(body.nickname, 40) || "Jogador",
        public: body.public === true,
        cards,
        createdAt: now,
      };
      await mutate((data) => {
        item.userId = sessionUser(req, data)?.id || null;
        data.shares.push(item);
      });
      return reply(res, 201, { ok: true, id: item.id, ownerToken });
    }
    return reply(res, 404, { error: "Não encontrado." });
  } catch (error) {
    console.error("event_api_error", error.message);
    reply(res, error.status || 500, {
      error: error.status ? error.message : "Erro ao salvar. Tente novamente.",
    });
  }
}
