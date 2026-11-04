/**
 * Experiment exp-npm-publishing-practices (pre-registered in
 * data/experiments.json before data collection).
 *
 * What share of popular npm packages published their latest release with
 * neither trusted publishing (OIDC) nor staged human approval, i.e. in a way
 * a stolen long-lived token could reproduce?
 *
 *   tsx src/experiments/publishing-practices.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wilson } from "./followup-engagement";

export type Practice = "staged-approval" | "trusted-publisher" | "neither";

export interface NpmUser {
  name?: string;
  trustedPublisher?: unknown;
  approver?: unknown;
}

/** Staged approval implies a human 2FA step, so it takes precedence. */
export function practiceOf(user: NpmUser | undefined): Practice {
  if (user?.approver) return "staged-approval";
  if (user?.trustedPublisher) return "trusted-publisher";
  return "neither";
}

export function practicesVerdict(neitherShare: number | null, n: number) {
  if (neitherShare === null || n < 200) return { result: "inconclusive" as const, reason: `only ${n} package(s) could be read; need ≥200` };
  const pct = `${(neitherShare * 100).toFixed(1)}%`;
  if (neitherShare >= 0.4) return { result: "supported" as const, reason: `${pct} of popular packages' latest releases used neither trusted publishing nor staged approval (≥ 40%)` };
  if (neitherShare < 0.15) return { result: "refuted" as const, reason: `only ${pct} used neither (< 15%)` };
  return { result: "inconclusive" as const, reason: `${pct} is between the 15% and 40% thresholds` };
}

const REG = "https://registry.npmjs.org";
const enc = (name: string) => name.replace("/", "%2F");
async function json<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "venture-experiment" } }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    if (res && res.status === 404) return null;
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return null;
}

async function classify(name: string) {
  const tags = await json<Record<string, string>>(`${REG}/-/package/${enc(name)}/dist-tags`);
  const latest = tags?.latest;
  if (!latest) return null;
  const v = await json<{ _npmUser?: NpmUser; dist?: { attestations?: unknown } }>(`${REG}/${enc(name)}/${latest}`);
  if (!v) return null;
  return { name, version: latest, practice: practiceOf(v._npmUser), provenance: !!v.dist?.attestations };
}

function summarise(rows: { practice: Practice }[]) {
  const n = rows.length;
  const count = (p: Practice) => rows.filter((r) => r.practice === p).length;
  const neither = count("neither");
  return {
    n,
    stagedApproval: count("staged-approval"),
    trustedPublisher: count("trusted-publisher"),
    neither,
    neitherShare: n ? neither / n : null,
    neitherCi95: n ? wilson(neither, n) : null,
  };
}

async function main() {
  const keywords = ["javascript", "typescript", "react", "node", "cli", "util"];
  const names: string[] = [];
  for (const k of keywords) {
    const r = await json<{ objects: { package: { name: string } }[] }>(`${REG}/-/v1/search?text=keywords:${k}&size=250&popularity=1.0&quality=0.0&maintenance=0.0`);
    for (const o of r?.objects ?? []) if (!names.includes(o.package.name)) names.push(o.package.name);
  }
  const popular = names.slice(0, 400);
  if (popular.length < 200) throw new Error(`search returned only ${popular.length} packages; refusing to emit a verdict`);
  const rowsA = [];
  for (const n of popular) {
    const r = await classify(n);
    if (r) rowsA.push(r);
  }
  const campaignFile = join(process.cwd(), "research/experiments/exp-publish-anomaly-campaign-replication/result.json");
  const hijacked: string[] = existsSync(campaignFile) ? (JSON.parse(readFileSync(campaignFile, "utf8")).campaigns as { pkg: string }[]).map((c) => c.pkg) : [];
  const rowsB = [];
  for (const n of hijacked) {
    const r = await classify(n);
    if (r) rowsB.push(r);
  }
  const A = summarise(rowsA);
  const B = summarise(rowsB);
  const v = practicesVerdict(A.neitherShare, A.n);
  const executedAt = new Date().toISOString();
  const out = join(process.cwd(), "research/experiments/exp-npm-publishing-practices");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "result.json"), JSON.stringify({ experiment: "exp-npm-publishing-practices", executedAt, keywords, popular: A, hijacked: B, verdict: v, rowsPopular: rowsA, rowsHijacked: rowsB }, null, 2) + "\n");
  const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
  const line = (label: string, s: ReturnType<typeof summarise>) =>
    `- ${label}: ${s.n} packages read. Staged with human approval: ${s.stagedApproval}; trusted publishing (OIDC) only: ${s.trustedPublisher}; neither: ${s.neither} (${pct(s.neitherShare)}${s.neitherCi95 ? `, 95% CI ${pct(s.neitherCi95[0])}–${pct(s.neitherCi95[1])}` : ""}).`;
  const md = [
    "# Result: exp-npm-publishing-practices",
    "",
    `Executed ${executedAt} ${process.env.GITHUB_ACTIONS ? `in GitHub Actions (run ${process.env.GITHUB_RUN_ID})` : "locally"} on the public npm registry.`,
    "",
    line("Popular packages (latest release)", A),
    line("Previously hijacked packages (latest release)", B),
    "",
    `Verdict (pre-registered rule): ${v.result}: ${v.reason}.`,
    "",
    "Caveats: 'neither' includes interactive publishes protected by 2FA, which the registry metadata doesn't distinguish from token publishes, so it is an upper bound on exposure to stolen tokens. Popularity comes from the npm search API's ranking for six broad keywords.",
  ].join("\n");
  writeFileSync(join(out, "RESULT.md"), md + "\n");
  console.log(md);
}

if (process.argv[1]?.endsWith("publishing-practices.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
