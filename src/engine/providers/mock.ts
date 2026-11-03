/**
 * Deterministic mock provider. It reads the structured INPUT block that the
 * pipeline embeds in each prompt and produces mechanically-derived output, so
 * the full pipeline can be exercised offline in tests and CI.
 *
 * Its output is NEVER real research: producesRealResearch = false forces all
 * records into the fixture store with provenance "fixture".
 */
import { CRITERIA } from "../../core/schema";
import { INPUT_END, INPUT_START } from "../pipeline";
import type { CompletionRequest, CompletionResult, ModelProvider } from "./types";

type Doc = { poolId: string; title: string; excerpt: string };

function input(prompt: string): Record<string, unknown> {
  const a = prompt.indexOf(INPUT_START);
  const b = prompt.lastIndexOf(INPUT_END);
  return JSON.parse(prompt.slice(a + INPUT_START.length, b));
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]{8,200}[.!?]?/);
  return (m ? m[0] : text.slice(0, 120)).trim();
}

export class MockProvider implements ModelProvider {
  readonly name = "mock";
  readonly model = "deterministic-fixture";
  readonly producesRealResearch = false;
  readonly paid = false;

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const inp = input(req.prompt);
    const out = this.respond(req.role, inp);
    const text = JSON.stringify(out);
    return { text, inputTokens: Math.ceil(req.prompt.length / 4), outputTokens: Math.ceil(text.length / 4), costUsd: 0 };
  }

  private respond(role: CompletionRequest["role"], inp: Record<string, unknown>): unknown {
    const docs = (inp.documents as Doc[] | undefined) ?? [];
    switch (role) {
      case "scout": {
        const max = (inp.maxProblems as number) ?? 2;
        return {
          problems: docs.slice(0, max).map((d) => ({
            title: `Recurring pain: ${d.title.slice(0, 60)}`,
            statement: `Documents describe users struggling with: ${firstSentence(d.excerpt)}`,
            affectedUsers: "Practitioners described in the source",
            severityNote: "Mock assessment",
            frequencyNote: "Mock assessment",
            evidence: [
              { poolId: d.poolId, quote: firstSentence(d.excerpt), claim: `Source reports: ${firstSentence(d.excerpt)}`, stance: "supports", epistemic: "fact" },
            ],
          })),
        };
      }
      case "inventor": {
        const problems = inp.problems as { index: number; title: string }[];
        return {
          ideas: problems.map((p) => ({
            title: `Assistant for ${p.title.replace(/^Recurring pain: /, "").slice(0, 50)}`,
            problemIndexes: [p.index],
            summary: `A mock concept that automates detection and triage for problem ${p.index}, produced deterministically for testing.`,
            targetUsers: "Teams affected by the problem",
            solution: `Watch the relevant signals, cluster recurring failures, and propose fixes for problem ${p.index}.`,
            differentiation: "Mock differentiation statement",
            feasibility: "Mock feasibility statement",
            assumptions: [{ text: "Users will trust automated triage suggestions", criticality: "high" }],
            risks: ["Mock risk: incumbents already offer this"],
            alternatives: [{ name: `Manual workaround ${p.index}`, kind: "workaround", description: "Doing it by hand" }],
          })),
        };
      }
      case "critic":
        return {
          objections: [{ text: "Existing tools may already cover most of this need.", severity: "major", evidence: [] }],
          scores: Object.fromEntries(CRITERIA.map((c, i) => [c, { score: 2 + ((c.length + i) % 3), rationale: `mock rationale for ${c}` }])),
        };
      case "director": {
        const ideas = inp.ideas as { index: number; attractiveness: number }[];
        const best = [...ideas].sort((a, b) => b.attractiveness - a.attractiveness)[0];
        return {
          decisions: ideas.map((i) => ({
            index: i.index,
            status: i.index === best?.index ? "advanced" : i.index % 2 ? "rejected" : "parked",
            rationale: i.index === best?.index ? "Highest attractiveness in this mock run." : "Mock decision.",
          })),
        };
      }
      case "experimenter":
        return {
          title: `Smoke test for ${(inp.idea as { title: string }).title}`.slice(0, 80),
          hypothesis: "If offered, target users will try the triage assistant.",
          uncertainty: "Whether users trust automated triage.",
          procedure: ["Build a static mock-up", "Show it to five practitioners (requires authorization)"],
          successCriteria: ["3 of 5 say they would try it"],
          failureCriteria: ["Fewer than 2 of 5 interested"],
          estimatedTime: "2 days",
          estimatedCostUsd: 0,
          resources: ["mock-up"],
          expectedLearning: "Whether trust is the blocking assumption.",
          ifSuccess: "Prototype the clustering step.",
          ifFailure: "Park the idea.",
          executionMode: "requires-authorization",
        };
      default:
        return {};
    }
  }
}
