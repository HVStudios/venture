import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyMemory, type Theme } from "../src/core/schema";
import { validateMemory } from "../src/core/validate";
import { isRelevant, mergeSignals, parseArxiv, stripMarkup } from "../src/engine/collectors";
import { ingestBundle } from "../src/engine/ingest";
import { runPipeline, type PoolItem } from "../src/engine/pipeline";
import { AnthropicProvider } from "../src/engine/providers/anthropic";
import { MockProvider } from "../src/engine/providers/mock";
import { RecordingProvider, ReplayProvider } from "../src/engine/providers/replay";
import type { CompletionRequest, ModelProvider } from "../src/engine/providers/types";
import { loadRaw, saveMemory } from "../src/engine/store";
import { verificationTarget, verifySource } from "../src/engine/verify";

const theme: Theme = { id: "theme-t", name: "Test theme", description: "Testing the pipeline", mode: "focused", keywords: ["flaky"], status: "active", createdAt: "2026-11-03", provenance: "fixture" };
const pool: PoolItem[] = [
  { poolId: "doc-a", url: "https://example.com/a", title: "Flaky CI", publisher: "Ex", sourceType: "forum", retrievedAt: "2026-11-03", excerpt: "Our CI fails randomly once a day and we press re-run. It wastes hours." },
  { poolId: "doc-b", url: "https://example.com/b", title: "Slow queue", publisher: "Ex", sourceType: "forum", retrievedAt: "2026-11-03", excerpt: "The CI queue takes forty minutes before anything runs. People context-switch." },
];
const fixedNow = () => new Date("2026-11-03T12:00:00Z");

function memWithTheme() {
  const m = emptyMemory();
  m.themes.push(theme);
  return m;
}

describe("pipeline with mock provider", () => {
  it("produces a bundle that ingests cleanly into a fixture store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "venture-"));
    const memory = memWithTheme();
    saveMemory(dir, memory);
    const bundle = await runPipeline({ theme, pool, memory, provider: new MockProvider(), runId: "run-test", now: fixedNow });
    expect(bundle.run.status).toBe("completed");
    expect(bundle.run.provenance).toBe("fixture");
    expect(bundle.ideas.length).toBeGreaterThan(0);
    expect(bundle.ideas.every((i) => i.objections.length > 0)).toBe(true);
    expect(bundle.ideas.filter((i) => i.status === "advanced").length).toBeLessThanOrEqual(1);
    const res = ingestBundle(dir, bundle, "fixture");
    expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(res.ok).toBe(true);
    // fixture output can never enter a real store
    const realDir = mkdtempSync(join(tmpdir(), "venture-real-"));
    saveMemory(realDir, emptyMemory());
    expect(ingestBundle(realDir, bundle, "real").ok).toBe(false);
  });

  it("drops evidence whose quote is not verbatim in the retrieved document", async () => {
    const liar: ModelProvider = {
      name: "liar",
      producesRealResearch: false,
      paid: false,
      async complete(req: CompletionRequest) {
        if (req.role === "scout")
          return {
            text: JSON.stringify({
              problems: [
                { title: "Invented problem", statement: "This problem is supported by a made-up quote only.", affectedUsers: "nobody", evidence: [{ poolId: "doc-a", quote: "97% of developers hate CI", claim: "fabricated statistic" }, { poolId: "doc-zzz", quote: "whatever text", claim: "unknown doc" }] },
              ],
            }),
          };
        return { text: "{}" };
      },
    };
    const bundle = await runPipeline({ theme, pool, memory: memWithTheme(), provider: liar, runId: "run-liar", now: fixedNow });
    expect(bundle.evidence).toHaveLength(0);
    expect(bundle.problems).toHaveLength(0);
    expect(bundle.run.status).toBe("failed");
    expect(bundle.run.errors.join("\n")).toMatch(/not found verbatim/);
    expect(bundle.run.errors.join("\n")).toMatch(/unknown document/);
  });

  it("enforces the model-call limit", async () => {
    const bundle = await runPipeline({ theme, pool, memory: memWithTheme(), provider: new MockProvider(), runId: "run-lim", limits: { maxModelCalls: 2 }, now: fixedNow });
    expect(bundle.run.status).toBe("partial");
    expect(bundle.run.usage.modelCalls).toBe(2);
    expect(bundle.ideas.every((i) => i.status !== "advanced")).toBe(true);
  });

  it("skips candidates that duplicate historical ideas", async () => {
    const dir = mkdtempSync(join(tmpdir(), "venture-dup-"));
    const memory = memWithTheme();
    saveMemory(dir, memory);
    const first = await runPipeline({ theme, pool, memory, provider: new MockProvider(), runId: "run-one", now: fixedNow });
    expect(ingestBundle(dir, first, "fixture").ok).toBe(true);
    const m2 = validateMemory(loadRaw(dir), "fixture").memory!;
    const second = await runPipeline({ theme, pool, memory: m2, provider: new MockProvider(), runId: "run-two", now: fixedNow });
    expect(second.ideas).toHaveLength(0);
    expect(second.run.errors.join("\n")).toMatch(/duplicate of/);
  });
});

