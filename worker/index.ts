// すいどうやさん3.0 の受け口（Cloudflare Workers）
import { Hono } from "hono";
import { auth, requireUser } from "./auth";
import { sites } from "./routes/sites";
import { files } from "./routes/files";
import { settings } from "./routes/settings";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.route("/auth", auth);

app.use("/api/*", requireUser);
app.get("/api/me", (c) => {
  const u = c.get("user");
  return c.json({ email: u.email, name: u.name, picture: u.picture });
});
app.route("/api/sites", sites);
app.route("/api", files);
app.route("/api/settings", settings);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "server" }, 500);
});

export default app;
