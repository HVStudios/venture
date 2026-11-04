import { describe, expect, it } from "vitest";
import { combinedScores, combinedVerdict, percentileRanks } from "../src/experiments/combined-signals";

describe("combined signal experiment", () => {
  it("ranks with ties", () => {
    expect(percentileRanks([10, 20, 20, 30])).toEqual([0, 0.5, 0.5, 1]);
  });
  it("averages two rank vectors without fitting", () => {
    expect(combinedScores([1, 2, 3], [3, 2, 1])).toEqual([0.5, 0.5, 0.5]);
  });
  it("applies the pre-registered rule", () => {
    expect(combinedVerdict(0.8, 200).result).toBe("supported");
    expect(combinedVerdict(0.65, 200).result).toBe("refuted");
    expect(combinedVerdict(0.72, 200).result).toBe("inconclusive");
    expect(combinedVerdict(0.9, 100).result).toBe("inconclusive");
  });
});
