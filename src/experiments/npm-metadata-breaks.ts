/**
 * Experiment exp-npm-metadata-breaks (pre-registered in data/experiments.json
 * before any release data was collected).
 *
 * For 400 popular npm packages, find minor or patch releases from the past
 * 24 months whose package metadata changed the install/import contract in a
 * way that needs a major bump. The harness writes candidate flags and a
 * fixed-seed sample of 20 for a manual audit (AUDIT.md). The pre-registered
 * verdict needs both the frequency measurement and the audit.
 *
 *   tsx src/experiments/npm-metadata-breaks.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import semver from "semver";

export interface Manifest {
  version: string;
  engines?: Record<string, string>;
  exports?: unknown;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  type?: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  bin?: string | Record<string, string>;
  name?: string;
}

export type Rule = "engines-tightened" | "exports-subpath-removed" | "exports-map-added" | "entry-removed" | "switched-to-esm" | "peer-added" | "peer-tightened" | "bin-removed";

const minOf = (range?: string) => {
  if (!range) return null;
  try {
    return semver.minVersion(range);
  } catch {
    return null;
  }
};

function exportKeys(exp: unknown): string[] | null {
  if (exp === undefined || exp === null) return null;
  if (typeof exp === "string" || Array.isArray(exp)) return ["."];
  if (typeof exp === "object") {
    const keys = Object.keys(exp as object);
    // Conditions-only object ({ import, require }) means the root export.
    return keys.some((k) => k.startsWith(".")) ? keys.filter((k) => k.startsWith(".")) : ["."];
  }
  return null;
}

function binNames(m: Manifest): string[] {
  if (!m.bin) return [];
  if (typeof m.bin === "string") return [m.name ?? "(default)"];
  return Object.keys(m.bin);
}

/** Contract changes between two releases that would require a major version bump. */
export function contractBreaks(a: Manifest, b: Manifest): { rule: Rule; detail: string }[] {
  const out: { rule: Rule; detail: string }[] = [];
  const ea = minOf(a.engines?.node);
  const eb = minOf(b.engines?.node);
  if (eb && (!ea ? semver.gt(eb, "0.0.0") : semver.gt(eb, ea))) {
    out.push({ rule: "engines-tightened", detail: `engines.node ${a.engines?.node ?? "(none)"} → ${b.engines?.node}` });
  }
  const xa = exportKeys(a.exports);
  const xb = exportKeys(b.exports);
  if (xa && xb) {
    const removed = xa.filter((k) => !xb.includes(k) && !xb.some((p) => p.includes("*") && k.startsWith(p.split("*")[0])));
    if (removed.length) out.push({ rule: "exports-subpath-removed", detail: `exports removed: ${removed.slice(0, 5).join(", ")}` });
  } else if (!xa && xb) {
    out.push({ rule: "exports-map-added", detail: "exports map added (blocks deep imports that previously worked)" });
  }
  for (const f of ["main", "module", "types", "typings"] as const) {
    if (a[f] && !b[f] && !(f === "typings" && b.types) && !(f === "types" && b.typings)) out.push({ rule: "entry-removed", detail: `${f} field removed (was ${a[f]})` });
  }
  if (a.type !== "module" && b.type === "module") out.push({ rule: "switched-to-esm", detail: `type: ${a.type ?? "(commonjs)"} → module` });
  const pa = a.peerDependencies ?? {};
  const pb = b.peerDependencies ?? {};
  for (const [dep, range] of Object.entries(pb)) {
    if (!(dep in pa)) {
      if (!b.peerDependenciesMeta?.[dep]?.optional) out.push({ rule: "peer-added", detail: `new required peer ${dep}@${range}` });
    } else {
      const ma = minOf(pa[dep]);
      const mb = minOf(range);
      if (ma && mb && semver.major(mb) > semver.major(ma)) out.push({ rule: "peer-tightened", detail: `peer ${dep} ${pa[dep]} → ${range}` });
    }
  }
  const ba = binNames(a);
  const bb = binNames(b);
  const binRemoved = ba.filter((n) => !bb.includes(n));
  if (binRemoved.length) out.push({ rule: "bin-removed", detail: `bin removed: ${binRemoved.join(", ")}` });
  return out;
}

