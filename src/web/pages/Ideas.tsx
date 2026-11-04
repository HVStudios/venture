import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CRITERIA, type Idea } from "../../core/schema";
import { CRITERION_INFO, evidenceForIdea } from "../../core/scoring";
import { Empty, EpiBadge, EvidenceCard, EvidenceLevel, Meter, Pill, Section, StatusPill } from "../components/ui";
import { fmtDate, useLab } from "../data";

const STATUSES: Idea["status"][] = ["advanced", "proposed", "parked", "rejected", "merged"];

export function IdeaCard({ idea, compare, onToggle }: { idea: Idea; compare?: boolean; onToggle?: () => void }) {
  const { ideaScores, byId } = useLab();
  const s = ideaScores.get(idea.id)!;
  return (
    <article className={`card idea-card status-${idea.status}`}>
      <header>
        <StatusPill status={idea.status} />
        <EvidenceLevel a={s.evidence} />
        {onToggle && (
          <label className="compare-toggle">
            <input type="checkbox" checked={!!compare} onChange={onToggle} /> compare
          </label>
        )}
      </header>
      <h3>
        <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
      </h3>
      <p>{idea.summary}</p>
      <div className="meters">
        <Meter value={s.attractiveness} label="Attractiveness" tone="attract" />
        <Meter value={s.evidence.score} label="Evidence" tone="evidence" />
      </div>
      <footer className="muted">
        {idea.problemIds.map((p) => byId("problems", p)?.title ?? p).join(" · ")}
      </footer>
    </article>
  );
}

export function Ideas() {
  const { m, ideaScores } = useLab();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"attract" | "evidence" | "updated">("attract");
  const [picked, setPicked] = useState<string[]>([]);
  const status = params.get("status") ?? "all";
  const theme = params.get("theme") ?? "all";

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return m.ideas
      .filter((i) => (status === "all" ? true : i.status === status))
      .filter((i) => (theme === "all" ? true : i.themeIds.includes(theme)))
      .filter((i) => !needle || `${i.title} ${i.summary} ${i.solution}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
        const A = ideaScores.get(a.id)!;
        const B = ideaScores.get(b.id)!;
        return sort === "attract" ? B.attractiveness - A.attractiveness : B.evidence.score - A.evidence.score;
      });
  }, [m.ideas, status, theme, q, sort, ideaScores]);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <Section
        title="Ideas"
        kicker={`${list.length} of ${m.ideas.length}`}
        aside={
          picked.length >= 2 ? (
            <Link className="btn" to={`/compare?ids=${picked.join(",")}`}>
              Compare {picked.length} →
            </Link>
          ) : (
            <span className="muted">Select 2–4 ideas to compare</span>
          )
        }
      >
        <div className="filters">
          <input type="search" placeholder="Search ideas…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ideas" />
          <select value={status} onChange={(e) => set("status", e.target.value)} aria-label="Status">
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s} ({m.ideas.filter((i) => i.status === s).length})
              </option>
            ))}
          </select>
          <select value={theme} onChange={(e) => set("theme", e.target.value)} aria-label="Theme">
            <option value="all">All themes</option>
            {m.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="attract">Sort: attractiveness</option>
            <option value="evidence">Sort: evidence strength</option>
            <option value="updated">Sort: recently updated</option>
          </select>
        </div>
        {list.length ? (
          <div className="card-grid">
            {list.map((i) => (
              <IdeaCard
                key={i.id}
                idea={i}
                compare={picked.includes(i.id)}
                onToggle={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id].slice(-4)))}
              />
            ))}
          </div>
        ) : (
          <Empty>No ideas match these filters.</Empty>
        )}
      </Section>
    </div>
  );
}

export function ScoreTable({ idea }: { idea: Idea }) {
  return (
    <div className="table-wrap">
    <table className="score-table">
      <thead>
        <tr>
          <th>Criterion</th>
          <th>Weight</th>
          <th>Score</th>
          <th>Rationale</th>
        </tr>
      </thead>
      <tbody>
        {CRITERIA.map((c) => {
          const v = idea.scores.criteria[c];
          return (
            <tr key={c}>
              <td title={CRITERION_INFO[c].question}>{CRITERION_INFO[c].label}</td>
              <td className="num">×{CRITERION_INFO[c].weight}</td>
              <td>
                <span className="dots" aria-label={`${v.score} of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= v.score ? "on" : ""} />
                  ))}
                </span>
              </td>
              <td>{v.rationale}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

