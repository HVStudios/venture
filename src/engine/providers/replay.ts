/**
 * Record/replay: wraps a provider and stores each response keyed by a hash of
 * the request, so a pipeline run can be reproduced deterministically and
 * offline. The cassette remembers whether the original provider produced
 * real research; a replay never upgrades fixture output to real.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CompletionRequest, CompletionResult, ModelProvider } from "./types";

type Cassette = { provider: string; model?: string; real: boolean; entries: Record<string, CompletionResult> };

export function requestKey(req: CompletionRequest): string {
  return createHash("sha256").update(`${req.role}\n${req.system}\n${req.prompt}`).digest("hex").slice(0, 24);
}

export class RecordingProvider implements ModelProvider {
  readonly name: string;
  readonly model?: string;
  readonly producesRealResearch: boolean;
  readonly paid: boolean;
  private cassette: Cassette;
  constructor(
    private inner: ModelProvider,
    private file: string,
  ) {
    this.name = inner.name;
    this.model = inner.model;
    this.producesRealResearch = inner.producesRealResearch;
    this.paid = inner.paid;
    this.cassette = { provider: inner.name, model: inner.model, real: inner.producesRealResearch, entries: {} };
  }
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const res = await this.inner.complete(req);
    this.cassette.entries[requestKey(req)] = res;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.cassette, null, 2) + "\n");
    return res;
  }
}

export class ReplayProvider implements ModelProvider {
  readonly name: string;
  readonly model?: string;
  readonly producesRealResearch: boolean;
  readonly paid = false;
  private cassette: Cassette;
  constructor(file: string) {
    if (!existsSync(file)) throw new Error(`cassette not found: ${file}`);
    this.cassette = JSON.parse(readFileSync(file, "utf8")) as Cassette;
    this.name = `replay(${this.cassette.provider})`;
    this.model = this.cassette.model;
    this.producesRealResearch = this.cassette.real;
  }
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const hit = this.cassette.entries[requestKey(req)];
    if (!hit) throw new Error(`replay miss for ${req.role} (${requestKey(req)}): pipeline inputs changed since recording`);
    return { ...hit, costUsd: 0 };
  }
}
