/**
 * Research areas: everything VENTURE knows about one theme, assembled from
 * structured records so pages update automatically as research accrues.
 * The narrative synthesis comes from the theme's research brief, if any.
 * Nothing here invents content: missing information is reported as missing.
 */
import type { Brief, Decision, Evidence, Experiment, Idea, IdeaStatus, Memory, Problem, Run, Source, Theme } from "./schema";

export interface AreaStatus {
  key: "collecting" | "investigating" | "designing-test" | "testing" | "reassessing" | "paused";
  label: string;
  explanation: string;
}

export interface TimelineEvent {
  at: string;
  kind: "session" | "collection" | "discovery" | "decision" | "experiment" | "brief";
  title: string;
  detail?: string;
  link?: string;
  tone?: "positive" | "negative" | "neutral";
}

export interface AreaModel {
  theme: Theme;
  brief?: Brief;
  stale: boolean;
  staleReason?: string;
  status: AreaStatus;
  problems: Problem[];
  ideas: Idea[];
  ideasByStatus: Record<IdeaStatus, Idea[]>;
  experiments: { planned: Experiment[]; completed: Experiment[]; other: Experiment[] };
  evidence: Evidence[];
  sources: Source[];
  researchRuns: Run[];
  collectorRuns: Run[];
  signals: number;
  timeline: TimelineEvent[];
  latest?: TimelineEvent;
  nextStep?: string;
  lastActivity?: string;
}

export const IDEA_STATUS_TEXT: Record<IdeaStatus, { label: string; meaning: string }> = {
  advanced: { label: "Chosen for testing", meaning: "Judged worth a validation experiment." },
  proposed: { label: "Under consideration", meaning: "Not yet decided." },
  parked: { label: "On hold", meaning: "Not rejected, but not worth pursuing now. Revisited if the evidence changes." },
  rejected: { label: "Rejected", meaning: "Judged not worth pursuing on current evidence." },
  merged: { label: "Merged", meaning: "Combined into another idea." },
};

export const RESULT_TEXT: Record<NonNullable<Experiment["outcome"]>["result"], string> = {
  supported: "The hypothesis was supported",
  refuted: "The hypothesis was refuted",
  inconclusive: "The result was inconclusive",
};

const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);

function ideasOf(m: Memory, themeId: string) {
  return m.ideas.filter((i) => i.themeIds.includes(themeId));
}

function deriveStatus(theme: Theme, research: Run[], ideas: Idea[], exps: Experiment[]): AreaStatus {
  if (theme.status !== "active")
    return { key: "paused", label: theme.status === "retired" ? "Retired" : "Paused", explanation: "This area is not being actively researched." };
  if (!research.length)
    return {
      key: "collecting",
      label: "Collecting leads",
      explanation: "Collectors gather public signals on a schedule, but no research session has investigated this area yet.",
    };
  if (exps.some((x) => x.status === "approved" || x.status === "running"))
    return { key: "testing", label: "Testing", explanation: "An approved experiment is waiting to run or is running." };
  const advanced = ideas.filter((i) => i.status === "advanced");
  if (advanced.some((i) => exps.some((x) => x.ideaId === i.id && x.status === "proposed")))
    return { key: "designing-test", label: "Designing a test", explanation: "A promising idea has a proposed experiment that hasn't been approved or run yet." };
  if (exps.some((x) => x.status === "completed") && !advanced.length)
    return { key: "reassessing", label: "Reassessing", explanation: "Experiments have run and no idea is currently chosen for testing. The area needs new hypotheses." };
  return { key: "investigating", label: "Investigating", explanation: "Research sessions are gathering evidence and evaluating ideas." };
}

