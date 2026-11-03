import { useState } from "react";

const REPO = "https://github.com/HVStudios/venture";

export function ThemeProposal() {
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
    <>
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
    </>
  );
}
