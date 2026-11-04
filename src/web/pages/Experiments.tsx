import { Link } from "react-router-dom";
import { calibration } from "../../core/actions";
import { Empty, Section, StatusPill } from "../components/ui";
import { useLab } from "../data";
import { ExperimentCard } from "./Ideas";

function Calibration() {
  const { m, byId } = useLab();
  const rows = calibration(m);
  if (!rows.length) return null;
  const n = rows.length;
  return (
    <Section title="Calibration" kicker={`${n} recorded outcome(s)`}>
      <p className="muted">
        Each row pairs an outcome with the scores the lab held when it decided to test the idea. Over time this shows whether attractiveness and evidence scores predict anything.{" "}
        {n < 10 && <b>With n = {n}, no conclusion about calibration is possible yet.</b>}
      </p>
      <div className="table-wrap">
        <table className="score-table">
          <thead>
            <tr>
              <th>Experiment</th>
              <th>Idea</th>
              <th className="num">Attractiveness then</th>
              <th className="num">Evidence then</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.experimentId}>
                <td>{byId("experiments", r.experimentId)?.title}</td>
                <td>
                  <Link to={`/ideas/${r.ideaId}`}>{byId("ideas", r.ideaId)?.title}</Link>
                </td>
                <td className="num">{r.attractivenessAtDecision ?? "—"}</td>
                <td className="num">{r.evidenceAtDecision ?? "—"}</td>
                <td>
                  <StatusPill status={r.result} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function Experiments() {
  const { m } = useLab();
  const order = { running: 0, approved: 1, proposed: 2, completed: 3, abandoned: 4 } as const;
  const list = [...m.experiments].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="page">
      <Section page bare title="Validation experiments" kicker={`${list.length} experiment(s) · ${list.filter((x) => x.outcome).length} with recorded outcomes`}>
        <p className="muted">
          Experiments target an idea's riskiest assumption at the lowest practical cost. Anything that involves contacting people, spending money or publishing claims is marked <i>requires-authorization</i> and will not run without explicit human approval. An outcome appears only after an experiment has actually been run.
        </p>
        {list.length ? list.map((x) => <ExperimentCard key={x.id} id={x.id} />) : <Empty>No experiments proposed yet.</Empty>}
      </Section>
      <Calibration />
    </div>
  );
}
