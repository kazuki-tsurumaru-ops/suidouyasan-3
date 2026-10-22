import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api, type ClaudeStatus } from "../lib/api";
import { Page, rise } from "../components/Shell";
import { FullSkeleton } from "../components/Skeleton";

export function Settings() {
  const [st, setSt] = useState<ClaudeStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { api.claude().then(setSt); }, []);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try { await f(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  };

  if (!st) return <FullSkeleton withShell={false} />;
  return (
    <Page>
      <div className="head"><h1>設定</h1></div>
      <motion.section className="glass panel" style={{ display: "grid", gap: 14, maxWidth: 720 }} {...rise(0)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>Claudeと接続</h2>
          <AnimatePresence mode="wait">
            <motion.span
              key={st.connected ? "on" : "off"}
              className={"badge " + (st.connected ? "ok" : "wait")}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
            >
              {st.connected ? `接続済み（末尾 ${st.last4}）` : "まだ接続していません"}
            </motion.span>
          </AnimatePresence>
        </div>

        {st.connected ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <motion.button className="btn" disabled={busy} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
              onClick={() => run(async () => { await api.checkClaude(); setMsg({ ok: true, text: "つながっています" }); })}>
              接続を確かめる
            </motion.button>
            <motion.button className="btn ghost" disabled={busy} whileTap={{ scale: 0.95 }}
              onClick={() => run(async () => { setSt(await api.disconnectClaude()); })}>
              接続を外す
            </motion.button>
          </div>
        ) : (
          <form
            className="form"
            onSubmit={(e) => { e.preventDefault(); run(async () => { setSt(await api.connectClaude(key)); setKey(""); setMsg({ ok: true, text: "接続しました" }); }); }}
          >
            <label className="field">APIキー
              <input id="claude-key" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
            </label>
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <a className="sub" href="/guide/claude.html" target="_blank" rel="noopener">接続方法</a>
              <motion.button className="btn" disabled={busy || !key.trim()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
                {busy ? "確かめています…" : "接続する"}
              </motion.button>
            </div>
          </form>
        )}

        <AnimatePresence>
          {msg && (
            <motion.p key={msg.text} className={msg.ok ? "" : "error"} style={{ margin: 0, color: msg.ok ? "var(--ok)" : undefined }}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {msg.text}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.section>
    </Page>
  );
}
