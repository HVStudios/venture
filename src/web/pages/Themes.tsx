import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Pill, Section, StatusPill } from "../components/ui";
import { fmtDate, useLab } from "../data";

const REPO = "https://github.com/HVStudios/venture";

export function Themes() {
  const { m } = useLab();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  const [mode, setMode] = useState<"focused" | "exploratory">("focused");

  const issueUrl = () => {
    const body = [
      "### Proposed research theme",
      "",
      `**Name:** ${name}`,
      `**Mode:** ${mode}`,
      `**Keywords:** ${keywords}`,
      "",
      "**Description / motivation:**",
      desc,
      "",
      "_Submitted from the VENTURE web UI. A maintainer or research session will review it before adding it to `data/themes.json`._",
    ].join("\n");
    return `${REPO}/issues/new?labels=theme-request&title=${encodeURIComponent(`Theme: ${name}`)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="page">
      <Section title="Research themes" kicker="What VENTURE is investigating">
        <p className="muted">
          Themes steer the collectors and the research sessions. <b>Focused</b> themes investigate a defined area in depth. <b>Exploratory</b> themes cast a wide net for new opportunities. Themes are configuration and live in <code>data/themes.json</code>.
        </p>
        {m.themes.length ? (
          <div className="card-grid">
            {m.themes.map((t) => {
              const ideas = m.ideas.filter((i) => i.themeIds.includes(t.id));
              const problems = m.problems.filter((p) => p.themeIds.includes(t.id));
              const signals = m.signals.filter((s) => s.themeId === t.id).length;
              const runs = m.runs.filter((r) => r.themeId === t.id && r.mode !== "collector");
              return (
                <article key={t.id} className="card theme-card">
                  <header>
                    <StatusPill status={t.status} /> <Pill kind="type">{t.mode}</Pill>
                  </header>
                  <h3>{t.name}</h3>
                  <p>{t.description}</p>
                  <div className="kw">
                    {t.keywords.map((k) => (
                      <code key={k}>{k}</code>
                    ))}
                  </div>
                  <footer className="muted">
                    {problems.length} problems · <Link to={`/ideas?theme=${t.id}`}>{ideas.length} ideas</Link> · {signals} signals · {runs.length} research run(s) · since {fmtDate(t.createdAt)}
                  </footer>
                  {t.notes && <p className="muted">{t.notes}</p>}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty>No themes configured.</Empty>
        )}
      </Section>

      <Section title="Propose a theme" kicker="Configuration without credentials">
        <p className="muted">
          This site is static and holds no credentials. Submitting opens a pre-filled GitHub issue labelled <code>theme-request</code>, which research sessions pick up. Nothing is sent until you submit it on GitHub.
        </p>
        <form
          className="theme-form"
          onSubmit={(e) => {
            e.preventDefault();
            window.open(issueUrl(), "_blank", "noopener");
          }}
        >
          <label>
            Name
            <input required minLength={3} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Accessibility tooling for scientific software" />
          </label>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="focused">focused</option>
              <option value="exploratory">exploratory</option>
            </select>
          </label>
          <label className="wide">
            Keywords (comma-separated, used by collectors)
            <input required value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="screen reader, jupyter, matplotlib accessibility" />
          </label>
          <label className="wide">
            Why is this worth investigating?
            <textarea required rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <button className="btn" type="submit">
            Open pre-filled issue on GitHub →
          </button>
        </form>
      </Section>
    </div>
  );
}
