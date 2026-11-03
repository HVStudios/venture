/**
 * Model-provider abstraction. The research pipeline talks only to this
 * interface, so execution methods (offline mock, recorded replay, a paid API,
 * a local model) are interchangeable.
 */
export type ResearchRole = "scout" | "researcher" | "inventor" | "critic" | "experimenter" | "director";

export interface CompletionRequest {
  role: ResearchRole;
  system: string;
  prompt: string;
  /** Upper bound on output tokens for this call. */
  maxTokens: number;
}

export interface CompletionResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export interface ModelProvider {
  /** Stable identifier recorded in run logs. */
  readonly name: string;
  readonly model?: string;
  /**
   * Whether output may be persisted as real research. Mock providers return
   * false and their runs are always written to the fixture store.
   */
  readonly producesRealResearch: boolean;
  /** Whether calls cost money. Paid providers require explicit opt-in. */
  readonly paid: boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export class BudgetExceededError extends Error {}
