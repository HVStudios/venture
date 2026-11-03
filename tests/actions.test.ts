
import { describe, expect, it } from "vitest";
import { ActionError, approveExperiment, decideIdea, reconsiderationQueue, recordOutcome } from "../src/core/actions";
import { validateMemory } from "../src/core/validate";
import { loadRaw, FIXTURE_STORE } from "../src/engine/store";

const fresh = () => structuredClone(validateMemory(loadRaw(FIXTURE_STORE), "fixture").memory!);
const AT = "2026-11-04T10:00:00Z";

describe("decisions and experiments", () => {
  it("records a decision with a score snapshot and keeps memory valid", () => {
    const m = fresh();
    const idea = m.ideas.find((i) => i.status === "parked")!;
    const d = decideIdea(m, idea.id, "rejected", "New evidence shows the market is saturated.", "director", AT);
    expect(d.action).toBe("reject");
    expect(d.fromStatus).toBe("parked");
    expect(d.attractiveness).toBeTypeOf("number");
    expect(validateMemory(m, "fixture").issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("refuses to advance an idea without an experiment", () => {
    const m = fresh();
    const idea = m.ideas.find((i) => !m.experiments.some((x) => x.ideaId === i.id))!;
    expect(() => decideIdea(m, idea.id, "advanced", "looks good", "director", AT)).toThrow(ActionError);
  });

  it("refuses to record outcomes for experiments that were never approved", () => {
    const m = fresh();
    const x = m.experiments[0];
    expect(() => recordOutcome(m, x.id, { result: "supported", summary: "it worked", evidenceIds: [], actor: "t", at: AT })).toThrow(/only approved or running/);
  });

  it("records an outcome after approval and updates assumptions", () => {
    const m = fresh();
    const x = m.experiments[0];
    approveExperiment(m, x.id, "owner", "go ahead", AT);
    const idea = m.ideas.find((i) => i.id === x.ideaId)!;
    const aid = idea.assumptions[0].id;
    recordOutcome(m, x.id, { result: "refuted", summary: "Nobody tried it.", evidenceIds: [], assumptions: { [aid]: "refuted" }, actor: "t", at: AT });
    expect(m.experiments[0].status).toBe("completed");
    expect(idea.assumptions[0].status).toBe("refuted");
    expect(m.decisions.filter((d) => d.subjectId === x.id).map((d) => d.action)).toEqual(["advance", "complete"]);
    expect(validateMemory(m, "fixture").issues.filter((i) => i.level === "error")).toEqual([]);
  });
});

describe("reconsideration queue", () => {
  it("flags parked ideas when evidence arrives after the decision", () => {
    const m = fresh();
    expect(reconsiderationQueue(m)).toEqual([]);
    const idea = m.ideas.find((i) => i.status === "parked")!;
    const src = m.sources[0];
    m.sources.push({ ...src, id: "src-late", retrievedAt: "2030-01-01T00:00:00Z", excerpt: "A new report shows the problem is widespread." });
    m.evidence.push({ id: "ev-late", claim: "New report", sourceId: "src-late", quote: "the problem is widespread", stance: "supports", epistemic: "fact", problemIds: idea.problemIds, ideaIds: [], competitorIds: [], provenance: "fixture" });
    const q = reconsiderationQueue(m);
    expect(q.map((r) => r.idea.id)).toContain(idea.id);
    expect(q[0].reasons.join(" ")).toMatch(/retrieved after the decision/);
  });

  it("works on the real research memory", () => {
    const real = validateMemory(JSON.parse(JSON.stringify(loadRaw("data"))), "real").memory!;
    expect(Array.isArray(reconsiderationQueue(real))).toBe(true);

  });
});
