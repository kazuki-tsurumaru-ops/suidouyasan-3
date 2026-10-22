import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { api, type Drawing, type Photo, type Site } from "../lib/api";
import { readPhotoInfo } from "../lib/exif";
import { Page, rise } from "../components/Shell";
import { FullSkeleton, RowsSkeleton } from "../components/Skeleton";

const TABS = ["写真", "図面", "見積"] as const;

export function SiteDetail() {
  const { id = "" } = useParams();
  const [data, setData] = useState<{ site: Site; photos: Photo[]; drawings: Drawing[] } | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("写真");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.site(id).then(setData), [id]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <FullSkeleton withShell={false} />;
  const { site, photos, drawings } = data;
  return (
    <Page>
      <div className="head">
        <div>
          <h1>{site.name}</h1>
          <div className="sub"><span className={`tag ${site.kind}`}>{site.kind}</span>{site.start_date && <> ・ {site.start_date}〜{site.end_date ?? ""}</>}</div>
        </div>
      </div>
      <div className="glass tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {tab === t && <motion.span layoutId="tab-pill" className="pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            {t}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={{ opacity: 0, x: -16, filter: "blur(4px)" }}
          transition={{ duration: 0.25 }}
        >
          {tab === "写真" && <Photos siteId={site.id} photos={photos} busy={busy} setBusy={setBusy} reload={load} />}
          {tab === "図面" && <Drawings siteId={site.id} drawings={drawings} busy={busy} setBusy={setBusy} reload={load} />}
          {tab === "見積" && <div className="glass empty">見積はまだありません</div>}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

type UploadProps = { siteId: string; busy: boolean; setBusy: (b: boolean) => void; reload: () => Promise<void> };

function Drop({ label, accept, multiple, onFiles }: { label: string; accept: string; multiple?: boolean; onFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <motion.div
      className={"drop" + (over ? " over" : "")}
      whileHover={{ scale: 1.005 }}
      animate={{ scale: over ? 1.01 : 1 }}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
    >
      {label}
      <input ref={ref} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => onFiles(Array.from(e.target.files || []))} />
    </motion.div>
  );
}

function Photos({ siteId, photos, busy, setBusy, reload }: UploadProps & { photos: Photo[] }) {
  const upload = async (files: File[]) => {
    setBusy(true);
    for (const f of files) {
      const info = readPhotoInfo(await f.arrayBuffer());
      const form = new FormData();
      form.set("file", f);
      if (info.date) form.set("taken_at", info.date.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3"));
      form.set("has_place", info.lat !== null ? "1" : "0");
      await api.uploadPhoto(siteId, form);
    }
    await reload();
    setBusy(false);
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Drop label="写真をここに置くか、押して選ぶ" accept="image/*" multiple onFiles={upload} />
      <div className="glass">
        {busy ? <RowsSkeleton rows={4} /> : photos.length === 0 ? <div className="empty">写真はまだありません</div> : (
          <motion.div className="list">
            {photos.map((p, i) => (
              <motion.div className="row" key={p.id} {...rise(i)}>
                <img className="thumb" src={`/api/photos/${p.id}`} alt="" loading="lazy" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.file_name}</div>
                  <div className="sub">{p.taken_at ?? "撮影日時なし"}{p.part ? ` ・ ${p.part}` : ""}</div>
                </div>
                <span className={"badge " + (p.status === "確認待ち" ? "wait" : "ok")}>{p.status}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Drawings({ siteId, drawings, busy, setBusy, reload }: UploadProps & { drawings: Drawing[] }) {
  const [stage, setStage] = useState("申請");
  const upload = async (files: File[]) => {
    setBusy(true);
    for (const f of files) {
      const form = new FormData();
      form.set("file", f);
      form.set("stage", stage);
      await api.uploadDrawing(siteId, form).catch(() => {});
    }
    await reload();
    setBusy(false);
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="glass panel" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>図面の種類
          <select id="drawing-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option>申請</option><option>竣工</option><option>その他</option>
          </select>
        </label>
        <div style={{ flex: 1 }}><Drop label="Jw_cad の図面（.jww）を置くか、押して選ぶ" accept=".jww,.dxf" multiple onFiles={upload} /></div>
      </div>
      <div className="glass">
        {busy ? <RowsSkeleton rows={3} /> : drawings.length === 0 ? <div className="empty">図面はまだありません</div> : (
          <motion.div className="list">
            {drawings.map((d, i) => (
              <motion.div className="row" key={d.id} {...rise(i)}>
                <div className="thumb" style={{ display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>JWW</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{d.file_name}</div>
                  <div className="sub">{d.uploaded_at}</div>
                </div>
                <span className="tag">{d.stage}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
