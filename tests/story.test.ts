import { describe, expect, it } from "vitest";
import type { Memory } from "../src/core/schema";
import { assumptionTraced, buildIdeaStory, buildStories } from "../src/core/story";
import { validateMemory } from "../src/core/validate";
import { FIXTURE_STORE, loadRaw } from "../src/engine/store";

const real = () => validateMemory(JSON.parse(JSON.stringify(loadRaw("data"))), "real").memory!;
const fixture = () => validateMemory(JSON.parse(JSON.stringify(loadRaw(FIXTURE_STORE))), "fixture").memory!;
const issuesOf = (m: Memory) => validateMemory(JSON.parse(JSON.stringify(m)), "fixture").issues;

/** The fixture's advanced idea, with one quote linked to it and a completed experiment on it. */
function scenario() {
  const m = fixture();
  const idea = m.ideas.find((i) => i.status === "advanced")!;
  const x = m.experiments.find((e) => e.ideaId === idea.id)!;
  const ev = m.evidence[0];
  ev.ideaIds = [idea.id];
  return { m, idea, x, ev };
}

describe("assumption links", () => {
  it("parse old records with empty link lists", () => {
    const m = real();
    expect(m.ideas.every((i) => i.assumptions.every((a) => Array.isArray(a.evidenceIds)))).toBe(true);
    expect(m.experiments.every((x) => Array.isArray(x.assumptionIds))).toBe(true);
  });

  it("reject an experiment that tests an assumption its idea does not have", () => {
    const { m, x } = scenario();
    x.assumptionIds = ["a99"];
    expect(issuesOf(m).some((i) => i.level === "error" && /tests assumption 'a99'/.test(i.message))).toBe(true);
  });

  it("reject an assumption that cites missing evidence", () => {
    const { m, idea } = scenario();
    idea.assumptions[0].evidenceIds = ["ev-missing"];
    expect(issuesOf(m).some((i) => i.level === "error" && /references missing evidence 'ev-missing'/.test(i.message))).toBe(true);
  });

  it("warn when a decided assumption has no thread to a quote or experiment", () => {
    const { m, idea } = scenario();
    idea.assumptions[0].status = "supported";
    const warned = () => issuesOf(m).some((i) => i.ref === `ideas.${idea.id}` && /cite no evidence/.test(i.message));
    expect(warned()).toBe(true);
    idea.assumptions[0].evidenceIds = [m.evidence[0].id];
    expect(warned()).toBe(false);
  });

  it("count a completed experiment on the assumption as a trace", () => {
    const { m, idea, x } = scenario();
    const a = idea.assumptions[0];
    expect(assumptionTraced(m, idea.id, a)).toBe(false);
    x.assumptionIds = [a.id];
    expect(assumptionTraced(m, idea.id, a)).toBe(false); // planned, not yet run
    x.status = "completed";
    x.outcome = { recordedAt: "2026-11-04T10:00:00Z", result: "refuted", summary: "Did not hold.", evidenceIds: [] };
    expect(assumptionTraced(m, idea.id, a)).toBe(true);
  });

  it("warn when a completed experiment does not name what it tested", () => {
    const { m, x } = scenario();
    x.status = "completed";
    x.outcome = { recordedAt: "2026-11-04T10:00:00Z", result: "inconclusive", summary: "Too few cases.", evidenceIds: [] };
    expect(issuesOf(m).some((i) => i.ref === `experiments.${x.id}` && /does not name the assumption/.test(i.message))).toBe(true);
  });
});

describe("idea story", () => {
  it("opens with the idea's birth and tells the rest in time order", () => {
    const { m, idea, x, ev } = scenario();
    const a = idea.assumptions[0];
    a.evidenceIds = [ev.id];
    m.sources.find((s) => s.id === ev.sourceId)!.retrievedAt = "2026-11-04T08:00:00Z"; // arrived after the idea
    x.assumptionIds = [a.id];
    x.status = "completed";
    x.outcome = { recordedAt: "2026-11-04T10:00:00Z", result: "refuted", summary: "Did not hold.", evidenceIds: [] };
    m.decisions.push({
      id: "dec-test-park",
      at: "2026-11-04T11:00:00Z",
      subjectType: "idea",
      subjectId: idea.id,
      action: "park",
      fromStatus: "advanced",
      toStatus: "parked",
      rationale: "Its riskiest assumption was refuted.",
      actor: "test",
      provenance: "fixture",
    });

    const s = buildIdeaStory(m, idea.id)!;
    expect(s.events.map((e) => e.kind)).toEqual(["created", "evidence", "result", "decision"]);
    expect(s.events[0].title).toMatch(/^Proposed, recorded as /);
    expect(s.events[1]).toMatchObject({ evidenceId: ev.id, assumptionIds: [a.id] });
    expect(s.events[2]).toMatchObject({ tone: "negative", experimentId: x.id, assumptionIds: [a.id] });
    expect(s.events[3]).toMatchObject({ title: "Parked: advanced to parked", tone: "neutral" });
    expect(s.lastActivity).toBe("2026-11-04T11:00:00Z");

    const t = s.threads[0];
    expect(t.evidence.map((e) => e.evidence.id)).toEqual([ev.id]);
    expect(t.evidence[0].source?.id).toBe(ev.sourceId);
    expect(t.experiments.map((e) => e.id)).toEqual([x.id]);
    expect(t.traced).toBe(true);
  });

  it("does not repeat evidence the idea was built on as later news", () => {
    const { m, idea, ev } = scenario();
    m.sources.find((s) => s.id === ev.sourceId)!.retrievedAt = "2026-01-01T00:00:00Z";
    const s = buildIdeaStory(m, idea.id)!;
    expect(s.events.some((e) => e.kind === "evidence")).toBe(false);
    expect(s.events[0].detail).toMatch(/Built on 1 quoted claim;/);
  });

  it("builds a sound story for every real idea", () => {
    const m = real();
    const stories = buildStories(m);
    expect(stories.length).toBe(m.ideas.filter((i) => i.status !== "merged").length);
    for (let i = 1; i < stories.length; i++) expect(stories[i - 1].lastActivity >= stories[i].lastActivity).toBe(true);
    for (const s of stories) {
      expect(s.events[0].kind).toBe("created");
      for (let i = 1; i < s.events.length; i++) expect(s.events[i].at >= s.events[i - 1].at).toBe(true);
      expect(new Set(s.events.map((e) => e.id)).size).toBe(s.events.length);
      expect(s.threads.length).toBe(s.idea.assumptions.length);
      expect(s.standing).toBe(s.idea.status === "advanced" || s.idea.status === "proposed");
    }
  });

  it("returns nothing for an unknown idea", () => {
    expect(buildIdeaStory(fixture(), "idea-nope")).toBeUndefined();
  });
});
