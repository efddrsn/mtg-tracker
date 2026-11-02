import assert from "node:assert/strict";
import { test, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const path = await mkdtemp(join(tmpdir(), "magic-hub-test-"));
process.env.EVENT_DATA_DIR = path;
process.env.EVENT_ADMIN_KEY = "local-test-admin-password";
const { handleEventApi } = await import("./event-community.mjs");
const server = createServer((req, res) => {
  void handleEventApi(req, res, new URL(req.url, "http://localhost").pathname);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(path, { recursive: true, force: true });
});
async function call(url, method = "GET", body, headers = {}) {
  const response = await fetch(origin + url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json() };
}
test("register persists name and email, deduplicates repeated email, and protects admin", async () => {
  const invalid = await call("/api/event/register", "POST", {
    name: "Player",
    email: "player@example.com",
  });
  assert.equal(invalid.status, 400);
  for (const nickname of ["First", "Second"]) {
    const r = await call("/api/event/register", "POST", {
      name: "Player",
      email: "player@example.com",
      nickname,
      consent: true,
    });
    assert.equal(r.status, 201);
  }
  assert.equal((await call("/api/event/admin")).status, 401);
  const admin = await call("/api/event/admin", "GET", undefined, {
    "x-admin-key": "local-test-admin-password",
  });
  assert.equal(admin.status, 200);
  assert.equal(admin.json.leads.length, 1);
  assert.equal(admin.json.leads[0].nickname, "Second");
});
test("share is publicly readable, but private shares never appear in gallery", async () => {
  const cards = [
    {
      name: "Sol Ring",
      oracleId: "123",
      image: "https://cards.scryfall.io/normal/front/x/1/test.jpg",
    },
  ];
  const privateShare = await call("/api/event/shares", "POST", {
    title: "Private",
    cards,
    nickname: "A",
  });
  const publicShare = await call("/api/event/shares", "POST", {
    title: "Public",
    cards,
    public: true,
    nickname: "B",
  });
  assert.equal(privateShare.status, 201);
  assert.equal(publicShare.status, 201);
  const gallery = (await call("/api/event/gallery")).json.shares;
  assert.equal(gallery.length, 1);
  assert.equal(gallery[0].title, "Public");
  assert.equal(
    (await call("/api/event/shares/" + privateShare.json.id)).json.share.title,
    "Private",
  );
});
test("feedback is stored only in private admin endpoint", async () => {
  const r = await call("/api/event/feedback", "POST", {
    message: "The swiper is fun, please add filters.",
    feature: "Swiper",
    rating: 5,
  });
  assert.equal(r.status, 201);
  const admin = (
    await call("/api/event/admin", "GET", undefined, {
      "x-admin-key": "local-test-admin-password",
    })
  ).json;
  assert.equal(admin.feedback.length, 1);
  assert.equal(admin.feedback[0].email, "");
  const gallery = await call("/api/event/gallery");
  assert.equal(
    JSON.stringify(gallery.json).includes("player@example.com"),
    false,
  );
});
test("cross-origin POST is rejected", async () => {
  const r = await call(
    "/api/event/register",
    "POST",
    { name: "Bad", email: "bad@example.com", consent: true },
    { origin: "https://evil.example" },
  );
  assert.equal(r.status, 403);
});

test("owner can update the same URL, change visibility, revoke and restore; visitors cannot", async () => {
  const create = await call("/api/event/shares", "POST", {
    title: "Editable",
    public: true,
    cards: [{ name: "Island", quantity: 33, section: "main" }],
  });
  const url = "/api/event/shares/" + create.json.id;
  const owner = { "x-owner-token": create.json.ownerToken };
  assert.equal((await call(url, "PUT", { title: "Hacked" })).status, 403);
  assert.equal((await call(url, "DELETE")).status, 403);
  assert.equal(
    (await call(url, "PUT", { title: "Updated", public: false }, owner)).status,
    200,
  );
  const shared = (await call(url)).json.share;
  assert.equal(shared.title, "Updated");
  assert.equal(shared.cards[0].quantity, 33);
  assert.equal(shared.ownerHash, undefined);
  assert.equal(shared.userId, undefined);
  assert.equal(shared.ownerToken, undefined);
  assert.equal(
    (await call("/api/event/gallery")).json.shares.some(
      (s) => s.id === create.json.id,
    ),
    false,
  );
  assert.equal((await call(url, "DELETE", undefined, owner)).status, 200);
  assert.equal((await call(url)).status, 404);
  assert.equal((await call(url, "PUT", { restore: true }, owner)).status, 200);
  assert.equal((await call(url)).status, 200);
});

test("accounts isolate workspaces, persist latest revisions, and invalidate logout sessions", async () => {
  const signup = await fetch(origin + "/api/event/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({
      name: "QA",
      email: "qa@example.com",
      password: "test-only-password-2026",
    }),
  });
  assert.equal(signup.status, 201);
  const cookie = signup.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  const headers = { cookie: cookie.split(";")[0] };
  const publicUser = (await signup.json()).user;
  assert.equal(publicUser.passwordHash, undefined);
  assert.equal((await call("/api/event/workspace")).status, 401);
  const deck = {
    id: "private-id",
    title: "Only mine",
    cards: [{ name: "Island", quantity: 33, section: "main" }],
    updatedAt: 100,
  };
  assert.equal(
    (await call("/api/event/workspace", "PUT", { decks: [deck] }, headers))
      .status,
    200,
  );
  await call(
    "/api/event/workspace",
    "PUT",
    { decks: [{ ...deck, title: "stale", updatedAt: 50 }] },
    headers,
  );
  const workspace = (
    await call("/api/event/workspace", "GET", undefined, headers)
  ).json;
  assert.equal(workspace.decks[0].title, "Only mine");
  const badLogin = await call("/api/event/auth/login", "POST", {
    email: "qa@example.com",
    password: "wrong-password-2026",
  });
  assert.equal(badLogin.status, 401);
  const admin = (
    await call("/api/event/admin", "GET", undefined, {
      "x-admin-key": "local-test-admin-password",
    })
  ).json;
  assert.equal(admin.users, undefined);
  assert.equal(admin.sessions, undefined);
  assert.equal(
    (await call("/api/event/auth/logout", "POST", {}, headers)).status,
    200,
  );
  assert.equal(
    (await call("/api/event/workspace", "GET", undefined, headers)).status,
    401,
  );
  const login = await fetch(origin + "/api/event/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "qa@example.com",
      password: "test-only-password-2026",
    }),
  });
  assert.equal(login.status, 200);
  const restored = (
    await call("/api/event/workspace", "GET", undefined, {
      cookie: login.headers.get("set-cookie").split(";")[0],
    })
  ).json;
  assert.equal(restored.decks[0].cards[0].quantity, 33);
  assert.equal(
    (
      await call("/api/event/auth/signup", "POST", {
        name: "Another",
        email: "another@example.com",
        password: "another-password-2026",
      })
    ).status,
    201,
  );
});

test("share payload limits are explicit rather than silently losing cards", async () => {
  const result = await call("/api/event/shares", "POST", {
    title: "Too big",
    cards: Array.from({ length: 251 }, (_, i) => ({ name: "Card " + i })),
  });
  assert.equal(result.status, 400);
});
