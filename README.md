# VENTURE

**An evidence-first autonomous AI innovation lab.** VENTURE discovers real problems, researches existing solutions, invents candidate products, attacks its own ideas, and proposes cheap validation experiments for the few that survive. Every claim is traced to a verbatim quote from a retrieved source.

**Live site:** https://hvstudios.github.io/venture/

| | |
|---|---|
| Research memory | `data/*.json` (real research) · `fixtures/demo/*.json` (synthetic demo, labelled as such) |
| How it reasons | [`docs/SPEC.md`](docs/SPEC.md) · the `/method` page on the site |
| How it's built | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| How agents do research | [`docs/RESEARCH_PROTOCOL.md`](docs/RESEARCH_PROTOCOL.md) |

## Quick start
```bash
npm install
npm run dev            # snapshot + local site at http://localhost:5173
npm run check          # typecheck, tests, memory validation, production build
npm run venture -- status
```

## Research engine CLI
```bash
npm run venture -- validate                                   # integrity, provenance, verbatim quotes, duplicates
npm run venture -- ingest research/bundles/<run>.json         # add an agent-session research bundle
npm run venture -- scout --theme all                          # collect raw signals (HN, GitHub, Stack Overflow, arXiv)
npm run venture -- verify                                     # re-fetch cited pages and check quotes
npm run venture -- run --theme <id> --provider mock           # full pipeline on fixtures (offline, deterministic)
VENTURE_ALLOW_PAID=1 npm run venture -- run --theme <id> --provider anthropic --max-cost 0.50
```

## What runs automatically, and what doesn't
- **Automatic (GitHub Actions, free):** CI on every PR, deployment on every merge, and signal collection plus source verification twice a week (`research-ops.yml`). No model is involved in any of these.
- **Research reasoning:** done by Claude Code sessions following the research protocol. A Claude Pro subscription does not include API access, so VENTURE never reuses subscription credentials as an API key.
- **Optional unattended LLM research:** the pipeline supports the Anthropic API. It stays off unless you add an API key and opt in, and it is usage-billed with an enforced budget.

## License
No license yet. All rights reserved by the repository owner.
