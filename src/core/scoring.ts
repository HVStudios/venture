/**
 * Transparent, heuristic scoring.
 *
 * Two numbers are kept deliberately separate:
 *  - attractiveness: how appealing an idea would be *if its assumptions hold*
 *    (weighted 1–5 criterion scores assigned by the research roles).
 *  - evidence strength: how well the problem and idea are supported by stored,
 *    traceable evidence (computed mechanically from evidence records).
 *
 * Neither is a probability of success. They are ordinal heuristics meant to
 * make reasoning comparable and inspectable, not empirically calibrated.
 */
import type { CriterionKey, Evidence, Idea, Memory, Source, SourceType } from "./schema";
import { CRITERIA } from "./schema";

export const CRITERION_INFO: Record<CriterionKey, { label: string; weight: number; question: string }> = {
  severity: { label: "Problem severity", weight: 1.5, question: "How painful is the problem for those who have it?" },
  frequency: { label: "Frequency", weight: 1.0, question: "How often, and for how many people, does it occur?" },
  userValue: { label: "User value", weight: 1.5, question: "How much would the solution improve outcomes for users?" },
  competitiveGap: {
    label: "Competitive gap",
    weight: 1.0,
    question: "How poorly do existing alternatives serve the need? (5 = wide-open gap)",
  },
  differentiation: { label: "Differentiation", weight: 1.0, question: "How distinct is the approach from what exists?" },
  feasibility: { label: "Technical feasibility", weight: 1.25, question: "Can it be built with known technology?" },
  costComplexity: {
    label: "Cost & complexity",
    weight: 0.75,
    question: "How cheap/simple is a credible first version? (5 = very cheap)",
  },
  userAccess: { label: "User accessibility", weight: 0.75, question: "How easily can target users be reached?" },
  validationCost: {
    label: "Cheap validation",
    weight: 0.75,
    question: "How cheaply can the riskiest assumption be tested? (5 = very cheap)",
  },
};

export function attractiveness(idea: Pick<Idea, "scores">): number {
  let total = 0;
  let weights = 0;
  for (const key of CRITERIA) {
    const { weight } = CRITERION_INFO[key];
    total += weight * ((idea.scores.criteria[key].score - 1) / 4);
    weights += weight;
  }
  return Math.round((total / weights) * 100);
}

const EPISTEMIC_WEIGHT: Record<Evidence["epistemic"], number> = {
  fact: 1,
  inference: 0.6,
  hypothesis: 0.3,
  speculation: 0.1,
};

/** Direct user voice (issues, forums) counts more than vendor marketing. */
export const SOURCE_TYPE_WEIGHT: Record<SourceType, number> = {
  survey: 1,
  dataset: 1,
  paper: 0.9,
  docs: 0.8,
  "issue-tracker": 0.75,
  forum: 0.7,
  repository: 0.7,
  news: 0.6,
  blog: 0.5,
  other: 0.5,
  vendor: 0.4,
};

const VERIFICATION_WEIGHT: Record<Source["verification"]["status"], number> = {
  ok: 1,
  unchecked: 0.8,
  blocked: 0.75,
  unreachable: 0.5,
  "quote-missing": 0.3,
};

export type EvidenceLevel = "none" | "weak" | "moderate" | "strong";

export interface EvidenceAssessment {
  score: number;
  level: EvidenceLevel;
  supportingOrigins: number;
  contradictingOrigins: number;
  supportWeight: number;
  contraWeight: number;
  evidenceCount: number;
  explanation: string[];
}

export function originKey(source: Source): string {
  return source.originId ?? source.id;
}

function weigh(items: Evidence[], sources: Map<string, Source>, boost: (e: Evidence) => number = () => 1): { origins: number; weight: number } {
  // Group by independent origin; take the strongest item per origin, so that
  // ten articles repeating one claim count once.
  const best = new Map<string, number>();
  for (const ev of items) {
    const src = sources.get(ev.sourceId);
    if (!src) continue;
    const w =
      EPISTEMIC_WEIGHT[ev.epistemic] * SOURCE_TYPE_WEIGHT[src.sourceType] * VERIFICATION_WEIGHT[src.verification.status] * boost(ev);
    const key = originKey(src);
    best.set(key, Math.max(best.get(key) ?? 0, w));
  }
  let weight = 0;
  for (const w of best.values()) weight += w;
  return { origins: best.size, weight };
}

/**
 * @param targetIdeaId when assessing an idea, contradicting evidence aimed at
 * the idea itself (not just its problem) counts double: it attacks the
 * proposed solution directly, while problem-level support only shows the
 * problem is real.
 */
export function assessEvidence(evidence: Evidence[], sourceList: Source[], targetIdeaId?: string): EvidenceAssessment {
  const sources = new Map(sourceList.map((s) => [s.id, s]));
  const support = weigh(
    evidence.filter((e) => e.stance === "supports"),
    sources,
  );
  const contra = weigh(
    evidence.filter((e) => e.stance === "contradicts"),
    sources,
    (e) => (targetIdeaId && e.ideaIds.includes(targetIdeaId) ? 2 : 1),
  );
  // Saturating curve: ~3 strong independent origins ≈ 63, ~6 ≈ 86.
  const raw = 1 - Math.exp(-support.weight / 3);
  const balance = support.weight + contra.weight === 0 ? 0 : support.weight / (support.weight + contra.weight);
  const score = Math.round(100 * raw * balance);
  const level: EvidenceLevel = score < 10 ? "none" : score < 35 ? "weak" : score < 60 ? "moderate" : "strong";
  const explanation = [
    `${support.origins} independent supporting origin(s), weighted ${support.weight.toFixed(2)}`,
    `${contra.origins} independent contradicting origin(s), weighted ${contra.weight.toFixed(2)}`,
    ...(targetIdeaId ? ["Includes evidence on the idea's problems. Contradicting evidence aimed at the idea itself counts double."] : []),
    "Weights combine epistemic status (fact > inference > hypothesis > speculation), source type (surveys and datasets > user reports > vendor claims) and quote verification.",
  ];
  return {
    score,
    level,
    supportingOrigins: support.origins,
    contradictingOrigins: contra.origins,
    supportWeight: support.weight,
    contraWeight: contra.weight,
    evidenceCount: evidence.length,
    explanation,
  };
}

/** Evidence relevant to an idea: linked directly, or linked to its problems. */
export function evidenceForIdea(idea: Idea, memory: Pick<Memory, "evidence">): Evidence[] {
  const problems = new Set(idea.problemIds);
  return memory.evidence.filter((e) => e.ideaIds.includes(idea.id) || e.problemIds.some((p) => problems.has(p)));
}

export function evidenceForProblem(problemId: string, memory: Pick<Memory, "evidence">): Evidence[] {
  return memory.evidence.filter((e) => e.problemIds.includes(problemId));
}

export function assessIdea(idea: Idea, memory: Pick<Memory, "evidence" | "sources">) {
  return {
    attractiveness: attractiveness(idea),
    evidence: assessEvidence(evidenceForIdea(idea, memory), memory.sources, idea.id),
  };
}
