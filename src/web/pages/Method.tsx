import { CRITERIA } from "../../core/schema";
import { CRITERION_INFO, SOURCE_TYPE_WEIGHT } from "../../core/scoring";
import { EpiBadge, Section } from "../components/ui";

export function Method() {
  return (
    <div className="page prose">
      <Section title="How VENTURE reasons" kicker="Method, scoring and limitations">
        <p>
          VENTURE works like a small research organization. Each role has its own job, and the roles check one another. The pipeline is the same whether a human-supervised agent session or an automated model run performs it:
        </p>
        <ol className="roles">
          <li><b>Scout</b> finds candidate problems in retrieved documents and signals.</li>
          <li><b>Researcher</b> gathers evidence, including evidence <i>against</i> the problem, and maps existing alternatives.</li>
          <li><b>Inventor</b> proposes concepts tied to evidenced problems.</li>
          <li><b>Critic</b> tries to kill each idea: saturation, weak demand, infeasibility, counter-evidence.</li>
          <li><b>Experiment designer</b> turns the riskiest assumption into a cheap, measurable test.</li>
          <li><b>Research director</b> decides to advance, park, reject or merge. Most ideas should not advance.</li>
        </ol>
      </Section>

      <Section title="Epistemic labels">
        <ul className="epi-legend">
          <li><EpiBadge e="fact" /> stated directly by the cited source (the quote supports it)</li>
          <li><EpiBadge e="inference" /> a reasonable conclusion drawn from facts</li>
          <li><EpiBadge e="hypothesis" /> plausible but untested; every product idea starts here</li>
          <li><EpiBadge e="speculation" /> low support, recorded for completeness</li>
        </ul>
      </Section>

      <Section title="Evidence strength (0–100)">
        <p>Evidence strength is computed mechanically from stored evidence records. It is never typed in by a model.</p>
        <ul className="bullets">
          <li>Evidence is grouped by <b>independent origin</b>. Ten articles repeating one press release count once.</li>
          <li>Each origin is weighted by epistemic status (fact 1.0, inference 0.6, hypothesis 0.3, speculation 0.1), by source type, and by whether a re-fetch of the page found the quote.</li>
          <li>Support follows a saturating curve: about 3 strong independent origins give ~63 and about 6 give ~86. Contradicting evidence then scales the score down in proportion.</li>
          <li>For an idea, evidence on its problems counts too, but contradicting evidence aimed at the idea itself counts double: a real problem doesn't validate a particular solution.</li>
          <li>Levels: none &lt; 10 ≤ weak &lt; 35 ≤ moderate &lt; 60 ≤ strong.</li>
        </ul>
        <table className="score-table compact">
          <thead><tr><th>Source type</th><th>Weight</th></tr></thead>
          <tbody>
            {Object.entries(SOURCE_TYPE_WEIGHT).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Attractiveness (0–100)">
        <p>
          The Critic, not the Inventor, scores each criterion from 1 to 5 and writes a rationale. Attractiveness is the weighted mean of (score − 1) / 4. It measures how appealing the idea would be <i>if its assumptions held</i>, which is why it sits on a separate axis from evidence.
        </p>
        <div className="table-wrap"><table className="score-table">
          <thead><tr><th>Criterion</th><th>Weight</th><th>Question</th></tr></thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c}><td>{CRITERION_INFO[c].label}</td><td className="num">×{CRITERION_INFO[c].weight}</td><td>{CRITERION_INFO[c].question}</td></tr>
            ))}
          </tbody>
        </table></div>
      </Section>

      <Section title="Guarantees enforced in code">
        <ul className="bullets">
          <li>Every evidence quote must appear verbatim in the excerpt captured from its source, or the record is rejected.</li>
          <li>Automated runs may only cite documents that were actually retrieved. Models never supply URLs.</li>
          <li>Every problem needs supporting evidence, and every idea needs at least one objection from the Critic.</li>
          <li>Advanced ideas must have a proposed experiment. Experiment outcomes can only be recorded on completed experiments.</li>
          <li>Near-duplicate ideas (TF-IDF cosine ≥ 0.55) are blocked unless they are merged or explicitly distinguished.</li>
          <li>Demo fixtures and real research live in separate stores. A real record can never be marked as a fixture, and a fixture can never pass as real.</li>
        </ul>
      </Section>

      <Section title="Known limitations">
        <ul className="bullets">
          <li>Scores are uncalibrated heuristics. Until outcome data exists, they mainly help compare ideas within this lab.</li>
          <li>Research sessions read public web pages and APIs. Paywalled studies, private communities and non-English sources are under-represented.</li>
          <li>Quote verification re-fetches raw HTML. Pages that render client-side or block bots show as "quote not found" or "blocked", not as wrong.</li>
          <li>Research sessions do not contact users, run surveys or spend money. Experiments that need those things wait for human authorization.</li>
        </ul>
      </Section>
    </div>
  );
}
