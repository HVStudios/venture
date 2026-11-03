# Result: exp-publish-anomaly-campaign-replication

Executed 2026-11-03T23:41:51.496Z in GitHub Actions (run 41740429673) on OpenSSF malicious-packages reports and the public npm registry.

- Independent campaigns with a hijacked legitimate npm package: 22 (mechanisms: install-hook 12, new-dependency 0, file-modification 3, unknown 7).
- Campaigns with a new-dependency or install-hook signal: 12 of 15 classifiable (80.0%, 95% CI 54.8%–93.0%).
- Legitimate consecutive releases of the representative packages that add a dependency or install script: 7 of 423 (1.7%).

Verdict (pre-registered rule): supported: 80.0% of classifiable campaigns carry a dependency or install-hook signal (≥ 60%).

Notes: 1536 candidate report(s) 2024-01-01..2026-11-02 grouped into 121 campaign(s); 608 registry lookup(s); campaign grouping basis among analysed campaigns: identifier 1, named 4, day 17.

Caveats: campaigns are grouped heuristically (explicit identifier, named campaign, else publish day). Mechanisms are classified by keyword rules over report text. npm only.
