import { describe, expect, it } from "vitest";
import { classify, releaseSignals, verdict } from "../src/experiments/publish-anomaly";

describe("publish-anomaly experiment", () => {
  it("classifies mechanisms by priority", () => {
    expect(classify("Every wheel ships three extra files ... cook.pth contains `import cook`.").mechanism).toBe("install-hook");
    expect(classify("Both versions injected a dependency called plain-crypto-js").mechanism).toBe("new-dependency");
    expect(classify("the attacker prepended the malicious code directly to the top of index.js").mechanism).toBe("file-modification");
    expect(classify("The package axios was found to contain malicious code.").mechanism).toBe("unknown");
  });
  it("detects new dependencies and install scripts between releases", () => {
    const a = { version: "1.0.0", dependencies: { x: "1" }, scripts: { test: "t" } };
    expect(releaseSignals(a, { version: "1.0.1", dependencies: { x: "1" } })).toEqual({ newDependency: false, newInstallScript: false });
    expect(releaseSignals(a, { version: "1.0.2", dependencies: { x: "1", y: "2" } }).newDependency).toBe(true);
    expect(releaseSignals(a, { version: "1.0.3", scripts: { postinstall: "node x.js" } }).newInstallScript).toBe(true);
  });
  it("applies the pre-registered rule", () => {
    expect(verdict(0.7, 20, 0.05).result).toBe("supported");
    expect(verdict(0.3, 20, 0.05).result).toBe("refuted");
    expect(verdict(0.7, 10, 0.05).result).toBe("inconclusive");
    expect(verdict(0.7, 20, 0.2).result).toBe("inconclusive");
  });
});
