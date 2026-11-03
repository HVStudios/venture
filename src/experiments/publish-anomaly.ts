/**
 * Experiment exp-publish-anomaly-retrospective (pre-registered in
 * data/experiments.json before execution).
 *
 * Do hijacked releases of legitimate packages carry simple structural signals
 * (a new dependency, or a new install-time hook) that a maintainer-side alarm
 * could detect, and how often do legitimate releases carry the same signals?
 *
 * Data: OpenSSF malicious-packages OSV reports (mechanism, from report text)
 * and the public npm registry (per-version dependencies and scripts).
 * Runs in GitHub Actions:  tsx src/experiments/publish-anomaly.ts [--max 60]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wilson } from "./followup-engagement";

export type Mechanism = "install-hook" | "new-dependency" | "file-modification" | "unknown";

const HOOK = /postinstall|preinstall|install script|lifecycle script|\.pth\b|setup\.py/i;
const DEP = /(new|added|adds|inject\w*|introduc\w*|malicious) (a )?(dependency|dependencies)|dependency (called|named|on)|added (as )?a dependency/i;
const MOD = /prepend\w*|modif\w*|injected (into|in)|appended|obfuscated code (in|to)|index\.js|tampered/i;

/** Classify an OSV report's free text. Priority: hook > dependency > modification. */
export function classify(text: string): { mechanism: Mechanism; matched?: string } {
  for (const [m, re] of [["install-hook", HOOK], ["new-dependency", DEP], ["file-modification", MOD]] as [Mechanism, RegExp][]) {
    const hit = text.match(re);
    if (hit) return { mechanism: m, matched: hit[0] };
  }
  return { mechanism: "unknown" };
}

