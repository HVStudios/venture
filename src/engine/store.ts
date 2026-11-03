/** File-based research memory: one pretty-printed JSON array per collection. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { COLLECTIONS, emptyMemory, type Memory } from "../core/schema";

export const ROOT = resolve(import.meta.dirname, "../..");
export const REAL_STORE = join(ROOT, "data");
export const FIXTURE_STORE = join(ROOT, "fixtures/demo");

export function loadRaw(dir: string): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const c of COLLECTIONS) {
    const f = join(dir, `${c}.json`);
    out[c] = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as unknown[]) : [];
  }
  return out;
}

export function saveMemory(dir: string, memory: Memory): void {
  mkdirSync(dir, { recursive: true });
  for (const c of COLLECTIONS) {
    const items = [...(memory[c] as { id: string }[])].sort((a, b) => a.id.localeCompare(b.id));
    writeFileSync(join(dir, `${c}.json`), JSON.stringify(items, null, 2) + "\n");
  }
}

export { emptyMemory };
