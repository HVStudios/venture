/**
 * Source verification: re-fetch each cited URL and check that every quote
 * attributed to it still appears in the page text. Results are stored on the
 * source record and feed into evidence-strength weighting.
 */
import type { Memory, Source } from "../core/schema";
import { normalizeText } from "../core/validate";
import { stripMarkup, type Fetcher } from "./collectors";

/**
 * Some pages render their text client-side. For well-known hosts, fetch a
 * machine-readable equivalent of the same content instead of the HTML shell.
 */
export function verificationTarget(url: string): { url: string; headers: Record<string, string>; json?: (d: unknown) => string } {
  const ua = { "User-Agent": "Mozilla/5.0 (compatible; venture-verifier)" };
  const issue = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull|discussions)\/(\d+)/);
  if (issue && !url.includes("/discussions/")) {
    const headers: Record<string, string> = { ...ua, Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    return {
      url: `https://api.github.com/repos/${issue[1]}/${issue[2]}/issues/${issue[3]}`,
      headers,
      json: (d) => `${(d as { title?: string }).title ?? ""}\n${(d as { body?: string }).body ?? ""}`,
    };
  }
  const blob = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (blob) return { url: `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`, headers: ua };
  return { url, headers: ua };
}

export async function verifySource(source: Source, quotes: string[], fetcher: Fetcher, now: Date): Promise<Source["verification"]> {
  const checkedAt = now.toISOString();
  try {
    const target = verificationTarget(source.url);
    const res = await fetcher(target.url, { headers: target.headers, redirect: "follow" });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { status: "blocked", checkedAt, httpStatus: res.status, note: "site refused automated access" };
    }
    if (!res.ok) return { status: "unreachable", checkedAt, httpStatus: res.status };
    const raw = target.json ? target.json(await res.json()) : await res.text();
    // Compare with markup removed on both sides (markdown emphasis included).
    const clean = (s: string) => normalizeText(stripMarkup(s).replace(/[*_`]/g, ""));
    const text = clean(raw);
    const missing = quotes.filter((q) => !text.includes(clean(q)));
    if (missing.length) {
      return {
        status: "quote-missing",
        checkedAt,
        httpStatus: res.status,
        note: `${missing.length}/${quotes.length} quote(s) not found in fetched page (may be rendered client-side)`,
      };
    }
    return { status: "ok", checkedAt, httpStatus: res.status, note: `${quotes.length} quote(s) found` };
  } catch (e) {
    return { status: "unreachable", checkedAt, note: e instanceof Error ? e.message.slice(0, 120) : "fetch failed" };
  }
}

export async function verifyAll(memory: Memory, fetcher: Fetcher, now: Date, onlyStale = false): Promise<Record<string, number>> {
  const tally: Record<string, number> = {};
  for (const source of memory.sources) {
    if (onlyStale && source.verification.status === "ok") continue;
    const quotes = memory.evidence.filter((e) => e.sourceId === source.id).map((e) => e.quote);
    source.verification = await verifySource(source, quotes.length ? quotes : [source.excerpt.slice(0, 80)], fetcher, now);
    tally[source.verification.status] = (tally[source.verification.status] ?? 0) + 1;
  }
  return tally;
}
