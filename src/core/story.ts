/**
 * The story of an idea: everything that happened to it, in order, and the
 * thread from each of its assumptions back to verbatim quotes.
 *
 * Derived only from stored records (runs, evidence, experiments, decisions),
 * so new research appears in every view without view-specific work. Shared by
 * the engine and the web UI; nothing here invents or infers research content.
 */
import type { Decision, Evidence, Experiment, Idea, Memory, Source } from "./schema";

type Assumption = Idea["assumptions"][number];

export type StoryKind = "created" | "evidence" | "experiment" | "result" | "decision";
export type StoryTone = "positive" | "negative" | "neutral";

export interface StoryEvent {
  /** Stable across rebuilds, so a view can tell which events are new to a visitor. */
  id: string;
  at: string;
  kind: StoryKind;
  title: string;
  detail?: string;
  tone: StoryTone;
  runId?: string;
  decisionId?: string;
  experimentId?: string;
  evidenceId?: string;
  /** The idea's assumptions this event bears on. */
  assumptionIds: string[];
}

export interface AssumptionThread {
  assumption: Assumption;
  /** Quotes the assumption cites, with their sources. */
  evidence: { evidence: Evidence; source?: Source }[];
  /** Experiments that test this assumption, completed or not. */
  experiments: Experiment[];
  /** True when the assumption's status is backed by a quote or a completed experiment. */
  traced: boolean;
}

export interface IdeaStory {
  idea: Idea;
  threads: AssumptionThread[];
  events: StoryEvent[];
  /** Latest event time (or the idea's last update when that is later). */
  lastActivity: string;
  /** Still in play: proposed or advanced. */
  standing: boolean;
}

/** An assumption is traced when it cites a quote or a completed experiment tested it. */
export function assumptionTraced(m: Pick<Memory, "experiments">, ideaId: string, a: Assumption): boolean {
  if (a.evidenceIds.length) return true;
  return m.experiments.some((x) => x.ideaId === ideaId && x.outcome && x.assumptionIds.includes(a.id));
}

const KIND_ORDER: Record<StoryKind, number> = { created: 0, evidence: 1, experiment: 2, result: 3, decision: 4 };

const IDEA_ACTION: Record<Decision["action"], { title: string; tone: StoryTone }> = {
  create: { title: "Recorded", tone: "neutral" },
  advance: { title: "Advanced", tone: "positive" },
  reject: { title: "Rejected", tone: "negative" },
  park: { title: "Parked", tone: "neutral" },
  revise: { title: "Revised", tone: "neutral" },
  merge: { title: "Merged into another idea", tone: "neutral" },
  reopen: { title: "Reopened", tone: "positive" },
  complete: { title: "Completed", tone: "neutral" },
};

