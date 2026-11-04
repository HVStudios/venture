import { Link, useSearchParams } from "react-router-dom";
import { Empty, Pill, Section, StatusPill } from "../components/ui";
import { useLab } from "../data";

interface Hit {
  kind: string;
  id: string;
  title: string;
  snippet: string;
  href: string;
  status?: string;
  score: number;
  external?: boolean;
}

function snippet(text: string, needle: string): string {
  const i = text.toLowerCase().indexOf(needle);
  if (i < 0) return text.slice(0, 160);
  const start = Math.max(0, i - 60);
  return (start ? "…" : "") + text.slice(start, i + needle.length + 100) + "…";
}

export function Search() {
  const [params] = useSearchParams();
  const { m } = useLab();
  const q = (params.get("q") ?? "").trim();
  const needle = q.toLowerCase();
  const hits: Hit[] = [];
  if (needle.length >= 2) {
    const add = (kind: string, id: string, title: string, body: string, href: string, status?: string, external?: boolean) => {
      const t = title.toLowerCase().includes(needle);
      const b = body.toLowerCase().includes(needle);
      if (t || b) hits.push({ kind, id, title, snippet: snippet(t && !b ? title : body, needle), href, status, score: (t ? 2 : 0) + (b ? 1 : 0), external });
    };
    m.problems.forEach((p) => add("problem", p.id, p.title, `${p.statement} ${p.affectedUsers}`, `/problems/${p.id}`, p.status));
    m.ideas.forEach((i) => add("idea", i.id, i.title, `${i.summary} ${i.solution} ${i.statusRationale}`, `/ideas/${i.id}`, i.status));
    m.experiments.forEach((x) => add("experiment", x.id, x.title, `${x.hypothesis} ${x.uncertainty}`, "/experiments", x.status));
    m.competitors.forEach((c) => {
      const idea = m.ideas.find((i) => i.competitorIds.includes(c.id));
      add("alternative", c.id, c.name, c.description, idea ? `/ideas/${idea.id}` : "/ideas");
    });
    m.evidence.forEach((e) => add("evidence", e.id, e.claim, e.quote, e.ideaIds[0] ? `/ideas/${e.ideaIds[0]}` : e.problemIds[0] ? `/problems/${e.problemIds[0]}` : "/sources"));
    m.sources.forEach((s) => add("source", s.id, s.title, `${s.publisher} ${s.excerpt}`, s.url, s.verification.status, true));
    m.themes.forEach((t) => add("theme", t.id, t.name, t.description, `/research/${t.id}`, t.status));
  }
  hits.sort((a, b) => b.score - a.score);
  const kinds = [...new Set(hits.map((h) => h.kind))];
  return (
    <div className="page">
      <Section page title={q ? `Results for “${q}”` : "Search"} kicker={`${hits.length} match(es)`}>
        {!q && <Empty>Type at least two characters in the search box (press “/” to focus it).</Empty>}
        {q && !hits.length && <Empty>Nothing in this data set matches.</Empty>}
        {kinds.map((k) => (
          <div key={k} className="search-group">
            <h3>{k}s</h3>
            <ul className="source-list">
              {hits
                .filter((h) => h.kind === k)
                .map((h) => (
                  <li key={h.id} className="source-item">
                    <div>
                      {h.status && <StatusPill status={h.status} />}{" "}
                      {h.external ? (
                        <a href={h.href} target="_blank" rel="noopener noreferrer nofollow">
                          {h.title}
                        </a>
                      ) : (
                        <Link to={h.href}>{h.title}</Link>
                      )}{" "}
                      <Pill kind="type">{h.id}</Pill>
                    </div>
                    <p className="excerpt">{h.snippet}</p>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </Section>
    </div>
  );
}
