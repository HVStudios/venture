/**
 * Deterministic signal collectors over free public APIs. No LLM involved.
 * They gather raw, unreviewed items (with real URLs and verbatim excerpts)
 * that later become the document pool for Scouts.
 *
 * Retrieved text is untrusted data. It is stored and displayed as text only.
 */
import type { Signal, Theme } from "../../core/schema";
import { slug } from "../../core/ids";

export type Fetcher = (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export interface Collector {
  name: string;
  collect(theme: Theme, perQuery: number, fetcher: Fetcher, now: Date): Promise<Signal[]>;
}

const clip = (s: string, n = 1200) => (s.length > n ? s.slice(0, n) + "…" : s);
const UA = { "User-Agent": "venture-research-bot (+https://github.com/HVStudios/venture)" };

export function stripMarkup(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------ Hacker News (Algolia)
type HnHit = { objectID: string; title?: string; story_text?: string; comment_text?: string; points?: number; num_comments?: number; created_at?: string; url?: string };
export const hackerNews: Collector = {
  name: "hackernews",
  async collect(theme, perQuery, fetcher, now) {
    const out: Signal[] = [];
    for (const kw of theme.keywords) {
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(kw)}&tags=story&hitsPerPage=${perQuery}`;
      const res = await fetcher(url, { headers: UA });
      if (!res.ok) throw new Error(`hackernews ${res.status}`);
      const data = (await res.json()) as { hits: HnHit[] };
      for (const h of data.hits) {
        if (!h.title) continue;
        out.push({
          id: `sig-hn-${h.objectID}`,
          collector: "hackernews",
          themeId: theme.id,
          url: `https://news.ycombinator.com/item?id=${h.objectID}`,
          title: h.title,
          excerpt: clip(stripMarkup(h.story_text ?? h.title)),
          engagement: (h.points ?? 0) + (h.num_comments ?? 0),
          engagementLabel: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`,
          createdAt: h.created_at,
          retrievedAt: now.toISOString(),
          triage: "new",
          provenance: "real",
        });
      }
    }
    return out;
  },
};

// ------------------------------------------------------------ GitHub issues
type GhIssue = { id: number; html_url: string; title: string; body?: string | null; comments: number; reactions?: { total_count: number }; created_at: string };
export const githubIssues: Collector = {
  name: "github-issues",
  async collect(theme, perQuery, fetcher, now) {
    const out: Signal[] = [];
    const headers: Record<string, string> = { ...UA, Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    for (const kw of theme.keywords) {
      const q = `${kw} is:issue sort:reactions-+1`;
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=${perQuery}`;
      const res = await fetcher(url, { headers });
      if (!res.ok) throw new Error(`github ${res.status}`);
      const data = (await res.json()) as { items: GhIssue[] };
      for (const i of data.items) {
        out.push({
          id: `sig-gh-${i.id}`,
          collector: "github-issues",
          themeId: theme.id,
          url: i.html_url,
          title: i.title,
          excerpt: clip(stripMarkup(i.body ?? "")),
          engagement: (i.reactions?.total_count ?? 0) + i.comments,
          engagementLabel: `${i.reactions?.total_count ?? 0} reactions · ${i.comments} comments`,
          createdAt: i.created_at,
          retrievedAt: now.toISOString(),
          triage: "new",
          provenance: "real",
        });
      }
    }
    return out;
  },
};

// ------------------------------------------------------------ Stack Exchange
type SeItem = { question_id: number; link: string; title: string; score: number; answer_count: number; creation_date: number; body?: string };
export const stackOverflow: Collector = {
  name: "stackoverflow",
  async collect(theme, perQuery, fetcher, now) {
    const out: Signal[] = [];
    for (const kw of theme.keywords) {
      const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=${encodeURIComponent(kw)}&site=stackoverflow&pagesize=${perQuery}&filter=withbody`;
      const res = await fetcher(url, { headers: UA });
      if (!res.ok) throw new Error(`stackoverflow ${res.status}`);
      const data = (await res.json()) as { items: SeItem[] };
      for (const q of data.items) {
        out.push({
          id: `sig-so-${q.question_id}`,
          collector: "stackoverflow",
          themeId: theme.id,
          url: q.link,
          title: stripMarkup(q.title),
          excerpt: clip(stripMarkup(q.body ?? "")),
          engagement: q.score + q.answer_count,
          engagementLabel: `${q.score} votes · ${q.answer_count} answers`,
          createdAt: new Date(q.creation_date * 1000).toISOString(),
          retrievedAt: now.toISOString(),
          triage: "new",
          provenance: "real",
        });
      }
    }
    return out;
  },
};

// ------------------------------------------------------------ arXiv
export function parseArxiv(xml: string, theme: Theme, now: Date): Signal[] {
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => {
    const pick = (tag: string) => stripMarkup(e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
    const idUrl = pick("id");
    return {
      id: `sig-arxiv-${slug(idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, ""), 40)}`,
      collector: "arxiv",
      themeId: theme.id,
      url: idUrl.replace(/^http:/, "https:"),
      title: pick("title"),
      excerpt: clip(pick("summary")),
      engagement: 0,
      engagementLabel: "preprint",
      createdAt: pick("published") || undefined,
      retrievedAt: now.toISOString(),
      triage: "new" as const,
      provenance: "real" as const,
    };
  });
}
export const arxiv: Collector = {
  name: "arxiv",
  async collect(theme, perQuery, fetcher, now) {
    const out: Signal[] = [];
    for (const kw of theme.keywords) {
      const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:"${kw}"`)}&sortBy=submittedDate&max_results=${perQuery}`;
      const res = await fetcher(url, { headers: UA });
      if (!res.ok) throw new Error(`arxiv ${res.status}`);
      out.push(...parseArxiv(await res.text(), theme, now));
    }
    return out;
  },
};

export const COLLECTORS: Collector[] = [hackerNews, githubIssues, stackOverflow, arxiv];

/** Merge new signals into existing ones; keeps triage state, refreshes engagement. */
export function mergeSignals(existing: Signal[], incoming: Signal[], maxPerTheme: number): Signal[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const s of incoming) {
    const prev = byId.get(s.id);
    byId.set(s.id, prev ? { ...s, triage: prev.triage } : s);
  }
  const all = [...byId.values()];
  const themes = new Set(all.map((s) => s.themeId));
  const kept: Signal[] = [];
  for (const t of themes) {
    kept.push(
      ...all
        .filter((s) => s.themeId === t)
        .sort((a, b) => (a.triage === "promoted" ? -1 : 0) - (b.triage === "promoted" ? -1 : 0) || b.engagement - a.engagement)
        .slice(0, maxPerTheme),
    );
  }
  return kept;
}
