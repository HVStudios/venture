/**
 * Source verification: re-fetch each cited URL and check that every quote
 * attributed to it still appears in the page text. Results are stored on the
 * source record and feed into evidence-strength weighting.
 */
import type { Memory, Source } from "../core/schema";
import { normalizeText } from "../core/validate";
import { stripMarkup, type Fetcher } from "./collectors";

export async function verifySource(source: Source, quotes: string[], fetcher: Fetcher, now: Date): Promise<Source["verification"]> {
  const checkedAt = now.toISOString();
  try {
    const res = await fetcher(source.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; venture-verifier)" }, redirect: "follow" });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return { status: "blocked", checkedAt, httpStatus: res.status, note: "site refused automated access" };
    }
    if (!res.ok) return { status: "unreachable", checkedAt, httpStatus: res.status };
    const text = normalizeText(stripMarkup(await res.text()));
    const missing = quotes.filter((q) => !text.includes(normalizeText(stripMarkup(q))));
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
