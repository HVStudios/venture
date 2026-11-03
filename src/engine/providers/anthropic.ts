/**
 * Claude API provider. Usage-billed, therefore OFF unless explicitly enabled:
 * an SDK credential (e.g. ANTHROPIC_API_KEY) must be available AND
 * VENTURE_ALLOW_PAID=1 must be set AND a positive cost ceiling given.
 * A Claude Pro subscription does not include API access; this provider never
 * tries to reuse subscription credentials.
 */
import type { CompletionRequest, CompletionResult, ModelProvider } from "./types";
import { BudgetExceededError } from "./types";

/** USD per million tokens [input, output]. Anthropic list prices, cached 2026-10. */
export const PRICING: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic-api";
  readonly producesRealResearch = true;
  readonly paid = true;
  spentUsd = 0;
  constructor(
    readonly model: string,
    private maxCostUsd: number,
  ) {
    if (process.env.VENTURE_ALLOW_PAID !== "1") {
      throw new Error("The Anthropic API provider is usage-billed. Set VENTURE_ALLOW_PAID=1 to opt in explicitly.");
    }
    if (!(maxCostUsd > 0)) throw new Error("A positive --max-cost is required for paid providers.");
  }

  estimate(inputTokens: number, outputTokens: number): number {
    const [i, o] = PRICING[this.model] ?? [10, 50];
    return (inputTokens * i + outputTokens * o) / 1e6;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    // Pre-flight worst case: ~3.5 chars/token input, the full output budget.
    const worst = this.estimate(Math.ceil((req.system.length + req.prompt.length) / 3.5), req.maxTokens);
    if (this.spentUsd + worst > this.maxCostUsd) {
      throw new BudgetExceededError(
        `call would exceed budget ($${this.spentUsd.toFixed(3)} spent + up to $${worst.toFixed(3)} > $${this.maxCostUsd})`,
      );
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const response = await client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
    });
    if (response.stop_reason === "refusal") throw new Error(`model declined the ${req.role} step`);
    let text = "";
    for (const block of response.content) if (block.type === "text") text += block.text;
    const cost = this.estimate(response.usage.input_tokens, response.usage.output_tokens);
    this.spentUsd += cost;
    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costUsd: cost,
    };
  }
}
