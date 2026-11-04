/**
 * Experiment exp-install-hook-watch-prospective (pre-registered in
 * data/experiments.json before any monitoring data was collected).
 *
 * Runs once a day (workflow "Install-hook watch"). Each run compares the
 * latest version of 400 popular npm packages with the last one seen and
 * records whether a new release added install scripts or dependencies.
 * State lives in research/experiments/exp-install-hook-watch-prospective/.
 * After 28 days it writes RESULT.md with the pre-registered verdict.
 *
 *   tsx src/experiments/install-hook-watch.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wilson } from "./followup-engagement";
import { releaseSignals, type VersionMeta } from "./publish-anomaly";

export interface Observation {
  pkg: string;
  from: string;
  to: string;
  seenAt: string;
  newDependency: boolean;
  newInstallScript: boolean;
  addedDependencies: string[];
}

export interface WatchState {
  experiment: "exp-install-hook-watch-prospective";
  startedAt: string;
  endsAt: string;
  packages: Record<string, string>;
  observations: Observation[];
  checks: { at: string; newReleases: number; failures: number }[];
  finishedAt?: string;
}

export function watchVerdict(releases: number, alerts: number) {
  if (releases < 300) return { result: "inconclusive" as const, reason: `only ${releases} release(s) observed; need ≥300` };
  const rate = alerts / releases;
  const pct = `${(rate * 100).toFixed(1)}%`;
  if (rate <= 0.05) return { result: "supported" as const, reason: `${pct} of releases would have triggered an alert (≤ 5%)` };
  if (rate > 0.15) return { result: "refuted" as const, reason: `${pct} of releases would have triggered an alert (> 15%)` };
  return { result: "inconclusive" as const, reason: `${pct} is between the 5% and 15% thresholds` };
}

export function summariseWatch(s: WatchState) {
  const releases = s.observations.length;
  const alerts = s.observations.filter((o) => o.newDependency || o.newInstallScript).length;
  const hooks = s.observations.filter((o) => o.newInstallScript).length;
  return { releases, alerts, hooks, rate: releases ? alerts / releases : null, ci95: releases ? wilson(alerts, releases) : null };
}

const REG = "https://registry.npmjs.org";
const enc = (n: string) => n.replace("/", "%2F");
async function json<T>(url: string): Promise<T | null> {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "venture-experiment" } }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    if (res?.status === 404) return null;
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  return null;
}

async function main() {
  const dir = join(process.cwd(), "research/experiments/exp-install-hook-watch-prospective");
  const stateFile = join(dir, "state.json");
  mkdirSync(dir, { recursive: true });
  const now = new Date();
  let state: WatchState;
  if (!existsSync(stateFile)) {
    const pop = JSON.parse(readFileSync(join(process.cwd(), "research/experiments/exp-npm-publishing-practices/result.json"), "utf8")).rowsPopular as { name: string; version: string }[];
    state = {
      experiment: "exp-install-hook-watch-prospective",
      startedAt: now.toISOString(),
      endsAt: new Date(now.getTime() + 28 * 86_400_000).toISOString(),
      packages: Object.fromEntries(pop.map((p) => [p.name, p.version])),
      observations: [],
      checks: [],
    };
    // Baseline: refresh to the current latest versions; no observations yet.
    for (const name of Object.keys(state.packages)) {
      const tags = await json<Record<string, string>>(`${REG}/-/package/${enc(name)}/dist-tags`);
      if (tags?.latest) state.packages[name] = tags.latest;
    }
    state.checks.push({ at: now.toISOString(), newReleases: 0, failures: 0 });
    writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
    console.log(`baseline recorded for ${Object.keys(state.packages).length} packages; watch ends ${state.endsAt}`);
    return;
  }
  state = JSON.parse(readFileSync(stateFile, "utf8")) as WatchState;
  if (state.finishedAt) {
    console.log("watch already finished");
    return;
  }
  let newReleases = 0;
  let failures = 0;
  for (const [name, prev] of Object.entries(state.packages)) {
    const tags = await json<Record<string, string>>(`${REG}/-/package/${enc(name)}/dist-tags`);
    const latest = tags?.latest;
    if (!latest) {
      failures++;
      continue;
    }
    if (latest === prev) continue;
    const [a, b] = await Promise.all([json<VersionMeta>(`${REG}/${enc(name)}/${prev}`), json<VersionMeta>(`${REG}/${enc(name)}/${latest}`)]);
    if (!a || !b) {
      failures++;
      state.packages[name] = latest;
      continue;
    }
    const s = releaseSignals(a, b);
    const prevDeps = new Set(Object.keys(a.dependencies ?? {}));
    state.observations.push({ pkg: name, from: prev, to: latest, seenAt: now.toISOString(), ...s, addedDependencies: Object.keys(b.dependencies ?? {}).filter((d) => !prevDeps.has(d)) });
    state.packages[name] = latest;
    newReleases++;
  }
  state.checks.push({ at: now.toISOString(), newReleases, failures });
  const sum = summariseWatch(state);
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const finished = now.toISOString() >= state.endsAt;
  const lines = [
    `# ${finished ? "Result" : "Interim status (not a verdict)"}: exp-install-hook-watch-prospective`,
    "",
    `Watching ${Object.keys(state.packages).length} popular npm packages from ${state.startedAt.slice(0, 10)} to ${state.endsAt.slice(0, 10)}; ${state.checks.length} daily check(s) so far.`,
    "",
    `- New releases observed: ${sum.releases}. Releases that would have triggered an alert (new install script or new dependency): ${sum.alerts} (${pct(sum.rate)}${sum.ci95 ? `, 95% CI ${pct(sum.ci95[0])}–${pct(sum.ci95[1])}` : ""}); of which new install scripts: ${sum.hooks}.`,
  ];
  if (finished) {
    const v = watchVerdict(sum.releases, sum.alerts);
    lines.push("", `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`, "", "Not yet done: cross-checking flagged releases against OpenSSF malicious-packages reports (a research-session step).");
    state.finishedAt = now.toISOString();
  }
  lines.push("", "Caveat: when several versions were published between two daily checks, only the latest is compared with the previous one seen.");
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
  writeFileSync(join(dir, finished ? "RESULT.md" : "STATUS.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

if (process.argv[1]?.endsWith("install-hook-watch.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
