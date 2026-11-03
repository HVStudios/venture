import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Empty, Section } from "../components/ui";
import { useLab } from "../data";

type Kind = "theme" | "problem" | "idea" | "competitor" | "experiment" | "source";
interface N extends SimulationNodeDatum {
  id: string;
  kind: Kind;
  label: string;
  href?: string;
  status?: string;
}
interface L {
  source: string | N;
  target: string | N;
  kind: string;
}

const R: Record<Kind, number> = { theme: 13, problem: 10, idea: 9, competitor: 6, experiment: 7, source: 4 };

export function Graph() {
  const { m } = useLab();
  const nav = useNavigate();
  const [showSources, setShowSources] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const { nodes, links, box } = useMemo(() => {
    const nodes: N[] = [];
    const links: L[] = [];
    const has = new Set<string>();
    const add = (n: N) => {
      if (!has.has(n.id)) {
        has.add(n.id);
        nodes.push(n);
      }
    };
    m.themes.forEach((t) => add({ id: t.id, kind: "theme", label: t.name, href: `/research/${t.id}` }));
    m.problems.forEach((p) => {
      add({ id: p.id, kind: "problem", label: p.title, href: `/problems/${p.id}`, status: p.status });
      p.themeIds.forEach((t) => links.push({ source: t, target: p.id, kind: "theme" }));
    });
    m.ideas.forEach((i) => {
      add({ id: i.id, kind: "idea", label: i.title, href: `/ideas/${i.id}`, status: i.status });
      i.problemIds.forEach((p) => links.push({ source: p, target: i.id, kind: "addresses" }));
      i.competitorIds.forEach((c) => links.push({ source: i.id, target: c, kind: "competes" }));
      if (i.mergedInto) links.push({ source: i.id, target: i.mergedInto, kind: "merged" });
      i.relatedIdeaIds.forEach((r) => links.push({ source: i.id, target: r, kind: "related" }));
    });
    m.competitors.forEach((c) => add({ id: c.id, kind: "competitor", label: c.name }));
    m.experiments.forEach((x) => {
      add({ id: x.id, kind: "experiment", label: x.title, href: `/experiments` });
      links.push({ source: x.ideaId, target: x.id, kind: "tests" });
    });
    if (showSources) {
      m.sources.forEach((s) => add({ id: s.id, kind: "source", label: s.title }));
      m.evidence.forEach((e) => [...e.problemIds, ...e.ideaIds].forEach((t) => links.push({ source: e.sourceId, target: t, kind: e.stance })));
    }
    const valid = links.filter((l) => has.has(l.source as string) && has.has(l.target as string));
    const sim = forceSimulation<N>(nodes)
      .force("link", forceLink<N, L>(valid).id((d) => d.id).distance((l) => (l.kind === "theme" ? 90 : 60)))
      .force("charge", forceManyBody().strength(-220))
      .force("collide", forceCollide<N>((d) => R[d.kind] + 14))
      .force("center", forceCenter(0, 0))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();
    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const box = nodes.length
      ? { x: Math.min(...xs) - 80, y: Math.min(...ys) - 40, w: Math.max(...xs) - Math.min(...xs) + 220, h: Math.max(...ys) - Math.min(...ys) + 80 }
      : { x: 0, y: 0, w: 100, h: 100 };
    return { nodes, links: valid, box };
  }, [m, showSources]);

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of links) {
      const s = (l.source as N).id;
      const t = (l.target as N).id;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    }
    return map;
  }, [links]);
  const lit = (id: string) => !hover || hover === id || neighbors.get(hover)?.has(id);

  if (!nodes.length) return <Empty>Nothing to map yet.</Empty>;
  return (
    <div className="page">
      <Section
        title="Research map"
        kicker="Themes → problems → ideas → competitors & experiments"
        aside={
          <label className="toggle">
            <input type="checkbox" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} /> show sources
          </label>
        }
      >
        <div className="legend">
          {(["theme", "problem", "idea", "competitor", "experiment", "source"] as Kind[]).map((k) => (
            <span key={k}>
              <i className={`lg lg-${k}`} /> {k}
            </span>
          ))}
        </div>
        <div className="graph-wrap">
          <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="graph" role="img" aria-label="Relationship graph">
            {links.map((l, i) => {
              const s = l.source as N;
              const t = l.target as N;
              return (
                <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} className={`edge edge-${l.kind} ${lit(s.id) && lit(t.id) ? "" : "dim"}`} />
              );
            })}
            {nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                className={`node node-${n.kind} ${n.status ? `st-${n.status}` : ""} ${lit(n.id) ? "" : "dim"} ${n.href ? "clickable" : ""}`}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => n.href && nav(n.href)}
              >
                <circle r={R[n.kind]} />
                {(n.kind !== "source" || hover === n.id) && (
                  <text x={R[n.kind] + 4} y={4}>
                    {n.label.length > 38 ? n.label.slice(0, 36) + "…" : n.label}
                  </text>
                )}
                <title>{`${n.kind}: ${n.label}`}</title>
              </g>
            ))}
          </svg>
        </div>
      </Section>
    </div>
  );
}