const RESULT_TONE: Record<NonNullable<Experiment["outcome"]>["result"], StoryTone> = {
  supported: "positive",
  refuted: "negative",
  inconclusive: "neutral",
};

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function buildIdeaStory(m: Memory, ideaId: string): IdeaStory | undefined {
  const idea = m.ideas.find((i) => i.id === ideaId);
  if (!idea) return undefined;
  const sources = new Map(m.sources.map((s) => [s.id, s]));
  const evidenceById = new Map(m.evidence.map((e) => [e.id, e]));
  const experiments = m.experiments.filter((x) => x.ideaId === idea.id);
  const citing = (evidenceId: string) => idea.assumptions.filter((a) => a.evidenceIds.includes(evidenceId)).map((a) => a.id);

  const threads: AssumptionThread[] = idea.assumptions.map((a) => ({
    assumption: a,
    evidence: a.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((e): e is Evidence => !!e)
      .map((e) => ({ evidence: e, source: sources.get(e.sourceId) })),
    experiments: experiments.filter((x) => x.assumptionIds.includes(a.id)),
    traced: assumptionTraced(m, idea.id, a),
  }));

  const events: StoryEvent[] = [];
  const decisions = m.decisions.filter((d) => d.subjectType === "idea" && d.subjectId === idea.id);

  // Birth: when and where the idea was proposed, what it was built on and how the Critic met it.
  const linked = m.evidence.filter((e) => e.ideaIds.includes(idea.id));
  const founding = linked.filter((e) => (sources.get(e.sourceId)?.retrievedAt ?? "") <= idea.createdAt);
  const fatal = idea.objections.filter((o) => o.severity === "fatal").length;
  const create = decisions.find((d) => d.action === "create");
  events.push({
    id: `created:${idea.id}`,
    at: create?.at ?? idea.createdAt,
    kind: "created",
    title: create ? `Proposed, recorded as ${create.toStatus}` : "Proposed",
    detail: [
      founding.length ? `Built on ${plural(founding.length, "quoted claim")}` : undefined,
      `challenged with ${plural(idea.objections.length, "objection")}${fatal ? ` (${fatal} fatal)` : ""}`,
      create?.rationale,
    ]
      .filter(Boolean)
      .join("; "),
    tone: "neutral",
    runId: create?.runId ?? idea.createdInRun,
    decisionId: create?.id,
    assumptionIds: [],
  });

  // Evidence that arrived after the idea was proposed.
  for (const e of linked) {
    const at = sources.get(e.sourceId)?.retrievedAt;
    if (!at || at <= idea.createdAt) continue;
    events.push({
      id: `evidence:${e.id}`,
      at,
      kind: "evidence",
      title: e.stance === "supports" ? "New supporting evidence" : e.stance === "contradicts" ? "New contradicting evidence" : "New context",
      detail: e.claim,
      tone: e.stance === "supports" ? "positive" : e.stance === "contradicts" ? "negative" : "neutral",
      evidenceId: e.id,
      assumptionIds: citing(e.id),
    });
  }

  // Experiments: their lifecycle decisions, then their recorded outcomes.
  for (const x of experiments) {
    for (const d of m.decisions.filter((d) => d.subjectType === "experiment" && d.subjectId === x.id)) {
      if (d.action === "complete" || d.toStatus === "completed") continue; // the outcome tells this better
      const title =
        d.action === "create"
          ? "Experiment designed"
          : d.toStatus === "approved"
            ? "Experiment approved"
            : d.toStatus === "running"
              ? "Experiment started"
              : d.toStatus === "abandoned"
                ? "Experiment abandoned"
                : "Experiment revised";
      events.push({
        id: `experiment:${d.id}`,
        at: d.at,
        kind: "experiment",
        title: `${title}: ${x.title}`,
        detail: d.rationale,
        tone: d.toStatus === "abandoned" ? "negative" : "neutral",
        runId: d.runId,
        decisionId: d.id,
        experimentId: x.id,
        assumptionIds: x.assumptionIds,
      });
    }
    if (x.outcome) {
      events.push({
        id: `result:${x.id}`,
        at: x.outcome.recordedAt,
        kind: "result",
        title: `Experiment ${x.outcome.result}: ${x.title}`,
        detail: x.outcome.summary,
        tone: RESULT_TONE[x.outcome.result],
        experimentId: x.id,
        assumptionIds: x.assumptionIds,
      });
    }
  }

  // Status decisions on the idea itself.
  for (const d of decisions) {
    if (d === create) continue;
    const a = IDEA_ACTION[d.action];
    events.push({
      id: `decision:${d.id}`,
      at: d.at,
      kind: "decision",
      title: d.fromStatus && d.fromStatus !== d.toStatus ? `${a.title}: ${d.fromStatus} to ${d.toStatus}` : a.title,
      detail: d.rationale,
      tone: a.tone,
      runId: d.runId,
      decisionId: d.id,
      assumptionIds: [],
    });
  }

  events.sort((a, b) => a.at.localeCompare(b.at) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id));
  const last = events.at(-1)?.at ?? idea.updatedAt;
  return {
    idea,
    threads,
    events,
    lastActivity: last > idea.updatedAt ? last : idea.updatedAt,
    standing: idea.status === "advanced" || idea.status === "proposed",
  };
}

/** Every idea's story except merged ones, most recent activity first. */
export function buildStories(m: Memory): IdeaStory[] {
  return m.ideas
    .filter((i) => i.status !== "merged")
    .map((i) => buildIdeaStory(m, i.id)!)
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}
