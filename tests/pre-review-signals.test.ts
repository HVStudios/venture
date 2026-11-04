import { describe, expect, it } from "vitest";
import { auc, newcomerFlagRate, signalVerdict } from "../src/experiments/pre-review-signals";

describe("pre-review signal experiment", () => {
  it("computes AUC with ties", () => {
    expect(auc([3, 4], [1, 2])).toBe(1);
    expect(auc([1, 2], [3, 4])).toBe(0);
    expect(auc([1], [1])).toBe(0.5);
    expect(auc([], [1])).toBeNull();
  });
  it("computes the newcomer flag rate at half recall", () => {
    expect(newcomerFlagRate([10, 8, 6, 4], [1, 5, 7, 9])).toBe(0.25);
  });
  it("applies the pre-registered rule", () => {
    expect(signalVerdict(0.8, 0.5, 200).result).toBe("supported");
    expect(signalVerdict(0.55, 0.55, 200).result).toBe("refuted");
    expect(signalVerdict(0.7, 0.5, 200).result).toBe("inconclusive");
    expect(signalVerdict(0.9, 0.9, 100).result).toBe("inconclusive");
  });
});
