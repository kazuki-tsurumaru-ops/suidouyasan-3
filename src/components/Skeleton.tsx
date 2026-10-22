import { motion } from "motion/react";

/** 起動中・画面の切り替え中に出す、全画面のスケルトン（画面の形だけを先に見せる） */
export function FullSkeleton({ withShell = true }: { withShell?: boolean }) {
  const content = (
    <div className="main" aria-busy="true" aria-label="読み込み中">
      <div className="head">
        <div className="sk sk-title" />
        <div className="sk" style={{ width: 132, height: 40, borderRadius: 999 }} />
      </div>
      <div className="grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <motion.div
            key={i}
            className="glass sk-card-wrap"
            style={{ padding: 18, display: "grid", gap: 12, borderRadius: 22 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35 }}
          >
            <div className="sk sk-line" style={{ width: "60%", height: 18 }} />
            <div className="sk sk-line" style={{ width: 70, height: 20, borderRadius: 999 }} />
            <div className="sk sk-line" style={{ width: "45%" }} />
          </motion.div>
        ))}
      </div>
    </div>
  );
  if (!withShell) return content;
  return (
    <div className="shell">
      <aside className="glass side" aria-hidden="true">
        <div className="sk" style={{ height: 22, width: 150, margin: "6px 12px 18px" }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sk" style={{ height: 38, margin: "2px 4px", borderRadius: 12 }} />
        ))}
        <div className="spacer" />
        <div className="sk" style={{ height: 40, margin: 6, borderRadius: 12 }} />
      </aside>
      {content}
    </div>
  );
}

/** 一覧の中だけの小さなスケルトン */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="row" key={i}>
          <div className="sk" style={{ width: 56, height: 42 }} />
          <div style={{ display: "grid", gap: 8 }}>
            <div className="sk sk-line" style={{ width: "50%" }} />
            <div className="sk sk-line" style={{ width: "30%", height: 12 }} />
          </div>
          <div className="sk" style={{ width: 90, height: 22, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}
