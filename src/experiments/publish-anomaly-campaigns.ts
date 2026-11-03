/**
 * Experiment exp-publish-anomaly-campaign-replication (pre-registered in
 * data/experiments.json before execution).
 *
 * Same question as exp-publish-anomaly-retrospective, but the unit of
 * analysis is the attack campaign, not the package: one representative per
 * campaign, so a single worm wave can't dominate the result.
 *
 *   tsx src/experiments/publish-anomaly-campaigns.ts
 * Needs a sparse checkout of ossf/malicious-packages (osv/malicious/npm).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wilson } from "./followup-engagement";
import { classify, releaseSignals, type Mechanism, type VersionMeta } from "./publish-anomaly";

export interface Osv {
  id: string;
  published?: string;
  modified?: string;
  summary?: string;
  details?: string;
  affected?: { package: { ecosystem: string; name: string }; versions?: string[] }[];
}

export const HIJACK =
  /compromised (npm |maintainer |publisher )?(account|token|credentials)|account (was |had been )?compromised|compromised (version|release|branch)|legitimate package|hijack|account takeover|taken over|stolen (npm |publish )?token|supply[- ]chain (attack|compromise)|trojanized/i;

/**
 * Campaign grouping: an explicit campaign identifier, else a named campaign
 * (from a fixed list of specific names) mentioned in the report, else the
 * publish day (reports of one wave are
 * typically filed together).
 */
export function campaignKey(osv: Osv): { key: string; basis: "identifier" | "named" | "day" } {
  const t = `${osv.summary ?? ""}\n${osv.details ?? ""}`;
  const ident = t.match(/campaign identifier[^"“]*["“]([^"”]+)["”]/i);
  if (ident) return { key: `id:${ident[1].toLowerCase()}`, basis: "identifier" };
  // Only specific campaign names; generic phrases ("supply chain worm", "attack campaign") would merge unrelated attacks.
  const named = t.match(/\b(shai[- ]?hulud|miasma|teampcp|glassworm|ironworm|s1ngularity)\b/i);
  if (named) return { key: `named:${named[1].toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim()}`, basis: "named" };
  return { key: `day:${(osv.published ?? osv.modified ?? "").slice(0, 10)}`, basis: "day" };
}

/** Pre-registered rule for the replication. */
export function campaignVerdict(share: number | null, classifiable: number) {
  if (share === null || classifiable < 15) return { result: "inconclusive" as const, reason: `only ${classifiable} classifiable campaign(s); need ≥15` };
  if (share >= 0.6) return { result: "supported" as const, reason: `${(share * 100).toFixed(1)}% of classifiable campaigns carry a dependency or install-hook signal (≥ 60%)` };
  if (share < 0.4) return { result: "refuted" as const, reason: `${(share * 100).toFixed(1)}% of classifiable campaigns carry such a signal (< 40%)` };
  return { result: "inconclusive" as const, reason: `${(share * 100).toFixed(1)}% is between the 40% and 60% thresholds` };
}

async function registryDoc(name: string) {
  const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, { headers: { "User-Agent": "venture-experiment" } });
  return res.ok ? ((await res.json()) as { versions?: Record<string, VersionMeta>; time?: Record<string, string> }) : null;
}

