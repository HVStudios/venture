# Result: exp-npm-publishing-practices

Executed 2026-11-04T09:22:40.002Z in GitHub Actions (run 41806670663) on the public npm registry.

- Popular packages (latest release): 400 packages read. Staged with human approval: 31; trusted publishing (OIDC) only: 168; neither: 201 (50.2%, 95% CI 45.4%–55.1%).
- Previously hijacked packages (latest release): 22 packages read. Staged with human approval: 2; trusted publishing (OIDC) only: 7; neither: 13 (59.1%, 95% CI 38.7%–76.7%).

Verdict (pre-registered rule): supported: 50.2% of popular packages' latest releases used neither trusted publishing nor staged approval (≥ 40%).

Caveats: 'neither' includes interactive publishes protected by 2FA, which the registry metadata doesn't distinguish from token publishes, so it is an upper bound on exposure to stolen tokens. Popularity comes from the npm search API's ranking for six broad keywords.
