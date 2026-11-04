import { useState } from "react";
import { Empty, Pill, Section } from "../components/ui";
import { domain, useLab } from "../data";

export function Signals() {
  const { m } = useLab();
  const [theme, setTheme] = useState("all");
  const list = m.signals.filter((s) => theme === "all" || s.themeId === theme).sort((a, b) => b.engagement - a.engagement);
  return (
    <div className="page">
      <Section page title="Raw signal feed" kicker={`${m.signals.length} unreviewed items from deterministic collectors`}>
        <p className="muted">
          Collectors query public APIs (Hacker News, GitHub Issues, Stack Overflow, arXiv) for each theme's keywords on a schedule, with no AI involved. Signals are leads, not evidence. They become evidence only after a research run quotes them in support of a specific claim.
        </p>
        <div className="filters">
          <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
            <option value="all">All themes</option>
            {m.themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {list.length ? (
          <ul className="signal-list">
            {list.slice(0, 200).map((s) => (
              <li key={s.id}>
                <div>
                  <Pill kind="type">{s.collector}</Pill> <Pill kind={`triage-${s.triage}`}>{s.triage}</Pill>{" "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                    {s.title}
                  </a>{" "}
                  <span className="muted">
                    {domain(s.url)} · {s.engagementLabel} {s.createdAt ? `· ${s.createdAt.slice(0, 10)}` : ""}
                  </span>
                </div>
                {s.excerpt && <p className="excerpt">{s.excerpt.slice(0, 280)}{s.excerpt.length > 280 ? "…" : ""}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No signals collected yet. The scheduled collector workflow fills this feed.</Empty>
        )}
      </Section>
    </div>
  );
}
