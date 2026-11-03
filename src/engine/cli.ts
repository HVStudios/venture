#!/usr/bin/env node
/**
 * VENTURE command line.
 *
 *   venture validate                      check both stores (CI gate)
 *   venture snapshot                      build public/data/snapshot.json for the web UI
 *   venture ingest <bundle.json> [--fixture] [--dry-run]
 *   venture scout --theme <id|all> [--collectors hackernews,github-issues] [--per-query 10]
 *   venture run --theme <id> --provider mock|replay|anthropic [--cassette f] [--record f]
 *               [--model m] [--max-cost usd] [--max-ideas n] [--max-calls n]
 *   venture verify [--stale]              re-fetch cited sources, check quotes
 *   venture status                        summary of research memory
 *   venture decide <idea-id> --status s --rationale "…" [--actor a] [--merged-into id]
 *   venture approve <exp-id> --by <name> --note "…"   (owner authorization)
 *   venture outcome <exp-id> --result supported|refuted|inconclusive --summary "…"
 *               [--evidence ev-1,ev-2] [--assumption a1=supported] [--force]
 *   venture reconsider                    parked/rejected ideas whose evidence changed
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runId } from "../core/ids";
import type { Memory, Provenance, Run, Theme } from "../core/schema";
import { validateMemory } from "../core/validate";
import { ActionError, approveExperiment, decideIdea, reconsiderationQueue, recordOutcome } from "../core/actions";
import type { IdeaStatus } from "../core/schema";
import { COLLECTORS, mergeSignals, type Fetcher } from "./collectors";
import { ingestBundle } from "./ingest";
import { runPipeline, type PoolItem } from "./pipeline";
import { AnthropicProvider } from "./providers/anthropic";
import { MockProvider } from "./providers/mock";
import { RecordingProvider, ReplayProvider } from "./providers/replay";
import type { ModelProvider } from "./providers/types";
import { FIXTURE_STORE, REAL_STORE, ROOT, loadRaw, saveMemory } from "./store";
import { verifyAll } from "./verify";

function args(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[a.slice(2)] = next;
        i++;
      } else flags[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

function load(dir: string, expected: Provenance): Memory {
  const { memory, issues } = validateMemory(loadRaw(dir), expected);
  const errors = issues.filter((i) => i.level === "error");
  if (!memory || errors.length) {
    for (const e of errors) console.error(`  ✗ ${e.ref}: ${e.message}`);
    throw new Error(`store ${dir} is invalid`);
  }
  return memory;
}

const fetcher: Fetcher = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });

function report(label: string, issues: { level: string; ref: string; message: string }[]) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  console.log(`${label}: ${errors.length} error(s), ${warnings.length} warning(s)`);
  for (const i of errors) console.log(`  ✗ ${i.ref}: ${i.message}`);
  for (const i of warnings) console.log(`  ! ${i.ref}: ${i.message}`);
  return errors.length;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = args(rest);

  switch (cmd) {
    case "validate": {
      let errors = 0;
      errors += report("data/ (real)", validateMemory(loadRaw(REAL_STORE), "real").issues);
      errors += report("fixtures/demo (fixture)", validateMemory(loadRaw(FIXTURE_STORE), "fixture").issues);
      if (errors) process.exit(1);
      return;
    }

    case "snapshot": {
      const real = load(REAL_STORE, "real");
      const fixture = load(FIXTURE_STORE, "fixture");
      let commit = process.env.GITHUB_SHA ?? "";
      try {
        commit ||= execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      } catch {
        commit ||= "unknown";
      }
      const out = join(ROOT, "public/data");
      mkdirSync(out, { recursive: true });
      const snapshot = { schemaVersion: 1, generatedAt: new Date().toISOString(), commit: commit.slice(0, 12), stores: { real, fixture } };
      writeFileSync(join(out, "snapshot.json"), JSON.stringify(snapshot));
      console.log(`snapshot: ${real.ideas.length} real idea(s), ${fixture.ideas.length} fixture idea(s) → public/data/snapshot.json`);
      return;
    }

    case "ingest": {
      const file = pos[0];
      if (!file) throw new Error("usage: venture ingest <bundle.json> [--fixture] [--dry-run]");
      const fixture = !!flags.fixture;
      const res = ingestBundle(fixture ? FIXTURE_STORE : REAL_STORE, JSON.parse(readFileSync(file, "utf8")), fixture ? "fixture" : "real", !!flags["dry-run"]);
      report(`ingest ${file}`, res.issues);
      console.log("added:", JSON.stringify(res.added), "replaced:", JSON.stringify(res.replaced));
      if (!res.ok) process.exit(1);
      console.log(flags["dry-run"] ? "dry run: nothing written" : "ingested");
      return;
    }

    case "scout": {
      const memory = load(REAL_STORE, "real");
      const themeArg = String(flags.theme ?? "all");
      const themes = memory.themes.filter((t) => t.status === "active" && (themeArg === "all" || t.id === themeArg));
      if (!themes.length) throw new Error(`no active theme matches '${themeArg}'`);
      const names = flags.collectors ? String(flags.collectors).split(",") : COLLECTORS.map((c) => c.name);
      const perQuery = Number(flags["per-query"] ?? 8);
      const now = new Date();
      for (const theme of themes) {
        const run: Run = {
          id: runId(now, `scout-${theme.id.replace(/^theme-/, "")}`),
          themeId: theme.id,
          mode: "collector",
          provider: "none (deterministic collectors)",
          startedAt: now.toISOString(),
          status: "running",
          stages: [],
          counts: { sourcesExamined: 0, sourcesCited: 0, problemsFound: 0, ideasGenerated: 0, ideasAdvanced: 0, ideasRejected: 0, ideasParked: 0, experimentsProposed: 0 },
          queries: theme.keywords,
          errors: [],
          limitations: ["Collector runs gather raw signals only; no analysis, ideas or claims are produced."],
          usage: { modelCalls: 0, estimatedCostUsd: 0, actualCostUsd: 0 },
          limits: { perQuery },
          provenance: "real",
        };
        const found = [];
        for (const c of COLLECTORS.filter((x) => names.includes(x.name))) {
          try {
            const got = await c.collect(theme, perQuery, fetcher, now);
            found.push(...got);
            run.stages.push({ name: "scout", status: "ok", notes: `${c.name}: ${got.length} signal(s)` });
          } catch (e) {
            run.errors.push(`${c.name}: ${e instanceof Error ? e.message : e}`);
            run.stages.push({ name: "scout", status: "failed", notes: c.name });
          }
        }
        memory.signals = mergeSignals(memory.signals, found, Number(flags["max-per-theme"] ?? 150));
        run.counts.sourcesExamined = found.length;
        run.completedAt = new Date().toISOString();
        run.status = run.errors.length ? (found.length ? "partial" : "failed") : "completed";
        run.stages.push({ name: "persist", status: "ok" });
        memory.runs.push(run);
        console.log(`${theme.id}: ${found.length} signal(s), ${run.errors.length} error(s)`);
      }
      const check = validateMemory(memory, "real");
      if (report("post-scout validation", check.issues)) process.exit(1);
      saveMemory(REAL_STORE, check.memory!);
      return;
    }

    case "run": {
      const providerName = String(flags.provider ?? "mock");
      let provider: ModelProvider;
      if (providerName === "mock") provider = new MockProvider();
      else if (providerName === "replay") provider = new ReplayProvider(String(flags.cassette));
      else if (providerName === "anthropic") provider = new AnthropicProvider(String(flags.model ?? "claude-opus-5-5"), Number(flags["max-cost"] ?? 0));
      else throw new Error(`unknown provider '${providerName}'`);
      if (flags.record) provider = new RecordingProvider(provider, String(flags.record));

      const real = provider.producesRealResearch;
      const store = real ? REAL_STORE : FIXTURE_STORE;
      const memory = load(store, real ? "real" : "fixture");
      const theme: Theme | undefined = memory.themes.find((t) => t.id === flags.theme);
      if (!theme) throw new Error(`theme '${flags.theme}' not found in ${store}`);
      const signals = memory.signals.filter((s) => s.themeId === theme.id && s.triage !== "ignored" && s.excerpt.length > 40);
      const pool: PoolItem[] = signals
        .sort((a, b) => b.engagement - a.engagement)
        .map((s) => ({
          poolId: s.id.replace(/^sig-/, ""),
          url: s.url,
          title: s.title,
          publisher: { hackernews: "Hacker News", "github-issues": "GitHub", stackoverflow: "Stack Overflow", arxiv: "arXiv" }[s.collector] ?? s.collector,
          sourceType: ({ hackernews: "forum", "github-issues": "issue-tracker", stackoverflow: "forum", arxiv: "paper" } as const)[s.collector as "arxiv"] ?? "other",
          publishedAt: s.createdAt,
          retrievedAt: s.retrievedAt,
          excerpt: s.excerpt,
        }));
      const id = runId(new Date(), `${provider.name}-${theme.id.replace(/^theme-/, "")}`);
      const bundle = await runPipeline({
        theme,
        pool,
        memory,
        provider,
        runId: id,
        limits: {
          ...(flags["max-ideas"] ? { maxIdeas: Number(flags["max-ideas"]) } : {}),
          ...(flags["max-calls"] ? { maxModelCalls: Number(flags["max-calls"]) } : {}),
          ...(flags["max-sources"] ? { maxSources: Number(flags["max-sources"]) } : {}),
        },
      });
      if (provider instanceof AnthropicProvider) bundle.run.usage.actualCostUsd = provider.spentUsd;
      const bundleDir = join(ROOT, "research/bundles");
      mkdirSync(bundleDir, { recursive: true });
      const bundleFile = join(bundleDir, `${id}.json`);
      if (real) writeFileSync(bundleFile, JSON.stringify(bundle, null, 2) + "\n");
      const res = ingestBundle(store, bundle, real ? "real" : "fixture");
      report(`run ${id} (${bundle.run.status})`, res.issues);
      console.log(JSON.stringify(bundle.run.counts), bundle.run.errors.length ? `\nrun notes:\n  ${bundle.run.errors.join("\n  ")}` : "");
      if (!res.ok) process.exit(1);
      return;
    }

    case "verify": {
      const memory = load(REAL_STORE, "real");
      const tally = await verifyAll(memory, fetcher, new Date(), !!flags.stale);
      console.log("verification:", JSON.stringify(tally));
      saveMemory(REAL_STORE, memory);
      return;
    }

    case "status": {
      for (const [label, dir, p] of [["real", REAL_STORE, "real"], ["fixture", FIXTURE_STORE, "fixture"]] as const) {
        const m = load(dir, p);
        console.log(
          `${label}: ${m.themes.length} themes · ${m.signals.length} signals · ${m.sources.length} sources · ${m.evidence.length} evidence · ${m.problems.length} problems · ${m.ideas.length} ideas · ${m.experiments.length} experiments · ${m.runs.length} runs`,
        );
      }
      return;
    }

    case "decide":
    case "approve":
    case "outcome": {
      const memory = load(REAL_STORE, "real");
      const at = new Date().toISOString();
      const id = pos[0];
      if (!id) throw new Error(`usage: venture ${cmd} <id> …`);
      let d;
      if (cmd === "decide") {
        d = decideIdea(memory, id, String(flags.status) as IdeaStatus, String(flags.rationale ?? ""), String(flags.actor ?? "director"), at, {
          mergedInto: flags["merged-into"] ? String(flags["merged-into"]) : undefined,
        });
      } else if (cmd === "approve") {
        if (!flags.by) throw new Error("--by <name> is required: approval is a human authorization");
        d = approveExperiment(memory, id, String(flags.by), String(flags.note ?? "approved"), at);
      } else {
        const assumptions = Object.fromEntries(
          (flags.assumption ? String(flags.assumption).split(",") : []).map((kv) => kv.split("=") as [string, "supported"]),
        );
        d = recordOutcome(memory, id, {
          result: String(flags.result) as "supported",
          summary: String(flags.summary ?? ""),
          evidenceIds: flags.evidence ? String(flags.evidence).split(",") : [],
          assumptions,
          actor: String(flags.actor ?? "experimenter"),
          at,
          force: !!flags.force,
        });
      }
      const check = validateMemory(memory, "real");
      if (report(`${cmd} ${id}`, check.issues)) process.exit(1);
      saveMemory(REAL_STORE, check.memory!);
      console.log(`recorded ${d.id}: ${d.fromStatus ?? "—"} → ${d.toStatus}`);
      return;
    }

    case "reconsider": {
      const memory = load(REAL_STORE, "real");
      const queue = reconsiderationQueue(memory, Number(flags.threshold ?? 10));
      if (!queue.length) console.log("No parked or rejected ideas have new evidence since their last decision.");
      for (const r of queue) console.log(`${r.idea.id} (${r.idea.status}): ${r.reasons.join("; ")}`);
      return;
    }

    default:
      console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
  }
}

main().catch((e) => {
  console.error(e instanceof ActionError ? `refused: ${e.message}` : e instanceof Error ? e.message : e);
  process.exit(1);
});
