import { describe, expect, it } from "vitest";
import { contractBreaks, releasePairs, sampleFixed } from "../src/experiments/npm-metadata-breaks";

const rules = (a: object, b: object) => contractBreaks({ version: "1.0.0", ...a }, { version: "1.1.0", ...b }).map((r) => r.rule);

describe("release-contract rules", () => {
  it("flags a raised Node engine requirement (the polished case)", () => {
    expect(rules({ engines: { node: ">=10" } }, { engines: { node: ">=20" } })).toEqual(["engines-tightened"]);
    expect(rules({ engines: { node: ">=20" } }, { engines: { node: ">=20" } })).toEqual([]);
    expect(rules({}, { engines: { node: ">=18" } })).toEqual(["engines-tightened"]);
  });
  it("flags removed export subpaths and newly added exports maps", () => {
    expect(rules({ exports: { ".": "./a.js", "./utils": "./u.js" } }, { exports: { ".": "./a.js" } })).toEqual(["exports-subpath-removed"]);
    expect(rules({ exports: { "./utils/x": "./x.js" } }, { exports: { "./utils/*": "./*.js" } })).toEqual([]);
    expect(rules({ main: "index.js" }, { main: "index.js", exports: "./index.js" })).toEqual(["exports-map-added"]);
    expect(rules({ exports: { import: "./a.mjs", require: "./a.cjs" } }, { exports: { ".": { import: "./a.mjs" } } })).toEqual([]);
  });
  it("flags removed entry fields, ESM switch, peers and bins", () => {
    expect(rules({ main: "a.js", types: "a.d.ts" }, { main: "a.js" })).toEqual(["entry-removed"]);
    expect(rules({ typings: "a.d.ts" }, { types: "a.d.ts" })).toEqual([]);
    expect(rules({}, { type: "module" })).toEqual(["switched-to-esm"]);
    expect(rules({}, { peerDependencies: { react: "^18" } })).toEqual(["peer-added"]);
    expect(rules({}, { peerDependencies: { react: "^18" }, peerDependenciesMeta: { react: { optional: true } } })).toEqual([]);
    expect(rules({ peerDependencies: { react: "^17 || ^18" } }, { peerDependencies: { react: "^18" } })).toEqual(["peer-tightened"]);
    expect(rules({ bin: { foo: "a.js", bar: "b.js" } }, { bin: { foo: "a.js" } })).toEqual(["bin-removed"]);
  });
  it("pairs minor/patch releases within major lines, skipping 0.x and prereleases", () => {
    const v = (version: string) => ({ version });
    const versions = { "1.0.0": v("1.0.0"), "1.1.0": v("1.1.0"), "2.0.0": v("2.0.0"), "1.1.1": v("1.1.1"), "0.1.0": v("0.1.0"), "0.2.0": v("0.2.0"), "2.1.0-beta.1": v("2.1.0-beta.1") };
    const time = { "1.0.0": "2025-01-01", "1.1.0": "2025-02-01", "2.0.0": "2025-03-01", "1.1.1": "2025-04-01", "0.1.0": "2025-01-01", "0.2.0": "2025-02-01", "2.1.0-beta.1": "2025-05-01" };
    const pairs = releasePairs(versions, time, "2024-11-04", "2026-11-04").map(([a, b]) => `${a.version}->${b.version}`);
    expect(pairs).toEqual(["1.0.0->1.1.0", "1.1.0->1.1.1"]);
  });
  it("samples deterministically", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` }));
    expect(sampleFixed(items, 5)).toEqual(sampleFixed([...items].reverse(), 5));
  });
});