function decisionEvent(d: Decision, m: Memory): TimelineEvent | undefined {
  if (d.subjectType === "idea") {
    const idea = m.ideas.find((i) => i.id === d.subjectId);
    if (!idea) return undefined;
    const verb: Record<Decision["action"], string> = {
      create: `Proposed and assessed`,
      advance: "Chose for testing",
      reject: "Rejected",
      park: "Put on hold",
      revise: "Re-assessed",
      merge: "Merged",
      reopen: "Reopened",
      complete: "Completed",
    };
    const status = IDEA_STATUS_TEXT[d.toStatus as IdeaStatus]?.label.toLowerCase();
    const title =
      d.action === "create"
        ? `${verb.create} idea “${idea.title}”: ${status}`
        : d.fromStatus === d.toStatus
          ? `Re-assessed “${idea.title}”: still ${status}`
          : `${verb[d.action]} “${idea.title}”`;
    const tone = d.toStatus === "advanced" ? "positive" : d.toStatus === "rejected" ? "negative" : "neutral";
    return { at: d.at, kind: "decision", title, detail: d.rationale, link: `/ideas/${idea.id}`, tone };
  }
  if (d.subjectType === "theme") {
    const verb = d.toStatus === "paused" ? "Paused this research area" : d.toStatus === "active" ? "Reopened this research area" : `Research area status: ${d.toStatus}`;
    return { at: d.at, kind: "decision", title: verb, detail: d.rationale, tone: d.toStatus === "paused" ? "negative" : "neutral" };
  }
  if (d.subjectType === "experiment") {
    const x = m.experiments.find((e) => e.id === d.subjectId);
    if (!x) return undefined;
    if (d.action === "complete")
      return {
        at: d.at,
        kind: "experiment",
        title: `Experiment completed: ${RESULT_TEXT[d.toStatus as "supported"] ?? d.toStatus}`,
        detail: `${x.title} ${d.rationale}`,
        link: "/experiments",
        tone: d.toStatus === "supported" ? "positive" : d.toStatus === "refuted" ? "negative" : "neutral",
      };
    if (d.toStatus === "running") return { at: d.at, kind: "experiment", title: `Experiment started: ${x.title}`, detail: d.rationale, link: "/experiments" };
    if (d.toStatus === "approved") return { at: d.at, kind: "experiment", title: `Experiment approved: ${x.title}`, detail: d.rationale, link: "/experiments" };
    return { at: d.at, kind: "experiment", title: `Experiment design revised: ${x.title}`, detail: d.rationale, link: "/experiments" };
  }
  return undefined;
}

export function buildTimeline(m: Memory, themeId: string): TimelineEvent[] {
  const ideas = ideasOf(m, themeId);
  const ideaIds = new Set(ideas.map((i) => i.id));
  const expIds = new Set(m.experiments.filter((x) => ideaIds.has(x.ideaId)).map((x) => x.id));
  const events: TimelineEvent[] = [];
  for (const r of m.runs.filter((x) => x.themeId === themeId)) {
    const at = r.completedAt ?? r.startedAt;
    if (r.mode === "collector") {
      const notes = r.stages.filter((s) => s.notes && /signal/.test(s.notes)).map((s) => s.notes).join(", ");
      events.push({ at, kind: "collection", title: `Collected ${r.counts.sourcesExamined} public signals`, detail: notes || undefined, link: `/runs/${r.id}` });
    } else {
      const c = r.counts;
      const parts = [
        c.sourcesExamined && `${c.sourcesExamined} documents read`,
        c.sourcesCited && `${c.sourcesCited} cited`,
        c.problemsFound && `${c.problemsFound} problem(s) identified`,
        c.ideasGenerated && `${c.ideasGenerated} idea(s) generated`,
        c.experimentsProposed && `${c.experimentsProposed} experiment(s) proposed`,
      ].filter(Boolean);
      const isExperiment = r.stages[0]?.name === "experiment";
      events.push({
        at,
        kind: "session",
        title: isExperiment ? "Experiment executed and analysed" : r.mode === "automated-llm" ? "Automated research run" : "Research session",
        detail: [parts.join(" · "), ...r.limitations.slice(0, 1).map((l) => `Limitation: ${l}`)].filter(Boolean).join(". "),
        link: `/runs/${r.id}`,
      });
    }
  }
  for (const p of m.problems.filter((x) => x.themeIds.includes(themeId)))
    events.push({ at: p.firstSeen, kind: "discovery", title: `Identified problem: ${p.title}`, detail: p.statement, link: `/problems/${p.id}` });
  for (const d of m.decisions) {
    if (!ideaIds.has(d.subjectId) && !expIds.has(d.subjectId) && d.subjectId !== themeId) continue;
    const e = decisionEvent(d, m);
    if (e) events.push(e);
  }
  const brief = m.briefs.find((b) => b.themeId === themeId);
  if (brief) events.push({ at: brief.updatedAt, kind: "brief", title: "Research brief updated", detail: `Written by ${brief.author}.` });
  return events.sort(byTime);
}

