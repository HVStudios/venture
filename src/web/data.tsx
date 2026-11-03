import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Idea, Memory } from "../core/schema";
import { assessEvidence, assessIdea, evidenceForProblem, type EvidenceAssessment } from "../core/scoring";
import { RELATED_THRESHOLD, SimilarityIndex, ideaText } from "../core/similarity";

export interface Snapshot {
  schemaVersion: number;
  generatedAt: string;
  commit: string;
  stores: { real: Memory; fixture: Memory };
}

export type Store = "real" | "fixture";

export interface Lab {
  snapshot: Snapshot;
  store: Store;
  setStore: (s: Store) => void;
  m: Memory;
  ideaScores: Map<string, { attractiveness: number; evidence: EvidenceAssessment }>;
  problemEvidence: Map<string, EvidenceAssessment>;
  related: Map<string, { id: string; score: number }[]>;
  byId: <K extends keyof Memory>(coll: K, id: string) => Memory[K][number] | undefined;
}

const Ctx = createContext<Lab | null>(null);
const STORE_KEY = "venture.store";

function readStore(): Store | null {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v === "real" || v === "fixture" ? v : null;
  } catch {
    return null;
  }
}

export function LabProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [store, setStoreState] = useState<Store | null>(readStore());

  useEffect(() => {
    fetch("./data/snapshot.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((s: Snapshot) => setSnapshot(s))
      .catch((e: Error) => setError(e.message));
  }, []);

  const setStore = (s: Store) => {
    setStoreState(s);
    try {
      localStorage.setItem(STORE_KEY, s);
    } catch {
      /* storage unavailable */
    }
  };

  const effective: Store = store ?? (snapshot && snapshot.stores.real.ideas.length === 0 && snapshot.stores.real.themes.length === 0 ? "fixture" : "real");

  const lab = useMemo<Lab | null>(() => {
    if (!snapshot) return null;
    const m = snapshot.stores[effective];
    const ideaScores = new Map(m.ideas.map((i) => [i.id, assessIdea(i, m)]));
    const problemEvidence = new Map(m.problems.map((p) => [p.id, assessEvidence(evidenceForProblem(p.id, m), m.sources)]));
    const index = new SimilarityIndex(m.ideas.map((i) => ({ id: i.id, text: ideaText(i) })));
    const related = new Map(m.ideas.map((i) => [i.id, index.nearest(i.id, 4, RELATED_THRESHOLD)]));
    const maps = new Map<string, Map<string, unknown>>();
    const byId = <K extends keyof Memory>(coll: K, id: string) => {
      let map = maps.get(coll);
      if (!map) {
        map = new Map((m[coll] as { id: string }[]).map((x) => [x.id, x]));
        maps.set(coll, map);
      }
      return map.get(id) as Memory[K][number] | undefined;
    };
    return { snapshot, store: effective, setStore, m, ideaScores, problemEvidence, related, byId };
  }, [snapshot, effective]);

  if (error)
    return (
      <div className="boot">
        <h1>VENTURE</h1>
        <p>Could not load the research snapshot ({error}).</p>
      </div>
    );
  if (!lab)
    return (
      <div className="boot">
        <div className="boot-pulse" />
        <p>Loading research memory…</p>
      </div>
    );
  return <Ctx.Provider value={lab}>{children}</Ctx.Provider>;
}

export function useLab(): Lab {
  const lab = useContext(Ctx);
  if (!lab) throw new Error("useLab outside provider");
  return lab;
}

export function lastUpdated(m: Memory): string | undefined {
  const stamps = [
    ...m.runs.map((r) => r.completedAt ?? r.startedAt),
    ...m.ideas.map((i) => i.updatedAt),
    ...m.sources.map((s) => s.verification.checkedAt ?? s.retrievedAt),
  ].filter(Boolean) as string[];
  return stamps.sort().at(-1);
}

export function ideasForProblem(m: Memory, problemId: string): Idea[] {
  return m.ideas.filter((i) => i.problemIds.includes(problemId));
}

export function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const d = Date.now() - new Date(iso).getTime();
  const min = Math.round(d / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 60) return `${days} days ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return iso.length > 10 ? iso.slice(0, 16).replace("T", " ") + " UTC" : iso;
}

export function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
