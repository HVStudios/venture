import { Link, useSearchParams } from "react-router-dom";
import { CRITERIA } from "../../core/schema";
import { CRITERION_INFO } from "../../core/scoring";
import { Empty, EvidenceLevel, Meter, Section, StatusPill } from "../components/ui";
import { useLab } from "../data";

export function Compare() {
  const [params] = useSearchParams();
  const { m, ideaScores, byId } = useLab();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const ideas = ids.map((id) => m.ideas.find((i) => i.id === id)).filter(Boolean) as typeof m.ideas;
  if (ideas.length < 2) return <Empty>Pick at least two ideas on the <Link to="/ideas">Ideas</Link> page to compare them.</Empty>;
  const cols = { gridTemplateColumns: `minmax(130px, 180px) repeat(${ideas.length}, minmax(200px, 1fr))` };
  const row = (label: string, render: (i: (typeof ideas)[number]) => React.ReactNode) => (
    <div className="cmp-row" style={cols}>
      <div className="cmp-label">{label}</div>
      {ideas.map((i) => (
        <div key={i.id} className="cmp-cell">
          {render(i)}
        </div>
      ))}
    </div>
  );
  return (
    <div className="page">
      <Section page title="Compare ideas" kicker={`${ideas.length} side by side`}>
        <div className="cmp">
          {row("Idea", (i) => (
            <>
              <StatusPill status={i.status} />
              <h3>
                <Link to={`/ideas/${i.id}`}>{i.title}</Link>
              </h3>
            </>
          ))}
          {row("Scores", (i) => {
            const s = ideaScores.get(i.id)!;
            return (
              <>
                <Meter value={s.attractiveness} label="Attractiveness" tone="attract" />
                <Meter value={s.evidence.score} label="Evidence" tone="evidence" />
                <EvidenceLevel a={s.evidence} />
              </>
            );
          })}
          {row("Problem", (i) => i.problemIds.map((p) => byId("problems", p)?.title).join("; "))}
          {row("Users", (i) => i.targetUsers)}
          {row("Solution", (i) => i.solution)}
          {row("Differentiation", (i) => i.differentiation)}
          {CRITERIA.map((c) =>
            row(CRITERION_INFO[c].label, (i) => (
              <span title={i.scores.criteria[c].rationale}>
                <span className="dots">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= i.scores.criteria[c].score ? "on" : ""} />
                  ))}
                </span>
              </span>
            )),
          )}
          {row("Worst objection", (i) => {
            const rank = { fatal: 0, major: 1, minor: 2 };
            const o = [...i.objections].sort((a, b) => rank[a.severity] - rank[b.severity])[0];
            return o ? `${o.severity}: ${o.text}` : "—";
          })}
          {row("Competitors", (i) => i.competitorIds.map((c) => byId("competitors", c)?.name).join(", ") || "—")}
          {row("Decision", (i) => i.statusRationale)}
        </div>
      </Section>
    </div>
  );
}
