/**
 * Experiment exp-npm-structural-breaks (pre-registered in data/experiments.json
 * before any release data was collected).
 *
 * Replication of the exploratory finding from exp-npm-metadata-breaks on a
 * fresh population: structural release-contract rules only (no engines rule),
 * 400 popular npm packages that were NOT in the first study. Writes candidate
 * flags and a fixed-seed audit sample of 20 flags, at most one per package
 * family (npm scope, or the package name when unscoped), for a manual audit.
 *
 *   tsx src/experiments/npm-structural-breaks.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contractBreaks, releasePairs, sampleFixed, type Manifest, type Rule } from "./npm-metadata-breaks";

export const STRUCTURAL: Rule[] = ["exports-subpath-removed", "exports-map-added", "entry-removed", "switched-to-esm", "peer-added", "peer-tightened", "bin-removed"];
export const KEYWORDS = ["vue", "eslint", "test", "css", "database", "http"];
const REG = "https://registry.npmjs.org";

/** Package family: the npm scope, or the name itself when unscoped. */
export const family = (pkg: string) => (pkg.startsWith("@") ? pkg.split("/")[0] : pkg);

/** Fixed-seed sample with at most one flag per package family, so one release train can't dominate. */
export function sampleOnePerFamily<T extends { id: string; pkg: string }>(items: T[], n: number, seed = "venture-structural-2026-11-16"): T[] {
  const ordered = sampleFixed(items, items.length, seed);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of ordered) {
    if (seen.has(family(it.pkg))) continue;
    seen.add(family(it.pkg));
    out.push(it);
    if (out.length === n) break;
  }
  return out;
}

/** The pre-registered frequency part of the verdict. Precision comes from the audit. */
export function frequencyVerdict(share: number): "met" | "too-rare" {
  return share >= 0.05 ? "met" : "too-rare";
}

async function json<T>(url: string): Promise<T | null> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "venture-experiment" } }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return null;
}

async function main() {
  const to = "2026-11-04T00:00:00Z";
  const from = "2024-11-04T00:00:00Z";
  const studied = new Set((JSON.parse(readFileSync(join(process.cwd(), "research/experiments/exp-npm-publishing-practices/result.json"), "utf8")).rowsPopular as { name: string }[]).map((r) => r.name));
  const names: string[] = [];
  for (const k of KEYWORDS) {
    const r = await json<{ objects: { package: { name: string } }[] }>(`${REG}/-/v1/search?text=keywords:${k}&size=250&popularity=1.0&quality=0.0&maintenance=0.0`);
    for (const o of r?.objects ?? []) if (!studied.has(o.package.name) && !names.includes(o.package.name)) names.push(o.package.name);
  }
  const population = names.slice(0, 400);
  if (population.length < 200) throw new Error(`search returned only ${population.length} fresh packages; refusing to emit a result`);
  type Packument = { versions?: Record<string, Manifest>; time?: Record<string, string> };
  const flags: { id: string; pkg: string; from: string; to: string; rules: { rule: Rule; detail: string }[] }[] = [];
  let readable = 0;
  let pairsTotal = 0;
  const flagged = new Set<string>();
  for (const name of population) {
    const doc = await json<Packument>(`${REG}/${name.replace("/", "%2F")}`);
    if (!doc?.versions || !doc.time) continue;
    readable++;
    for (const [a, b] of releasePairs(doc.versions, doc.time, from, to)) {
      pairsTotal++;
      const rules = contractBreaks({ ...a, name }, { ...b, name }).filter((r) => STRUCTURAL.includes(r.rule));
      if (rules.length) {
        flags.push({ id: `${name}@${a.version}->${b.version}`, pkg: name, from: a.version, to: b.version, rules });
        flagged.add(name);
      }
    }
  }
  if (readable < 200) throw new Error(`only ${readable} packages readable; refusing to emit a result`);
  const perRule: Record<string, number> = {};
  for (const f of flags) for (const r of f.rules) perRule[r.rule] = (perRule[r.rule] ?? 0) + 1;
  const share = flagged.size / readable;
  const families = new Set(flags.map((f) => family(f.pkg))).size;
  const sample = sampleOnePerFamily(flags, 20);
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-npm-structural-breaks");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-npm-structural-breaks", executedAt, window: { from, to }, keywords: KEYWORDS, population, packagesRead: readable, releasePairs: pairsTotal, flaggedPairs: flags.length, packagesWithFlag: flagged.size, packageShare: share, flaggedFamilies: families, frequency: frequencyVerdict(share), perRule, auditSample: sample, flags }, null, 2) + "\n");
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const md = [
    "# Result (frequency part): exp-npm-structural-breaks",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on the public npm registry. Window: ${from.slice(0, 10)} to ${to.slice(0, 10)}. Fresh population: ${population.length} popular packages (keywords ${KEYWORDS.join(", ")}) not in exp-npm-metadata-breaks.`,
    "",
    `- Packages read: ${readable}. Minor/patch release pairs (major ≥ 1): ${pairsTotal}.`,
    `- Packages with at least one structural flag: ${flagged.size} (${pct(share)}), in ${families} package families. Frequency criterion (≥ 5%): ${frequencyVerdict(share)}.`,
    `- Flagged release pairs: ${flags.length} (${pct(pairsTotal ? flags.length / pairsTotal : 0)} of pairs).`,
    `- Flags per rule: ${Object.entries(perRule).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}.`,
    `- Audit sample: ${sample.length} flags, at most one per package family.`,
    "",
    "Verdict: pending. The pre-registered rule also requires the manual audit (see AUDIT.md).",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  writeFileSync(join(out, "AUDIT.md"), ["# Audit sample (fixed seed, one per package family): exp-npm-structural-breaks", "", "Criteria (same as exp-npm-metadata-breaks, fixed before judging): **genuine** = a user on a setup supported at release time can no longer install, import or run something that previously worked. **debatable** = affects only end-of-life Node lines, old patch levels within a supported line, or setups where npm merely warns. **not genuine** = a correction of already-wrong metadata, or a revert of something added by mistake.", "",
    ...sample.map((f, i) => `${i + 1}. \`${f.id}\`: ${f.rules.map((r) => r.detail).join("; ")}\n   - Judgement: _pending_`)].join("\n") + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("npm-structural-breaks.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
