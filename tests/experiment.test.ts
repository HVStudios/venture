import { describe, expect, it } from "vitest";
import { analysePr, summarise, verdict, wilson, type PrRow } from "../src/experiments/followup-engagement";

const c = (login: string, at: string, type?: string) => ({ user: { login, type }, created_at: at });

describe("follow-up engagement experiment", () => {
  it("detects an author reply after the first human comment, ignoring bots", () => {
    const r = analysePr("alice", [c("llvmbot", "2026-01-01T00:00:00Z"), c("bob", "2026-01-01T01:00:00Z"), c("alice", "2026-01-01T03:00:00Z")]);
    expect(r).toEqual({ otherHumanComments: 1, authorReplied: true, hoursToReply: 2 });
    expect(analysePr("alice", [c("alice", "2026-01-01T00:00:00Z"), c("bob", "2026-01-02T00:00:00Z")]).authorReplied).toBe(false);
    expect(analysePr("alice", [c("ci", "2026-01-01T00:00:00Z", "Bot")]).otherHumanComments).toBe(0);
  });
  it("computes a sane Wilson interval", () => {
    const [lo, hi] = wilson(5, 10);
    expect(lo).toBeGreaterThan(0.2);
    expect(hi).toBeLessThan(0.8);
  });
  it("applies the pre-registered decision rule", () => {
    const rows = (group: PrRow["group"], n: number, k: number): PrRow[] =>
      Array.from({ length: n }, (_, i) => ({ url: `u${group}${i}`, group, author: "a", otherHumanComments: 1, authorReplied: i < k }));
    const all = [...rows("policy-closed", 40, 8), ...rows("newcomer-merged", 40, 32)];
    expect(verdict(summarise(all, "policy-closed"), summarise(all, "newcomer-merged")).result).toBe("supported");
    const same = [...rows("policy-closed", 40, 30), ...rows("newcomer-merged", 40, 32)];
    expect(verdict(summarise(same, "policy-closed"), summarise(same, "newcomer-merged")).result).toBe("refuted");
    const small = [...rows("policy-closed", 10, 1), ...rows("newcomer-merged", 40, 32)];
    expect(verdict(summarise(small, "policy-closed"), summarise(small, "newcomer-merged")).result).toBe("inconclusive");
  });
});
