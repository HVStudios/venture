import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Empty, Pill, Section, StatusPill } from "../components/ui";
import { fmtDate, useLab } from "../data";
import { RunReplay } from "../components/RunReplay";
import { Strata } from "../components/Strata";

function duration(a: string, b?: string) {
  if (!b) return "—";
  const s = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);
  return s < 120 ? `${s}s` : `${Math.round(s / 60)} min`;
}

export function History() {
  const { m, byId } = useLab();
  const [showCollectors, setShowCollectors] = useState(false);
  const runs = [...m.runs].filter((r) => showCollectors || r.mode !== "collector").sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const decisions = [...m.decisions].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="page">
      <Section page
        title="Research runs"
        kicker={`${m.runs.length} run(s) recorded`}
        aside={
          <label className="toggle">
            <input type="checkbox" checked={showCollectors} onChange={(e) => setShowCollectors(e.target.checked)} /> include collector runs
          </label>
        }
      >
        {runs.length ? (
          <div className="table-wrap">
            <table className="runs-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Status</th>
                  <th>Theme</th>
                  <th>Mode</th>
                  <th>Started</th>
                  <th className="num">Duration</th>
                  <th className="num">Sources</th>
                  <th className="num">Ideas</th>
                  <th className="num">Adv / Park / Rej</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/runs/${r.id}`}>
                        <code>{r.id}</code>
                      </Link>
                    </td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td>{byId("themes", r.themeId)?.name ?? r.themeId}</td>
                    <td className="nowrap" title={r.provider}>
                      {r.mode}
                    </td>
                    <td className="nowrap tnum">{fmtDate(r.startedAt)}</td>
                    <td className="num">{duration(r.startedAt, r.completedAt)}</td>
                    <td className="num">
                      {r.counts.sourcesCited}/{r.counts.sourcesExamined}
                    </td>
                    <td className="num">{r.counts.ideasGenerated}</td>
                    <td className="num">
                      {r.counts.ideasAdvanced} / {r.counts.ideasParked} / {r.counts.ideasRejected}
                    </td>
                    <td className="num">{r.usage.actualCostUsd !== undefined ? `$${r.usage.actualCostUsd.toFixed(2)}` : r.usage.estimatedCostUsd !== undefined ? `~$${r.usage.estimatedCostUsd.toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No runs yet.</Empty>
        )}
      </Section>

      <Section title="Decision ledger" kicker={`${decisions.length} decision(s), append-only`}>
        <Strata decisions={decisions} name={(d) => (d.subjectType === "idea" ? byId("ideas", d.subjectId)?.title : d.subjectType === "problem" ? byId("problems", d.subjectId)?.title : d.subjectType === "experiment" ? byId("experiments", d.subjectId)?.title : byId("themes", d.subjectId)?.name) ?? d.subjectId} />
        <ol className="timeline">
          {decisions.map((d) => (
            <li key={d.id}>
              <span className="when">{fmtDate(d.at)}</span>
              <span>
                <b>{d.action}</b> {d.subjectType}{" "}
                <Link to={d.subjectType === "idea" ? `/ideas/${d.subjectId}` : d.subjectType === "problem" ? `/problems/${d.subjectId}` : "/experiments"}>
                  {(d.subjectType === "idea" ? byId("ideas", d.subjectId)?.title : d.subjectType === "problem" ? byId("problems", d.subjectId)?.title : null) ?? d.subjectId}
                </Link>{" "}
                {d.fromStatus ? `${d.fromStatus} → ` : "→ "}
                <StatusPill status={d.toStatus} /> <span className="muted">by {d.actor}</span>
              </span>
              <p>{d.rationale}</p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

export function RunDetail() {
  const { id } = useParams();
  const { m, byId } = useLab();
  const r = m.runs.find((x) => x.id === id);
  if (!r) return <Empty>Run not found in this data set.</Empty>;
  const ideas = m.ideas.filter((i) => i.createdInRun === r.id);
  const problems = m.problems.filter((p) => p.discoveredInRun === r.id);
  const experiments = m.experiments.filter((x) => x.createdInRun === r.id);
  return (
    <div className="page detail">
      <div className="crumbs">
        <Link to="/history">Runs</Link> / <span>{r.id}</span>
      </div>
      <header className="detail-head">
        <div>
          <div className="pills">
            <StatusPill status={r.status} /> <Pill kind="type">{r.mode}</Pill> <Pill kind={r.provenance === "real" ? "real" : "fixture"}>{r.provenance}</Pill>
          </div>
          <h1>
            <code>{r.id}</code>
          </h1>
          <dl className="facts">
            <dt>Theme</dt>
            <dd>{byId("themes", r.themeId)?.name ?? r.themeId}</dd>
            <dt>Provider</dt>
            <dd>
              {r.provider}
              {r.model ? ` · ${r.model}` : ""}
            </dd>
            <dt>Started / completed</dt>
            <dd>
              {fmtDate(r.startedAt)} → {fmtDate(r.completedAt)} ({duration(r.startedAt, r.completedAt)})
            </dd>
            <dt>Usage</dt>
            <dd>
              {r.usage.modelCalls ?? 0} model call(s)
              {r.usage.inputTokens ? ` · ${r.usage.inputTokens} in / ${r.usage.outputTokens} out tokens` : ""}
              {r.usage.actualCostUsd !== undefined ? ` · actual cost $${r.usage.actualCostUsd.toFixed(2)}` : ""}
              {r.usage.estimatedCostUsd !== undefined ? ` · estimated $${r.usage.estimatedCostUsd.toFixed(2)}` : ""}
              {r.usage.note && <div className="muted">{r.usage.note}</div>}
            </dd>
            {Object.keys(r.limits).length > 0 && (
              <>
                <dt>Limits</dt>
                <dd className="mono">{Object.entries(r.limits).map(([k, v]) => `${k}=${v}`).join("  ")}</dd>
              </>
            )}
          </dl>
        </div>
      </header>
      <Section title="Replay" kicker={`${r.stages.length} stage(s), from the run's own record`}>
        <RunReplay run={r} m={m} />
      </Section>
      {r.queries.length > 0 && (
        <Section title="Queries & sources examined" kicker={`${r.counts.sourcesExamined} examined · ${r.counts.sourcesCited} cited`}>
          <ul className="bullets mono">
            {r.queries.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}
      <div className="grid-2">
        <Section title="Errors & dropped items">
          {r.errors.length ? (
            <ul className="bullets">
              {r.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <Empty>None recorded.</Empty>
          )}
        </Section>
        <Section title="Limitations">
          {r.limitations.length ? (
            <ul className="bullets">
              {r.limitations.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <Empty>None recorded.</Empty>
          )}
        </Section>
      </div>
      <Section title="Output">
        <ul className="bullets">
          {problems.map((p) => (
            <li key={p.id}>
              problem · <Link to={`/problems/${p.id}`}>{p.title}</Link>
            </li>
          ))}
          {ideas.map((i) => (
            <li key={i.id}>
              idea · <Link to={`/ideas/${i.id}`}>{i.title}</Link> <StatusPill status={i.status} />
            </li>
          ))}
          {experiments.map((x) => (
            <li key={x.id}>experiment · {x.title}</li>
          ))}
          {!problems.length && !ideas.length && <li className="muted">No problems or ideas were produced by this run.</li>}
        </ul>
      </Section>
    </div>
  );
}
