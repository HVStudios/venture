# Result: exp-pre-review-signal-discrimination

Provenance note: the experiment ran twice in GitHub Actions (run 41809278569, attempts 1 and 2). Both times GitHub rejected the final push of the results (server-side errors during a GitHub incident), so the per-PR rows were not saved. The summary below is copied verbatim from the job log of attempt 2 (job 126523069498), which printed it before the push. Attempt 1's output was never seen.

Executed 2026-11-04T10:47:11.731Z in GitHub Actions (run 41809278569) on public GitHub data.

- PRs with readable authors: 237 (policy-closed 119, newcomer-merged 118). Accounts no longer existing: policy-closed 0, newcomer-merged 0.
- S1, PRs opened across GitHub in the 30 days before: median 6 (policy-closed) vs 1 (newcomer-merged); AUC 0.64; within LLVM 0.62.
- S2, account age at PR creation: median 1724 days (policy-closed) vs 2341 days (newcomer-merged); AUC 0.54.
- At the S1 threshold that flags half of the policy-closed PRs, 30.5% of genuine newcomer PRs would also be flagged.

Verdict (pre-registered rule): inconclusive: S1 AUC 0.64 (S2 0.54) is between the thresholds.

Caveats: the control group is LLVM-only; group labels are inferred from comment text in the original experiment; the cross-repo PR count comes from GitHub search totals.
