import { describe, expect, it } from "vitest";
import { practiceOf, practicesVerdict } from "../src/experiments/publishing-practices";

describe("npm publishing practices experiment", () => {
  it("classifies _npmUser metadata", () => {
    expect(practiceOf({ name: "GitHub Actions", trustedPublisher: { id: "github" }, approver: { name: "x" } })).toBe("staged-approval");
    expect(practiceOf({ name: "GitHub Actions", trustedPublisher: { id: "github" } })).toBe("trusted-publisher");
    expect(practiceOf({ name: "someone" })).toBe("neither");
    expect(practiceOf(undefined)).toBe("neither");
  });
  it("applies the pre-registered rule", () => {
    expect(practicesVerdict(0.5, 300).result).toBe("supported");
    expect(practicesVerdict(0.1, 300).result).toBe("refuted");
    expect(practicesVerdict(0.3, 300).result).toBe("inconclusive");
    expect(practicesVerdict(0.5, 150).result).toBe("inconclusive");
  });
});