export function IdeaDetail() {
  const { id } = useParams();
  const lab = useLab();
  const { m, byId, ideaScores, related } = lab;
  const idea = m.ideas.find((i) => i.id === id);
  if (!idea) return <Empty>Idea not found in this data set.</Empty>;
  const s = ideaScores.get(idea.id)!;
  const ev = evidenceForIdea(idea, m);
  const supporting = ev.filter((e) => e.stance === "supports");
  const contra = ev.filter((e) => e.stance === "contradicts");
  const context = ev.filter((e) => e.stance === "context");
  const experiments = m.experiments.filter((x) => x.ideaId === idea.id);
  const history = m.decisions.filter((d) => d.subjectId === idea.id).sort((a, b) => a.at.localeCompare(b.at));
  const rel = related.get(idea.id) ?? [];

  return (
    <div className="page detail">
      <div className="crumbs">
        <Link to="/ideas">Ideas</Link> / <span>{idea.id}</span>
      </div>
      <header className="detail-head">
        <div>
          <div className="pills">
            <StatusPill status={idea.status} />
            <EpiBadge e={idea.epistemic} />
            {idea.themeIds.map((t) => (
              <Pill key={t} kind="theme">
                {byId("themes", t)?.name ?? t}
              </Pill>
            ))}
          </div>
          <h1>{idea.title}</h1>
          <p className="lede">{idea.summary}</p>
          <p className="decision-note">
            <b>Director:</b> {idea.statusRationale}
            {idea.mergedInto && (
              <>
                {" "}
                Merged into <Link to={`/ideas/${idea.mergedInto}`}>{byId("ideas", idea.mergedInto)?.title}</Link>.
              </>
            )}
          </p>
        </div>
        <aside className="score-box">
          <Meter value={s.attractiveness} label="Attractiveness" tone="attract" hint="Weighted criterion scores (if assumptions hold)" />
          <Meter value={s.evidence.score} label="Evidence strength" tone="evidence" hint={s.evidence.explanation.join("\n")} />
          <p className="muted">
            Counts evidence on this idea's problems plus idea-specific evidence: {s.evidence.supportingOrigins} independent supporting origin(s), {s.evidence.contradictingOrigins} contradicting. <Link to="/method">What these mean</Link>
          </p>
        </aside>
      </header>

      <nav className="toc">
        {["problem", "solution", "evidence", "alternatives", "critique", "scores", "experiments", "history"].map((a) => (
          <a key={a} href={`#/ideas/${idea.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(a)?.scrollIntoView({ behavior: "smooth" }); }}>
            {a}
          </a>
        ))}
      </nav>

      <Section title="Problem" id="problem">
        {idea.problemIds.map((p) => {
          const prob = byId("problems", p);
          return prob ? (
            <div key={p} className="problem-inline">
              <Link to={`/problems/${p}`}><b>{prob.title}</b></Link>
              <p>{prob.statement}</p>
              <p className="muted">Affects: {prob.affectedUsers}</p>
            </div>
          ) : null;
        })}
      </Section>

      <Section title="Proposed solution" id="solution">
        <dl className="facts">
          <dt>Target users</dt>
          <dd>{idea.targetUsers}</dd>
          <dt>Solution</dt>
          <dd>{idea.solution}</dd>
          <dt>Differentiation</dt>
          <dd>{idea.differentiation}</dd>
          <dt>Technical feasibility</dt>
          <dd>{idea.feasibility}</dd>
          {idea.practical && (
            <>
              <dt>Practical value</dt>
              <dd>
                {idea.practical.distribution} · adopters: {idea.practical.adopters} · smallest useful version: {idea.practical.smallestUsefulVersion} · {idea.practical.buildableByVenture ? "buildable by VENTURE" : "not buildable by VENTURE"} ({idea.practical.buildNote}) · money: {idea.practical.monetization}
              </dd>
            </>
          )}
          {idea.noveltyNote && (
            <>
              <dt>Novelty vs. memory</dt>
              <dd>{idea.noveltyNote}</dd>
            </>
          )}
        </dl>
        <div className="grid-2 tight">
          <div>
            <h3>Key assumptions</h3>
            <ul className="assumptions">
              {idea.assumptions.map((a) => (
                <li key={a.id}>
                  <Pill kind={`crit-${a.criticality}`}>{a.criticality}</Pill> <Pill kind={`astat-${a.status}`}>{a.status}</Pill> {a.text}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Risks</h3>
            <ul className="bullets">
              {idea.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            {idea.nextSteps.length > 0 && (
              <>
                <h3>Next steps</h3>
                <ul className="bullets">
                  {idea.nextSteps.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title="Evidence" id="evidence" kicker={`${supporting.length} supporting · ${contra.length} contradicting · ${context.length} context`}>
        {contra.length > 0 && <h3 className="contra-h">Contradicting evidence</h3>}
        {contra.map((e) => <EvidenceCard key={e.id} ev={e} showLinks={false} />)}
        {supporting.length > 0 && <h3>Supporting evidence</h3>}
        {supporting.map((e) => <EvidenceCard key={e.id} ev={e} showLinks={false} />)}
        {context.length > 0 && <h3>Context</h3>}
        {context.map((e) => <EvidenceCard key={e.id} ev={e} showLinks={false} />)}
        {!ev.length && <Empty>No evidence recorded. Treat this idea as speculation.</Empty>}
      </Section>

      <Section title="Existing alternatives & competitors" id="alternatives">
        {idea.competitorIds.length ? (
          <div className="card-grid">
            {idea.competitorIds.map((cid) => {
              const c = byId("competitors", cid);
              if (!c) return null;
              return (
                <article key={cid} className="card comp-card">
                  <header>
                    <Pill kind="type">{c.kind}</Pill>
                  </header>
                  <h3>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer nofollow">{c.name}</a> : c.name}</h3>
                  <p>{c.description}</p>
                  {c.strengths.length > 0 && <p><b>Strengths:</b> {c.strengths.join("; ")}</p>}
                  {c.weaknesses.length > 0 && <p><b>Gaps:</b> {c.weaknesses.join("; ")}</p>}
                  {c.sourceIds.length > 0 && (
                    <p className="muted">Sources: {c.sourceIds.map((sid) => byId("sources", sid)?.publisher ?? sid).join(", ")}</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty>No alternatives recorded. That is itself a warning sign: absence of competitors is rarely real.</Empty>
        )}
      </Section>

      <Section title="Critique" id="critique" kicker="The Critic's objections">
        <ul className="objections">
          {idea.objections.map((o) => (
            <li key={o.id} className={`objection sev-${o.severity}`}>
              <div>
                <Pill kind={`sev-${o.severity}`}>{o.severity}</Pill> <Pill kind={`ostat-${o.status}`}>{o.status}</Pill>
              </div>
              <p>{o.text}</p>
              {o.response && (
                <p className="response">
                  <b>Response:</b> {o.response}
                </p>
              )}
              {o.evidenceIds.map((eid) => {
                const e = byId("evidence", eid);
                return e ? <EvidenceCard key={eid} ev={e} showLinks={false} /> : null;
              })}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Evaluation" id="scores" kicker={`Assessed by ${idea.scores.assessedBy} · ${fmtDate(idea.scores.assessedAt)}`}>
        <ScoreTable idea={idea} />
        <p className="muted">
          Attractiveness = weighted mean of (score − 1) / 4, scaled to 0–100. Evidence strength is computed separately from the linked evidence records. These are heuristic, uncalibrated ratings.
        </p>
      </Section>

      <Section title="Validation experiments" id="experiments">
        {experiments.length ? experiments.map((x) => <ExperimentCard key={x.id} id={x.id} />) : <Empty>No experiment proposed. Only advanced ideas get experiments.</Empty>}
      </Section>

      <Section title="Assessment history" id="history">
        <ol className="timeline">
          {history.map((d) => (
            <li key={d.id}>
              <span className="when">{fmtDate(d.at)}</span>
              <span>
                <b>{d.action}</b> {d.fromStatus ? `${d.fromStatus} → ` : ""}
                <StatusPill status={d.toStatus} /> by {d.actor}
                {d.runId && (
                  <>
                    {" "}in <Link to={`/runs/${d.runId}`}>{d.runId}</Link>
                  </>
                )}
                {d.attractiveness !== undefined && (
                  <span className="muted"> · attractiveness {d.attractiveness} · evidence {d.evidenceStrength}</span>
                )}
              </span>
              <p>{d.rationale}</p>
            </li>
          ))}
        </ol>
        {rel.length > 0 && (
          <>
            <h3>Similar ideas in memory</h3>
            <ul className="bullets">
              {rel.map((r) => (
                <li key={r.id}>
                  <Link to={`/ideas/${r.id}`}>{byId("ideas", r.id)?.title}</Link> <span className="muted">similarity {r.score.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </div>
  );
}

export function ExperimentCard({ id }: { id: string }) {
  const { byId } = useLab();
  const x = byId("experiments", id);
  if (!x) return null;
  const idea = byId("ideas", x.ideaId);
  return (
    <article className="card experiment">
      <header>
        <StatusPill status={x.status} /> <Pill kind={`mode-${x.executionMode}`}>{x.executionMode}</Pill>
        <span className="muted">
          {x.estimatedTime} · ${x.estimatedCostUsd}
        </span>
      </header>
      <h3>{x.title}</h3>
      {idea && (
        <p className="muted">
          Tests <Link to={`/ideas/${idea.id}`}>{idea.title}</Link>
        </p>
      )}
      <dl className="facts">
        <dt>Hypothesis</dt>
        <dd>{x.hypothesis}</dd>
        <dt>Largest uncertainty</dt>
        <dd>{x.uncertainty}</dd>
        <dt>Procedure</dt>
        <dd>
          <ol>
            {x.procedure.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </dd>
        <dt>Success if</dt>
        <dd>
          <ul className="bullets">{x.successCriteria.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </dd>
        <dt>Reject if</dt>
        <dd>
          <ul className="bullets">{x.failureCriteria.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </dd>
        <dt>Resources</dt>
        <dd>{x.resources.join(", ") || "—"}</dd>
        <dt>Expected learning</dt>
        <dd>{x.expectedLearning}</dd>
        <dt>Then</dt>
        <dd>
          <b>On success:</b> {x.nextSteps.ifSuccess}
          <br />
          <b>On failure:</b> {x.nextSteps.ifFailure}
        </dd>
        <dt>Outcome</dt>
        <dd>{x.outcome ? <><StatusPill status={x.outcome.result} /> {x.outcome.summary} <span className="muted">({fmtDate(x.outcome.recordedAt)})</span></> : <span className="muted">Not run yet. No outcome has been recorded, and none will be invented.</span>}</dd>
      </dl>
    </article>
  );
}
