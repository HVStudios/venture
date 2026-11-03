# Result: exp-publish-anomaly-retrospective

Executed 2026-11-03T23:02:06.790Z in GitHub Actions (run 41735491312) on OpenSSF malicious-packages reports and the public npm registry.

- Hijacked legitimate npm packages analysed: 60 (mechanisms: install-hook 58, new-dependency 0, file-modification 0, unknown 2).
- Incidents with a new-dependency or install-hook signal: 58 of 58 classifiable (100.0%).
- Legitimate consecutive releases that add a dependency or install script: 14 of 1119 (1.3%).

Verdict (pre-registered rule): supported: 100.0% of incidents carry a signal (≥ 60%) and 1.3% of legitimate releases do (< 10%).

Caveats: mechanisms are classified by keyword rules over report text (matched phrases are in result.json for audit). Reports vary in detail. npm only.
