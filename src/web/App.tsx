import { useEffect, useRef, useState } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { FixtureNotice } from "./components/ui";
import { lastUpdated, timeAgo, useLab } from "./data";
import { Compare } from "./pages/Compare";
import { Experiments } from "./pages/Experiments";
import { Graph } from "./pages/Graph";
import { IdeaDetail, Ideas } from "./pages/Ideas";
import { Method } from "./pages/Method";
import { Overview } from "./pages/Overview";
import { ProblemDetail, Problems } from "./pages/Problems";
import { History, RunDetail } from "./pages/Runs";
import { ResearchArea, ResearchAreas } from "./pages/Research";
import { Search } from "./pages/Search";
import { Signals } from "./pages/Signals";
import { Sources } from "./pages/Sources";

const NAV = [
  ["/", "Lab"],
  ["/research", "Research"],
  ["/ideas", "Ideas"],
  ["/experiments", "Experiments"],
  ["/sources", "Evidence"],
  ["/graph", "Map"],
  ["/history", "Runs"],
  ["/method", "Method"],
] as const;

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function StoreSwitch() {
  const { store, setStore, snapshot } = useLab();
  return (
    <div className="store-switch" role="group" aria-label="Data source">
      <button className={store === "real" ? "on" : ""} onClick={() => setStore("real")} title="Research produced by real research runs">
        Real research <span className="count">{snapshot.stores.real.ideas.length}</span>
      </button>
      <button className={store === "fixture" ? "on fixture" : ""} onClick={() => setStore("fixture")} title="Synthetic demonstration data from the mock provider">
        Demo fixtures
      </button>
    </div>
  );
}

function SearchBox() {
  const nav = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/input|textarea|select/i.test(t.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      className="searchbox"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        nav(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <input ref={ref} type="search" placeholder="Search  /" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the lab" />
    </form>
  );
}

function Shell() {
  const lab = useLab();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const updated = lastUpdated(lab.m);
  return (
    <div className={`shell ${lab.store}`}>
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="VENTURE home">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
            <path d="M6 7l10 19 10-19" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>VENTURE</span>
        </NavLink>
        <button className="menu-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          Menu
        </button>
        <nav className={open ? "open" : ""}>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <SearchBox />
          <StoreSwitch />
        </div>
      </header>
      <FixtureNotice />
      <main>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/ideas/:id" element={<IdeaDetail />} />
          <Route path="/problems" element={<Problems />} />
          <Route path="/problems/:id" element={<ProblemDetail />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/search" element={<Search />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/history" element={<History />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/research" element={<ResearchAreas />} />
          <Route path="/research/:id" element={<ResearchArea />} />
          <Route path="/themes" element={<Navigate to="/research" replace />} />
          <Route path="/method" element={<Method />} />
          <Route path="*" element={<div className="empty">Nothing here. <NavLink to="/">Back to the lab</NavLink></div>} />
        </Routes>
      </main>
      <footer className="footer">
        <span>
          Snapshot built {timeAgo(lab.snapshot.generatedAt)} · commit <code>{lab.snapshot.commit}</code> · research last updated {timeAgo(updated)}
        </span>
        <span>
          Scores are heuristics, not probabilities. <NavLink to="/method">How VENTURE reasons →</NavLink>
        </span>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <Shell />
    </HashRouter>
  );
}
