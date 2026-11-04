import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { buildArea, buildAreas, IDEA_STATUS_TEXT, RESULT_TEXT, strongestObjection, type AreaModel, type TimelineEvent } from "../../core/areas";
import type { Evidence, Experiment, Idea, IdeaStatus, Source } from "../../core/schema";
import { EpiBadge, EvidenceLevel, Pill, VerifyBadge } from "../components/ui";
import { domain, fmtDate, timeAgo, useLab } from "../data";
import { ThemeProposal } from "../components/ThemeProposal";

const REPO = "https://github.com/HVStudios/venture";
const DIST: Record<NonNullable<Idea["practical"]>["distribution"], string> = {
  "open-source": "Open-source tool",
  "hosted-free": "Free hosted service",
  "paid-product": "Paid product",
  "open-core": "Open core (free tool, paid extras)",
  "write-up-only": "Knowledge, not a product",
};

function StatusChip({ s }: { s: AreaModel["status"] }) {
  return (
    <span className={`area-status area-${s.key}`} title={s.explanation}>
      <i /> {s.label}
    </span>
  );
}

function Counts({ a }: { a: AreaModel }) {
  const items: [number, string][] = [
    [a.researchRuns.length, "research sessions"],
    [a.sources.length, "cited sources"],
    [a.ideas.length, "ideas assessed"],
    [a.experiments.completed.length + a.experiments.planned.length, "experiments"],
  ];
  return (
    <dl className="area-counts">
      {items.map(([n, l]) => (
        <div key={l}>
          <dd>{n}</dd>
          <dt>{l}</dt>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ overview
export function ResearchAreas() {
  const { m } = useLab();
  const areas = useMemo(() => buildAreas(m), [m]);
  return (
    <div className="page">
      <header className="research-head">
        <div className="kicker">Research areas</div>
        <h1>What VENTURE is investigating</h1>
        <p className="lede">
          Each research area is a standing investigation. Open one to read its question, what has been found, what has been tested, what the lab currently concludes and what it will look at next. All of it is traceable to sources.
        </p>
      </header>
      <div className="area-list">
        {areas.map((a) => (
          <AreaCard key={a.theme.id} a={a} />
        ))}
      </div>
      <section className="section">
        <header className="section-head">
          <div>
            <div className="kicker">Steer the lab</div>
            <h2>Propose a new research area</h2>
          </div>
        </header>
        <ThemeProposal />
      </section>
    </div>
  );
}

function AreaCard({ a }: { a: AreaModel }) {
  const findings = a.brief?.findings.slice(0, 2) ?? [];
  return (
    <article className={`area-card area-card-${a.status.key}`}>
      <div className="area-card-main">
        <div className="area-card-top">
          <StatusChip s={a.status} />
          <span className="muted small">{a.theme.mode === "exploratory" ? "Exploratory area" : "Focused investigation"}</span>
        </div>
        <h2>
          <Link to={`/research/${a.theme.id}`}>{a.theme.name}</Link>
        </h2>
        <p className="area-question">{a.brief?.researchQuestion ?? a.theme.description}</p>
        {findings.length > 0 ? (
          <div className="area-findings">
            <div className="kicker">Key findings so far</div>
            <ul>
              {findings.map((f) => (
                <li key={f.id}>{f.statement}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted area-nofindings">
            {a.researchRuns.length ? "Research has started, but no written synthesis of findings exists yet." : "No findings yet. This area hasn't been investigated beyond automatic signal collection."}
          </p>
        )}
      </div>
      <aside className="area-card-side">
        <Counts a={a} />
        <div className="area-side-block">
          <div className="kicker">Latest development</div>
          <p>{a.latest ? a.latest.title : "Nothing yet"}</p>
          {a.latest && <span className="muted small">{timeAgo(a.latest.at)}</span>}
        </div>
        <div className="area-side-block">
          <div className="kicker">Next planned</div>
          <p>{a.nextStep ?? <span className="muted">No next step recorded yet.</span>}</p>
        </div>
        <Link className="btn" to={`/research/${a.theme.id}`}>
          Read the research journal →
        </Link>
      </aside>
    </article>
  );
}

// ------------------------------------------------------------------ journal
const SECTIONS = [
  ["overview", "Overview"],
  ["findings", "Key findings"],
  ["history", "Research history"],
  ["ideas", "Hypotheses & ideas"],
  ["experiments", "Experiments"],
  ["conclusions", "Conclusions"],
  ["next", "Next steps"],
  ["sources", "Sources & evidence"],
] as const;

function JSection({ id, n, title, children, lead }: { id: string; n: number; title: string; children: React.ReactNode; lead?: string }) {
  return (
    <section className="jsection" id={id}>
      <header>
        <span className="jnum">{String(n).padStart(2, "0")}</span>
        <h2>{title}</h2>
      </header>
      {lead && <p className="jlead">{lead}</p>}
      {children}
    </section>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="missing">{children}</p>;
}

/** Numbered citations, as in a paper: [n] → source n in the reference list. */
function useCitations(a: AreaModel) {
  return useMemo(() => {
    const order: Source[] = [];
    const index = new Map<string, number>();
    const cite = (sourceId: string) => {
      if (!index.has(sourceId)) {
        const s = a.sources.find((x) => x.id === sourceId);
        if (!s) return undefined;
        order.push(s);
        index.set(sourceId, order.length);
      }
      return index.get(sourceId);
    };
    // Findings first, then everything else, so the numbering follows the reading order.
    a.brief?.findings.forEach((f) => f.evidenceIds.forEach((e) => { const ev = a.evidence.find((x) => x.id === e); if (ev) cite(ev.sourceId); }));
    a.evidence.forEach((e) => cite(e.sourceId));
    return { order, index };
  }, [a]);
}

function Cites({ ids, a, index }: { ids: string[]; a: AreaModel; index: Map<string, number> }) {
  const nums = [...new Set(ids.map((id) => a.evidence.find((e) => e.id === id)).filter(Boolean).map((e) => index.get((e as Evidence).sourceId)).filter(Boolean) as number[])].sort((x, y) => x - y);
  if (!nums.length) return null;
  return (
    <span className="cites">
      {nums.map((n) => (
        <a key={n} href={`#src-${n}`} onClick={(ev) => { ev.preventDefault(); document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
          [{n}]
        </a>
      ))}
    </span>
  );
}

export function ResearchArea() {
  const { id } = useParams();
  const { m } = useLab();
  const a = useMemo(() => (id ? buildArea(m, id) : undefined), [m, id]);
  if (!a) return <div className="empty">This research area doesn't exist in this data set. <Link to="/research">All research areas</Link></div>;
  return <Journal a={a} />;
}

function Journal({ a }: { a: AreaModel }) {
  const { order, index } = useCitations(a);
  const b = a.brief;
  const contra = a.evidence.filter((e) => e.stance === "contradicts");
  return (
    <div className="page journal">
      <div className="crumbs">
        <Link to="/research">Research areas</Link> / <span>{a.theme.name}</span>
      </div>
      <header className="journal-head">
        <div className="journal-head-main">
          <div className="area-card-top">
            <StatusChip s={a.status} />
            <span className="muted small">
              {a.theme.mode === "exploratory" ? "Exploratory area" : "Focused investigation"} · opened {fmtDate(a.theme.createdAt)}
              {a.lastActivity ? ` · last activity ${timeAgo(a.lastActivity)}` : ""}
            </span>
          </div>
          <h1>{a.theme.name}</h1>
          <p className="journal-question">{b?.researchQuestion ?? a.theme.description}</p>
          <p className="muted">{a.status.explanation}</p>
        </div>
        <Counts a={a} />
      </header>

      {a.stale && <div className="stale-banner"><b>The written synthesis may be out of date.</b> {a.staleReason} The history, ideas and experiments below are always current.</div>}
      {!b && (
        <div className="stale-banner">
          <b>No research brief has been written for this area yet.</b> Sections that need a written synthesis say so below. Everything else is generated from the recorded research.
        </div>
      )}

      <div className="journal-layout">
        <nav className="journal-toc" aria-label="Sections">
          {SECTIONS.map(([sid, label], i) => (
            <a key={sid} href={`#${sid}`} onClick={(e) => { e.preventDefault(); document.getElementById(sid)?.scrollIntoView({ behavior: "smooth" }); }}>
              <span>{String(i + 1).padStart(2, "0")}</span> {label}
            </a>
          ))}
          {b && <p className="muted small">Brief updated {fmtDate(b.updatedAt)} by {b.author}</p>}
        </nav>

        <article className="journal-body">
          <JSection id="overview" n={1} title="Overview">
            <p>{a.theme.description}</p>
            {b ? (
              <>
                <h3>Why it matters</h3>
                <p>{b.whyItMatters}</p>
                {b.subQuestions.length > 0 && (
                  <>
                    <h3>Questions this area tries to answer</h3>
                    <ol className="jlist">
                      {b.subQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            ) : (
              <Missing>The motivation and sub-questions haven't been written up yet.</Missing>
            )}
            <h3>Problems identified so far</h3>
            {a.problems.length ? (
              <ul className="problem-rows">
                {a.problems.map((p) => (
                  <li key={p.id}>
                    <Link to={`/problems/${p.id}`}>{p.title}</Link>
                    <p>{p.statement}</p>
                    <span className="muted small">Affects: {p.affectedUsers}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Missing>No problems have been identified yet.</Missing>
            )}
            <p className="muted small">
              Search terms used by the collectors: {a.theme.keywords.map((k) => <code key={k}>{k}</code>).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])} · {a.signals} signal(s) gathered · <Link to="/signals">browse signals</Link>
            </p>
          </JSection>

          <JSection id="findings" n={2} title="Key findings" lead={b ? "What the research has established so far. Numbers in brackets point to the sources at the end of this journal." : undefined}>
            {b?.findings.length ? (
              <ol className="findings">
                {b.findings.map((f) => (
                  <li key={f.id}>
                    <p className="finding-statement">
                      {f.statement} <Cites ids={f.evidenceIds} a={a} index={index} />
                    </p>
                    <p className="finding-strength">
                      <EpiBadge e={f.epistemic} /> {f.strength}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <Missing>No findings have been written up for this area yet.</Missing>
            )}
            {b && b.uncertainties.length > 0 && (
              <>
                <h3>Important uncertainties</h3>
                <ul className="jlist">
                  {b.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </>
            )}
            <h3>Evidence pointing the other way</h3>
            {contra.length ? (
              <ul className="counter">
                {contra.map((e) => (
                  <li key={e.id}>
                    {e.claim} <Cites ids={[e.id]} a={a} index={index} />
                    {e.context && <span className="muted"> {e.context}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <Missing>No contradicting evidence has been recorded. That means none was found, not that none exists.</Missing>
            )}
          </JSection>

          <JSection id="history" n={3} title="Research history" lead="Every session, discovery and decision, in order. Generated from the research log.">
            <History events={a.timeline} />
          </JSection>

          <JSection id="ideas" n={4} title="Hypotheses & ideas" lead="Solutions VENTURE has considered and what it decided about each. Most ideas should not survive.">
            {a.ideas.length ? (
              (["advanced", "proposed", "parked", "rejected", "merged"] as IdeaStatus[])
                .filter((s) => a.ideasByStatus[s].length)
                .map((s) => (
                  <div key={s} className="idea-group">
                    <h3>
                      {IDEA_STATUS_TEXT[s].label} <span className="muted">({a.ideasByStatus[s].length}): {IDEA_STATUS_TEXT[s].meaning}</span>
                    </h3>
                    {a.ideasByStatus[s].map((i) => (
                      <IdeaStory key={i.id} idea={i} a={a} index={index} />
                    ))}
                  </div>
                ))
            ) : (
              <Missing>No ideas have been proposed yet.</Missing>
            )}
          </JSection>

          <JSection id="experiments" n={5} title="Experiments" lead="Tests of the riskiest assumptions. Results appear only after an experiment has actually been run.">
            <h3>Completed</h3>
            {a.experiments.completed.length ? a.experiments.completed.map((x) => <ExperimentStory key={x.id} x={x} a={a} />) : <Missing>No experiment has been completed in this area.</Missing>}
            <h3>Planned</h3>
            {a.experiments.planned.length ? a.experiments.planned.map((x) => <ExperimentStory key={x.id} x={x} a={a} />) : <Missing>No experiment is currently planned.</Missing>}
          </JSection>

          <JSection id="conclusions" n={6} title="Conclusions">
            {b?.conclusion ? (
              <div className="conclusion">
                <p className="belief">{b.conclusion.belief}</p>
                <dl className="facts">
                  <dt>Confidence</dt>
                  <dd>
                    <span className={`confidence conf-${b.conclusion.confidence}`}>{b.conclusion.confidence}</span> {b.conclusion.confidenceReason}
                  </dd>
                  <dt>Still unknown</dt>
                  <dd>
                    {b.conclusion.unknowns.length ? (
                      <ul className="jlist">
                        {b.conclusion.unknowns.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>
                    ) : (
                      "Nothing recorded."
                    )}
                  </dd>
                  <dt>Keep investigating?</dt>
                  <dd>
                    <b>{b.conclusion.continueInvestigation ? "Yes." : "No."}</b> {b.conclusion.continueReason}
                  </dd>
                </dl>
                <p className="muted small">Confidence is the research team's qualitative judgement, explained above. It is not a computed probability.</p>
              </div>
            ) : (
              <Missing>{a.researchRuns.length ? "No conclusion has been written yet. VENTURE won't state one until a research session has reviewed the evidence." : "Too early for conclusions: no research has been done in this area yet."}</Missing>
            )}
          </JSection>

          <JSection id="next" n={7} title="Next steps">
            {b?.nextSteps.length ? (
              <ol className="jlist next">
                {b.nextSteps.map((n, i) => (
                  <li key={i}>
                    <Pill kind="type">{n.kind}</Pill> {n.text}
                    {n.issue && (
                      <>
                        {" "}
                        <a href={`${REPO}/issues/${n.issue}`} target="_blank" rel="noopener noreferrer">
                          issue #{n.issue}
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            ) : a.nextStep ? (
              <p>{a.nextStep} <span className="muted small">(derived from the planned experiments; no written plan yet)</span></p>
            ) : (
              <Missing>No next step has been recorded.</Missing>
            )}
          </JSection>

          <JSection id="sources" n={8} title="Sources & evidence" lead={`${order.length} cited source(s), ${a.evidence.length} evidence item(s). Every quote was captured verbatim and is re-checked against the live page on a schedule.`}>
            {order.length ? (
              <ol className="refs">
                {order.map((s, i) => (
                  <SourceRef key={s.id} s={s} n={i + 1} evidence={a.evidence.filter((e) => e.sourceId === s.id)} />
                ))}
              </ol>
            ) : (
              <Missing>No sources cited yet.</Missing>
            )}
            <p className="muted small">
              Deeper views: <Link to="/sources">evidence library</Link> · <Link to="/ideas">all ideas</Link> · <Link to="/experiments">all experiments</Link> · <Link to="/graph">research map</Link> · <Link to="/history">run logs</Link>
            </p>
          </JSection>
        </article>
      </div>
    </div>
  );
}

function History({ events }: { events: TimelineEvent[] }) {
  const [showCollection, setShowCollection] = useState(false);
  const shown = events.filter((e) => showCollection || e.kind !== "collection");
  const days = new Map<string, TimelineEvent[]>();
  for (const e of shown) {
    const d = e.at.slice(0, 10);
    if (!days.has(d)) days.set(d, []);
    days.get(d)!.push(e);
  }
  const hidden = events.length - shown.length;
  return (
    <>
      {[...days.entries()].map(([day, evs]) => (
        <div key={day} className="day">
          <div className="day-label">{day}</div>
          <ol className="jtimeline">
            {evs.map((e, i) => (
              <li key={i} className={`ev ev-${e.kind} ${e.tone ? `tone-${e.tone}` : ""}`}>
                <span className="ev-time">{e.at.slice(11, 16)} UTC</span>
                <div>
                  <p className="ev-title">{e.link ? <Link to={e.link}>{e.title}</Link> : e.title}</p>
                  {e.detail && <p className="ev-detail">{e.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!shown.length && <Missing>Nothing has happened in this area yet.</Missing>}
      {(hidden > 0 || showCollection) && (
        <button className="link-btn" onClick={() => setShowCollection(!showCollection)}>
          {showCollection ? "Hide automatic signal collections" : `Show ${hidden} automatic signal collection(s)`}
        </button>
      )}
    </>
  );
}

function IdeaStory({ idea, a, index }: { idea: Idea; a: AreaModel; index: Map<string, number> }) {
  const { ideaScores } = useLab();
  const s = ideaScores.get(idea.id);
  const o = strongestObjection(idea);
  const support = a.evidence.filter((e) => e.ideaIds.includes(idea.id) && e.stance === "supports");
  const against = a.evidence.filter((e) => e.ideaIds.includes(idea.id) && e.stance === "contradicts");
  return (
    <div className={`idea-story st-${idea.status}`}>
      <h4>
        <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
      </h4>
      <p>{idea.summary}</p>
      <dl className="facts">
        <dt>Decision</dt>
        <dd>{idea.statusRationale}</dd>
        {o && (
          <>
            <dt>Strongest objection</dt>
            <dd>
              <Pill kind={`sev-${o.severity}`}>{o.severity}</Pill> {o.text} <Cites ids={o.evidenceIds} a={a} index={index} />
            </dd>
          </>
        )}
        {(support.length > 0 || against.length > 0) && (
          <>
            <dt>Idea-specific evidence</dt>
            <dd>
              {support.length} supporting <Cites ids={support.map((e) => e.id)} a={a} index={index} /> · {against.length} contradicting <Cites ids={against.map((e) => e.id)} a={a} index={index} />
            </dd>
          </>
        )}
        {idea.practical && (
          <>
            <dt>Practical value</dt>
            <dd>
              <b>{DIST[idea.practical.distribution]}</b> for {idea.practical.adopters}. Smallest useful version: {idea.practical.smallestUsefulVersion}{" "}
              <span className="muted">
                ({idea.practical.buildableByVenture ? "VENTURE could build and test this itself" : "beyond what VENTURE can build itself"}: {idea.practical.buildNote}) Money: {idea.practical.monetization}
              </span>
            </dd>
          </>
        )}
        {s && (
          <>
            <dt>Assessment</dt>
            <dd>
              <EvidenceLevel a={s.evidence} /> behind it (including its problem) · attractiveness {s.attractiveness}/100 <Link to="/method" className="muted small">what these mean</Link>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

function ExperimentStory({ x, a }: { x: Experiment; a: AreaModel }) {
  const idea = a.ideas.find((i) => i.id === x.ideaId);
  const stateText: Record<Experiment["status"], string> = {
    proposed: "Planned: designed, awaiting approval",
    approved: "Approved: waiting to run",
    running: "Running",
    completed: "Completed",
    abandoned: "Abandoned",
  };
  return (
    <div className={`exp-story ${x.outcome ? `exp-${x.outcome.result}` : "planned"}`}>
      <div className="exp-story-head">
        <span className="exp-state">{stateText[x.status]}</span>
        <span className="muted small">
          {x.executionMode === "automatable" ? "automated, public data" : x.executionMode === "requires-humans" ? "needs real users" : "needs owner authorization"} · est. {x.estimatedTime} · ${x.estimatedCostUsd}
        </span>
      </div>
      <h4>{x.title}</h4>
      <dl className="facts">
        <dt>Why</dt>
        <dd>{x.uncertainty}</dd>
        <dt>Hypothesis</dt>
        <dd>{x.hypothesis}</dd>
        {idea && (
          <>
            <dt>Tests idea</dt>
            <dd>
              <Link to={`/ideas/${idea.id}`}>{idea.title}</Link> <span className="muted">({IDEA_STATUS_TEXT[idea.status].label.toLowerCase()})</span>
            </dd>
          </>
        )}
        <dt>How it's measured</dt>
        <dd>
          <details>
            <summary>{x.procedure.length} step(s): success if {x.successCriteria.join("; ")}</summary>
            <ol className="jlist">
              {x.procedure.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
            <p>
              <b>Counts as failure if:</b> {x.failureCriteria.join("; ")}
            </p>
          </details>
        </dd>
        {x.outcome ? (
          <>
            <dt>Result</dt>
            <dd>
              <b className={`res res-${x.outcome.result}`}>{RESULT_TEXT[x.outcome.result]}.</b> {x.outcome.summary}
              <div className="muted small">Recorded {fmtDate(x.outcome.recordedAt)}</div>
            </dd>
            <dt>What follows</dt>
            <dd>{x.outcome.result === "refuted" ? x.nextSteps.ifFailure : x.outcome.result === "supported" ? x.nextSteps.ifSuccess : `Neither planned branch applies cleanly. If it had succeeded: ${x.nextSteps.ifSuccess} If it had failed: ${x.nextSteps.ifFailure}`}</dd>
          </>
        ) : (
          <>
            <dt>Result</dt>
            <dd className="muted">Not run yet. No result exists, and none will be presumed.</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function SourceRef({ s, n, evidence }: { s: Source; n: number; evidence: Evidence[] }) {
  return (
    <li id={`src-${n}`} className="ref">
      <span className="ref-n">[{n}]</span>
      <div>
        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
          {s.title}
        </a>
        <div className="muted small">
          {s.publisher} · {domain(s.url)} · {s.sourceType}
          {s.publishedAt ? ` · published ${s.publishedAt.slice(0, 10)}` : ""} · retrieved {s.retrievedAt.slice(0, 10)} <VerifyBadge v={s.verification} />
        </div>
        <details>
          <summary>
            {evidence.length} claim(s) drawn from this source
          </summary>
          <ul className="ref-claims">
            {evidence.map((e) => (
              <li key={e.id}>
                <span className={`stance stance-${e.stance}`}>{e.stance}</span> <EpiBadge e={e.epistemic} /> {e.claim}
                <blockquote>“{e.quote}”</blockquote>
              </li>
            ))}
          </ul>
          {s.limitations && <p className="muted small">Limitations: {s.limitations}</p>}
        </details>
      </div>
    </li>
  );
}
