import { describe, expect, it } from "vitest";
import { isOrphaned, maintainedAlternatives, sum30, tagList, type WpPlugin } from "../src/experiments/wp-orphaned-demand";

const p = (slug: string, installs: number, updated: string, tags: string[]): WpPlugin => ({ slug, name: slug, active_installs: installs, last_updated: `${updated} 3:12pm GMT`, tags: Object.fromEntries(tags.map((t) => [t, t])) });

describe("orphaned-demand rules (synthetic data)", () => {
  const asOf = "2026-11-16T00:00:00Z";
  it("flags only plugins that are both popular and stale for 24 months", () => {
    expect(isOrphaned(p("a", 20000, "2024-11-15", []), asOf)).toBe(true);
    expect(isOrphaned(p("b", 20000, "2024-11-17", []), asOf)).toBe(false);
    expect(isOrphaned(p("c", 9999, "2020-01-01", []), asOf)).toBe(false);
  });
  it("finds maintained alternatives by shared tags, freshness and size", () => {
    const o = p("old", 40000, "2022-01-01", ["forms", "contact", "email"]);
    const all = [o, p("fresh-big", 30000, "2026-06-01", ["forms", "contact"]), p("fresh-small", 10000, "2026-06-01", ["forms", "contact"]), p("stale-big", 90000, "2025-01-01", ["forms", "contact"]), p("one-tag", 90000, "2026-06-01", ["forms"])];
    expect(maintainedAlternatives(o, all, asOf).map((x) => x.slug)).toEqual(["fresh-big"]);
  });
  it("sums the latest 30 days of downloads and reads tag arrays", () => {
    const daily = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, "0")}`, i < 10 ? "100" : "1"]));
    expect(sum30(daily)).toBe(30);
    expect(tagList({ tags: ["x", "y"] })).toEqual(["x", "y"]);
  });
});
