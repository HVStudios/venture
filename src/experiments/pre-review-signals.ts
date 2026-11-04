/**
 * Experiment exp-pre-review-signal-discrimination (pre-registered in
 * data/experiments.json before any signal data was collected).
 *
 * Do two cheap signals available before review separate PRs closed under
 * AI/low-effort policies from merged first-time LLVM PRs?
 *   S1: PRs the author opened across GitHub in the 30 days before the PR
 *   S2: author account age at PR creation (younger → more suspicious)
 *
 * Runs in GitHub Actions:  tsx src/experiments/pre-review-signals.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Probability that a random positive scores higher than a random negative (ties count half). */
export function auc(pos: number[], neg: number[]): number | null {
  if (!pos.length || !neg.length) return null;
  let s = 0;
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return s / (pos.length * neg.length);
}

/** Share of negatives at or above the threshold that catches half the positives. */
export function newcomerFlagRate(pos: number[], neg: number[]): number | null {
  if (!pos.length || !neg.length) return null;
  const sorted = [...pos].sort((a, b) => b - a);
  const threshold = sorted[Math.floor((sorted.length - 1) / 2)];
  return neg.filter((n) => n >= threshold).length / neg.length;
}

export function signalVerdict(s1: number | null, s2: number | null, n: number) {
  if (n < 150 || s1 === null) return { result: "inconclusive" as const, reason: `only ${n} PR(s) with readable authors; need ≥150` };
  if (s1 >= 0.75) return { result: "supported" as const, reason: `S1 (recent cross-repo PR burst) AUC ${s1.toFixed(2)} ≥ 0.75` };
  if (s1 < 0.6 && (s2 === null || s2 < 0.6)) return { result: "refuted" as const, reason: `S1 AUC ${s1.toFixed(2)} and S2 AUC ${s2?.toFixed(2) ?? "n/a"} are both below 0.60` };
  return { result: "inconclusive" as const, reason: `S1 AUC ${s1.toFixed(2)} (S2 ${s2?.toFixed(2) ?? "n/a"}) is between the thresholds` };
}

const API = "https://api.github.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function gh<T>(path: string): Promise<{ status: number; body: T | null }> {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(API + path, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "venture-experiment" } });
    if (res.status === 403 || res.status === 429) {
      await sleep(20_000 * (i + 1));
      continue;
    }
    return { status: res.status, body: res.ok ? ((await res.json()) as T) : null };
  }
  return { status: 429, body: null };
}

interface Row {
  url: string;
  group: "policy-closed" | "newcomer-merged";
  author: string;
  llvm: boolean;
  createdAt?: string;
  accountExists: boolean;
  s1PriorPrs?: number;
  s2AccountAgeDays?: number;
}

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN required");
  const src = JSON.parse(readFileSync(join(process.cwd(), "research/experiments/exp-followup-engagement-retrospective/result.json"), "utf8"));
  const input = (src.rows as { url: string; group: string; author: string }[]).filter((r) => r.group === "policy-closed" || r.group === "newcomer-merged");
  const rows: Row[] = [];
  for (const r of input) {
    const m = r.url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) continue;
    const row: Row = { url: r.url, group: r.group as Row["group"], author: r.author, llvm: m[1] === "llvm" && m[2] === "llvm-project", accountExists: false };
    const pr = await gh<{ created_at: string }>(`/repos/${m[1]}/${m[2]}/pulls/${m[3]}`);
    row.createdAt = pr.body?.created_at;
    const user = await gh<{ created_at: string }>(`/users/${encodeURIComponent(r.author)}`);
    if (user.body && row.createdAt) {
      row.accountExists = true;
      row.s2AccountAgeDays = (Date.parse(row.createdAt) - Date.parse(user.body.created_at)) / 86_400_000;
      const end = new Date(Date.parse(row.createdAt) - 86_400_000).toISOString().slice(0, 10);
      const start = new Date(Date.parse(row.createdAt) - 30 * 86_400_000).toISOString().slice(0, 10);
      const q = encodeURIComponent(`type:pr author:${r.author} created:${start}..${end}`);
      const s = await gh<{ total_count: number }>(`/search/issues?q=${q}&per_page=1`);
      row.s1PriorPrs = s.body?.total_count;
      await sleep(2200); // search API: 30 requests/minute
    }
    rows.push(row);
  }
  const ok = rows.filter((r) => r.accountExists && r.s1PriorPrs !== undefined && r.s2AccountAgeDays !== undefined);
  const pos = ok.filter((r) => r.group === "policy-closed");
  const neg = ok.filter((r) => r.group === "newcomer-merged");
  const s1 = auc(pos.map((r) => r.s1PriorPrs!), neg.map((r) => r.s1PriorPrs!));
  const s2 = auc(pos.map((r) => -r.s2AccountAgeDays!), neg.map((r) => -r.s2AccountAgeDays!));
  const s1Llvm = auc(pos.filter((r) => r.llvm).map((r) => r.s1PriorPrs!), neg.map((r) => r.s1PriorPrs!));
  const flag = newcomerFlagRate(pos.map((r) => r.s1PriorPrs!), neg.map((r) => r.s1PriorPrs!));
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const deleted = (g: Row["group"]) => rows.filter((r) => r.group === g && !r.accountExists).length;
  const v = signalVerdict(s1, s2, ok.length);
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-pre-review-signal-discrimination");
  mkdirSync(out, { recursive: true });
  const stats = { n: ok.length, policyClosed: pos.length, newcomerMerged: neg.length, s1Auc: s1, s2Auc: s2, s1AucWithinLlvm: s1Llvm, newcomerFlagRateAtHalfRecall: flag,
    medianPriorPrs: { policyClosed: median(pos.map((r) => r.s1PriorPrs!)), newcomerMerged: median(neg.map((r) => r.s1PriorPrs!)) },
    medianAccountAgeDays: { policyClosed: median(pos.map((r) => r.s2AccountAgeDays!)), newcomerMerged: median(neg.map((r) => r.s2AccountAgeDays!)) },
    accountsGone: { policyClosed: deleted("policy-closed"), newcomerMerged: deleted("newcomer-merged") } };
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-pre-review-signal-discrimination", executedAt, stats, verdict: v, rows }, null, 2) + "\n");
  const f2 = (x: number | null) => (x === null ? "n/a" : x.toFixed(2));
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const md = [
    "# Result: exp-pre-review-signal-discrimination",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on public GitHub data.`,
    "",
    `- PRs with readable authors: ${ok.length} (policy-closed ${pos.length}, newcomer-merged ${neg.length}). Accounts no longer existing: policy-closed ${stats.accountsGone.policyClosed}, newcomer-merged ${stats.accountsGone.newcomerMerged}.`,
    `- S1, PRs opened across GitHub in the 30 days before: median ${stats.medianPriorPrs.policyClosed} (policy-closed) vs ${stats.medianPriorPrs.newcomerMerged} (newcomer-merged); AUC ${f2(s1)}; within LLVM ${f2(s1Llvm)}.`,
    `- S2, account age at PR creation: median ${stats.medianAccountAgeDays.policyClosed?.toFixed(0)} days (policy-closed) vs ${stats.medianAccountAgeDays.newcomerMerged?.toFixed(0)} days (newcomer-merged); AUC ${f2(s2)}.`,
    `- At the S1 threshold that flags half of the policy-closed PRs, ${pct(flag)} of genuine newcomer PRs would also be flagged.`,
    "",
    `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`,
    "",
    "Caveats: the control group is LLVM-only; group labels are inferred from comment text in the original experiment; the cross-repo PR count comes from GitHub search totals.",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("pre-review-signals.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
