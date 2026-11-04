import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Decision, Idea } from "../../core/schema";
import { Empty, EvidenceLevel, Section, StatusPill } from "../components/ui";
import { reconsiderationQueue } from "../../core/actions";
import { buildAreas } from "../../core/areas";
import { fmtDate, lastUpdated, timeAgo, useLab } from "../data";
import { buildStories } from "../../core/story";
import { LastEvent, Mark, SinceLastVisit, Tally, VERDICT_WORD, byVerdict } from "../components/story";
import { Sieve, sieveLayers } from "../components/Sieve";

const LANDSCAPE_KEY: [Idea["status"], string][] = [
  ["advanced", "Advanced"],
  ["proposed", "Proposed"],
  ["parked", "Parked"],
  ["rejected", "Rejected"],
];

export function Landscape({ ideas, height = 340 }: { ideas: Idea[]; height?: number }) {
  const { ideaScores } = useLab();
  const nav = useNavigate();
  const W = 720;
  const H = height;
  const pad = { l: 48, r: 12, t: 12, b: 40 };
  const x = (v: number) => pad.l + (v / 100) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / 100) * (H - pad.t - pad.b);
  // Label the ideas still in play; parked and rejected ones carry their name in the tooltip.
  const labelled = new Set(ideas.filter((i) => i.status === "advanced" || i.status === "proposed").map((i) => i.id));
  const present = LANDSCAPE_KEY.filter(([k]) => ideas.some((i) => i.status === k));
  return (
    <figure className="landscape">
      <div className="legend-row" style={{ marginBottom: 8 }}>
        {present.map(([k, l]) => (
          <span key={k} className={`dot dot-${k}`} style={{ cursor: "default" }}>
            <svg width="10" height="10" aria-hidden>
              <circle cx="5" cy="5" r="4" />
            </svg>
            {l} {ideas.filter((i) => i.status === k).length}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ideas plotted by evidence strength (x) and attractiveness (y)">
        <rect x={x(50)} y={y(100)} width={x(100) - x(50)} height={y(50) - y(100)} className="quad-good" />
        {[25, 50, 75, 100].map((t) => (
          <line key={t} x1={x(0)} x2={x(100)} y1={y(t)} y2={y(t)} className="grid" />
        ))}
        <line x1={x(0)} x2={x(100)} y1={y(0)} y2={y(0)} className="axis" />
        <text x={x(99)} y={y(100) + 16} textAnchor="end" className="quad-label">Attractive and evidenced</text>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <text x={x(t)} y={H - pad.b + 18} textAnchor={t === 0 ? "start" : t === 100 ? "end" : "middle"} className="tick">{t}</text>
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
          </g>
        ))}
        <text x={x(100)} y={H - 4} textAnchor="end" className="axis-label">Evidence strength</text>
        <text transform={`translate(10 ${y(50)}) rotate(-90)`} textAnchor="middle" className="axis-label">Attractiveness</text>
        {ideas.map((i, idx) => {
          const s = ideaScores.get(i.id)!;
          const twins = ideas.slice(0, idx).filter((o) => {
            const t = ideaScores.get(o.id)!;
            return Math.abs(t.evidence.score - s.evidence.score) < 6 && Math.abs(t.attractiveness - s.attractiveness) < 4;
          }).length;
          const cx = x(s.evidence.score) + twins * 5;
          const cy = y(s.attractiveness) + twins * 4;
          const right = s.evidence.score > 60;
          return (
            <g key={i.id} className={`dot dot-${i.status}`} onClick={() => nav(`/ideas/${i.id}`)} tabIndex={0} role="link" aria-label={i.title}
              onKeyDown={(e) => e.key === "Enter" && nav(`/ideas/${i.id}`)}>
              <circle cx={cx} cy={cy} r={6} />
              <title>{`${i.title}\nstatus: ${i.status}\nattractiveness ${s.attractiveness} · evidence ${s.evidence.score}`}</title>
              {labelled.has(i.id) && (
                <text x={right ? cx - 11 : cx + 11} y={cy + 4} textAnchor={right ? "end" : "start"} className="dot-label">
                  {i.title.length > 38 ? i.title.slice(0, 36) + "…" : i.title}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        Each idea sits at the strength of its traceable evidence (across) and how attractive it would be if its assumptions held (up). Neither axis is a probability of success. Parked and rejected ideas are named on hover.
      </figcaption>
    </figure>
  );
}

/** The overview's headline: the lab's kill rate as a sentence, with every idea drawn inline. */
function Verdict({
  ideas,
  latestFor,
  lead,
  actions,
  demo,
  since,
}: {
  ideas: Idea[];
  latestFor: (id: string) => Decision | undefined;
  lead: ReactNode;
  actions: ReactNode;
  demo: boolean;
  since?: ReactNode;
}) {
  const sorted = [...ideas].sort(byVerdict);
  const standing = sorted.filter((i) => i.status === "advanced" || i.status === "proposed");
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const shown = sorted.find((i) => i.id === focus) ?? standing[0] ?? sorted[0];
  const d = shown && latestFor(shown.id);
  const n = ideas.length;
  return (
    <header className="verdict">
      <h1>
        <span className="verdict-l1">
          {n} idea{n === 1 ? "" : "s"} tested{demo ? " (demo)" : ""}.
        </span>{" "}
        <span className="verdict-l2">
          <Tally ideas={ideas} focus={shown?.id} onFocus={setFocus} />{" "}
          {standing.length ? standing.length : "None"} still standing.
        </span>
      </h1>
      {shown && (
        <p className="verdict-read" aria-live="polite">
          <Link to={`/ideas/${shown.id}`} className="who">
            {shown.title}
          </Link>{" "}
          <span className={`was was-${shown.status}`}>{VERDICT_WORD[shown.status] ?? shown.status}</span>
          {d?.rationale && <span className="why"> — {d.rationale}</span>}
        </p>
      )}
      {since}
      <div className="verdict-foot">
        <p className="sub">{lead}</p>
        <div className="title-actions">{actions}</div>
      </div>
    </header>
  );
}

function Ago({ at }: { at?: string }) {
  return at ? <>{timeAgo(at)}</> : <span className="muted">—</span>;
}

export function Overview() {
  const { m, store, ideaScores } = useLab();
  const runs = [...m.runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const researchRuns = runs.filter((r) => r.mode !== "collector");
  const latest = researchRuns[0];
  const decisions = [...m.decisions].sort((a, b) => b.at.localeCompare(a.at));
  const recent = decisions.slice(0, 6);
  const lastDecision = decisions[0];
  const openAssumptions = m.ideas
    .filter((i) => i.status === "advanced" || i.status === "proposed")
    .flatMap((i) => i.assumptions.filter((a) => a.criticality === "high" && a.status === "untested").map((a) => ({ idea: i, a })))
    .slice(0, 4);
  const areas = buildAreas(m);
  const activeAreas = areas.filter((a) => a.status.key !== "paused" && a.status.key !== "collecting").length;
  const reconsider = reconsiderationQueue(m);
  const withOutcome = m.experiments.filter((e) => e.outcome).length;
  const updated = lastUpdated(m);
  const subjectName = (d: (typeof decisions)[number]) =>
    (d.subjectType === "idea" ? m.ideas.find((i) => i.id === d.subjectId)?.title : d.subjectType === "problem" ? m.problems.find((p) => p.id === d.subjectId)?.title : d.subjectType === "theme" ? m.themes.find((t) => t.id === d.subjectId)?.name : undefined) ?? d.subjectId;
  const subjectHref = (d: (typeof decisions)[number]) =>
    d.subjectType === "idea" ? `/ideas/${d.subjectId}` : d.subjectType === "problem" ? `/problems/${d.subjectId}` : d.subjectType === "experiment" ? "/experiments" : `/research/${d.subjectId}`;
  const tested = m.ideas.filter((i) => i.status !== "merged");
  const stories = buildStories(m);
  const inPlay = [...stories.filter((x) => x.standing), ...stories.filter((x) => !x.standing)].slice(0, 6);
  const latestFor = (id: string) => decisions.find((d) => d.subjectType === "idea" && d.subjectId === id);
  const busiest = [...areas].sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""))[0];

  return (
    <div className="page">
      <Verdict
        ideas={tested}
        latestFor={latestFor}
        demo={store !== "real"}
        since={<SinceLastVisit stories={stories} />}
        lead={
          lastDecision ? (
            <>
              Latest decision: <b>{subjectName(lastDecision)}</b> {lastDecision.action === "create" ? "recorded as" : "moved to"} {lastDecision.toStatus}, {timeAgo(lastDecision.at)}. Every claim is traced to a verbatim quote from a retrieved source.
            </>
          ) : (
            "No decisions recorded yet. Every claim will be traced to a verbatim quote from a retrieved source."
          )
        }
        actions={
          <>
            {busiest && (
              <Link className="btn" to={`/research/${busiest.theme.id}`}>
                Read the latest journal
              </Link>
            )}
            <span className={`stamp${updated ? "" : " stale"}`}>
              <i /> Research updated {updated ? timeAgo(updated) : "never"}
            </span>
          </>
        }
      />

      <section className="figures" aria-labelledby="figures-h">
        <h2 id="figures-h" className="sr-only">The lab in figures</h2>
        <p>
          Across <b>{activeAreas}&nbsp;open</b> of {areas.length}&nbsp;research areas, the lab has cited <b>{m.sources.length}&nbsp;sources</b>,
          quoted <b>{m.evidence.length}&nbsp;claims</b>, found evidence for <b>{m.problems.length}&nbsp;problems</b> and taken{" "}
          <b>{withOutcome}&nbsp;of&nbsp;{m.experiments.length}</b> experiments to an outcome.
        </p>
      </section>

      <div className="grid-wide">
        <Section title="The sieve" kicker="From what the lab read to what still stands">
          <Sieve layers={sieveLayers(m)} />
        </Section>
        <Section title="In play" kicker="Latest first" aside={<Link to="/ideas">All ideas</Link>}>
          {inPlay.length ? (
            <ul className="in-play">
              {inPlay.map((x) => (
                <li key={x.idea.id} className={x.standing ? "standing" : ""}>
                  <Mark idea={x.idea} size="row" />
                  <div>
                    <Link to={`/ideas/${x.idea.id}`} className="name">
                      {x.idea.title}
                    </Link>
                    <LastEvent story={x} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No ideas yet.</Empty>
          )}
        </Section>
      </div>

      <Section title="Research areas" kicker={`${areas.length} standing investigations`} aside={<Link to="/research">All areas</Link>}>
        {areas.length ? (
          <ul className="area-rows">
            <li className="head" aria-hidden>
              <span>Status</span>
              <span>Area and its question</span>
              <span className="n">Sessions</span>
              <span className="n">Ideas</span>
              <span className="n">Experiments</span>
              <span className="ago">Last activity</span>
            </li>
            {areas.map((a) => (
              <li key={a.theme.id}>
                <span className="status">
                  <span className={`area-status area-${a.status.key}`} title={a.status.explanation}>
                    <i /> {a.status.label}
                  </span>
                </span>
                <div className="body">
                  <Link to={`/research/${a.theme.id}`} className="name">
                    {a.theme.name}
                  </Link>
                  <p className="q">{a.brief?.researchQuestion ?? a.theme.description}</p>
                </div>
                <span className={`n${a.researchRuns.length ? "" : " zero"}`} data-label="sessions">{a.researchRuns.length}</span>
                <span className={`n${a.ideas.length ? "" : " zero"}`} data-label="ideas">{a.ideas.length}</span>
                <span className={`n${a.experiments.completed.length ? "" : " zero"}`} data-label="experiments">{a.experiments.completed.length}</span>
                <span className="ago">
                  <Ago at={a.lastActivity} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No research areas yet.</Empty>
        )}
      </Section>

      <div className="grid-wide">
        <Section title="Idea landscape" kicker="Evidence against attractiveness" aside={<Link to="/ideas">All ideas</Link>}>
          {m.ideas.length ? <Landscape ideas={m.ideas.filter((i) => i.status !== "merged")} /> : <Empty>No ideas recorded yet.</Empty>}
        </Section>

        <div className="stack">
        <Section title="Latest research run" aside={latest && <Link to={`/runs/${latest.id}`}>Run log</Link>}>
          {latest ? (
            <div className="run-card">
              <div className="run-meta">
                <div>
                  <StatusPill status={latest.status} /> <span className="muted small">{timeAgo(latest.completedAt ?? latest.startedAt)}</span>
                </div>
                <b>{m.themes.find((t) => t.id === latest.themeId)?.name ?? "No area"}</b>
                <span className="muted small">
                  {latest.mode} · {latest.provider}
                  {latest.model ? ` (${latest.model})` : ""} · {fmtDate(latest.startedAt)}
                </span>
                <code title={latest.id}>{latest.id}</code>
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
                {(
                  [
                    [latest.counts.sourcesExamined, "examined"],
                    [latest.counts.sourcesCited, "cited"],
                    [latest.counts.ideasGenerated, "ideas"],
                    [latest.counts.ideasAdvanced, "advanced"],
                    [latest.counts.ideasRejected, "rejected"],
                  ] as const
                ).map(([n, l]) => (
                  <span key={l}>
                    <b className={n ? "" : "zero"}>{n}</b>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <Empty>No research runs recorded yet.</Empty>
          )}
        </Section>
          <Section title="Riskiest open assumptions">
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
          </Section>
        </div>
      </div>

      <div className="grid-wide">
        <Section title="Decision ledger" kicker={`${decisions.length} entries, append-only`} aside={<Link to="/history">Full ledger</Link>}>
          {recent.length ? (
            <table className="ledger">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Subject and rationale</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id}>
                    <td className="when">{d.at.slice(0, 10)}</td>
                    <td className="what">
                      <StatusPill status={d.toStatus} />
                    </td>
                    <td className="body">
                      <Link className="subject" to={subjectHref(d)}>
                        {subjectName(d)}
                      </Link>
                      <p className="why">{d.rationale}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No decisions yet.</Empty>
          )}
        </Section>

        <div className="stack">
          {reconsider.length > 0 ? (
            <Section title="Up for reconsideration" kicker={`${reconsider.length} with new evidence`}>
              <ul className="decision-list">
                {reconsider.slice(0, 5).map((r) => (
                  <li key={r.idea.id}>
                    <div>
                      <StatusPill status={r.idea.status} /> <Link to={`/ideas/${r.idea.id}`}>{r.idea.title}</Link>
                    </div>
                    <p className="muted small">{r.reasons.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            <Section title="Up for reconsideration">
              <Empty>No parked or rejected idea has new evidence since its decision.</Empty>
            </Section>
          )}
        </div>
      </div>
      <p className="small-print">Research memory last changed {fmtDate(updated)}. Scores are heuristics, not probabilities.</p>
    </div>
  );
}
