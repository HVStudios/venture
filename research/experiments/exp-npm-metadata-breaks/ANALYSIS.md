# Exploratory analysis: exp-npm-metadata-breaks

**Not pre-registered.** Computed after the audit, to see where the noise comes from.

- Engine-range rules produced 68 of 137 flags. In the audit, 10 of the 12 non-genuine or debatable flags were engine-range changes, mostly dropping end-of-life Node versions.
- Without the engines rule, the remaining structural rules (exports removed or added, entry fields removed, ESM switch, peers, bins) flag 75 release pairs in 41 of 400 packages (10.2%).
- In the audit sample, 7 of the 9 flags from structural rules were genuine (78%; small n).
- Flags cluster in a few release trains (@tanstack 13, better-auth 10, @typescript-eslint 9), so a handful of fast-moving projects account for many of them.

Interpretation: a structural-only release-contract check is precise enough to be useful (about 4 in 5 flags genuine), but it fires for about 1 in 10 popular packages over two years. That's a modest benefit, best delivered as a feature of an existing packaging linter (publint, 1.3k stars, which lints a single release) rather than a new standalone tool. Engine-range checks would need to know Node's end-of-life dates to be useful.