describe("record / replay", () => {
  it("replays a recorded run identically and offline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "venture-rr-"));
    const cassette = join(dir, "c.json");
    const a = await runPipeline({ theme, pool, memory: memWithTheme(), provider: new RecordingProvider(new MockProvider(), cassette), runId: "run-r", now: fixedNow });
    const replay = new ReplayProvider(cassette);
    expect(replay.producesRealResearch).toBe(false);
    const b = await runPipeline({ theme, pool, memory: memWithTheme(), provider: replay, runId: "run-r", now: fixedNow });
    expect(b.ideas.map((i) => i.title)).toEqual(a.ideas.map((i) => i.title));
    expect(JSON.parse(readFileSync(cassette, "utf8")).real).toBe(false);
  });
});

describe("paid provider guard", () => {
  it("refuses to construct without explicit opt-in and budget", () => {
    delete process.env.VENTURE_ALLOW_PAID;
    expect(() => new AnthropicProvider("claude-opus-5-5", 1)).toThrow(/VENTURE_ALLOW_PAID/);
    process.env.VENTURE_ALLOW_PAID = "1";
    expect(() => new AnthropicProvider("claude-opus-5-5", 0)).toThrow(/max-cost/);
    const p = new AnthropicProvider("claude-opus-5-5", 1);
    expect(p.estimate(1_000_000, 0)).toBe(4);
    delete process.env.VENTURE_ALLOW_PAID;
  });
});

describe("collectors and verification", () => {
  it("strips markup and entities", () => {
    expect(stripMarkup("<p>a &amp; b</p>\n<i>c</i>")).toBe("a & b c");
  });
  it("parses arXiv Atom", () => {
    const xml = `<feed><entry><id>http://arxiv.org/abs/2601.00001v1</id><title>Agents  and CI</title><summary>We study flaky tests.</summary><published>2026-01-01T00:00:00Z</published></entry></feed>`;
    const [s] = parseArxiv(xml, theme, fixedNow());
    expect(s.url).toBe("https://arxiv.org/abs/2601.00001v1");
    expect(s.title).toBe("Agents and CI");
  });
  it("merges signals keeping triage state", () => {
    const sig = (id: string, engagement: number, triage: "new" | "promoted" = "new") => ({ id, collector: "x", themeId: "theme-t", url: "https://e.com", title: id, excerpt: "", engagement, engagementLabel: "", retrievedAt: "2026-11-03", triage, provenance: "real" as const });
    const merged = mergeSignals([sig("sig-a", 1, "promoted")], [sig("sig-a", 9), sig("sig-b", 5)], 10);
    expect(merged.find((s) => s.id === "sig-a")!.triage).toBe("promoted");
    expect(merged.find((s) => s.id === "sig-a")!.engagement).toBe(9);
  });
  it("verifies quotes against fetched pages", async () => {
    const source = { id: "src-a", url: "https://e.com/a", title: "a", publisher: "e", retrievedAt: "2026-11-03", sourceType: "blog" as const, excerpt: "x", verification: { status: "unchecked" as const }, provenance: "real" as const };
    const page = (status: number, body: string) => async () => ({ ok: status < 400, status, json: async () => ({}), text: async () => body });
    expect((await verifySource(source, ["hello   world"], page(200, "<p>Hello <b>world</b>!</p>"), fixedNow())).status).toBe("ok");
    expect((await verifySource(source, ["absent"], page(200, "<p>Hello</p>"), fixedNow())).status).toBe("quote-missing");
    expect((await verifySource(source, ["x"], page(403, ""), fixedNow())).status).toBe("blocked");
    expect((await verifySource(source, ["x"], page(404, ""), fixedNow())).status).toBe("unreachable");
  });
});

describe("verification targets", () => {
  it("maps GitHub issues to the API and blobs to raw files", () => {
    expect(verificationTarget("https://github.com/tldraw/tldraw/issues/7695").url).toBe("https://api.github.com/repos/tldraw/tldraw/issues/7695");
    expect(verificationTarget("https://github.com/a/b/blob/main/README.md").url).toBe("https://raw.githubusercontent.com/a/b/main/README.md");
    expect(verificationTarget("https://example.com/x").url).toBe("https://example.com/x");
  });
  it("ignores markdown emphasis when matching quotes", async () => {
    const source = { id: "src-a", url: "https://e.com/a", title: "a", publisher: "e", retrievedAt: "2026-11-03", sourceType: "docs" as const, excerpt: "x", verification: { status: "unchecked" as const }, provenance: "real" as const };
    const page = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "This policy is **not** intended for _x_." });
    expect((await verifySource(source, ["This policy is not intended for x."], page, new Date())).status).toBe("ok");
  });
});

describe("signal relevance", () => {
  it("requires every keyword token to appear", () => {
    expect(isRelevant("Maintainers drowning in AI slop pull requests", ["AI slop pull request"])).toBe(true);
    expect(isRelevant("Allow to change the font size of the workbench", ["AI slop pull request", "low-effort contributions"])).toBe(false);
  });
});
