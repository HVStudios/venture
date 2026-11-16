/**
 * Review aid for exp-declined-feature-requests (added after collection; it
 * changes no rule). For each sampled issue, records who closed it, the
 * close reason, labels, and the full comment thread, so the manual review can
 * judge "declined by maintainers" vs "closed as stale".
 *
 *   tsx src/experiments/declined-features-review.ts   (GitHub Actions; needs GITHUB_TOKEN)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.github.com";
async function gh<T>(path: string): Promise<T | null> {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(API + path, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "venture-experiment" } }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  return null;
}

async function main() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN required");
  const dir = join(process.cwd(), "research/experiments/exp-declined-feature-requests");
  const r = JSON.parse(readFileSync(join(dir, "result.json"), "utf8")) as { sample: { id: string; repo: string; number: number }[] };
  type Ev = { event: string; actor?: { login: string; type: string } | null; created_at: string; state_reason?: string | null; label?: { name: string } };
  type Cm = { user: { login: string; type: string } | null; author_association: string; created_at: string; body: string };
  const out = [];
  for (const s of r.sample) {
    const events: Ev[] = [];
    for (let p = 1; p <= 5; p++) {
      const e = await gh<Ev[]>(`/repos/${s.repo}/issues/${s.number}/timeline?per_page=100&page=${p}`);
      if (!e?.length) break;
      events.push(...e);
      if (e.length < 100) break;
    }
    const comments: Cm[] = [];
    for (let p = 1; p <= 5; p++) {
      const c = await gh<Cm[]>(`/repos/${s.repo}/issues/${s.number}/comments?per_page=100&page=${p}`);
      if (!c?.length) break;
      comments.push(...c);
      if (c.length < 100) break;
    }
    const closes = events.filter((e) => e.event === "closed").map((e) => ({ at: e.created_at, by: e.actor?.login ?? null, byType: e.actor?.type ?? null, reason: e.state_reason ?? null }));
    const labelsAdded = events.filter((e) => e.event === "labeled").map((e) => ({ at: e.created_at, label: e.label?.name, by: e.actor?.login ?? null }));
    out.push({ id: s.id, closes, labelsAdded, comments: comments.map((c) => ({ by: c.user?.login ?? null, byType: c.user?.type ?? null, association: c.author_association, at: c.created_at, body: (c.body ?? "").slice(0, 1500) })) });
  }
  writeFileSync(join(dir, "review-data.json"), JSON.stringify({ collectedAt: new Date().toISOString(), run: process.env.GITHUB_RUN_ID ?? null, issues: out }, null, 2) + "\n");
  console.log(`review data for ${out.length} issues`);
}

if (process.argv[1]?.endsWith("declined-features-review.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
