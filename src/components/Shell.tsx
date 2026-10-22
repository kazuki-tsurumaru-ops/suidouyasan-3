import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { Me } from "../lib/api";
import { api } from "../lib/api";

const NAV = [
  { to: "/", label: "現場", icon: <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { to: "/photos", label: "写真", icon: <><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="12" cy="12" r="3.5" /></> },
  { to: "/drawings", label: "図面", icon: <><path d="M4 4h12l4 4v12H4z" /><path d="M8 13h8M8 17h5" /></> },
  { to: "/estimates", label: "見積", icon: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></> },
];

export function Shell({ me, children }: { me: Me; children: ReactNode }) {
  const loc = useLocation();
  const current = NAV.slice().reverse().find((n) => (n.to === "/" ? loc.pathname === "/" || loc.pathname.startsWith("/sites") : loc.pathname.startsWith(n.to)))?.to;
  return (
    <div className="shell">
      <motion.aside
        className="glass side"
        initial={{ opacity: 0, x: -24, filter: "blur(8px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      >
        <div className="brand">すいどうやさん3.0</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={() => "nav" + (current === n.to ? " active" : "")}>
            {current === n.to && <motion.span layoutId="nav-pill" className="pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{n.icon}</svg>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="me">
          {me.picture ? <img src={me.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar" />}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{me.name || me.email}</span>
        </div>
        <motion.button
          className="btn ghost"
          style={{ margin: "0 8px 4px", justifyContent: "center" }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={async () => { await api.logout().catch(() => {}); location.href = "/login"; }}
        >
          ログアウト
        </motion.button>
      </motion.aside>
      {children}
    </div>
  );
}

/** 画面の切り替えのアニメーション */
export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.main
      className="main"
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
      transition={{ type: "spring", stiffness: 240, damping: 30 }}
    >
      {children}
    </motion.main>
  );
}

/** ガラスのカードを順に浮かび上がらせる（i 番目ほど少し遅れて出る） */
export function rise(i: number) {
  return {
    initial: { opacity: 0, y: 14, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { type: "spring" as const, stiffness: 300, damping: 26, delay: Math.min(i, 12) * 0.05 },
  };
}
