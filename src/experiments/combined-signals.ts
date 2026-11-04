/**
 * Experiment exp-combined-signal-discrimination (pre-registered in
 * data/experiments.json before the signals were measured together).
 *
 * Score = mean of the percentile ranks of description length (C2) and the
 * author's PR count across GitHub in the 30 days before the PR (S1).
 * No weights are fitted.
 *
 *   tsx src/experiments/combined-signals.ts   (GitHub Actions; needs GITHUB_TOKEN)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wordCount } from "./content-signals";
import { auc, newcomerFlagRate } from "./pre-review-signals";

/** Percentile rank in [0, 1]; ties share their mean rank. */
export function percentileRanks(xs: number[]): number[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const n = xs.length;
  return xs.map((x) => {
    const lo = sorted.indexOf(x);
    const hi = sorted.lastIndexOf(x);
    return n > 1 ? (lo + hi) / 2 / (n - 1) : 0.5;
  });
}

export function combinedScores(c2: number[], s1: number[]): number[] {
  const a = percentileRanks(c2);
  const b = percentileRanks(s1);
  return a.map((x, i) => (x + b[i]) / 2);
}

export function combinedVerdict(a: number | null, n: number) {
  if (a === null || n < 150) return { result: "inconclusive" as const, reason: `only ${n} usable PR(s); need ≥150` };
  if (a >= 0.75) return { result: "supported" as const, reason: `combined AUC ${a.toFixed(2)} ≥ 0.75` };
  if (a < 0.7) return { result: "refuted" as const, reason: `combined AUC ${a.toFixed(2)} < 0.70` };
  return { result: "inconclusive" as const, reason: `combined AUC ${a.toFixed(2)} is between 0.70 and 0.75` };
}

const API = "https://api.github.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function gh<T>(path: string): Promise<T | null> {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(API + path, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "venture-experiment" } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 404) return null;
    await sleep(15_000 * (i + 1));
  }
  return null;
}

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN required");
  const src = JSON.parse(readFileSync(join(process.cwd(), "research/experiments/exp-followup-engagement-retrospective/result.json"), "utf8"));
  const input = (src.rows as { url: string; group: string; author: string }[]).filter((r) => r.group === "policy-closed" || r.group === "newcomer-merged");
  const rows: { url: string; group: string; words?: number; priorPrs?: number }[] = [];
  for (const r of input) {
    const m = r.url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) continue;
    const pr = await gh<{ created_at: string; body?: string | null }>(`/repos/${m[1]}/${m[2]}/pulls/${m[3]}`);
    const row: (typeof rows)[number] = { url: r.url, group: r.group };
    if (pr) {
      row.words = wordCount(pr.body ?? "");
      const t = Date.parse(pr.created_at);
      const q = encodeURIComponent(`type:pr author:${r.author} created:${new Date(t - 30 * 86_400_000).toISOString().slice(0, 10)}..${new Date(t - 86_400_000).toISOString().slice(0, 10)}`);
      const s = await gh<{ total_count: number }>(`/search/issues?q=${q}&per_page=1`);
      row.priorPrs = s?.total_count;
      await sleep(2200);
    }
    rows.push(row);
  }
  const ok = rows.filter((r) => r.words !== undefined && r.priorPrs !== undefined);
  const scores = combinedScores(ok.map((r) => r.words!), ok.map((r) => r.priorPrs!));
  const pos = scores.filter((_, i) => ok[i].group === "policy-closed");
  const neg = scores.filter((_, i) => ok[i].group === "newcomer-merged");
  const a = auc(pos, neg);
  const flag = newcomerFlagRate(pos, neg);
  const v = combinedVerdict(a, ok.length);
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-combined-signal-discrimination");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-combined-signal-discrimination", executedAt, n: ok.length, auc: a, newcomerFlagRateAtHalfRecall: flag, verdict: v, rows }, null, 2) + "\n");
  const md = [
    "# Result: exp-combined-signal-discrimination",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on public GitHub data.`,
    "",
    `- PRs with both signals: ${ok.length} (policy-closed ${pos.length}, newcomer-merged ${neg.length}).`,
    `- Combined score (mean percentile rank of description length and prior 30-day cross-repo PR count): AUC ${a === null ? "n/a" : a.toFixed(2)}.`,
    `- At the threshold that flags half of the policy-closed PRs, ${flag === null ? "n/a" : `${(flag * 100).toFixed(1)}%`} of genuine newcomer PRs would also be flagged.`,
    "",
    `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`,
    "",
    "Caveats: the control group is LLVM-only; descriptions may have been edited after closing; cross-repo counts come from GitHub search totals.",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("combined-signals.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
