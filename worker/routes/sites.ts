// 現場の一覧・作成・中身
import { Hono } from "hono";
import type { AppEnv } from "../types";

const KINDS = ["水道局", "元請け", "民間"];

export const sites = new Hono<AppEnv>();

sites.get("/", async (c) => {
  const u = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT s.*,
       (SELECT COUNT(*) FROM photos p WHERE p.site_id = s.id) AS photo_count,
       (SELECT COUNT(*) FROM drawings d WHERE d.site_id = s.id) AS drawing_count
     FROM sites s WHERE s.company_id = ? ORDER BY s.created_at DESC`,
  ).bind(u.company_id).all();
  return c.json({ sites: results });
});

sites.post("/", async (c) => {
  const u = c.get("user");
  const body = await c.req.json<{ name?: string; kind?: string; start_date?: string; end_date?: string }>();
  const name = (body.name || "").trim();
  if (!name) return c.json({ error: "現場の名前を入れてください" }, 400);
  const kind = KINDS.includes(body.kind || "") ? body.kind : "民間";
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO sites (id, company_id, name, kind, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, u.company_id, name, kind, body.start_date || null, body.end_date || null).run();
  return c.json({ id }, 201);
});

sites.get("/:id", async (c) => {
  const u = c.get("user");
  const site = await c.env.DB.prepare("SELECT * FROM sites WHERE id = ? AND company_id = ?").bind(c.req.param("id"), u.company_id).first();
  if (!site) return c.json({ error: "not_found" }, 404);
  const photos = await c.env.DB.prepare("SELECT id, file_name, taken_at, status, part FROM photos WHERE site_id = ? ORDER BY taken_at").bind(site.id).all();
  const drawings = await c.env.DB.prepare("SELECT id, file_name, stage, uploaded_at FROM drawings WHERE site_id = ? ORDER BY uploaded_at").bind(site.id).all();
  return c.json({ site, photos: photos.results, drawings: drawings.results });
});
