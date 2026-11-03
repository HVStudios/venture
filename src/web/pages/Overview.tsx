import { Link, useNavigate } from "react-router-dom";
import type { Idea } from "../../core/schema";
import { Empty, EvidenceLevel, Section, StatusPill } from "../components/ui";
import { fmtDate, lastUpdated, timeAgo, useLab } from "../data";

export function Landscape({ ideas, height = 320 }: { ideas: Idea[]; height?: number }) {
  const { ideaScores } = useLab();
  const nav = useNavigate();
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 16, t: 16, b: 36 };
  const x = (v: number) => pad.l + (v / 100) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / 100) * (H - pad.t - pad.b);
  return (
    <figure className="landscape">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ideas plotted by evidence strength (x) and attractiveness (y)">
        <rect x={x(50)} y={y(100)} width={x(100) - x(50)} height={y(50) - y(100)} className="quad quad-good" />
        <line x1={x(50)} x2={x(50)} y1={y(0)} y2={y(100)} className="grid" />
        <line x1={x(0)} x2={x(100)} y1={y(50)} y2={y(50)} className="grid" />
        <text x={x(98)} y={y(96)} textAnchor="end" className="quad-label">attractive · evidenced</text>
        <text x={x(2)} y={y(96)} className="quad-label">attractive · unproven</text>
        <text x={x(98)} y={y(3)} textAnchor="end" className="quad-label">evidenced · unappealing</text>
        <text x={x(2)} y={y(3)} className="quad-label">weak on both</text>
        <line x1={x(0)} x2={x(100)} y1={y(0)} y2={y(0)} className="axis" />
        <line x1={x(0)} x2={x(0)} y1={y(0)} y2={y(100)} className="axis" />
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <text x={x(t)} y={H - pad.b + 16} textAnchor="middle" className="tick">{t}</text>
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
          </g>
        ))}
        <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" className="axis-label">evidence strength →</text>
        <text transform={`translate(12 ${(H - pad.b) / 2}) rotate(-90)`} textAnchor="middle" className="axis-label">attractiveness →</text>
        {ideas.map((i, idx) => {
          const s = ideaScores.get(i.id)!;
          // Stack labels/dots that would otherwise sit on top of each other.
          const twins = ideas.slice(0, idx).filter((o) => {
            const t = ideaScores.get(o.id)!;
            return Math.abs(t.evidence.score - s.evidence.score) < 6 && Math.abs(t.attractiveness - s.attractiveness) < 4;
          }).length;
          const dy = twins * 15;
          return (
            <g key={i.id} className={`dot dot-${i.status}`} onClick={() => nav(`/ideas/${i.id}`)} tabIndex={0} role="link" aria-label={i.title}
              onKeyDown={(e) => e.key === "Enter" && nav(`/ideas/${i.id}`)}>
              <circle cx={x(s.evidence.score) + twins * 4} cy={y(s.attractiveness) + dy} r={7} />
              <title>{`${i.title}\nstatus: ${i.status}\nattractiveness ${s.attractiveness} · evidence ${s.evidence.score}`}</title>
              <text x={s.evidence.score > 62 ? x(s.evidence.score) - 12 + twins * 4 : x(s.evidence.score) + 12 + twins * 4} y={y(s.attractiveness) + 4 + dy} textAnchor={s.evidence.score > 62 ? "end" : "start"} className="dot-label">
                {i.title.length > 34 ? i.title.slice(0, 32) + "…" : i.title}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        Each idea is placed by how strong its traceable evidence is (x) and how attractive it would be if its assumptions held (y). The two are kept separate on purpose. Neither axis is a probability of success.
      </figcaption>
    </figure>
  );
}

export function Overview() {
  const { m, store, ideaScores } = useLab();
  const runs = [...m.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const researchRuns = runs.filter((r) => r.mode !== "collector");
  const latest = researchRuns[0];
  const decisions = [...m.decisions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const counts = (s: Idea["status"]) => m.ideas.filter((i) => i.status === s).length;
  const openAssumptions = m.ideas
    .filter((i) => i.status === "advanced" || i.status === "proposed")
    .flatMap((i) => i.assumptions.filter((a) => a.criticality === "high" && a.status === "untested").map((a) => ({ idea: i, a })))
    .slice(0, 5);
  const active = m.themes.filter((t) => t.status === "active");

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-text">
          <div className="kicker">{store === "real" ? "Autonomous innovation lab · evidence first" : "Demonstration mode"}</div>
          <h1>
            An AI research organization that finds real problems, invents solutions, and <em>tries hard to prove itself wrong.</em>
          </h1>
          <p className="lede">
            Every claim links to the source it came from. Each idea is critiqued, scored on its evidence and on its attractiveness separately, and given a decision. The few that survive get a cheap validation experiment.
          </p>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>Problems with evidence</dt>
            <dd>{m.problems.length}</dd>
          </div>
          <div>
            <dt>Ideas: advanced / parked / rejected</dt>
            <dd>
              {counts("advanced")} / {counts("parked")} / {counts("rejected")}
            </dd>
          </div>
          <div>
            <dt>Cited sources</dt>
            <dd>{m.sources.length}</dd>
          </div>
          <div>
            <dt>Last research run</dt>
            <dd className="small">{latest ? timeAgo(latest.completedAt ?? latest.startedAt) : "none yet"}</dd>
          </div>
        </dl>
      </section>

      <div className="grid-2">
        <Section title="Idea landscape" kicker="Where things stand">
          {m.ideas.length ? <Landscape ideas={m.ideas.filter((i) => i.status !== "merged")} /> : <Empty>No ideas recorded yet.</Empty>}
        </Section>

        <Section title="Latest research run" kicker="Pipeline" aside={latest && <Link to={`/runs/${latest.id}`}>Open run log →</Link>}>
          {latest ? (
            <div className="run-card">
              <div className="run-meta">
                <StatusPill status={latest.status} /> <code>{latest.id}</code>
                <div className="muted">
                  {m.themes.find((t) => t.id === latest.themeId)?.name} · {latest.mode} · {latest.provider}
                  {latest.model ? ` (${latest.model})` : ""} · {fmtDate(latest.startedAt)}
                </div>
              </div>
              <ol className="stages">
                {latest.stages.map((s, i) => (
                  <li key={i} className={`stage stage-${s.status}`}>
                    <span className="stage-name">{s.name}</span>
                    <span className="stage-notes">{s.notes}</span>
                  </li>
                ))}
              </ol>
              <div className="run-counts">
                <span><b>{latest.counts.sourcesExamined}</b> examined</span>
                <span><b>{latest.counts.sourcesCited}</b> cited</span>
                <span><b>{latest.counts.ideasGenerated}</b> ideas</span>
                <span><b>{latest.counts.ideasAdvanced}</b> advanced</span>
                <span><b>{latest.counts.ideasRejected}</b> rejected</span>
              </div>
            </div>
          ) : (
            <Empty>No research runs recorded yet.</Empty>
          )}
        </Section>
      </div>

      <div className="grid-2">
        <Section title="Recent decisions" kicker="Director's log" aside={<Link to="/history">Full history →</Link>}>
          {decisions.length ? (
            <ul className="decision-list">
              {decisions.map((d) => {
                const idea = m.ideas.find((i) => i.id === d.subjectId);
                return (
                  <li key={d.id}>
                    <div>
                      <StatusPill status={d.toStatus} />{" "}
                      <Link to={d.subjectType === "idea" ? `/ideas/${d.subjectId}` : `/problems/${d.subjectId}`}>{idea?.title ?? d.subjectId}</Link>
                    </div>
                    <p>{d.rationale}</p>
                    <span className="muted">
                      {d.action} · {d.actor} · {fmtDate(d.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>No decisions yet.</Empty>
          )}
        </Section>

        <Section title="Riskiest open assumptions" kicker="What we don't know yet">
          {openAssumptions.length ? (
            <ul className="assumption-list">
              {openAssumptions.map(({ idea, a }) => (
                <li key={idea.id + a.id}>
                  <p>{a.text}</p>
                  <Link to={`/ideas/${idea.id}`} className="muted">
                    {idea.title} · <EvidenceLevel a={ideaScores.get(idea.id)!.evidence} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No untested high-criticality assumptions on live ideas.</Empty>
          )}
          <div className="themes-mini">
            <div className="kicker">Active themes</div>
            {active.map((t) => (
              <Link key={t.id} to={`/ideas?theme=${t.id}`} className="chip">
                {t.name}
              </Link>
            ))}
            {!active.length && <span className="muted">none</span>}
          </div>
        </Section>
      </div>
      <p className="muted small-print">Research memory last changed {fmtDate(lastUpdated(m))}.</p>
    </div>
  );
}
