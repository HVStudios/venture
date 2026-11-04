/**
 * The decision ledger as rock strata: one layer per research run (manual
 * decisions form a layer per day), newest on top, each
 * decision a segment coloured by where it moved its subject. The ledger is
 * append-only, so the layers only ever grow.
 */
import { Link } from "react-router-dom";
import type { Decision } from "../../core/schema";

const SURVIVED = new Set(["advanced", "supported", "approved", "completed", "running", "active", "reopened"]);
const KILLED = new Set(["rejected", "refuted", "abandoned", "dismissed"]);
const SHELVED = new Set(["parked", "paused", "weakened", "inconclusive"]);

export function layerTone(status: string) {
  return SURVIVED.has(status) ? "up" : KILLED.has(status) ? "down" : SHELVED.has(status) ? "shelved" : "neutral";
}

export function Strata({ decisions, name }: { decisions: Decision[]; name: (d: Decision) => string }) {
  const layers = new Map<string, Decision[]>();
  for (const d of [...decisions].sort((a, b) => b.at.localeCompare(a.at))) {
    const k = d.runId ?? `manual-${d.at.slice(0, 10)}`;
    layers.set(k, [...(layers.get(k) ?? []), d]);
  }
  const href = (d: Decision) => (d.subjectType === "idea" ? `/ideas/${d.subjectId}` : d.subjectType === "problem" ? `/problems/${d.subjectId}` : d.subjectType === "theme" ? `/research/${d.subjectId}` : "/experiments");
  return (
    <figure className="strata">
      <div className="strata-legend legend-row">
        <span><i className="sw up" /> moved forward</span>
        <span><i className="sw shelved" /> parked or paused</span>
        <span><i className="sw down" /> rejected or refuted</span>
        <span><i className="sw neutral" /> recorded or revised</span>
      </div>
      <ol>
        {[...layers].map(([key, ds]) => (
          <li key={key} className="stratum" style={{ height: `${Math.min(40, 10 + ds.length * 4)}px` }}>
            <div className="stratum-band">
              {ds.map((d) => (
                <Link key={d.id} to={href(d)} className={`seg seg-${layerTone(d.toStatus)}`} title={`${name(d)}: ${d.fromStatus ? `${d.fromStatus} → ` : ""}${d.toStatus}`} aria-label={`${name(d)}: ${d.toStatus}`} />
              ))}
            </div>
            <span className="stratum-day">
              {key.startsWith("manual-") ? (
                <>Manual · {key.slice(7)}</>
              ) : (
                <Link to={`/runs/${key}`} title={key}>
                  {ds[0].at.slice(5, 16).replace("T", " ")}
                </Link>
              )}{" "}
              <span className="muted">· {ds.length}</span>
            </span>
          </li>
        ))}
      </ol>
      <figcaption>One layer per research run, newest on top. Each segment is one decision; select it to open its subject, or a date to open the run.</figcaption>
    </figure>
  );
}
