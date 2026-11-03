/**
 * Lightweight, dependency-free semantic-ish similarity used for
 * deduplication. TF-IDF cosine over stemmed tokens plus title bigrams.
 * It is a guard-rail, not an oracle: high-similarity pairs must be
 * explicitly resolved (merged, related, or justified via noveltyNote).
 */
const STOP = new Set(
  "a an the and or of for to in on with without by from into via is are be as at it its this that these those their them they we our you your can could should would will may might not no than then so such using use based tool tools system platform app".split(
    " ",
  ),
);

export function stem(word: string): string {
  let w = word;
  for (const suf of ["ations", "ation", "ings", "ing", "ies", "ers", "er", "ed", "es", "ly", "s"]) {
    if (w.length > suf.length + 3 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      if (suf === "ies") w += "y";
      break;
    }
  }
  return w;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

export interface Doc {
  id: string;
  text: string;
}

function termFreq(toks: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  // bigrams capture phrases like "flaky test"
  for (let i = 0; i + 1 < toks.length; i++) {
    const bg = `${toks[i]}_${toks[i + 1]}`;
    tf.set(bg, (tf.get(bg) ?? 0) + 1);
  }
  return tf;
}

export class SimilarityIndex {
  private vectors = new Map<string, Map<string, number>>();
  private df = new Map<string, number>();

  constructor(docs: Doc[]) {
    const tfs = docs.map((d) => [d.id, termFreq(tokens(d.text))] as const);
    for (const [, tf] of tfs) for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    const n = Math.max(docs.length, 1);
    for (const [id, tf] of tfs) {
      const v = new Map<string, number>();
      for (const [t, f] of tf) v.set(t, (1 + Math.log(f)) * Math.log(1 + n / (this.df.get(t) ?? 1)));
      this.vectors.set(id, v);
    }
  }

  similarity(a: string, b: string): number {
    const va = this.vectors.get(a);
    const vb = this.vectors.get(b);
    if (!va || !vb) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const [t, w] of va) {
      na += w * w;
      const wb = vb.get(t);
      if (wb) dot += w * wb;
    }
    for (const w of vb.values()) nb += w * w;
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  nearest(id: string, k = 5, min = 0): { id: string; score: number }[] {
    const out: { id: string; score: number }[] = [];
    for (const other of this.vectors.keys()) {
      if (other === id) continue;
      const score = this.similarity(id, other);
      if (score >= min) out.push({ id: other, score });
    }
    return out.sort((x, y) => y.score - x.score).slice(0, k);
  }
}

export function ideaText(idea: { title: string; summary: string; solution: string }): string {
  return `${idea.title} ${idea.title} ${idea.summary} ${idea.solution}`;
}

/** Above this, two ideas are presumed duplicates unless explicitly justified. */
export const DUPLICATE_THRESHOLD = 0.55;
/** Above this, ideas are surfaced as related. */
export const RELATED_THRESHOLD = 0.25;
