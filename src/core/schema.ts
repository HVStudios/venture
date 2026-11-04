/**
 * VENTURE research-memory schema.
 *
 * Every persisted record is validated against these schemas. The schema is
 * deliberately strict about provenance: research records carry a
 * `provenance` flag so that demonstration fixtures can never be mistaken for
 * real research, and evidence must reference a stored source.
 */
import { z } from "zod";

export const Id = z
  .string()
  .regex(/^[a-z]+-[a-z0-9][a-z0-9-]*$/, "ids look like '<kind>-<slug>' (lowercase, digits, dashes)");
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/, "ISO-8601 date or datetime");

/** real = produced by an actual research process; fixture = demo/test data. */
export const Provenance = z.enum(["real", "fixture"]);
export type Provenance = z.infer<typeof Provenance>;

/** Epistemic status of a statement. Kept explicit everywhere it matters. */
export const Epistemic = z.enum(["fact", "inference", "hypothesis", "speculation"]);
export type Epistemic = z.infer<typeof Epistemic>;

// ---------------------------------------------------------------- themes
export const Theme = z.object({
  id: Id,
  name: z.string().min(3),
  description: z.string().min(10),
  mode: z.enum(["focused", "exploratory"]),
  keywords: z.array(z.string()).min(1),
  status: z.enum(["active", "paused", "retired"]),
  createdAt: IsoDate,
  notes: z.string().optional(),
  provenance: Provenance,
});
export type Theme = z.infer<typeof Theme>;

// ---------------------------------------------------------------- sources
export const SourceType = z.enum([
  "forum",
  "issue-tracker",
  "news",
  "blog",
  "docs",
  "paper",
  "survey",
  "vendor",
  "dataset",
  "repository",
  "other",
]);
export type SourceType = z.infer<typeof SourceType>;

export const Verification = z.object({
  status: z.enum(["unchecked", "ok", "quote-missing", "unreachable", "blocked"]),
  checkedAt: IsoDate.optional(),
  httpStatus: z.number().int().optional(),
  note: z.string().optional(),
});
export type Verification = z.infer<typeof Verification>;

export const Source = z.object({
  id: Id,
  url: z.string().url(),
  title: z.string().min(1),
  publisher: z.string().min(1),
  publishedAt: IsoDate.optional(),
  retrievedAt: IsoDate,
  sourceType: SourceType,
  /**
   * Sources that repeat the same original claim share an originId so they
   * are not counted as independent evidence. Defaults to the source's own id.
   */
  originId: z.string().optional(),
  /** Verbatim excerpt captured at retrieval time. */
  excerpt: z.string().min(1),
  limitations: z.string().optional(),
  verification: Verification.default({ status: "unchecked" }),
  provenance: Provenance,
});
export type Source = z.infer<typeof Source>;

// ---------------------------------------------------------------- evidence
export const Evidence = z.object({
  id: Id,
  claim: z.string().min(5),
  sourceId: Id,
  /** Exact quote from the source that supports the claim. */
  quote: z.string().min(1),
  stance: z.enum(["supports", "contradicts", "context"]),
  epistemic: Epistemic,
  context: z.string().optional(),
  limitations: z.string().optional(),
  problemIds: z.array(Id).default([]),
  ideaIds: z.array(Id).default([]),
  competitorIds: z.array(Id).default([]),
  provenance: Provenance,
});
export type Evidence = z.infer<typeof Evidence>;

// ---------------------------------------------------------------- problems
export const Problem = z.object({
  id: Id,
  title: z.string().min(5),
  statement: z.string().min(20),
  themeIds: z.array(Id).min(1),
  affectedUsers: z.string().min(3),
  severityNote: z.string().optional(),
  frequencyNote: z.string().optional(),
  status: z.enum(["open", "investigating", "addressed", "dismissed"]),
  discoveredInRun: Id,
  firstSeen: IsoDate,
  lastUpdated: IsoDate,
  provenance: Provenance,
});
export type Problem = z.infer<typeof Problem>;

// ---------------------------------------------------------------- competitors
export const Competitor = z.object({
  id: Id,
  name: z.string().min(1),
  url: z.string().url().optional(),
  kind: z.enum(["product", "open-source", "workaround", "platform-feature", "research"]),
  description: z.string().min(5),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  sourceIds: z.array(Id).default([]),
  provenance: Provenance,
});
export type Competitor = z.infer<typeof Competitor>;

// ---------------------------------------------------------------- ideas
export const CRITERIA = [
  "severity",
  "frequency",
  "userValue",
  "competitiveGap",
  "differentiation",
  "feasibility",
  "costComplexity",
  "userAccess",
  "validationCost",
] as const;
export type CriterionKey = (typeof CRITERIA)[number];

export const CriterionScore = z.object({
  score: z.number().int().min(1).max(5),
  rationale: z.string().min(5),
});
export const Scores = z.object({
  criteria: z.object(
    Object.fromEntries(CRITERIA.map((c) => [c, CriterionScore])) as Record<
      CriterionKey,
      typeof CriterionScore
    >,
  ),
  assessedAt: IsoDate,
  assessedBy: z.string(),
});
export type Scores = z.infer<typeof Scores>;