async function main() {
  const root = process.env.MALICIOUS_PACKAGES_DIR ?? "/tmp/malicious-packages/osv/malicious/npm";
  if (!existsSync(root)) throw new Error(`dataset not found at ${root}`);
  const reports: { osv: Osv; when: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json")) {
        const t = readFileSync(p, "utf8");
        if (!HIJACK.test(t)) continue;
        const osv = JSON.parse(t) as Osv;
        const when = osv.published ?? osv.modified ?? "";
        if (when >= "2024-01-01" && when <= "2026-11-02" && osv.affected?.[0]) reports.push({ osv, when });
      }
    }
  };
  walk(root);
  if (!reports.length) throw new Error("data acquisition returned no candidate reports; refusing to emit a verdict");

  // Group into campaigns; within each, members in chronological order.
  const groups = new Map<string, { basis: string; members: { osv: Osv; when: string }[] }>();
  for (const r of reports.sort((a, b) => a.when.localeCompare(b.when) || a.osv.id.localeCompare(b.osv.id))) {
    const { key, basis } = campaignKey(r.osv);
    if (!groups.has(key)) groups.set(key, { basis, members: [] });
    groups.get(key)!.members.push(r);
  }

  const campaigns: { key: string; basis: string; reports: number; representative: string; pkg: string; published: string; mechanism: Mechanism; matched?: string; legitVersions: number }[] = [];
  const fp: { pkg: string; pairs: number; either: number }[] = [];
  let lookups = 0;
  const LOOKUP_CAP = 2500;
  for (const [key, g] of groups) {
    // Representative: the earliest member that is a hijacked legitimate package.
    for (const r of g.members) {
      if (lookups >= LOOKUP_CAP) break;
      const name = r.osv.affected![0].package.name;
      const bad = new Set(r.osv.affected!.flatMap((a) => a.versions ?? []));
      lookups++;
      const doc = await registryDoc(name);
      await new Promise((res) => setTimeout(res, 150));
      if (!doc?.versions) continue;
      const legit = Object.values(doc.versions).filter((v) => !bad.has(v.version));
      if (legit.length < 10) continue;
      const c = classify(`${r.osv.summary ?? ""}\n${r.osv.details ?? ""}`);
      campaigns.push({ key, basis: g.basis, reports: g.members.length, representative: r.osv.id, pkg: name, published: r.when, ...c, legitVersions: legit.length });
      const ordered = legit.filter((v) => doc.time?.[v.version]).sort((a, b) => doc.time![a.version].localeCompare(doc.time![b.version])).slice(-21);
      let either = 0;
      for (let i = 1; i < ordered.length; i++) {
        const s = releaseSignals(ordered[i - 1], ordered[i]);
        either += +(s.newDependency || s.newInstallScript);
      }
      fp.push({ pkg: name, pairs: Math.max(0, ordered.length - 1), either });
      break;
    }
  }
  if (!campaigns.length) throw new Error("no campaign had a hijacked legitimate package; refusing to emit a verdict");

  const classifiable = campaigns.filter((c) => c.mechanism !== "unknown");
  const signal = classifiable.filter((c) => c.mechanism === "install-hook" || c.mechanism === "new-dependency");
  const share = classifiable.length ? signal.length / classifiable.length : null;
  const pairs = fp.reduce((a, b) => a + b.pairs, 0);
  const either = fp.reduce((a, b) => a + b.either, 0);
  const v = campaignVerdict(share, classifiable.length);
  const byMech = Object.fromEntries((["install-hook", "new-dependency", "file-modification", "unknown"] as Mechanism[]).map((m) => [m, campaigns.filter((c) => c.mechanism === m).length]));
  const byBasis = Object.fromEntries(["identifier", "named", "day"].map((b) => [b, campaigns.filter((c) => c.basis === b).length]));
  const notes = [
    `${reports.length} candidate report(s) 2024-01-01..2026-11-02 grouped into ${groups.size} campaign(s)`,
    `${lookups} registry lookup(s)${lookups >= LOOKUP_CAP ? " (cap reached: some campaigns were not examined)" : ""}`,
    `campaign grouping basis among analysed campaigns: ${Object.entries(byBasis).map(([k, n]) => `${k} ${n}`).join(", ")}`,
  ];
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-publish-anomaly-campaign-replication");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-publish-anomaly-campaign-replication", executedAt, notes, byMechanism: byMech, share, shareCi95: share === null ? null : wilson(signal.length, classifiable.length), fpRate: pairs ? either / pairs : null, verdict: v, campaigns, falsePositiveBaseline: fp }, null, 2) + "\n");
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const ci = share === null ? null : wilson(signal.length, classifiable.length);
  const md = [
    "# Result: exp-publish-anomaly-campaign-replication",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on OpenSSF malicious-packages reports and the public npm registry.`,
    "",
    `- Independent campaigns with a hijacked legitimate npm package: ${campaigns.length} (mechanisms: ${Object.entries(byMech).map(([k, n]) => `${k} ${n}`).join(", ")}).`,
    `- Campaigns with a new-dependency or install-hook signal: ${signal.length} of ${classifiable.length} classifiable (${pct(share)}${ci ? `, 95% CI ${pct(ci[0])}–${pct(ci[1])}` : ""}).`,
    `- Legitimate consecutive releases of the representative packages that add a dependency or install script: ${either} of ${pairs} (${pct(pairs ? either / pairs : null)}).`,
    "",
    `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`,
    "",
    `Notes: ${notes.join("; ")}.`,
    "",
    "Caveats: campaigns are grouped heuristically (explicit identifier, named campaign, else publish day). Mechanisms are classified by keyword rules over report text. npm only.",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("publish-anomaly-campaigns.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
