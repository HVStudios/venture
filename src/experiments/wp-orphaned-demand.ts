/**
 * Experiment exp-wp-orphaned-demand (pre-registered in data/experiments.json
 * before any directory data was collected).
 *
 * Among the 10,000 most popular WordPress.org plugins, find "orphaned demand":
 * plugins not updated for 24 months that still have ≥ 10,000 active installs
 * and are still downloaded (≥ 300 downloads in the last 30 days, which for a
 * plugin without updates are mostly new installs). For each, look for a
 * maintained alternative among the scanned plugins (sharing ≥ 2 tags, updated
 * in the last 12 months, ≥ 50% of the orphan's active installs). Writes the
 * candidates and a review sheet for the pre-registered manual check.
 *
 *   tsx src/experiments/wp-orphaned-demand.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface WpPlugin {
  slug: string;
  name: string;
  active_installs: number;
  last_updated: string; // "2024-01-05 3:12pm GMT"
  tags: Record<string, string> | string[];
  rating?: number;
  num_ratings?: number;
  support_threads?: number;
  support_threads_resolved?: number;
  tested?: string;
}

export const AS_OF = "2026-11-16T00:00:00Z";
export const THRESHOLDS = { orphanMonths: 24, minInstalls: 10_000, minDownloads30d: 300, maintainedMonths: 12, altInstallShare: 0.5, minSharedTags: 2 };

/** "2024-01-05 3:12pm GMT" → epoch ms (date part only). */
export function updatedAt(p: Pick<WpPlugin, "last_updated">): number {
  return Date.parse(`${p.last_updated.slice(0, 10)}T00:00:00Z`);
}

const monthsBefore = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.getTime();
};

export const tagList = (p: Pick<WpPlugin, "tags">) => (Array.isArray(p.tags) ? p.tags : Object.keys(p.tags ?? {}));

export function isOrphaned(p: WpPlugin, asOf = AS_OF): boolean {
  return p.active_installs >= THRESHOLDS.minInstalls && updatedAt(p) < monthsBefore(asOf, THRESHOLDS.orphanMonths);
}

export function maintainedAlternatives(orphan: WpPlugin, all: WpPlugin[], asOf = AS_OF): WpPlugin[] {
  const tags = new Set(tagList(orphan));
  const fresh = monthsBefore(asOf, THRESHOLDS.maintainedMonths);
  return all.filter(
    (q) =>
      q.slug !== orphan.slug &&
      updatedAt(q) >= fresh &&
      q.active_installs >= orphan.active_installs * THRESHOLDS.altInstallShare &&
      tagList(q).filter((t) => tags.has(t)).length >= THRESHOLDS.minSharedTags,
  );
}

export const sum30 = (daily: Record<string, string | number>) =>
  Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .reduce((s, [, v]) => s + Number(v || 0), 0);

async function json<T>(url: string): Promise<T | null> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "venture-experiment" } }).catch(() => null);
    if (res?.ok) return (await res.json().catch(() => null)) as T | null;
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return null;
}

async function main() {
  const API = "https://api.wordpress.org/plugins/info/1.2/";
  const fields = ["active_installs", "last_updated", "tags", "rating", "num_ratings", "support_threads", "support_threads_resolved", "tested"].map((f) => `request[fields][${f}]=1`).join("&");
  const all: WpPlugin[] = [];
  for (let page = 1; page <= 40; page++) {
    const r = await json<{ plugins: WpPlugin[] }>(`${API}?action=query_plugins&request[browse]=popular&request[per_page]=250&request[page]=${page}&${fields}`);
    for (const p of r?.plugins ?? []) if (!all.some((q) => q.slug === p.slug)) all.push(p);
  }
  if (all.length < 8000) throw new Error(`only ${all.length} plugins listed; refusing to emit a result`);
  const orphans = all.filter((p) => isOrphaned(p));
  const rows = [];
  for (const o of orphans) {
    const daily = await json<Record<string, string | number>>(`https://api.wordpress.org/stats/plugin/1.0/downloads.php?slug=${encodeURIComponent(o.slug)}&limit=30`);
    const downloads30d = daily ? sum30(daily) : null;
    const alts = maintainedAlternatives(o, all);
    rows.push({ slug: o.slug, name: o.name, activeInstalls: o.active_installs, lastUpdated: o.last_updated.slice(0, 10), tested: o.tested, rating: o.rating, numRatings: o.num_ratings, tags: tagList(o), downloads30d, alternatives: alts.slice(0, 5).map((a) => ({ slug: a.slug, activeInstalls: a.active_installs, lastUpdated: a.last_updated.slice(0, 10) })), alternativeCount: alts.length });
  }
  const live = rows.filter((r) => (r.downloads30d ?? 0) >= THRESHOLDS.minDownloads30d);
  const unserved = live.filter((r) => r.alternativeCount === 0);
  const review = [...live].sort((a, b) => (b.downloads30d ?? 0) - (a.downloads30d ?? 0)).slice(0, 10);
  const big = all.filter((p) => p.active_installs >= THRESHOLDS.minInstalls);
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-wp-orphaned-demand");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-wp-orphaned-demand", executedAt, asOf: AS_OF, thresholds: THRESHOLDS, scanned: all.length, withMinInstalls: big.length, orphaned: orphans.length, liveOrphans: live.length, unservedByTagRule: unserved.length, reviewSample: review.map((r) => r.slug), rows }, null, 2) + "\n");
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "n/a");
  const md = [
    "# Result (automated part): exp-wp-orphaned-demand",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on the public WordPress.org plugin API. As of ${AS_OF.slice(0, 10)}.`,
    "",
    `- Plugins scanned (most popular first): ${all.length}. With ≥ ${THRESHOLDS.minInstalls.toLocaleString("en")} active installs: ${big.length}.`,
    `- Orphaned (not updated for ${THRESHOLDS.orphanMonths} months, ≥ ${THRESHOLDS.minInstalls.toLocaleString("en")} installs): ${orphans.length} (${pct(orphans.length, big.length)} of plugins with that many installs).`,
    `- Still downloaded (≥ ${THRESHOLDS.minDownloads30d} downloads in the last 30 days): ${live.length}.`,
    `- Of those, with no maintained alternative by the tag rule: ${unserved.length}.`,
    "",
    "Verdict: pending. The pre-registered rule also requires a manual check of the 10 most-downloaded live orphans (see REVIEW.md).",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  writeFileSync(join(out, "REVIEW.md"), ["# Manual check: exp-wp-orphaned-demand", "", "For each of the 10 most-downloaded live orphans, a research session searches the directory for a maintained plugin (updated in the last 12 months) that does the same job for most users. **Unserved** = none found. **Served** = at least one found (named). Judged before any monetisation analysis.", "",
    ...review.map((r, i) => `${i + 1}. \`${r.slug}\` (${r.name}): ${r.activeInstalls.toLocaleString("en")} installs, last updated ${r.lastUpdated}, ${r.downloads30d} downloads in 30 days. Tag-rule alternatives: ${r.alternatives.map((a) => a.slug).join(", ") || "none"}.\n   - Judgement: _pending_`)].join("\n") + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("wp-orphaned-demand.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
