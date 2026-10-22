import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { api, LoginRequired, type Me } from "./lib/api";
import { FullSkeleton } from "./components/Skeleton";
import { Page, Shell } from "./components/Shell";
import { Login } from "./pages/Login";
import { Sites } from "./pages/Sites";
import { SiteDetail } from "./pages/SiteDetail";

function Backdrop() {
  return <div className="backdrop" aria-hidden="true"><i /><i /><i /><i /></div>;
}

function Soon({ title }: { title: string }) {
  return (
    <Page>
      <div className="head"><h1>{title}</h1></div>
      <div className="glass empty">現場を開くと、その現場の{title}が見られます</div>
    </Page>
  );
}

function Routed({ me }: { me: Me }) {
  const loc = useLocation();
  return (
    <Shell me={me}>
      <AnimatePresence mode="wait">
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Sites />} />
          <Route path="/sites/:id" element={<SiteDetail />} />
          <Route path="/photos" element={<Soon title="写真" />} />
          <Route path="/drawings" element={<Soon title="図面" />} />
          <Route path="/estimates" element={<Soon title="見積" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Shell>
  );
}

function Root() {
  const loc = useLocation();
  const [me, setMe] = useState<Me | null | "out">(null);
  useEffect(() => {
    if (loc.pathname === "/login") return;
    api.me().then(setMe).catch((e) => setMe(e instanceof LoginRequired ? "out" : "out"));
  }, [loc.pathname]);

  if (loc.pathname === "/login") return <Login />;
  if (me === null) return <FullSkeleton />;
  if (me === "out") return <Navigate to="/login" replace />;
  return (
    <motion.div style={{ height: "100%" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Routed me={me} />
    </motion.div>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Backdrop />
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </MotionConfig>
  );
}
