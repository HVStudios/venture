/**
 * Experiment exp-content-signal-discrimination (pre-registered in
 * data/experiments.json before any content data was collected).
 *
 * Do cheap content signals in the PR description separate PRs closed under
 * AI/low-effort policies from merged first-time LLVM PRs?
 *   C1: the description does NOT reference an issue (#123 or an issue URL)
 *   C2: description length in words (direction reported, not assumed)
 *
 *   tsx src/experiments/content-signals.ts   (GitHub Actions; needs GITHUB_TOKEN)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { auc, newcomerFlagRate } from "./pre-review-signals";

export function referencesIssue(body: string): boolean {
  return /(^|[\s(])#\d+\b/.test(body) || /github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/.test(body);
}

export function wordCount(body: string): number {
  return body.split(/\s+/).filter((w) => /\w/.test(w)).length;
}

/** AUC regardless of direction: returns the stronger orientation and which one it was. */
export function orientedAuc(pos: number[], neg: number[]): { auc: number | null; direction: "higher" | "lower" } {
  const a = auc(pos, neg);
  if (a === null) return { auc: null, direction: "higher" };
  return a >= 0.5 ? { auc: a, direction: "higher" } : { auc: 1 - a, direction: "lower" };
}

export function contentVerdict(c1: number | null, c2: number | null, n: number) {
  const best = Math.max(c1 ?? 0, c2 ?? 0);
  if (n < 150) return { result: "inconclusive" as const, reason: `only ${n} readable PR(s); need ≥150` };
  if (best >= 0.75) return { result: "supported" as const, reason: `best content signal AUC ${best.toFixed(2)} ≥ 0.75` };
  if ((c1 ?? 0) < 0.6 && (c2 ?? 0) < 0.6) return { result: "refuted" as const, reason: `C1 AUC ${(c1 ?? 0).toFixed(2)} and C2 AUC ${(c2 ?? 0).toFixed(2)} are both below 0.60` };
  return { result: "inconclusive" as const, reason: `best content signal AUC ${best.toFixed(2)} is between the thresholds` };
}

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN required");
  const src = JSON.parse(readFileSync(join(process.cwd(), "research/experiments/exp-followup-engagement-retrospective/result.json"), "utf8"));
  const input = (src.rows as { url: string; group: string }[]).filter((r) => r.group === "policy-closed" || r.group === "newcomer-merged");
  const rows: { url: string; group: string; readable: boolean; refsIssue?: boolean; words?: number }[] = [];
  for (const r of input) {
    const m = r.url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) continue;
    let body: string | null = null;
    for (let i = 0; i < 4 && body === null; i++) {
      const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}`, {
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "venture-experiment" },
      });
      if (res.ok) body = (((await res.json()) as { body?: string | null }).body ?? "") as string;
      else if (res.status === 404) break;
      else await new Promise((s) => setTimeout(s, 5000 * (i + 1)));
    }
    rows.push(body === null ? { url: r.url, group: r.group, readable: false } : { url: r.url, group: r.group, readable: true, refsIssue: referencesIssue(body), words: wordCount(body) });
  }
  const ok = rows.filter((r) => r.readable);
  const pos = ok.filter((r) => r.group === "policy-closed");
  const neg = ok.filter((r) => r.group === "newcomer-merged");
  const c1 = auc(pos.map((r) => (r.refsIssue ? 0 : 1)), neg.map((r) => (r.refsIssue ? 0 : 1)));
  const c2 = orientedAuc(pos.map((r) => r.words!), neg.map((r) => r.words!));
  const sign = c2.direction === "higher" ? 1 : -1;
  const flag2 = newcomerFlagRate(pos.map((r) => sign * r.words!), neg.map((r) => sign * r.words!));
  const share = (xs: typeof ok) => (xs.length ? xs.filter((r) => r.refsIssue).length / xs.length : null);
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const v = contentVerdict(c1, c2.auc, ok.length);
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-content-signal-discrimination");
  mkdirSync(out, { recursive: true });
  const stats = { n: ok.length, policyClosed: pos.length, newcomerMerged: neg.length, c1Auc: c1, c2Auc: c2.auc, c2Direction: c2.direction, c2NewcomerFlagRateAtHalfRecall: flag2,
    issueReferenceShare: { policyClosed: share(pos), newcomerMerged: share(neg) }, medianWords: { policyClosed: median(pos.map((r) => r.words!)), newcomerMerged: median(neg.map((r) => r.words!)) } };
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-content-signal-discrimination", executedAt, stats, verdict: v, rows }, null, 2) + "\n");
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const f2 = (x: number | null) => (x === null ? "n/a" : x.toFixed(2));
  const md = [
    "# Result: exp-content-signal-discrimination",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on public GitHub data.`,
    "",
    `- PRs with readable descriptions: ${ok.length} (policy-closed ${pos.length}, newcomer-merged ${neg.length}).`,
    `- C1, description references an issue: ${pct(stats.issueReferenceShare.policyClosed)} of policy-closed vs ${pct(stats.issueReferenceShare.newcomerMerged)} of newcomer-merged PRs; AUC (no reference → suspicious) ${f2(c1)}.`,
    `- C2, description length: median ${stats.medianWords.policyClosed} words (policy-closed) vs ${stats.medianWords.newcomerMerged} words (newcomer-merged); AUC ${f2(c2.auc)} (policy-closed descriptions are ${c2.direction === "higher" ? "longer" : "shorter"}).`,
    `- At the C2 threshold that flags half of the policy-closed PRs, ${pct(flag2)} of genuine newcomer PRs would also be flagged.`,
    "",
    `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`,
    "",
    "Caveats: the control group is LLVM-only; descriptions may have been edited after the PR was closed; group labels come from the original experiment.",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("content-signals.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
