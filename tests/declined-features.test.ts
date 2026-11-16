import { describe, expect, it } from "vitest";
import { looksLikeFeature, offersToPay, sampleOnePerRepo } from "../src/experiments/declined-features";

describe("declined-feature helpers (synthetic data)", () => {
  it("separates feature requests from bugs", () => {
    expect(looksLikeFeature("Add options to hide title bar", [])).toBe(true);
    expect(looksLikeFeature("Crash on startup", ["bug"])).toBe(false);
    expect(looksLikeFeature("Crash on startup", ["bug", "enhancement"])).toBe(true);
    expect(looksLikeFeature("Something odd", ["*out-of-scope"])).toBe(true);
    expect(looksLikeFeature("Something odd", [])).toBe(false);
  });
  it("detects offers to pay but not unrelated uses of 'pay'", () => {
    expect(offersToPay("Honestly I'd pay for this feature")).toBe(true);
    expect(offersToPay("We would gladly pay for a license")).toBe(true);
    expect(offersToPay("I'm offering a bounty of $200")).toBe(true);
    expect(offersToPay("Pay attention to the config")).toBe(false);
    expect(offersToPay("the payment API returns 500")).toBe(false);
  });
  it("samples at most one issue per repository", () => {
    const items = ["a", "a", "b", "c", "c", "c"].map((repo, i) => ({ id: `${repo}#${i}`, repo }));
    expect(sampleOnePerRepo(items, 10).map((x) => x.repo).sort()).toEqual(["a", "b", "c"]);
  });
});
