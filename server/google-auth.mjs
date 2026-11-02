import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const redirectUri = process.env.GOOGLE_REDIRECT_URI || "";
export const googleAvailable = Boolean(clientId && clientSecret && /^https:\/\//.test(redirectUri) && new URL(redirectUri).pathname === "/api/event/auth/google/callback");

const cookieName = "magic_google_flow";
const random = () => randomBytes(32).toString("base64url");
const sha = (value) => createHash("sha256").update(value).digest("base64url");

function secureCookie(req) {
  return req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket.encrypted);
}
function flowCookie(req, value, age) {
  return `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/api/event/auth/google; Max-Age=${age}${secureCookie(req) ? "; Secure" : ""}`;
}
function getFlowCookie(req) {
  const match = (req.headers.cookie || "").match(/(?:^|;\\s*)magic_google_flow=([A-Za-z0-9_.-]+)/);
  return match?.[1] || "";
}
export function clearGoogleCookie(req) { return flowCookie(req, "", 0); }
export function beginGoogle(req, res) {
  if (!googleAvailable) throw Object.assign(new Error("Google login não configurado."), { status: 503 });
  const state = random(), verifier = random(), nonce = random();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code",
    scope: "openid email profile", access_type: "online",
    prompt: "select_account", state, nonce,
    code_challenge: sha(verifier), code_challenge_method: "S256"
  }).toString();
  res.setHeader("Set-Cookie", flowCookie(req, [state, verifier, nonce].join("."), 600));
  res.writeHead(302, { Location: url.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  res.end();
}
async function verifiedIdToken(jwt, nonce) {
  if (typeof jwt !== "string") throw new Error("Google não retornou identidade.");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Token Google inválido.");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  if (header.alg !== "RS256" || !header.kid) throw new Error("Algoritmo de token inválido.");
  const now = Math.floor(Date.now() / 1000);
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) ||
      claims.aud !== clientId || claims.exp <= now || claims.iat > now + 60 ||
      claims.nonce !== nonce || !claims.sub || claims.email_verified !== true) {
    throw new Error("Identidade Google não verificada.");
  }
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Não foi possível validar a assinatura Google.");
  const jwks = await response.json();
  const jwk = jwks.keys?.find(k => k.kid === header.kid && k.kty === "RSA" && k.use === "sig");
  if (!jwk || !verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]),
     createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) {
    throw new Error("Assinatura Google inválida.");
  }
  const email = String(claims.email || "").trim().toLowerCase();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error("Email Google inválido.");
  return {
    googleSub: String(claims.sub),
    email,
    name: String(claims.name || email.split("@")[0]).slice(0, 60),
    // Google's email claim is authoritative for Gmail and Workspace-hosted domains.
    authoritativeEmail: /@(gmail|googlemail)\\.com$/.test(email) ||
       (typeof claims.hd === "string" && email.endsWith("@" + claims.hd.toLowerCase()))
  };
}
export async function exchangeGoogle(req) {
  if (!googleAvailable) throw new Error("Google login não configurado.");
  const requestUrl = new URL(req.url || "", "http://localhost");
  const [expectedState, verifier, nonce] = getFlowCookie(req).split(".");
  if (!expectedState || !verifier || !nonce || requestUrl.searchParams.get("state") !== expectedState ||
      requestUrl.searchParams.has("error")) throw new Error("Fluxo Google expirado ou cancelado.");
  const code = requestUrl.searchParams.get("code");
  if (!code || code.length > 4096) throw new Error("Código Google inválido.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier
    }), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Não foi possível concluir a autenticação Google.");
  const tokens = await response.json();
  return verifiedIdToken(tokens.id_token, nonce);
}
