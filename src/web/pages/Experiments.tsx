import { Empty, Section } from "../components/ui";
import { useLab } from "../data";
import { ExperimentCard } from "./Ideas";

export function Experiments() {
  const { m } = useLab();
  const order = { running: 0, approved: 1, proposed: 2, completed: 3, abandoned: 4 } as const;
  const list = [...m.experiments].sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="page">
      <Section title="Validation experiments" kicker={`${list.length} experiment(s) · ${list.filter((x) => x.outcome).length} with recorded outcomes`}>
        <p className="muted">
          Experiments target an idea's riskiest assumption at the lowest practical cost. Anything that involves contacting people, spending money or publishing claims is marked <i>requires-authorization</i> and will not run without explicit human approval. An outcome appears only after an experiment has actually been run.
        </p>
        {list.length ? list.map((x) => <ExperimentCard key={x.id} id={x.id} />) : <Empty>No experiments proposed yet.</Empty>}
      </Section>
    </div>
  );
}
