/**
 * Experiment exp-followup-engagement-retrospective (pre-registered in
 * data/experiments.json before execution).
 *
 * Question: do authors of PRs that were closed for violating an AI or
 * low-effort policy reply to maintainer comments less often than first-time
 * contributors whose PRs were merged?
 *
 * Reads public GitHub data only. Runs in GitHub Actions (needs GITHUB_TOKEN).
 *   tsx src/experiments/followup-engagement.ts [--per-group 120]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Comment {
  user: { login: string; type?: string };
  created_at: string;
}

export interface PrRow {
  url: string;
  group: "policy-closed" | "newcomer-merged" | "newcomer-closed";
  author: string;
  otherHumanComments: number;
  authorReplied: boolean;
  hoursToReply?: number;
}

const BOT = /\[bot\]$|^llvmbot$|^github-actions$|-bot$/i;
export const isBot = (u: Comment["user"]) => u.type === "Bot" || BOT.test(u.login);

/** Did the author reply after the first comment by another (human) participant? */
export function analysePr(author: string, comments: Comment[]): Pick<PrRow, "otherHumanComments" | "authorReplied" | "hoursToReply"> {
  const sorted = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const others = sorted.filter((c) => c.user.login !== author && !isBot(c.user));
  if (!others.length) return { otherHumanComments: 0, authorReplied: false };
  const first = others[0].created_at;
  const reply = sorted.find((c) => c.user.login === author && c.created_at > first);
  return {
    otherHumanComments: others.length,
    authorReplied: !!reply,
    hoursToReply: reply ? (new Date(reply.created_at).getTime() - new Date(first).getTime()) / 3.6e6 : undefined,
  };
}

export interface GroupStats {
  group: PrRow["group"];
  sampled: number;
  withHumanComment: number;
  replied: number;
  replyRate: number | null;
  ci95: [number, number] | null;
  medianHoursToReply: number | null;
}

/** Wilson score interval. */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - r) / d, (c + r) / d];
}

export function summarise(rows: PrRow[], group: PrRow["group"]): GroupStats {
  const g = rows.filter((r) => r.group === group);
  const eligible = g.filter((r) => r.otherHumanComments > 0);
  const replied = eligible.filter((r) => r.authorReplied);
  const hours = replied.map((r) => r.hoursToReply!).sort((a, b) => a - b);
  return {
    group,
    sampled: g.length,
    withHumanComment: eligible.length,
    replied: replied.length,
    replyRate: eligible.length ? replied.length / eligible.length : null,
    ci95: eligible.length ? wilson(replied.length, eligible.length) : null,
    medianHoursToReply: hours.length ? hours[Math.floor(hours.length / 2)] : null,
  };
}

/** Pre-registered decision rule. */
export function verdict(a: GroupStats, b: GroupStats): { result: "supported" | "refuted" | "inconclusive"; reason: string } {
  if (a.withHumanComment < 30 || b.withHumanComment < 30) {
    return { result: "inconclusive", reason: `insufficient sample (policy-closed n=${a.withHumanComment}, newcomer-merged n=${b.withHumanComment}; need ≥30 each)` };
  }
  const ra = a.replyRate!;
  const rb = b.replyRate!;
  if (ra <= 0.5 * rb) return { result: "supported", reason: `reply rate ${(ra * 100).toFixed(1)}% is at most half of ${(rb * 100).toFixed(1)}%` };
  if (Math.abs(ra - rb) < 0.15) return { result: "refuted", reason: `reply rates differ by less than 15 points (${(ra * 100).toFixed(1)}% vs ${(rb * 100).toFixed(1)}%)` };
  return { result: "inconclusive", reason: `difference is between the success and failure thresholds (${(ra * 100).toFixed(1)}% vs ${(rb * 100).toFixed(1)}%)` };
}