export const Assumption = z.object({
  id: z.string(),
  text: z.string().min(5),
  criticality: z.enum(["low", "medium", "high"]),
  status: z.enum(["untested", "supported", "weakened", "refuted"]),
});

export const Objection = z.object({
  id: z.string(),
  text: z.string().min(5),
  severity: z.enum(["minor", "major", "fatal"]),
  evidenceIds: z.array(Id).default([]),
  response: z.string().optional(),
  status: z.enum(["open", "mitigated", "accepted", "unresolved"]),
});
export type Objection = z.infer<typeof Objection>;

export const IdeaStatus = z.enum(["proposed", "advanced", "parked", "rejected", "merged"]);
export type IdeaStatus = z.infer<typeof IdeaStatus>;

export const Idea = z.object({
  id: Id,
  title: z.string().min(3),
  summary: z.string().min(20),
  problemIds: z.array(Id).min(1),
  themeIds: z.array(Id).min(1),
  targetUsers: z.string().min(3),
  solution: z.string().min(20),
  competitorIds: z.array(Id).default([]),
  differentiation: z.string().min(5),
  feasibility: z.string().min(5),
  assumptions: z.array(Assumption).min(1),
  risks: z.array(z.string()).min(1),
  nextSteps: z.array(z.string()).default([]),
  objections: z.array(Objection).min(1, "every idea must be challenged by the Critic"),
  scores: Scores,
  status: IdeaStatus,
  statusRationale: z.string().min(5),
  mergedInto: Id.optional(),
  relatedIdeaIds: z.array(Id).default([]),
  /** Explicit statement of how this idea differs from similar historical ideas. */
  noveltyNote: z.string().optional(),
  epistemic: Epistemic.default("hypothesis"),
  /**
   * The practical-value case: who would adopt it, in what form, and whether
   * VENTURE could build and test the smallest useful version itself.
   */
  practical: z
    .object({
      adopters: z.string().min(5),
      distribution: z.enum(["open-source", "hosted-free", "paid-product", "open-core", "write-up-only"]),
      smallestUsefulVersion: z.string().min(10),
      buildableByVenture: z.boolean(),
      buildNote: z.string().min(5),
      monetization: z.string().min(5),
    })
    .optional(),
  createdInRun: Id,
  createdAt: IsoDate,
  updatedAt: IsoDate,
  provenance: Provenance,
});
export type Idea = z.infer<typeof Idea>;

// ---------------------------------------------------------------- experiments
export const Experiment = z.object({
  id: Id,
  ideaId: Id,
  title: z.string().min(5),
  hypothesis: z.string().min(10),
  uncertainty: z.string().min(10),
  procedure: z.array(z.string()).min(1),
  successCriteria: z.array(z.string()).min(1),
  failureCriteria: z.array(z.string()).min(1),
  estimatedTime: z.string(),
  estimatedCostUsd: z.number().min(0),
  resources: z.array(z.string()).default([]),
  expectedLearning: z.string().min(5),
  nextSteps: z.object({ ifSuccess: z.string(), ifFailure: z.string() }),
  executionMode: z.enum(["automatable", "requires-humans", "requires-authorization"]),
  status: z.enum(["proposed", "approved", "running", "completed", "abandoned"]),
  outcome: z
    .object({
      recordedAt: IsoDate,
      result: z.enum(["supported", "refuted", "inconclusive"]),
      summary: z.string().min(5),
      evidenceIds: z.array(Id).default([]),
    })
    .optional(),
  createdInRun: Id,
  provenance: Provenance,
});
export type Experiment = z.infer<typeof Experiment>;

// ---------------------------------------------------------------- decisions
export const Decision = z.object({
  id: Id,
  at: IsoDate,
  /** The run that produced the decision; absent for manual/owner decisions. */
  runId: Id.optional(),
  subjectType: z.enum(["idea", "problem", "experiment", "theme"]),
  subjectId: Id,
  action: z.enum(["create", "advance", "reject", "park", "revise", "merge", "reopen", "complete"]),
  fromStatus: z.string().optional(),
  toStatus: z.string(),
  rationale: z.string().min(5),
  actor: z.string(),
  /** Snapshot of headline scores at decision time, for assessment history. */
  attractiveness: z.number().optional(),
  evidenceStrength: z.number().optional(),
  provenance: Provenance,
});
export type Decision = z.infer<typeof Decision>;

// ---------------------------------------------------------------- runs
export const RunStage = z.object({
  name: z.enum(["scout", "research", "invent", "critique", "dedupe", "select", "experiment", "persist"]),
  status: z.enum(["pending", "ok", "skipped", "failed"]),
  notes: z.string().optional(),
});

