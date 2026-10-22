// 会社ごとに Claude（Anthropic の API）へつなぐ。
// API キーは ENCRYPTION_KEY（Cloudflare の秘密の値）で暗号化して D1 に置き、外へは出さない。
import Anthropic, { AuthenticationError, PermissionDeniedError, APIConnectionError } from "@anthropic-ai/sdk";
import type { AppEnv } from "./types";

type Env = AppEnv["Bindings"];

const b64 = (a: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(a)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(env: Env): Promise<CryptoKey> {
  if (!env.ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY が設定されていません");
  return crypto.subtle.importKey("raw", unb64(env.ENCRYPTION_KEY), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptKey(env: Env, plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), new TextEncoder().encode(plain));
  return { cipher: b64(cipher), iv: b64(iv) };
}

async function decryptKey(env: Env, cipher: string, iv: string) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(env), unb64(cipher));
  return new TextDecoder().decode(plain);
}

/** Claude の呼び出し口。AI_GATEWAY_URL があれば Cloudflare AI Gateway を通す（記録と使いすぎの見張り） */
export function claudeClient(env: Env, apiKey: string) {
  return new Anthropic({ apiKey, baseURL: env.AI_GATEWAY_URL || undefined, maxRetries: 1 });
}

/** その会社の Claude の呼び出し口。つながっていなければ null */
export async function companyClaude(env: Env, companyId: string) {
  const row = await env.DB.prepare("SELECT key_cipher, key_iv FROM claude_connections WHERE company_id = ?")
    .bind(companyId).first<{ key_cipher: string; key_iv: string }>();
  if (!row) return null;
  return claudeClient(env, await decryptKey(env, row.key_cipher, row.key_iv));
}

/** キーで実際につながるかを確かめる（モデルの一覧を読むだけ。料金はかからない） */
export async function checkKey(env: Env, apiKey: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const page = await claudeClient(env, apiKey).models.list({ limit: 1 });
    void page;
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthenticationError) return { ok: false, reason: "キーが正しくありません。もう一度コピーして貼ってください" };
    if (e instanceof PermissionDeniedError) return { ok: false, reason: "このキーには使う権限がありません" };
    if (e instanceof APIConnectionError) return { ok: false, reason: "Claude につながりませんでした。少し待ってからもう一度押してください" };
    return { ok: false, reason: "接続を確かめられませんでした" };
  }
}
