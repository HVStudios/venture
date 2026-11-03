import { describe, expect, it } from "vitest";
import { campaignKey, campaignVerdict } from "../src/experiments/publish-anomaly-campaigns";

describe("campaign replication", () => {
  it("groups by explicit identifier, then named campaign, then day", () => {
    expect(campaignKey({ id: "a", details: 'part of the attack (campaign identifier "miasma-train-p1") that' }).key).toBe("id:miasma-train-p1");
    expect(campaignKey({ id: "b", details: "published in the Shai-Hulud campaign wave" }).basis).toBe("named");
    expect(campaignKey({ id: "c", published: "2026-03-31T01:00:00Z", details: "The package was found to contain malicious code." })).toEqual({ key: "day:2026-03-31", basis: "day" });
  });
  it("does not merge unrelated attacks on generic phrases", () => {
    expect(campaignKey({ id: "g", published: "2026-01-02T00:00:00Z", details: "part of a supply chain worm attack campaign" }).basis).toBe("day");
  });
  it("puts two reports of the same named campaign together", () => {
    const a = campaignKey({ id: "x", details: "compromised in the Shai-Hulud campaign" });
    const b = campaignKey({ id: "y", details: "another victim of the Shai-Hulud campaign" });
    expect(a.key).toBe(b.key);
  });
  it("applies the pre-registered rule", () => {
    expect(campaignVerdict(0.7, 20).result).toBe("supported");
    expect(campaignVerdict(0.3, 20).result).toBe("refuted");
    expect(campaignVerdict(0.5, 20).result).toBe("inconclusive");
    expect(campaignVerdict(0.9, 10).result).toBe("inconclusive");
  });
});
