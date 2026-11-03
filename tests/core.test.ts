import { describe, expect, it } from "vitest";
import { emptyMemory, type Evidence, type Source } from "../src/core/schema";
import { assessEvidence, attractiveness } from "../src/core/scoring";
import { SimilarityIndex, tokens } from "../src/core/similarity";
import { validateMemory } from "../src/core/validate";
import { slug } from "../src/core/ids";

const src = (id: string, over: Partial<Source> = {}): Source => ({
  id,
  url: `https://example.com/${id}`,
  title: id,
  publisher: "Example",
  retrievedAt: "2026-11-03",
  sourceType: "forum",
  excerpt: "Engineers lose hours every week to flaky tests that nobody owns.",
  verification: { status: "ok" },
  provenance: "real",
  ...over,
});
const ev = (id: string, sourceId: string, over: Partial<Evidence> = {}): Evidence => ({
  id,
  claim: "Flaky tests waste engineering time",
  sourceId,
  quote: "lose hours every week to flaky tests",
  stance: "supports",
  epistemic: "fact",
  problemIds: [],
  ideaIds: [],
  competitorIds: [],
  provenance: "real",
  ...over,
});

describe("evidence strength", () => {
  it("is zero with no evidence", () => {
    expect(assessEvidence([], []).score).toBe(0);
    expect(assessEvidence([], []).level).toBe("none");
  });

  it("counts sources sharing an origin only once", () => {
    const independent = [src("src-a"), src("src-b"), src("src-c")];
    const syndicated = [src("src-a", { originId: "o" }), src("src-b", { originId: "o" }), src("src-c", { originId: "o" })];
    const evs = [ev("ev-1", "src-a"), ev("ev-2", "src-b"), ev("ev-3", "src-c")];
    const a = assessEvidence(evs, independent);
    const b = assessEvidence(evs, syndicated);
    expect(a.supportingOrigins).toBe(3);
    expect(b.supportingOrigins).toBe(1);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("is reduced by contradicting evidence and by weak epistemic status", () => {
    const sources = [src("src-a"), src("src-b")];
    const base = assessEvidence([ev("ev-1", "src-a")], sources).score;
    const contra = assessEvidence([ev("ev-1", "src-a"), ev("ev-2", "src-b", { stance: "contradicts" })], sources).score;
    const spec = assessEvidence([ev("ev-1", "src-a", { epistemic: "speculation" })], sources).score;
    expect(contra).toBeLessThan(base);
    expect(spec).toBeLessThan(base);
  });

  it("counts contradictions aimed at a specific idea double", () => {
    const sources = [src("src-a"), src("src-b")];
    const evs = [ev("ev-1", "src-a"), ev("ev-2", "src-b", { stance: "contradicts", ideaIds: ["idea-x"] })];
    expect(assessEvidence(evs, sources, "idea-x").score).toBeLessThan(assessEvidence(evs, sources).score);
  });

  it("penalises quotes that failed re-verification", () => {
    const ok = assessEvidence([ev("ev-1", "src-a")], [src("src-a")]).score;
    const missing = assessEvidence([ev("ev-1", "src-a")], [src("src-a", { verification: { status: "quote-missing" } })]).score;
    expect(missing).toBeLessThan(ok);
  });
});

describe("attractiveness", () => {
  const scores = (n: number) =>
    ({
      criteria: Object.fromEntries(
        ["severity", "frequency", "userValue", "competitiveGap", "differentiation", "feasibility", "costComplexity", "userAccess", "validationCost"].map((k) => [k, { score: n, rationale: "because" }]),
      ),
      assessedAt: "2026-11-03",
      assessedBy: "test",
    }) as never;
  it("maps all-1 to 0 and all-5 to 100", () => {
    expect(attractiveness({ scores: scores(1) })).toBe(0);
    expect(attractiveness({ scores: scores(5) })).toBe(100);
    expect(attractiveness({ scores: scores(3) })).toBe(50);
  });
});

describe("similarity", () => {
  it("stems and drops stop-words", () => {
    expect(tokens("The flaky tests are failing")).toEqual(["flaky", "test", "fail"]);
  });
  it("ranks near-duplicates above unrelated text", () => {
    const idx = new SimilarityIndex([
      { id: "a", text: "Automatic quarantine of flaky tests in CI pipelines" },
      { id: "b", text: "Quarantine flaky tests automatically in CI" },
      { id: "c", text: "Meal planning assistant for families" },
    ]);
    expect(idx.similarity("a", "b")).toBeGreaterThan(0.4);
    expect(idx.similarity("a", "c")).toBeLessThan(0.05);
  });
});

describe("slug", () => {
  it("produces id-safe slugs", () => {
    expect(slug("Hello, World! CI/CD — fast")).toBe("hello-world-ci-cd-fast");
  });
});

describe("validateMemory", () => {
  const base = () => {
    const m = emptyMemory();
    m.themes.push({ id: "theme-t", name: "Test", description: "A test theme", mode: "focused", keywords: ["x"], status: "active", createdAt: "2026-11-03", provenance: "real" });
    m.runs.push({
      id: "run-1",
      themeId: "theme-t",
      mode: "agent-session",
      provider: "test",
      startedAt: "2026-11-03",
      status: "completed",
      stages: [],
      counts: { sourcesExamined: 1, sourcesCited: 1, problemsFound: 1, ideasGenerated: 0, ideasAdvanced: 0, ideasRejected: 0, ideasParked: 0, experimentsProposed: 0 },
      queries: [],
      errors: [],
      limitations: [],
      usage: {},
      limits: {},
      provenance: "real",
    });
    m.sources.push(src("src-a"));
    m.problems.push({ id: "prob-p", title: "Flaky tests", statement: "Engineers lose time to flaky tests in CI.", themeIds: ["theme-t"], affectedUsers: "engineers", status: "open", discoveredInRun: "run-1", firstSeen: "2026-11-03", lastUpdated: "2026-11-03", provenance: "real" });
    m.evidence.push(ev("ev-1", "src-a", { problemIds: ["prob-p"] }));
    return m;
  };

  it("accepts a consistent memory", () => {
    const { issues } = validateMemory(base(), "real");
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("rejects quotes that are not in the source excerpt", () => {
    const m = base();
    m.evidence[0].quote = "a fabricated quote that was never said";
    expect(validateMemory(m, "real").issues.some((i) => i.message.includes("verbatim"))).toBe(true);
  });

  it("rejects dangling references", () => {
    const m = base();
    m.evidence[0].sourceId = "src-missing";
    expect(validateMemory(m, "real").issues.some((i) => i.message.includes("missing sources"))).toBe(true);
  });

  it("rejects fixtures in the real store", () => {
    const m = base();
    m.themes[0].provenance = "fixture";
    expect(validateMemory(m, "real").issues.some((i) => i.message.includes("provenance"))).toBe(true);
  });

  it("requires problems to have supporting evidence", () => {
    const m = base();
    m.evidence = [];
    expect(validateMemory(m, "real").issues.some((i) => i.message.includes("no supporting evidence"))).toBe(true);
  });
});
