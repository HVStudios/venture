# Result: exp-content-signal-discrimination

Executed 2026-11-04T12:08:33.308Z in GitHub Actions (run 41826339477) on public GitHub data.

- PRs with readable descriptions: 240 (policy-closed 120, newcomer-merged 120).
- C1, description references an issue: 55.8% of policy-closed vs 58.3% of newcomer-merged PRs; AUC (no reference → suspicious) 0.51.
- C2, description length: median 166 words (policy-closed) vs 87 words (newcomer-merged); AUC 0.67 (policy-closed descriptions are longer).
- At the C2 threshold that flags half of the policy-closed PRs, 13.3% of genuine newcomer PRs would also be flagged.

Verdict (pre-registered rule): inconclusive: best content signal AUC 0.67 is between the thresholds.

Caveats: the control group is LLVM-only; descriptions may have been edited after the PR was closed; group labels come from the original experiment.
