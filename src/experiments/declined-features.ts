/**
 * Experiment exp-declined-feature-requests (pre-registered in
 * data/experiments.json before any issue data was collected).
 *
 * In popular developer-tool repositories, collect highly upvoted feature
 * requests that maintainers closed as "not planned" in the past 3 years.
 * Sample 20 (fixed seed, at most one per repository) for a manual review of
 * whether each is a buildable, unserved add-on opportunity. Also records, as a
 * secondary measure, whether anyone in the thread offered to pay.
 *
 *   tsx src/experiments/declined-features.ts   (GitHub Actions; needs GITHUB_TOKEN)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sampleFixed } from "./npm-metadata-breaks";

export const TOPICS = ["developer-tools", "cli", "terminal", "editor", "testing", "devops"];
export const WINDOW = { from: "2023-11-16", to: "2026-11-16" };
export const MIN_UPVOTES = 20;

const FEATURE_LABEL = /feat|enhanc|request|suggest|proposal|idea|out.of.scope|wontfix|won't fix/i;
const FEATURE_TITLE = /\b(feature|support|add|allow|option|ability|request)\b/i;
const NOT_FEATURE_LABEL = /\b(bug|regression|crash|question|duplicate|invalid|spam)\b/i;

/** A closed issue that looks like a feature request rather than a bug or question. */
export function looksLikeFeature(title: string, labels: string[]): boolean {
  if (labels.some((l) => NOT_FEATURE_LABEL.test(l)) && !labels.some((l) => FEATURE_LABEL.test(l))) return false;
  return labels.some((l) => FEATURE_LABEL.test(l)) || FEATURE_TITLE.test(title);
}

const PAY = /\b(i'?d|i would|we'?d|we would|happy to|willing to|would gladly|i'?ll|we'?ll)\s+(gladly\s+|happily\s+)?pay\b|\bshut up and take my money\b|\b(put|offer|offering) (up )?a bounty\b/i;
/** A comment that offers money for the feature. */
export const offersToPay = (body: string) => PAY.test(body);

/** Fixed-seed sample with at most one issue per repository. */
export function sampleOnePerRepo<T extends { id: string; repo: string }>(items: T[], n: number, seed = "venture-declined-2026-11-16"): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of sampleFixed(items, items.length, seed)) {
    if (seen.has(it.repo)) continue;
    seen.add(it.repo);
    out.push(it);
    if (out.length === n) break;
  }
  return out;
}

const API = "https://api.github.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function gh<T>(path: string): Promise<T | null> {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(API + path, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "venture-experiment" } }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    await sleep(res?.status === 403 || res?.status === 429 ? 30_000 : 3000 * (i + 1));
  }
  return null;
}

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN required");
  type Repo = { full_name: string; stargazers_count: number; archived: boolean };
  const repos: Repo[] = [];
  for (const t of TOPICS) {
    const r = await gh<{ items: Repo[] }>(`/search/repositories?q=${encodeURIComponent(`topic:${t} stars:>10000 archived:false`)}&sort=stars&order=desc&per_page=15`);
    for (const x of r?.items ?? []) if (!repos.some((y) => y.full_name === x.full_name)) repos.push(x);
    await sleep(2500);
  }
  if (repos.length < 40) throw new Error(`only ${repos.length} repositories found; refusing to emit a result`);
  type Issue = { number: number; title: string; html_url: string; labels: { name: string }[]; reactions: { "+1": number }; comments: number; created_at: string; closed_at: string };
  const candidates: { id: string; repo: string; number: number; title: string; url: string; labels: string[]; upvotes: number; comments: number; createdAt: string; closedAt: string }[] = [];
  let scanned = 0;
  for (const repo of repos) {
    const q = `repo:${repo.full_name} is:issue is:closed reason:"not planned" created:${WINDOW.from}..${WINDOW.to}`;
    const r = await gh<{ items: Issue[] }>(`/search/issues?q=${encodeURIComponent(q)}&sort=reactions-%2B1&order=desc&per_page=10`);
    await sleep(2500);
    for (const it of r?.items ?? []) {
      scanned++;
      const labels = it.labels.map((l) => l.name);
      if (it.reactions["+1"] >= MIN_UPVOTES && looksLikeFeature(it.title, labels)) {
        candidates.push({ id: `${repo.full_name}#${it.number}`, repo: repo.full_name, number: it.number, title: it.title, url: it.html_url, labels, upvotes: it.reactions["+1"], comments: it.comments, createdAt: it.created_at.slice(0, 10), closedAt: it.closed_at?.slice(0, 10) });
      }
    }
  }
  const sample = sampleOnePerRepo(candidates, 20);
  type Comment = { body: string; author_association: string; created_at: string; user: { login: string } | null };
  const details = [];
  for (const s of sample) {
    const comments: Comment[] = [];
    for (let page = 1; page <= 5; page++) {
      const c = await gh<Comment[]>(`/repos/${s.repo}/issues/${s.number}/comments?per_page=100&page=${page}`);
      if (!c?.length) break;
      comments.push(...c);
      if (c.length < 100) break;
    }
    const maint = comments.filter((c) => ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.author_association));
    const payers = comments.filter((c) => offersToPay(c.body ?? ""));
    details.push({ ...s, commentsRead: comments.length, payOffers: payers.length, payOfferExamples: payers.slice(0, 2).map((c) => (c.body ?? "").slice(0, 300)), lastMaintainerComment: maint.length ? (maint[maint.length - 1].body ?? "").slice(0, 600) : null });
  }
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-declined-feature-requests");
  mkdirSync(out, { recursive: true });
  const withPay = details.filter((d) => d.payOffers > 0).length;
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-declined-feature-requests", executedAt, window: WINDOW, topics: TOPICS, minUpvotes: MIN_UPVOTES, repositories: repos.map((r) => r.full_name), issuesScanned: scanned, candidates: candidates.length, sample: details, candidatesList: candidates }, null, 2) + "\n");
  const md = [
    "# Result (automated part): exp-declined-feature-requests",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} via the GitHub API. Window: issues created ${WINDOW.from} to ${WINDOW.to}.`,
    "",
    `- Repositories (topics ${TOPICS.join(", ")}; ≥ 10,000 stars; not archived): ${repos.length}.`,
    `- Closed-as-not-planned issues read (top 10 by upvotes per repository): ${scanned}. Feature-like with ≥ ${MIN_UPVOTES} upvotes: ${candidates.length}.`,
    `- Review sample: ${details.length} (fixed seed, at most one per repository).`,
    `- Secondary: sampled threads with at least one comment offering to pay: ${withPay} of ${details.length}.`,
    "",
    "Verdict: pending. The pre-registered rule requires the manual review (see REVIEW.md).",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  writeFileSync(join(out, "REVIEW.md"), ["# Manual review: exp-declined-feature-requests", "",
    "Each sampled issue is an **opportunity** only if all four hold: (1) it is a genuine feature request, not a bug; (2) maintainers declined it (said they won't build it, or that it's out of scope), not merely closed it as stale or a duplicate; (3) it could be delivered as a separate add-on (extension, plugin, wrapper or companion tool) without forking the project; (4) no maintained third-party add-on doing it was found by a search of GitHub, npm and the tool's extension marketplace.", "",
    ...details.map((d, i) => `${i + 1}. [${d.id}](${d.url}): ${d.title.replace(/[\r\n]+/g, " ")} (${d.upvotes} upvotes, ${d.commentsRead} comments, pay offers: ${d.payOffers})\n   - Judgement: _pending_`)].join("\n") + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("declined-features.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
