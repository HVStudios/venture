# VENTURE: product specification

## Purpose
VENTURE is an evidence-first innovation lab. It finds real problems, invents candidate solutions, tries hard to disprove them, and proposes cheap experiments for the few that survive. It keeps a persistent, inspectable research memory and publishes it as a website.

VENTURE is not an idea generator. Its success measure is **the quality of its decisions**: how well its claims are traced to sources, how readily it rejects weak ideas, and how cheaply it learns. The number of ideas it produces does not count.

## Users
1. **The lab owner**, who reads the findings, approves experiments that need people or money, and steers themes.
2. **Readers of the public site**, who browse problems, ideas, evidence and decisions.
3. **Autonomous research and coding agents**, which read the memory, extend it through the bundle protocol and keep the software running.

## Core objects
| Object | Purpose |
|---|---|
| Theme | Focused or exploratory research area, plus keywords that drive the collectors |
| Signal | Raw, unreviewed item from a deterministic collector (HN, GitHub, Stack Overflow, arXiv) |
| Source | A document that was actually retrieved: URL, publisher, dates, verbatim excerpt, verification status, origin group |
| Evidence | One claim, one exact quote from one source, a stance (supports, contradicts or context), and an epistemic label |
| Problem | An evidenced, recurring pain experienced by identifiable people |
| Competitor | An existing product, open-source tool, platform feature or workaround |
| Idea | A concept tied to problems, with assumptions, risks, the Critic's objections, criterion scores, a status and a rationale |
| Experiment | Hypothesis, uncertainty, procedure, success and failure criteria, cost, mode, and an outcome (only if actually run) |
| Decision | Append-only ledger entry: create, advance, park, reject, merge or reopen, with score snapshots |
| Run | Observable record of a research or collector execution: stages, counts, errors, limits, usage and cost |

## Principles enforced in code
- Every quote must be verbatim in the captured source excerpt. Validation fails otherwise.
- A real store contains no fixtures, and fixtures never appear as real research.
- A problem needs supporting evidence. An idea needs at least one objection. An advanced idea needs an experiment.
- Near-duplicate ideas are blocked unless they are merged or explicitly distinguished.
- Evidence strength is computed, never typed in. It is kept separate from attractiveness, and neither is a probability.
- Experiments that involve people, money or publication are marked `requires-authorization`.

## MVP (milestone 1)
- [x] Schema, validation, scoring, deduplication, ingestion
- [x] Research pipeline with providers: mock (fixtures), record/replay, Anthropic API (opt-in, budgeted)
- [x] Deterministic collectors and source re-verification, scheduled in GitHub Actions
- [x] Web UI: overview, idea landscape, problems, ideas, idea detail, evidence library, signals, experiments, compare, relationship map, runs, decision ledger, themes and theme proposals, method
- [x] CI, deployment to GitHub Pages
- [x] At least one real research run recorded through the agent-session protocol
- [x] First validation experiment actually executed (in GitHub Actions on public data) and its outcome recorded

## Out of scope for the MVP
Accounts, write access from the website, paid infrastructure, contacting people, executing untrusted code from sources.

## Success criteria for later milestones
- Experiments are actually executed and their outcomes recorded.
- Historical calibration: compare past evidence and attractiveness scores with outcomes.
- Previously parked or rejected ideas are reconsidered when new evidence links to their problems.
