import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { api, type Site } from "../lib/api";
import { Page, rise } from "../components/Shell";
import { FullSkeleton } from "../components/Skeleton";

export function Sites() {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => api.sites().then((r) => setSites(r.sites));
  useEffect(() => { load(); }, []);

  if (!sites) return <FullSkeleton withShell={false} />;
  return (
    <Page>
      <div className="head">
        <h1>現場</h1>
        <motion.button className="btn" whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.95 }} onClick={() => setOpen(true)}>
          ＋ 新しい現場
        </motion.button>
      </div>
      {sites.length === 0 ? (
        <motion.div className="glass empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          現場はまだありません
        </motion.div>
      ) : (
        <motion.div className="grid">
          {sites.map((s, i) => (
            <motion.div key={s.id} {...rise(i)} whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.98 }}>
              <Link to={`/sites/${s.id}`} className="glass card">
                <h3>{s.name}</h3>
                <span><span className={`tag ${s.kind}`}>{s.kind}</span></span>
                <div className="stats">
                  <span>写真 {s.photo_count ?? 0}</span>
                  <span>図面 {s.drawing_count ?? 0}</span>
                  {s.start_date && <span>{s.start_date}〜{s.end_date ?? ""}</span>}
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
      {createPortal(<AnimatePresence>{open && <NewSite onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}</AnimatePresence>, document.body)}
    </Page>
  );
}

function NewSite({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("水道局");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="glass strong dialog"
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try { await api.createSite({ name, kind, start_date: start || null, end_date: end || null }); onDone(); }
          catch (err) { setError((err as Error).message); setBusy(false); }
        }}
      >
        <h2>新しい現場</h2>
        <div className="form">
          <label className="field">現場の名前<input id="site-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          <label className="field">種類
            <select id="site-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option>水道局</option><option>元請け</option><option>民間</option>
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field">始まり<input id="site-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="field">終わり<input id="site-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <motion.button type="button" className="btn ghost" whileTap={{ scale: 0.95 }} onClick={onClose}>やめる</motion.button>
            <motion.button className="btn" disabled={busy || !name.trim()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>作る</motion.button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
}