export function buildArea(m: Memory, themeId: string): AreaModel | undefined {
  const theme = m.themes.find((t) => t.id === themeId);
  if (!theme) return undefined;
  const problems = m.problems.filter((p) => p.themeIds.includes(themeId));
  const ideas = ideasOf(m, themeId);
  const ideaIds = new Set(ideas.map((i) => i.id));
  const problemIds = new Set(problems.map((p) => p.id));
  const exps = m.experiments.filter((x) => ideaIds.has(x.ideaId));
  const evidence = m.evidence.filter((e) => e.problemIds.some((p) => problemIds.has(p)) || e.ideaIds.some((i) => ideaIds.has(i)));
  const srcIds = new Set(evidence.map((e) => e.sourceId));
  const sources = m.sources.filter((s) => srcIds.has(s.id));
  const runs = m.runs.filter((r) => r.themeId === themeId);
  const researchRuns = runs.filter((r) => r.mode !== "collector").sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const collectorRuns = runs.filter((r) => r.mode === "collector");
  const brief = m.briefs.find((b) => b.themeId === themeId);
  const timeline = buildTimeline(m, themeId);

  // A brief is stale when research or decisions happened after it was written.
  const researchEvents = timeline.filter((e) => e.kind !== "collection" && e.kind !== "brief");
  const lastResearch = researchEvents.at(-1)?.at;
  let stale = false;
  let staleReason: string | undefined;
  if (brief && lastResearch && lastResearch > brief.updatedAt) {
    stale = true;
    staleReason = `Research continued after this brief was written (${brief.updatedAt.slice(0, 10)}). The latest change: ${researchEvents.at(-1)!.title}.`;
  }

  const ideasByStatus = { advanced: [], proposed: [], parked: [], rejected: [], merged: [] } as Record<IdeaStatus, Idea[]>;
  for (const i of ideas) ideasByStatus[i.status].push(i);

  const planned = exps.filter((x) => x.status === "proposed" || x.status === "approved" || x.status === "running");
  const completed = exps.filter((x) => x.status === "completed");
  const other = exps.filter((x) => x.status === "abandoned");

  let nextStep = brief?.nextSteps[0]?.text;
  if (!nextStep) {
    const p = planned.find((x) => x.status === "approved") ?? planned[0];
    if (p) nextStep = `Run the experiment “${p.title}”.`;
  }
  const latest = researchEvents.at(-1) ?? timeline.at(-1);
  return {
    theme,
    brief,
    stale,
    staleReason,
    status: deriveStatus(theme, researchRuns, ideas, exps),
    problems,
    ideas,
    ideasByStatus,
    experiments: { planned, completed, other },
    evidence,
    sources,
    researchRuns,
    collectorRuns,
    signals: m.signals.filter((s) => s.themeId === themeId).length,
    timeline,
    latest,
    nextStep,
    lastActivity: timeline.at(-1)?.at,
  };
}

export function buildAreas(m: Memory): AreaModel[] {
  const order: Record<AreaStatus["key"], number> = { testing: 0, "designing-test": 1, investigating: 2, reassessing: 3, collecting: 4, paused: 5 };
  return m.themes
    .map((t) => buildArea(m, t.id)!)
    .sort((a, b) => order[a.status.key] - order[b.status.key] || (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
}

/** The idea's strongest objection, for one-line summaries. */
export function strongestObjection(idea: Idea) {
  const rank = { fatal: 0, major: 1, minor: 2 } as const;
  return [...idea.objections].sort((a, b) => rank[a.severity] - rank[b.severity])[0];
}
