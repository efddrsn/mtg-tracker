import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://hub.example/api/event/auth/google/callback");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function response() {
  const headers = {};
  return {
    headers,
    status: 0,
    setHeader(k, v) { headers[k] = v; },
    writeHead(status, extra) { this.status = status; Object.assign(headers, extra); },
    end() {},
  };
}
function request(url, cookie = "") {
  return {
    url,
    headers: { cookie, "x-forwarded-proto": "https" },
    socket: { encrypted: false },
  };
}
test("Google login uses PKCE, nonce, state and protected, short-lived cookies", async () => {
  const { beginGoogle, googleAvailable } = await import("./google-auth.mjs");
  expect(googleAvailable).toBe(true);
  const res = response();
  beginGoogle(request("/api/event/auth/google/start"), res);
  expect(res.status).toBe(302);
  expect(res.headers["Set-Cookie"]).toMatch(/HttpOnly; SameSite=Lax; Path=\/api\/event\/auth\/google; Max-Age=600; Secure/);
  const params = new URL(res.headers.Location).searchParams;
  expect(params.get("code_challenge_method")).toBe("S256");
  expect(params.get("state")).toBeTruthy();
  expect(params.get("nonce")).toBeTruthy();
  expect(params.get("client_secret")).toBeNull();
  const [state, verifier, nonce] = res.headers["Set-Cookie"].split(";")[0].split("=")[1].split(".");
  expect(state).toBe(params.get("state"));
  expect(nonce).toBe(params.get("nonce"));
  expect(createHash("sha256").update(verifier).digest("base64url")).toBe(params.get("code_challenge"));
});
test("Google callback rejects a missing or incorrect state before fetching tokens", async () => {
  const { exchangeGoogle } = await import("./google-auth.mjs");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(exchangeGoogle(request("/api/event/auth/google/callback?state=bad&code=fake"))).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
test("Google callback accepts only verified, audience-bound signed identity tokens", async () => {
  const { beginGoogle, exchangeGoogle } = await import("./google-auth.mjs");
  const res = response();
  beginGoogle(request("/api/event/auth/google/start"), res);
  const flowCookie = res.headers["Set-Cookie"].split(";")[0];
  const params = new URL(res.headers.Location).searchParams;
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key1", use: "sig", alg: "RS256" };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "key1" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com", aud: "test-client.apps.googleusercontent.com",
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000),
    nonce: params.get("nonce"), sub: "google-sub-123",
    email: "tester@gmail.com", email_verified: true, name: "Player",
  })).toString("base64url");
  const payload = header + "." + claims;
  const jwt = payload + "." + sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url");
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (String(url).includes("oauth2.googleapis.com/token"))
      return { ok: true, json: async () => ({ id_token: jwt }) };
    if (String(url).includes("oauth2/v3/certs"))
      return { ok: true, json: async () => ({ keys: [jwk] }) };
    throw new Error("Unexpected host");
  }));
  const profile = await exchangeGoogle(request("/api/event/auth/google/callback?state=" +
    encodeURIComponent(params.get("state")) + "&code=abc", flowCookie));
  expect(profile).toMatchObject({
    googleSub: "google-sub-123", email: "tester@gmail.com",
    name: "Player", authoritativeEmail: true,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});