/** Minor/patch pairs within each major line (major ≥ 1), in publish order, inside the window. */
export function releasePairs(versions: Record<string, Manifest>, time: Record<string, string>, from: string, to: string): [Manifest, Manifest][] {
  const stable = Object.values(versions).filter((v) => semver.valid(v.version) && !semver.prerelease(v.version) && time[v.version]);
  const byMajor = new Map<number, Manifest[]>();
  for (const v of stable) {
    const mj = semver.major(v.version);
    if (mj < 1) continue; // 0.x: anything may change, per SemVer
    if (!byMajor.has(mj)) byMajor.set(mj, []);
    byMajor.get(mj)!.push(v);
  }
  const pairs: [Manifest, Manifest][] = [];
  for (const line of byMajor.values()) {
    line.sort((x, y) => time[x.version].localeCompare(time[y.version]));
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]];
      if (time[b.version] < from || time[b.version] > to) continue;
      if (semver.gt(b.version, a.version)) pairs.push([a, b]);
    }
  }
  return pairs;
}

/** Deterministic sample: sort by hash of a fixed seed and the id. */
export function sampleFixed<T extends { id: string }>(items: T[], n: number, seed = "venture-audit-2026-11-04"): T[] {
  const h = (s: string) => createHash("sha256").update(seed + s).digest("hex");
  return [...items].sort((x, y) => h(x.id).localeCompare(h(y.id))).slice(0, n);
}

async function main() {
  const to = "2026-11-04T00:00:00Z";
  const from = "2024-11-04T00:00:00Z";
  const popular = (JSON.parse(readFileSync(join(process.cwd(), "research/experiments/exp-npm-publishing-practices/result.json"), "utf8")).rowsPopular as { name: string }[]).map((r) => r.name);
  const flags: { id: string; pkg: string; from: string; to: string; rules: { rule: Rule; detail: string }[] }[] = [];
  let pairsTotal = 0;
  let readable = 0;
  const packagesWithFlag = new Set<string>();
  for (const name of popular) {
    type Packument = { versions?: Record<string, Manifest>; time?: Record<string, string> };
    let doc = null as Packument | null;
    for (let i = 0; i < 3 && !doc; i++) {
      const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, { headers: { "User-Agent": "venture-experiment" } }).catch(() => null);
      if (res?.ok) doc = (await res.json()) as Packument;
      else await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
    if (!doc?.versions || !doc.time) continue;
    readable++;
    for (const [a, b] of releasePairs(doc.versions, doc.time, from, to)) {
      pairsTotal++;
      const rules = contractBreaks({ ...a, name }, { ...b, name });
      if (rules.length) {
        flags.push({ id: `${name}@${a.version}->${b.version}`, pkg: name, from: a.version, to: b.version, rules });
        packagesWithFlag.add(name);
      }
    }
  }
  if (readable < 200) throw new Error(`only ${readable} packages readable; refusing to emit a result`);
  const perRule: Record<string, number> = {};
  for (const f of flags) for (const r of f.rules) perRule[r.rule] = (perRule[r.rule] ?? 0) + 1;
  const pkgShare = packagesWithFlag.size / readable;
  const sample = sampleFixed(flags, 20);
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-npm-metadata-breaks");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-npm-metadata-breaks", executedAt, window: { from, to }, packagesRead: readable, releasePairs: pairsTotal, flaggedPairs: flags.length, packagesWithFlag: packagesWithFlag.size, packageShare: pkgShare, perRule, auditSample: sample, flags }, null, 2) + "\n");
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const md = [
    "# Result (frequency part): exp-npm-metadata-breaks",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on the public npm registry. Window: ${from.slice(0, 10)} to ${to.slice(0, 10)}.`,
    "",
    `- Packages read: ${readable}. Minor/patch release pairs (major ≥ 1): ${pairsTotal}.`,
    `- Packages with at least one flagged minor/patch release: ${packagesWithFlag.size} (${pct(pkgShare)}).`,
    `- Flagged release pairs: ${flags.length} (${pct(pairsTotal ? flags.length / pairsTotal : 0)} of pairs).`,
    `- Flags per rule: ${Object.entries(perRule).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}.`,
    "",
    "Verdict: pending. The pre-registered rule also requires a manual audit of 20 sampled flags (see AUDIT.md).",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  writeFileSync(join(out, "AUDIT.md"), ["# Audit sample (fixed seed): exp-npm-metadata-breaks", "", "Each flag is to be judged *genuine* (a real breaking change for some users, per SemVer) or *not genuine*, with a reason.", "",
    ...sample.map((f, i) => `${i + 1}. \`${f.id}\`: ${f.rules.map((r) => r.detail).join("; ")}\n   - Judgement: _pending_`)].join("\n") + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("npm-metadata-breaks.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
