# Architecture

```
                 ┌──────────────────────── research execution (never on the website) ───────────────────────┐
 GitHub Actions  │  research-ops.yml (Mon/Thu)                                                              │
 (free, no LLM)  │    scout: collectors → data/signals.json     verify: re-fetch sources → verification     │
                 │                                                                                          │
 Agent session   │  Claude Code session following docs/RESEARCH_PROTOCOL.md                                 │
 (subscription)  │    web search/fetch → research bundle JSON → `venture ingest` → PR → CI → merge          │
                 │                                                                                          │
 Automated LLM   │  `venture run --provider anthropic` (opt-in, budgeted) │ mock │ replay                   │
 (optional)      │    pipeline.ts: scout → invent → dedupe → critique → director → experiment → bundle      │
                 └────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                          │ every path produces a Bundle
                                                          ▼
                              src/engine/ingest.ts  ── merge → validate (src/core/validate.ts) → persist
                                                          │
                          data/*.json  (real memory, git is the database)   fixtures/demo/*.json (demo)
                                                          │
                              `venture snapshot` → public/data/snapshot.json
                                                          │
                              Vite + React static site → gh-pages branch → GitHub Pages
```

## Why this shape
- **GitHub Pages cannot run models or backends.** The site is static and reads a snapshot. It stays fully useful when no research is running.
- **Git is the database.** Research memory is diff-friendly JSON, reviewed through PRs and versioned for free. At the current scale (hundreds of records) this beats running a database. If the memory grows past a few MB, split the collections into per-record files.
- **One ingestion path.** Agent sessions, automated LLM runs and the mock all emit the same `Bundle`, so every guarantee is enforced in exactly one place.
- **No silent paid usage.** The Anthropic provider throws unless `VENTURE_ALLOW_PAID=1` is set and a positive `--max-cost` is given. A Claude Pro subscription is not an API credential, so subscription-powered research happens in interactive or scheduled Claude Code sessions instead.

## Modules
| Path | Responsibility |
|---|---|
| `src/core/schema.ts` | zod schemas and types for every record, plus `Bundle` |
| `src/core/validate.ts` | referential integrity, provenance, verbatim quotes, policy rules, duplicate detection |
| `src/core/scoring.ts` | attractiveness (weighted criteria) and evidence strength (independent origins, epistemic, source type, verification) |
| `src/core/similarity.ts` | TF-IDF cosine with bigrams for deduplication and "related ideas" |
| `src/engine/pipeline.ts` | role-based automated pipeline with hard limits and anti-fabrication checks |
| `src/engine/providers/*` | `ModelProvider` interface; mock, record/replay, Anthropic |
| `src/engine/collectors/*` | HN, GitHub Issues, Stack Overflow, arXiv collectors (no LLM) |
| `src/engine/verify.ts` | quote re-verification against live pages |
| `src/engine/cli.ts` | `venture validate · snapshot · ingest · scout · run · verify · status` |
| `src/web/*` | the static UI; computes scores client-side with the same core functions |

## Adding a provider
Implement `ModelProvider` (`complete()`, `producesRealResearch`, `paid`) in `src/engine/providers/` and register it in the `run` command. Local models (an Ollama HTTP endpoint, for example) fit this interface directly.

## Limits
`Limits` in `pipeline.ts`: duration, sources, model calls, problems, ideas, advanced ideas, critique rounds and output tokens per call. The paid provider additionally enforces a USD ceiling: it checks the worst case before each call and the actual cost after.