export const Run = z.object({
  id: Id,
  themeId: Id,
  mode: z.enum(["agent-session", "automated-llm", "collector", "fixture"]),
  provider: z.string(),
  model: z.string().optional(),
  startedAt: IsoDate,
  completedAt: IsoDate.optional(),
  status: z.enum(["running", "completed", "partial", "failed"]),
  stages: z.array(RunStage),
  counts: z.object({
    sourcesExamined: z.number().int().min(0),
    sourcesCited: z.number().int().min(0),
    problemsFound: z.number().int().min(0),
    ideasGenerated: z.number().int().min(0),
    ideasAdvanced: z.number().int().min(0),
    ideasRejected: z.number().int().min(0),
    ideasParked: z.number().int().min(0),
    experimentsProposed: z.number().int().min(0),
  }),
  queries: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  usage: z.object({
    modelCalls: z.number().int().min(0).optional(),
    inputTokens: z.number().int().min(0).optional(),
    outputTokens: z.number().int().min(0).optional(),
    estimatedCostUsd: z.number().min(0).optional(),
    actualCostUsd: z.number().min(0).optional(),
    note: z.string().optional(),
  }),
  limits: z.record(z.number()).default({}),
  provenance: Provenance,
});
export type Run = z.infer<typeof Run>;

// ---------------------------------------------------------------- signals
/** Raw, unreviewed items gathered by deterministic collectors (no LLM). */
export const Signal = z.object({
  id: Id,
  collector: z.string(),
  themeId: Id,
  url: z.string().url(),
  title: z.string(),
  excerpt: z.string().default(""),
  engagement: z.number().default(0),
  engagementLabel: z.string().default(""),
  createdAt: IsoDate.optional(),
  retrievedAt: IsoDate,
  triage: z.enum(["new", "promoted", "ignored"]).default("new"),
  provenance: Provenance,
});
export type Signal = z.infer<typeof Signal>;


// ---------------------------------------------------------------- briefs
/**
 * A research brief is the human-readable synthesis of one research area,
 * written by the research team (an agent session) and updated as part of
 * every research run. Structured records stay the source of truth: every
 * finding must cite stored evidence, and pages flag briefs that are older
 * than the latest research.
 */
export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

export const Brief = z.object({
  id: Id,
  themeId: Id,
  /** The central question, in plain language. */
  researchQuestion: z.string().min(10),
  whyItMatters: z.string().min(20),
  subQuestions: z.array(z.string().min(5)).default([]),
  findings: z
    .array(
      z.object({
        id: z.string(),
        statement: z.string().min(10),
        /** Plain-language note on how strong this is and why. */
        strength: z.string().min(5),
        evidenceIds: z.array(Id).min(1, "every finding must cite stored evidence"),
        epistemic: Epistemic,
      }),
    )
    .default([]),
  uncertainties: z.array(z.string().min(5)).default([]),
  conclusion: z
    .object({
      belief: z.string().min(10),
      confidence: Confidence,
      confidenceReason: z.string().min(10),
      unknowns: z.array(z.string().min(5)).default([]),
      continueInvestigation: z.boolean(),
      continueReason: z.string().min(5),
    })
    .optional(),
  nextSteps: z
    .array(
      z.object({
        text: z.string().min(5),
        kind: z.enum(["research", "experiment", "decision", "owner-action"]),
        experimentId: Id.optional(),
        issue: z.number().int().optional(),
      }),
    )
    .default([]),
  updatedAt: IsoDate,
  updatedInRun: Id.optional(),
  author: z.string(),
  provenance: Provenance,
});
export type Brief = z.infer<typeof Brief>;

// ---------------------------------------------------------------- memory
export const Memory = z.object({
  themes: z.array(Theme),
  sources: z.array(Source),
  evidence: z.array(Evidence),
  problems: z.array(Problem),
  competitors: z.array(Competitor),
  ideas: z.array(Idea),
  experiments: z.array(Experiment),
  decisions: z.array(Decision),
  runs: z.array(Run),
  signals: z.array(Signal),
  briefs: z.array(Brief).default([]),
});
export type Memory = z.infer<typeof Memory>;
export const COLLECTIONS = [
  "themes",
  "sources",
  "evidence",
  "problems",
  "competitors",
  "ideas",
  "experiments",
  "decisions",
  "runs",
  "signals",
  "briefs",
] as const satisfies readonly (keyof Memory)[];
export type CollectionName = (typeof COLLECTIONS)[number];

export function emptyMemory(): Memory {
  return {
    themes: [],
    sources: [],
    evidence: [],
    problems: [],
    competitors: [],
    ideas: [],
    experiments: [],
    decisions: [],
    runs: [],
    signals: [],
    briefs: [],
  };
}

/**
 * A research bundle is the unit of ingestion. Every research path — an
 * interactive agent session, an automated LLM pipeline or the mock provider —
 * produces a bundle; the engine validates it, deduplicates, scores and
 * persists it. Bundles may contain new records or full replacements of
 * existing records (matched by id).
 */
export const Bundle = z.object({
  run: Run,
  themes: z.array(Theme).default([]),
  sources: z.array(Source).default([]),
  evidence: z.array(Evidence).default([]),
  problems: z.array(Problem).default([]),
  competitors: z.array(Competitor).default([]),
  ideas: z.array(Idea).default([]),
  experiments: z.array(Experiment).default([]),
  decisions: z.array(Decision).default([]),
  briefs: z.array(Brief).default([]),
});
export type Bundle = z.infer<typeof Bundle>;