// ------------------------------------------------------------------ execution
const API = "https://api.github.com";
async function gh<T>(path: string): Promise<T> {
  const res = await fetch(API + path, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "venture-experiment" },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.json()) as T;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const QUERIES: Record<PrRow["group"], string[]> = {
  "policy-closed": [
    'is:pr is:closed is:unmerged "AIToolPolicy" created:2025-06-01..2026-11-01',
    'is:pr is:closed is:unmerged "policy on tool-generated content" created:2025-06-01..2026-11-01',
    'is:pr is:closed is:unmerged "AI_POLICY.md" created:2025-06-01..2026-11-01',
    'is:pr is:closed is:unmerged "AI slop" in:comments created:2025-06-01..2026-11-01',
  ],
  "newcomer-merged": [
    'repo:llvm/llvm-project is:pr is:merged "Thank you for submitting a Pull Request (PR) to the LLVM Project" created:2025-06-01..2026-11-01',
  ],
  "newcomer-closed": [
    'repo:llvm/llvm-project is:pr is:closed is:unmerged "Thank you for submitting a Pull Request (PR) to the LLVM Project" -"tool-generated content" created:2025-06-01..2026-11-01',
  ],
};

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN required");
  const perGroup = Number(process.argv[process.argv.indexOf("--per-group") + 1] || 120);
  const rows: PrRow[] = [];
  const notes: string[] = [];
  const seen = new Set<string>();
  for (const [group, queries] of Object.entries(QUERIES) as [PrRow["group"], string[]][]) {
    const items: { html_url: string; user: { login: string }; number: number; repository_url: string }[] = [];
    for (const q of queries) {
      for (let page = 1; page <= 4 && items.length < perGroup; page++) {
        const r = await gh<{ items: typeof items }>(`/search/issues?q=${encodeURIComponent(q)}&per_page=50&page=${page}&sort=created&order=desc`);
        for (const it of r.items) if (!seen.has(it.html_url) && items.length < perGroup) { seen.add(it.html_url); items.push(it); }
        if (r.items.length < 50) break;
        await sleep(2500);
      }
      await sleep(2500);
    }
    notes.push(`${group}: ${items.length} PR(s) sampled`);
    for (const it of items) {
      const repo = it.repository_url.replace(`${API}/repos/`, "");
      try {
        const [issueC, reviewC] = await Promise.all([
          gh<Comment[]>(`/repos/${repo}/issues/${it.number}/comments?per_page=100`),
          gh<Comment[]>(`/repos/${repo}/pulls/${it.number}/comments?per_page=100`),
        ]);
        rows.push({ url: it.html_url, group, author: it.user.login, ...analysePr(it.user.login, [...issueC, ...reviewC]) });
      } catch (e) {
        notes.push(`skipped ${it.html_url}: ${(e as Error).message}`);
        if (String(e).includes("403")) break;
      }
    }
  }
  const stats = (["policy-closed", "newcomer-merged", "newcomer-closed"] as const).map((g) => summarise(rows, g));
  const v = verdict(stats[0], stats[1]);
  const out = join(process.cwd(), "research/experiments/exp-followup-engagement-retrospective");
  mkdirSync(out, { recursive: true });
  const executedAt = new Date().toISOString();
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-followup-engagement-retrospective", executedAt, queries: QUERIES, stats, verdict: v, notes, rows }, null, 2) + "\n");
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const summary = [
    `# Result: exp-followup-engagement-retrospective`,
    ``,
    `Executed ${executedAt} in GitHub Actions on public GitHub data.`,
    ``,
    ...stats.map((s) => `- ${s.group}: ${s.replied} of ${s.withHumanComment} PRs with a human comment got an author reply (reply rate ${pct(s.replyRate)}, 95% CI ${s.ci95 ? `${pct(s.ci95[0])}–${pct(s.ci95[1])}` : "n/a"}; sampled ${s.sampled}).`),
    ``,
    `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`,
    ``,
    `Caveats: group membership is inferred from comment text found by GitHub search. The control group comes from LLVM only, while the policy-closed group spans many repositories.`,
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), summary + "\n");
  console.log(summary);
}

if (process.argv[1]?.endsWith("followup-engagement.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
