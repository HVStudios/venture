/**
 * Pure state transitions on research memory used by the CLI (and tests):
 * decisions, experiment approval, outcome recording, reconsideration.
 * Each transition appends to the decision ledger; nothing is ever edited
 * silently.
 */
import type { Decision, Experiment, Idea, IdeaStatus, Memory } from "./schema";
import { assessIdea, evidenceForIdea } from "./scoring";

export class ActionError extends Error {}

function decisionId(m: Memory, subject: string, at: string): string {
  const base = `dec-${at.slice(0, 10).replace(/-/g, "")}-${subject.replace(/^[a-z]+-/, "")}`.slice(0, 90);
  let id = base;
  for (let n = 2; m.decisions.some((d) => d.id === id); n++) id = `${base}-${n}`;
  return id;
}

export function decideIdea(m: Memory, ideaId: string, status: IdeaStatus, rationale: string, actor: string, at: string, opts: { runId?: string; mergedInto?: string } = {}): Decision {
  const idea = m.ideas.find((i) => i.id === ideaId);
  if (!idea) throw new ActionError(`unknown idea ${ideaId}`);
  if (status === "advanced" && !m.experiments.some((x) => x.ideaId === ideaId)) {
    throw new ActionError("an idea can only be advanced once it has a proposed experiment");
  }
  if (status === "merged") {
    if (!opts.mergedInto || !m.ideas.some((i) => i.id === opts.mergedInto)) throw new ActionError("merge requires an existing target idea");
    idea.mergedInto = opts.mergedInto;
  }
  const from = idea.status;
  idea.status = status;
  idea.statusRationale = rationale;
  idea.updatedAt = at;
  const a = assessIdea(idea, m);
  const action: Decision["action"] =
    status === "advanced" ? "advance" : status === "rejected" ? "reject" : status === "parked" ? "park" : status === "merged" ? "merge" : from === "rejected" || from === "parked" ? "reopen" : "revise";
  const d: Decision = {
    id: decisionId(m, ideaId, at),
    at,
    runId: opts.runId,
    subjectType: "idea",
    subjectId: ideaId,
    action,
    fromStatus: from,
    toStatus: status,
    rationale,
    actor,
    attractiveness: a.attractiveness,
    evidenceStrength: a.evidence.score,
    provenance: idea.provenance,
  };
  m.decisions.push(d);
  return d;
}

export function approveExperiment(m: Memory, expId: string, approver: string, note: string, at: string): Decision {
  const x = m.experiments.find((e) => e.id === expId);
  if (!x) throw new ActionError(`unknown experiment ${expId}`);
  if (x.status !== "proposed") throw new ActionError(`experiment is ${x.status}, not proposed`);
  x.status = "approved";
  const d: Decision = {
    id: decisionId(m, expId, at),
    at,
    subjectType: "experiment",
    subjectId: expId,
    action: "advance",
    fromStatus: "proposed",
    toStatus: "approved",
    rationale: note,
    actor: approver,
    provenance: x.provenance,
  };
  m.decisions.push(d);
  return d;
}

export interface OutcomeInput {
  result: NonNullable<Experiment["outcome"]>["result"];
  summary: string;
  evidenceIds: string[];
  assumptions?: Record<string, Idea["assumptions"][number]["status"]>;
  actor: string;
  at: string;
  force?: boolean;
}

/**
 * Record an observed outcome. Refuses experiments that were never approved or
 * run (unless forced), which guards against "recording" outcomes for
 * experiments that did not actually happen.
 */
export function recordOutcome(m: Memory, expId: string, input: OutcomeInput): Decision {
  const x = m.experiments.find((e) => e.id === expId);
  if (!x) throw new ActionError(`unknown experiment ${expId}`);
  if (!input.force && x.status !== "approved" && x.status !== "running") {
    throw new ActionError(`experiment is '${x.status}'; only approved or running experiments can record outcomes (use --force only if it truly ran)`);
  }
  if (x.status === "completed") throw new ActionError("outcome already recorded");
  for (const e of input.evidenceIds) if (!m.evidence.some((v) => v.id === e)) throw new ActionError(`unknown evidence ${e}`);
  const idea = m.ideas.find((i) => i.id === x.ideaId)!;
  for (const [aid, status] of Object.entries(input.assumptions ?? {})) {
    const a = idea.assumptions.find((y) => y.id === aid);
    if (!a) throw new ActionError(`idea ${idea.id} has no assumption ${aid}`);
    a.status = status;
  }
  idea.updatedAt = input.at;
  const from = x.status;
  x.status = "completed";
  x.outcome = { recordedAt: input.at, result: input.result, summary: input.summary, evidenceIds: input.evidenceIds };
  const d: Decision = {
    id: decisionId(m, expId, input.at),
    at: input.at,
    subjectType: "experiment",
    subjectId: expId,
    action: "complete",
    fromStatus: from,
    toStatus: input.result,
    rationale: input.summary,
    actor: input.actor,
    provenance: x.provenance,
  };
  m.decisions.push(d);
  return d;
}

export interface Reconsideration {
  idea: Idea;
  lastDecision?: Decision;
  currentEvidence: number;
  reasons: string[];
}

/**
 * Parked/rejected ideas whose evidence picture changed since their last
 * decision: the score moved by ≥ threshold, or evidence was retrieved after
 * the decision was taken.
 */
export function reconsiderationQueue(m: Memory, threshold = 10): Reconsideration[] {
  const out: Reconsideration[] = [];
  const sources = new Map(m.sources.map((s) => [s.id, s]));
  for (const idea of m.ideas.filter((i) => i.status === "parked" || i.status === "rejected")) {
    const last = m.decisions.filter((d) => d.subjectId === idea.id).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
    const current = assessIdea(idea, m).evidence.score;
    const reasons: string[] = [];
    if (last?.evidenceStrength !== undefined && Math.abs(current - last.evidenceStrength) >= threshold) {
      reasons.push(`evidence strength moved ${last.evidenceStrength} → ${current} since the last decision`);
    }
    if (last) {
      const fresh = evidenceForIdea(idea, m).filter((e) => (sources.get(e.sourceId)?.retrievedAt ?? "") > last.at);
      if (fresh.length) {
        const contra = fresh.filter((e) => e.stance === "contradicts").length;
        reasons.push(`${fresh.length} evidence item(s) retrieved after the decision (${contra} contradicting)`);
      }
    }
    if (reasons.length) out.push({ idea, lastDecision: last, currentEvidence: current, reasons });
  }
  return out;
}
