/**
 * Integrity and research-policy checks over a whole memory.
 * Errors block ingestion/CI; warnings are surfaced but do not block.
 */
import { COLLECTIONS, Memory as MemorySchema, type Memory, type Provenance } from "./schema";
import { DUPLICATE_THRESHOLD, SimilarityIndex, ideaText } from "./similarity";

export interface Issue {
  level: "error" | "warning";
  ref: string;
  message: string;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateMemory(input: unknown, expected?: Provenance): { memory?: Memory; issues: Issue[] } {
  const issues: Issue[] = [];
  const parsed = MemorySchema.safeParse(input);
  if (!parsed.success) {
    for (const e of parsed.error.issues.slice(0, 50)) {
      issues.push({ level: "error", ref: e.path.join("."), message: e.message });
    }
    return { issues };
  }
  const m = parsed.data;
  const err = (ref: string, message: string) => issues.push({ level: "error", ref, message });
  const warn = (ref: string, message: string) => issues.push({ level: "warning", ref, message });

  const ids: Record<string, Set<string>> = {};
  for (const c of COLLECTIONS) {
    ids[c] = new Set();
    for (const rec of m[c] as { id: string; provenance: Provenance }[]) {
      if (ids[c].has(rec.id)) err(`${c}.${rec.id}`, "duplicate id");
      ids[c].add(rec.id);
      if (expected && rec.provenance !== expected) {
        err(`${c}.${rec.id}`, `provenance '${rec.provenance}' not allowed in a '${expected}' store`);
      }
    }
  }
  const need = (coll: keyof typeof ids, id: string | undefined, ref: string) => {
    if (id && !ids[coll].has(id)) err(ref, `references missing ${coll} '${id}'`);
  };

  const sources = new Map(m.sources.map((s) => [s.id, s]));
  for (const ev of m.evidence) {
    const ref = `evidence.${ev.id}`;
    need("sources", ev.sourceId, ref);
    ev.problemIds.forEach((p) => need("problems", p, ref));
    ev.ideaIds.forEach((p) => need("ideas", p, ref));
    ev.competitorIds.forEach((p) => need("competitors", p, ref));
    if (!ev.problemIds.length && !ev.ideaIds.length && !ev.competitorIds.length) {
      warn(ref, "evidence is not linked to any problem, idea or competitor");
    }
    const src = sources.get(ev.sourceId);
    if (src && !normalizeText(src.excerpt).includes(normalizeText(ev.quote))) {
      err(ref, "quote does not appear verbatim in the source's captured excerpt");
    }
    if (src && src.provenance !== ev.provenance) err(ref, "evidence provenance differs from its source");
  }

  for (const p of m.problems) {
    const ref = `problems.${p.id}`;
    p.themeIds.forEach((t) => need("themes", t, ref));
    need("runs", p.discoveredInRun, ref);
    const support = m.evidence.filter((e) => e.problemIds.includes(p.id) && e.stance === "supports");
    if (!support.length && p.status !== "dismissed") err(ref, "problem has no supporting evidence");
  }

  for (const c of m.competitors) c.sourceIds.forEach((s) => need("sources", s, `competitors.${c.id}`));

  const experimentsByIdea = new Map<string, number>();
  for (const x of m.experiments) {
    const ref = `experiments.${x.id}`;
    need("ideas", x.ideaId, ref);
    need("runs", x.createdInRun, ref);
    experimentsByIdea.set(x.ideaId, (experimentsByIdea.get(x.ideaId) ?? 0) + 1);
    if (x.status === "completed" && !x.outcome) err(ref, "completed experiment must record an outcome");
    if (x.outcome && x.status !== "completed") err(ref, "only completed experiments may carry an outcome");
    x.outcome?.evidenceIds.forEach((e) => need("evidence", e, ref));
  }

  for (const idea of m.ideas) {
    const ref = `ideas.${idea.id}`;
    idea.problemIds.forEach((p) => need("problems", p, ref));
    idea.themeIds.forEach((t) => need("themes", t, ref));
    idea.competitorIds.forEach((c) => need("competitors", c, ref));
    idea.relatedIdeaIds.forEach((r) => need("ideas", r, ref));
    need("runs", idea.createdInRun, ref);
    for (const o of idea.objections) o.evidenceIds.forEach((e) => need("evidence", e, `${ref}.objections.${o.id}`));
    if (idea.status === "merged" && !idea.mergedInto) err(ref, "merged idea must name mergedInto");
    if (idea.mergedInto) need("ideas", idea.mergedInto, ref);
    if (idea.status === "advanced" && !experimentsByIdea.get(idea.id)) {
      err(ref, "advanced idea must have at least one proposed experiment");
    }
    if (!idea.competitorIds.length) warn(ref, "no competitors/alternatives recorded");
  }

  for (const d of m.decisions) {
    const ref = `decisions.${d.id}`;
    need("runs", d.runId, ref);
    const coll = ({ idea: "ideas", problem: "problems", experiment: "experiments", theme: "themes" } as const)[
      d.subjectType
    ];
    need(coll, d.subjectId, ref);
  }
  for (const r of m.runs) need("themes", r.themeId, `runs.${r.id}`);
  for (const s of m.signals) need("themes", s.themeId, `signals.${s.id}`);

  // Deduplication: near-identical ideas must be explicitly reconciled.
  const live = m.ideas.filter((i) => i.status !== "merged");
  const index = new SimilarityIndex(live.map((i) => ({ id: i.id, text: ideaText(i) })));
  for (let a = 0; a < live.length; a++) {
    for (let b = a + 1; b < live.length; b++) {
      const A = live[a];
      const B = live[b];
      const sim = index.similarity(A.id, B.id);
      if (sim < DUPLICATE_THRESHOLD) continue;
      const linked = A.relatedIdeaIds.includes(B.id) || B.relatedIdeaIds.includes(A.id);
      const justified = linked && (A.noveltyNote || B.noveltyNote);
      if (!justified) {
        err(
          `ideas.${A.id}`,
          `possible duplicate of '${B.id}' (similarity ${sim.toFixed(2)}); merge them or link via relatedIdeaIds with a noveltyNote`,
        );
      }
    }
  }

  return { memory: m, issues };
}