export interface VersionMeta {
  version: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"];

/** Signals between two consecutive legitimate releases. */
export function releaseSignals(prev: VersionMeta, next: VersionMeta): { newDependency: boolean; newInstallScript: boolean } {
  const pd = new Set(Object.keys(prev.dependencies ?? {}));
  const newDependency = Object.keys(next.dependencies ?? {}).some((d) => !pd.has(d));
  const ps = prev.scripts ?? {};
  const newInstallScript = INSTALL_SCRIPTS.some((s) => next.scripts?.[s] && next.scripts[s] !== ps[s]);
  return { newDependency, newInstallScript };
}

export function verdict(signalShare: number | null, classifiable: number, fpRate: number | null) {
  if (classifiable < 15 || signalShare === null) return { result: "inconclusive" as const, reason: `only ${classifiable} classifiable incident(s); need ≥15` };
  if (signalShare < 0.4) return { result: "refuted" as const, reason: `${(signalShare * 100).toFixed(1)}% of incidents carry a dependency/hook signal (< 40%)` };
  if (signalShare >= 0.6 && fpRate !== null && fpRate < 0.1)
    return { result: "supported" as const, reason: `${(signalShare * 100).toFixed(1)}% of incidents carry a signal (≥ 60%) and ${(fpRate * 100).toFixed(1)}% of legitimate releases do (< 10%)` };
  return { result: "inconclusive" as const, reason: `signal share ${(signalShare * 100).toFixed(1)}%, legitimate-release signal rate ${fpRate === null ? "n/a" : (fpRate * 100).toFixed(1) + "%"}: between thresholds` };
}

// ------------------------------------------------------------------ execution
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getJson<T>(url: string): Promise<T | null> {
  const headers: Record<string, string> = { "User-Agent": "venture-experiment" };
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

interface Osv {
  id: string;
  published?: string;
  modified?: string;
  summary?: string;
  details?: string;
  affected?: { package: { ecosystem: string; name: string }; versions?: string[] }[];
}

async function main() {
  // The dataset is read from a local sparse checkout of ossf/malicious-packages
  // (the workflow clones it); GitHub code search is not available to Actions tokens.
  const max = Number(process.argv[process.argv.indexOf("--max") + 1] || 60);
  const root = process.env.MALICIOUS_PACKAGES_DIR ?? "/tmp/malicious-packages/osv/malicious/npm";
  if (!existsSync(root)) throw new Error(`dataset not found at ${root}`);
  const HIJACK = /compromis|hijack|account takeover|taken over|stolen (npm )?token|maintainer account/i;
  const paths = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json")) {
        const t = readFileSync(p, "utf8");
        if (HIJACK.test(t)) paths.add(p);
      }
    }
  };
  walk(root);
  const queries = [`local scan of ${root} for /${HIJACK.source}/i`];
  if (!paths.size) throw new Error("data acquisition returned no candidate reports; refusing to emit a verdict");
  const notes = [`${paths.size} candidate OSV report(s) mention a compromise or hijack`, "An earlier execution attempt (2026-11-03T22:51Z) used GitHub code search, got 0 results (not available to Actions tokens) and was discarded as a harness failure."];
  const incidents: { id: string; pkg: string; published?: string; mechanism: Mechanism; matched?: string; legitVersions: number }[] = [];
  const fp: { pkg: string; pairs: number; newDependency: number; newInstallScript: number; either: number }[] = [];
  for (const path of paths) {
    if (incidents.length >= max) break;
    const osv = JSON.parse(readFileSync(path, "utf8")) as Osv;
    if (!osv?.affected?.[0]) continue;
    const when = osv.published ?? osv.modified ?? "";
    if (when < "2025-06-01" || when > "2026-11-02") continue;
    const { name } = osv.affected[0].package;
    const bad = new Set(osv.affected.flatMap((a) => a.versions ?? []));
    const doc = await getJson<{ versions?: Record<string, VersionMeta>; time?: Record<string, string> }>(`https://registry.npmjs.org/${name.replace("/", "%2F")}`);
    if (!doc?.versions) continue;
    const legit = Object.values(doc.versions).filter((v) => !bad.has(v.version));
    if (legit.length < 10) continue; // typosquats / new malicious packages, not hijacks
    const c = classify(`${osv.summary ?? ""}\n${osv.details ?? ""}`);
    incidents.push({ id: osv.id, pkg: name, published: when, ...c, legitVersions: legit.length });
    // False-positive baseline: last 20 consecutive legitimate releases, ordered by publish time.
    const ordered = legit.filter((v) => doc.time?.[v.version]).sort((a, b) => doc.time![a.version].localeCompare(doc.time![b.version])).slice(-21);
    let nd = 0, ns = 0, ei = 0;
    for (let i = 1; i < ordered.length; i++) {
      const s = releaseSignals(ordered[i - 1], ordered[i]);
      nd += +s.newDependency; ns += +s.newInstallScript; ei += +(s.newDependency || s.newInstallScript);
    }
    fp.push({ pkg: name, pairs: Math.max(0, ordered.length - 1), newDependency: nd, newInstallScript: ns, either: ei });
    await sleep(300);
  }
  if (!incidents.length) throw new Error("no hijacked legitimate packages found among candidates; refusing to emit a verdict");
  const classifiable = incidents.filter((i) => i.mechanism !== "unknown");
  const withSignal = classifiable.filter((i) => i.mechanism === "install-hook" || i.mechanism === "new-dependency");
  const share = classifiable.length ? withSignal.length / classifiable.length : null;
  const pairs = fp.reduce((a, b) => a + b.pairs, 0);
  const either = fp.reduce((a, b) => a + b.either, 0);
  const fpRate = pairs ? either / pairs : null;
  const v = verdict(share, classifiable.length, fpRate);
  const byMech = Object.fromEntries((["install-hook", "new-dependency", "file-modification", "unknown"] as Mechanism[]).map((m) => [m, incidents.filter((i) => i.mechanism === m).length]));
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-publish-anomaly-retrospective");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-publish-anomaly-retrospective", executedAt, queries, notes, byMechanism: byMech, share, shareCi95: share === null ? null : wilson(withSignal.length, classifiable.length), fpRate, fpCi95: pairs ? wilson(either, pairs) : null, verdict: v, incidents, falsePositiveBaseline: fp }, null, 2) + "\n");
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const md = [
    "# Result: exp-publish-anomaly-retrospective",
    "",
    `Executed ${executedAt} in GitHub Actions on OpenSSF malicious-packages reports and the public npm registry.`,
    "",
    `- Hijacked legitimate npm packages analysed: ${incidents.length} (mechanisms: ${Object.entries(byMech).map(([k, n]) => `${k} ${n}`).join(", ")}).`,
    `- Incidents with a new-dependency or install-hook signal: ${withSignal.length} of ${classifiable.length} classifiable (${pct(share)}).`,
    `- Legitimate consecutive releases that add a dependency or install script: ${either} of ${pairs} (${pct(fpRate)}).`,
    "",
    `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`,
    "",
    "Caveats: mechanisms are classified by keyword rules over report text (matched phrases are in result.json for audit). Reports vary in detail. npm only.",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("publish-anomaly.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
