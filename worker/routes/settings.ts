// 設定：Claude との接続
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { checkKey, encryptKey, companyClaude } from "../claude";

export const settings = new Hono<AppEnv>();

settings.get("/claude", async (c) => {
  const row = await c.env.DB.prepare("SELECT key_last4, connected_at, checked_at FROM claude_connections WHERE company_id = ?")
    .bind(c.get("user").company_id).first<{ key_last4: string; connected_at: string; checked_at: string | null }>();
  return c.json(row ? { connected: true, last4: row.key_last4, connected_at: row.connected_at, checked_at: row.checked_at } : { connected: false });
});

settings.put("/claude", async (c) => {
  const { key } = await c.req.json<{ key?: string }>();
  const apiKey = (key || "").trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(apiKey)) return c.json({ error: "「sk-ant-」で始まるキーを貼ってください" }, 400);
  const check = await checkKey(c.env, apiKey);
  if (!check.ok) return c.json({ error: check.reason }, 400);
  const u = c.get("user");
  const { cipher, iv } = await encryptKey(c.env, apiKey);
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO claude_connections (company_id, key_cipher, key_iv, key_last4, connected_by, connected_at, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_id) DO UPDATE SET key_cipher = excluded.key_cipher, key_iv = excluded.key_iv,
       key_last4 = excluded.key_last4, connected_by = excluded.connected_by, connected_at = excluded.connected_at, checked_at = excluded.checked_at`,
  ).bind(u.company_id, cipher, iv, apiKey.slice(-4), u.id, now, now).run();
  return c.json({ connected: true, last4: apiKey.slice(-4) });
});

// つながっているキーで、今もつながるかを確かめる
settings.post("/claude/check", async (c) => {
  const client = await companyClaude(c.env, c.get("user").company_id);
  if (!client) return c.json({ error: "まだ接続していません" }, 400);
  try {
    await client.models.list({ limit: 1 });
  } catch {
    return c.json({ error: "つながりませんでした。キーが消されていないか、Claude の管理画面で確かめてください" }, 400);
  }
  await c.env.DB.prepare("UPDATE claude_connections SET checked_at = ? WHERE company_id = ?").bind(new Date().toISOString(), c.get("user").company_id).run();
  return c.json({ ok: true });
});

settings.delete("/claude", async (c) => {
  await c.env.DB.prepare("DELETE FROM claude_connections WHERE company_id = ?").bind(c.get("user").company_id).run();
  return c.json({ connected: false });
});
