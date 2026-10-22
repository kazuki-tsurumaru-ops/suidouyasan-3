// Google だけでログインする仕組み（OpenID Connect）。
// ログインを許すのは ALLOWED_EMAILS に書いた Google アカウントだけ。
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv, User } from "./types";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION_COOKIE = "sid";
const SESSION_DAYS = 30;

function randomId(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256url(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function allowed(env: AppEnv["Bindings"], email: string): boolean {
  const list = (env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** ログインした人を記録し、セッションを作る */
async function startSession(env: AppEnv["Bindings"], email: string, name: string | null, picture: string | null) {
  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>();
  if (!user) {
    // まずは1社だけ。最初のログインで会社を1つ作る
    let company = await env.DB.prepare("SELECT id FROM companies LIMIT 1").first<{ id: string }>();
    if (!company) {
      company = { id: crypto.randomUUID() };
      await env.DB.prepare("INSERT INTO companies (id, name) VALUES (?, ?)").bind(company.id, "自社").run();
    }
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO users (id, company_id, email, name, picture) VALUES (?, ?, ?, ?, ?)")
      .bind(id, company.id, email, name, picture).run();
    user = { id, company_id: company.id, email, name, picture };
  } else {
    await env.DB.prepare("UPDATE users SET name = ?, picture = ? WHERE id = ?").bind(name, picture, user.id).run();
  }
  const sid = randomId();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(sid, user.id, expires).run();
  return { sid, expires };
}

export const auth = new Hono<AppEnv>();

auth.get("/google", async (c) => {
  const env = c.env;
  const secure = env.ENVIRONMENT !== "development";
  // 手元の確認用：Google の設定が無いときだけ、DEV_LOGIN_EMAIL でログインできる
  if (env.ENVIRONMENT === "development" && env.DEV_LOGIN_EMAIL && !env.GOOGLE_CLIENT_ID) {
    const { sid, expires } = await startSession(env, env.DEV_LOGIN_EMAIL, "確認用", null);
    setCookie(c, SESSION_COOKIE, sid, { httpOnly: true, secure, sameSite: "Lax", path: "/", expires: new Date(expires) });
    return c.redirect("/");
  }
  const state = randomId();
  const verifier = randomId(32);
  const opts = { httpOnly: true, secure, sameSite: "Lax" as const, path: "/", maxAge: 600 };
  setCookie(c, "g_state", state, opts);
  setCookie(c, "g_verifier", verifier, opts);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.APP_URL}/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await sha256url(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return c.redirect(url.toString());
});

auth.get("/google/callback", async (c) => {
  const env = c.env;
  const secure = env.ENVIRONMENT !== "development";
  const state = c.req.query("state");
  const code = c.req.query("code");
  const saved = getCookie(c, "g_state");
  const verifier = getCookie(c, "g_verifier");
  deleteCookie(c, "g_state", { path: "/" });
  deleteCookie(c, "g_verifier", { path: "/" });
  if (!code || !state || state !== saved || !verifier) return c.redirect("/login?error=state");

  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.APP_URL}/auth/google/callback`, grant_type: "authorization_code", code_verifier: verifier,
    }),
  });
  if (!res.ok) return c.redirect("/login?error=token");
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return c.redirect("/login?error=token");

  const { payload } = await jwtVerify(id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID,
  });
  const email = String(payload.email || "");
  if (!email || payload.email_verified !== true || !allowed(env, email)) return c.redirect("/login?error=denied");

  const { sid, expires } = await startSession(env, email, (payload.name as string) ?? null, (payload.picture as string) ?? null);
  setCookie(c, SESSION_COOKIE, sid, { httpOnly: true, secure, sameSite: "Lax", path: "/", expires: new Date(expires) });
  return c.redirect("/");
});

auth.post("/logout", async (c) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

/** /api の前に通す。ログインしていなければ 401 */
export async function requireUser(c: any, next: () => Promise<void>) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return c.json({ error: "login" }, 401);
  const user = await c.env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?",
  ).bind(sid, new Date().toISOString()).first();
  if (!user) return c.json({ error: "login" }, 401);
  c.set("user", user as User);
  await next();
}
