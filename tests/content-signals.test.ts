import { describe, expect, it } from "vitest";
import { contentVerdict, orientedAuc, referencesIssue, wordCount } from "../src/experiments/content-signals";

describe("content signal experiment", () => {
  it("detects issue references", () => {
    expect(referencesIssue("Fixes #1234")).toBe(true);
    expect(referencesIssue("see https://github.com/llvm/llvm-project/issues/99")).toBe(true);
    expect(referencesIssue("C# is great; version 1.2#3")).toBe(false);
    expect(referencesIssue("")).toBe(false);
  });
  it("counts words", () => {
    expect(wordCount("Fix the  bug \n in parser — now")).toBe(6);
  });
  it("orients AUC", () => {
    expect(orientedAuc([1, 2], [3, 4])).toEqual({ auc: 1, direction: "lower" });
  });
  it("applies the pre-registered rule", () => {
    expect(contentVerdict(0.8, 0.5, 200).result).toBe("supported");
    expect(contentVerdict(0.55, 0.58, 200).result).toBe("refuted");
    expect(contentVerdict(0.65, 0.55, 200).result).toBe("inconclusive");
    expect(contentVerdict(0.9, 0.9, 100).result).toBe("inconclusive");
  });
});
