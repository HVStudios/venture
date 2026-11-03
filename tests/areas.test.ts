import { describe, expect, it } from "vitest";
import { buildArea, buildAreas, buildTimeline } from "../src/core/areas";
import { emptyMemory } from "../src/core/schema";
import { validateMemory } from "../src/core/validate";
import { FIXTURE_STORE, loadRaw } from "../src/engine/store";

const real = () => validateMemory(JSON.parse(JSON.stringify(loadRaw("data"))), "real").memory!;
const fixture = () => validateMemory(JSON.parse(JSON.stringify(loadRaw(FIXTURE_STORE))), "fixture").memory!;

describe("research areas", () => {
  it("builds one area per theme, generated from data", () => {
    const m = real();
    const areas = buildAreas(m);
    expect(areas.map((a) => a.theme.id).sort()).toEqual(m.themes.map((t) => t.id).sort());
    for (const a of areas) {
      expect(a.status.label.length).toBeGreaterThan(3);
      // Sources shown for an area are exactly those cited by its evidence.
      const cited = new Set(a.evidence.map((e) => e.sourceId));
      expect(a.sources.every((s) => cited.has(s.id))).toBe(true);
    }
  });

  it("reports an un-researched theme honestly", () => {
    const m = emptyMemory();
    m.themes.push({ id: "theme-x", name: "X theme", description: "A theme nobody has researched", mode: "exploratory", keywords: ["x"], status: "active", createdAt: "2026-11-03", provenance: "real" });
    const a = buildArea(m, "theme-x")!;
    expect(a.status.key).toBe("collecting");
    expect(a.brief).toBeUndefined();
    expect(a.nextStep).toBeUndefined();
    expect(a.timeline).toEqual([]);
  });

  it("orders the timeline chronologically and describes decisions in words", () => {
    const m = fixture();
    const t = buildTimeline(m, m.themes[0].id);
    expect(t.length).toBeGreaterThan(0);
    for (let i = 1; i < t.length; i++) expect(t[i].at >= t[i - 1].at).toBe(true);
    expect(t.some((e) => e.kind === "decision" && /idea “/.test(e.title))).toBe(true);
  });

  it("flags a brief as stale when research happened after it", () => {
    const m = fixture();
    const themeId = m.themes[0].id;
    expect(buildArea(m, themeId)!.stale).toBe(false);
    m.briefs[0].updatedAt = "2020-01-01T00:00:00Z";
    const a = buildArea(m, themeId)!;
    expect(a.stale).toBe(true);
    expect(a.staleReason).toMatch(/Research continued/);
  });

  it("splits experiments into planned and completed", () => {
    const m = real();
    for (const a of buildAreas(m)) {
      expect(a.experiments.completed.every((x) => x.outcome)).toBe(true);
      expect(a.experiments.planned.every((x) => !x.outcome)).toBe(true);
    }
  });

  it("rejects briefs whose findings cite unknown evidence", () => {
    const m = fixture();
    m.briefs[0].findings[0].evidenceIds = ["ev-does-not-exist"];
    expect(validateMemory(m, "fixture").issues.some((i) => i.level === "error" && i.message.includes("missing evidence"))).toBe(true);
  });
});
