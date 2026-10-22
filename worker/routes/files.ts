// 写真と図面のファイル（Cloudflare R2 に置く）
import { Hono } from "hono";
import type { AppEnv } from "../types";

const MAX_BYTES = 30 * 1024 * 1024;

export const files = new Hono<AppEnv>();

async function ownSite(c: any, siteId: string) {
  return c.env.DB.prepare("SELECT id FROM sites WHERE id = ? AND company_id = ?").bind(siteId, c.get("user").company_id).first();
}

// 写真を入れる。撮影日時は画面の側で写真から読んで一緒に送る（無ければ空）
files.post("/sites/:id/photos", async (c) => {
  const siteId = c.req.param("id");
  if (!(await ownSite(c, siteId))) return c.json({ error: "not_found" }, 404);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > MAX_BYTES) return c.json({ error: "写真を選んでください" }, 400);
  const takenAt = String(form.get("taken_at") || "") || null;
  const hasPlace = form.get("has_place") === "1" ? 1 : 0;
  const id = crypto.randomUUID();
  const key = `photos/${c.get("user").company_id}/${siteId}/${id}`;
  await c.env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await c.env.DB.prepare(
    "INSERT INTO photos (id, site_id, company_id, r2_key, file_name, taken_at, has_place, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, siteId, c.get("user").company_id, key, file.name, takenAt, hasPlace, takenAt ? "振り分け済み" : "確認待ち").run();
  return c.json({ id }, 201);
});

// 図面（Jw_cad）を入れる
files.post("/sites/:id/drawings", async (c) => {
  const siteId = c.req.param("id");
  if (!(await ownSite(c, siteId))) return c.json({ error: "not_found" }, 404);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > MAX_BYTES || !/\.(jww|dxf)$/i.test(file.name)) {
    return c.json({ error: "Jw_cad の図面（.jww）を選んでください" }, 400);
  }
  const stage = ["申請", "竣工"].includes(String(form.get("stage"))) ? String(form.get("stage")) : "その他";
  const id = crypto.randomUUID();
  const key = `drawings/${c.get("user").company_id}/${siteId}/${id}`;
  await c.env.FILES.put(key, file.stream(), { httpMetadata: { contentType: "application/octet-stream" } });
  await c.env.DB.prepare("INSERT INTO drawings (id, site_id, company_id, r2_key, file_name, stage) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, siteId, c.get("user").company_id, key, file.name, stage).run();
  return c.json({ id }, 201);
});

// 写真の中身を返す（ログインした会社のものだけ）
files.get("/photos/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT r2_key FROM photos WHERE id = ? AND company_id = ?")
    .bind(c.req.param("id"), c.get("user").company_id).first<{ r2_key: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const obj = await c.env.FILES.get(row.r2_key);
  if (!obj) return c.json({ error: "not_found" }, 404);
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "private, max-age=3600" } });
});
