import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Source } from "../../core/schema";
import { Empty, EpiBadge, Section, SourceLine } from "../components/ui";
import { useLab } from "../data";

export function Sources() {
  const { m, byId } = useLab();
  const [type, setType] = useState("all");
  const [verify, setVerify] = useState("all");
  const [q, setQ] = useState("");
  const types = [...new Set(m.sources.map((s) => s.sourceType))].sort();
  const origins = new Set(m.sources.map((s) => s.originId ?? s.id)).size;
  const list = useMemo(
    () =>
      m.sources
        .filter((s) => type === "all" || s.sourceType === type)
        .filter((s) => verify === "all" || s.verification.status === verify)
        .filter((s) => !q || `${s.title} ${s.publisher} ${s.url}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt)),
    [m.sources, type, verify, q],
  );
  return (
    <div className="page">
      <Section page
        title="Evidence library"
        kicker={`${m.sources.length} sources · ${origins} independent origins · ${m.evidence.length} claims`}
        aside={<Link to="/signals">Raw signal feed →</Link>}
      >
        <p className="muted">
          Every source was actually retrieved. Each claim quotes it verbatim, and a scheduled job re-fetches the pages to check that the quotes are still there. Sources that repeat one original claim share an origin and count once.
        </p>
        <div className="filters">
          <input type="search" placeholder="Search sources…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search sources" />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Source type">
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={verify} onChange={(e) => setVerify(e.target.value)} aria-label="Verification">
            <option value="all">Any verification</option>
            {(["ok", "unchecked", "quote-missing", "unreachable", "blocked"] as Source["verification"]["status"][]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        {list.length ? (
          <ul className="source-list">
            {list.map((s) => {
              const claims = m.evidence.filter((e) => e.sourceId === s.id);
              return (
                <li key={s.id} className="source-item">
                  <SourceLine s={s} />
                  {s.limitations && <p className="muted">Limitations: {s.limitations}</p>}
                  <ul className="claims">
                    {claims.map((e) => (
                      <li key={e.id}>
                        <span className={`stance stance-${e.stance}`}>{e.stance}</span> <EpiBadge e={e.epistemic} /> {e.claim}{" "}
                        {e.problemIds.map((p) => (
                          <Link key={p} className="chip" to={`/problems/${p}`}>
                            {byId("problems", p)?.title ?? p}
                          </Link>
                        ))}
                        {e.ideaIds.map((p) => (
                          <Link key={p} className="chip chip-idea" to={`/ideas/${p}`}>
                            {byId("ideas", p)?.title ?? p}
                          </Link>
                        ))}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No sources match.</Empty>
        )}
      </Section>
    </div>
  );
}
