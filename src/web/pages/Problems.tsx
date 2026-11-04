import { Link, useParams } from "react-router-dom";
import { evidenceForProblem } from "../../core/scoring";
import { Empty, EvidenceCard, EvidenceLevel, Meter, Pill, Section, StatusPill } from "../components/ui";
import { fmtDate, ideasForProblem, useLab } from "../data";
import { IdeaCard } from "./Ideas";

export function Problems() {
  const { m, problemEvidence, byId } = useLab();
  const list = [...m.problems].sort((a, b) => (problemEvidence.get(b.id)?.score ?? 0) - (problemEvidence.get(a.id)?.score ?? 0));
  return (
    <div className="page">
      <Section page bare title="Discovered problems" kicker={`${list.length} problems, each backed by at least one quoted source`}>
        {list.length ? (
          <div className="card-grid">
            {list.map((p) => {
              const a = problemEvidence.get(p.id)!;
              const ideas = ideasForProblem(m, p.id);
              return (
                <article key={p.id} className="card problem-card">
                  <header>
                    <StatusPill status={p.status} /> <EvidenceLevel a={a} />
                  </header>
                  <h3>
                    <Link to={`/problems/${p.id}`}>{p.title}</Link>
                  </h3>
                  <p>{p.statement}</p>
                  <Meter value={a.score} label={`Evidence · ${a.supportingOrigins} independent origin(s)`} tone="evidence" />
                  <footer className="muted">
                    {p.themeIds.map((t) => byId("themes", t)?.name).join(", ")} · {ideas.length} idea(s)
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty>No problems recorded.</Empty>
        )}
      </Section>
    </div>
  );
}

export function ProblemDetail() {
  const { id } = useParams();
  const { m, problemEvidence, byId } = useLab();
  const p = m.problems.find((x) => x.id === id);
  if (!p) return <Empty>Problem not found in this data set.</Empty>;
  const a = problemEvidence.get(p.id)!;
  const ev = evidenceForProblem(p.id, m);
  const ideas = ideasForProblem(m, p.id);
  return (
    <div className="page detail">
      <div className="crumbs">
        <Link to="/problems">Problems</Link> / <span>{p.id}</span>
      </div>
      <header className="detail-head">
        <div>
          <div className="pills">
            <StatusPill status={p.status} />
            {p.themeIds.map((t) => (
              <Pill key={t} kind="theme">
                {byId("themes", t)?.name ?? t}
              </Pill>
            ))}
          </div>
          <h1>{p.title}</h1>
          <p className="lede">{p.statement}</p>
          <dl className="facts">
            <dt>Who is affected</dt>
            <dd>{p.affectedUsers}</dd>
            {p.severityNote && (
              <>
                <dt>Severity</dt>
                <dd>{p.severityNote}</dd>
              </>
            )}
            {p.frequencyNote && (
              <>
                <dt>Frequency</dt>
                <dd>{p.frequencyNote}</dd>
              </>
            )}
            <dt>First seen</dt>
            <dd>
              {fmtDate(p.firstSeen)} in <Link to={`/runs/${p.discoveredInRun}`}>{p.discoveredInRun}</Link>
            </dd>
          </dl>
        </div>
        <aside className="score-box">
          <Meter value={a.score} label="Evidence strength" tone="evidence" hint={a.explanation.join("\n")} />
          <ul className="muted small">
            {a.explanation.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </aside>
      </header>
      <Section title="Evidence" kicker={`${ev.length} item(s)`}>
        {ev.map((e) => (
          <EvidenceCard key={e.id} ev={e} showLinks={false} />
        ))}
      </Section>
      <Section title="Ideas addressing this problem">
        {ideas.length ? <div className="card-grid">{ideas.map((i) => <IdeaCard key={i.id} idea={i} />)}</div> : <Empty>No ideas yet.</Empty>}
      </Section>
    </div>
  );
}
