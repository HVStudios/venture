import { describe, expect, it } from "vitest";
import { startExperiment, ActionError } from "../src/core/actions";
import { summariseWatch, watchVerdict, type WatchState } from "../src/experiments/install-hook-watch";
import { validateMemory } from "../src/core/validate";
import { FIXTURE_STORE, loadRaw } from "../src/engine/store";

describe("install-hook watch", () => {
  it("applies the pre-registered rule", () => {
    expect(watchVerdict(400, 10).result).toBe("supported");
    expect(watchVerdict(400, 80).result).toBe("refuted");
    expect(watchVerdict(400, 40).result).toBe("inconclusive");
    expect(watchVerdict(100, 1).result).toBe("inconclusive");
  });
  it("summarises observations", () => {
    const s = { observations: [
      { pkg: "a", from: "1", to: "2", seenAt: "", newDependency: true, newInstallScript: false, addedDependencies: ["x"] },
      { pkg: "b", from: "1", to: "2", seenAt: "", newDependency: false, newInstallScript: false, addedDependencies: [] },
    ] } as unknown as WatchState;
    expect(summariseWatch(s)).toMatchObject({ releases: 2, alerts: 1, hooks: 0, rate: 0.5 });
  });
  it("only starts approved experiments", () => {
    const m = structuredClone(validateMemory(loadRaw(FIXTURE_STORE), "fixture").memory!);
    const x = m.experiments[0];
    expect(() => startExperiment(m, x.id, "t", "go", new Date().toISOString())).toThrow(ActionError);
  });
});
