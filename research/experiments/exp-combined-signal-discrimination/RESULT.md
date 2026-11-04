# Result: exp-combined-signal-discrimination

Executed 2026-11-04T12:33:15.199Z in GitHub Actions (run 41827267462) on public GitHub data.

- PRs with both signals: 237 (policy-closed 119, newcomer-merged 118).
- Combined score (mean percentile rank of description length and prior 30-day cross-repo PR count): AUC 0.69.
- At the threshold that flags half of the policy-closed PRs, 24.6% of genuine newcomer PRs would also be flagged.

Verdict (pre-registered rule): refuted: combined AUC 0.69 < 0.70.

Caveats: the control group is LLVM-only; descriptions may have been edited after closing; cross-repo counts come from GitHub search totals.
