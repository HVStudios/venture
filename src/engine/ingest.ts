/**
 * Ingest a research bundle into a store: merge (replace-by-id), enrich
 * decisions with score snapshots, validate the complete resulting memory and
 * only then persist. Nothing is written if validation fails.
 */
import { Bundle, COLLECTIONS, type Decision, type Memory, type Provenance } from "../core/schema";
import { assessIdea } from "../core/scoring";
import { validateMemory, type Issue } from "../core/validate";
import { loadRaw, saveMemory } from "./store";

export interface IngestResult {
  ok: boolean;
  issues: Issue[];
  added: Record<string, number>;
  replaced: Record<string, number>;
  memory?: Memory;
}

const EXP_ORDER = ["proposed", "approved", "running", "completed", "abandoned"];

/**
 * Re-ingesting an older bundle must not rewind state recorded since (e.g. an
 * experiment approved or completed after the bundle was written).
 */
export function rewinds(raw: Record<string, unknown[]>, bundle: Bundle): string[] {
  const problems: string[] = [];
  for (const x of bundle.experiments) {
    const cur = (raw.experiments as { id: string; status: string }[]).find((e) => e.id === x.id);
    if (cur && EXP_ORDER.indexOf(x.status) < EXP_ORDER.indexOf(cur.status)) {
      problems.push(`experiment ${x.id} would move back from '${cur.status}' to '${x.status}'`);
    }
  }
  for (const i of bundle.ideas) {
    const cur = (raw.ideas as { id: string; updatedAt: string; status: string }[]).find((e) => e.id === i.id);
    if (cur && i.updatedAt < cur.updatedAt) {
      problems.push(`idea ${i.id} in the bundle (updated ${i.updatedAt}) is older than the stored one (updated ${cur.updatedAt}, status '${cur.status}')`);
    }
  }
  for (const b of bundle.briefs) {
    const cur = (raw.briefs as { id: string; updatedAt: string }[]).find((e) => e.id === b.id);
    if (cur && b.updatedAt < cur.updatedAt) problems.push(`brief ${b.id} in the bundle is older than the stored one`);
  }
  return problems;
}

export function mergeBundle(raw: Record<string, unknown[]>, bundle: Bundle) {
  const added: Record<string, number> = {};
  const replaced: Record<string, number> = {};
  const merged: Record<string, unknown[]> = {};
  for (const c of COLLECTIONS) {
    const current = [...(raw[c] as { id: string }[])];
    const incoming: { id: string }[] =
      c === "runs" ? [bundle.run] : c === "signals" ? [] : ((bundle as unknown as Record<string, { id: string }[]>)[c] ?? []);
    added[c] = 0;
    replaced[c] = 0;
    for (const rec of incoming) {
      const idx = current.findIndex((x) => x.id === rec.id);
      if (idx >= 0) {
        current[idx] = rec;
        replaced[c]++;
      } else {
        current.push(rec);
        added[c]++;
      }
    }
    merged[c] = current;
  }
  return { merged, added, replaced };
}

export function ingestBundle(storeDir: string, bundleInput: unknown, expected: Provenance, dryRun = false): IngestResult {
  const parsed = Bundle.safeParse(bundleInput);
  if (!parsed.success) {
    return {
      ok: false,
      added: {},
      replaced: {},
      issues: parsed.error.issues.slice(0, 50).map((e) => ({ level: "error", ref: `bundle.${e.path.join(".")}`, message: e.message })),
    };
  }
  const bundle = parsed.data;
  const raw = loadRaw(storeDir);
  const rewind = rewinds(raw, bundle);
  if (rewind.length) {
    return { ok: false, added: {}, replaced: {}, issues: rewind.map((m) => ({ level: "error" as const, ref: "bundle", message: `${m}; remove it from the bundle or update it first` })) };
  }
  const { merged, added, replaced } = mergeBundle(raw, bundle);

  // First pass validation (without decisions enrichment) to get typed memory.
  const first = validateMemory(merged, expected);
  if (!first.memory) return { ok: false, issues: first.issues, added, replaced };
  const memory = first.memory;

  // Ensure every new idea has a creation decision and snapshot scores.
  const decided = new Set(memory.decisions.map((d) => d.subjectId));
  for (const idea of bundle.ideas) {
    if (!decided.has(idea.id)) {
      const d: Decision = {
        id: `dec-${bundle.run.id.replace(/^run-/, "")}-${idea.id.replace(/^idea-/, "")}`,
        at: idea.createdAt,
        runId: bundle.run.id,
        subjectType: "idea",
        subjectId: idea.id,
        action: "create",
        toStatus: idea.status,
        rationale: idea.statusRationale,
        actor: "director",
        provenance: idea.provenance,
      };
      memory.decisions.push(d);
    }
  }
  for (const d of memory.decisions) {
    if (d.subjectType !== "idea" || d.runId !== bundle.run.id) continue;
    const idea = memory.ideas.find((i) => i.id === d.subjectId);
    if (!idea) continue;
    const a = assessIdea(idea, memory);
    d.attractiveness ??= a.attractiveness;
    d.evidenceStrength ??= a.evidence.score;
  }

  const final = validateMemory(memory, expected);
  const ok = !final.issues.some((i) => i.level === "error");
  if (ok && !dryRun) saveMemory(storeDir, final.memory!);
  return { ok, issues: final.issues, added, replaced, memory: final.memory };
}
