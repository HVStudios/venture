# Sensitivity analysis: exp-publish-anomaly-campaign-replication

**Not pre-registered.** Computed after the pre-registered verdict ("supported") to show how much it depends on unclassified campaigns.

- 22 independent campaigns were analysed: 12 install-hook, 3 file-modification only, 7 unknown (the report text doesn't describe the mechanism).
- The verdict rests on exactly 15 classifiable campaigns, the minimum the design required.
- If all 7 unknown campaigns were non-signal cases, the share would be 12 of 22 (55%), below the 60% success threshold. If all were signal cases, it would be 19 of 22 (86%).
- The 3 file-modification campaigns (asyncapi, node-ipc, netspeedutil) injected code into existing files and would not trigger a new-dependency or install-hook alarm.

Interpretation: across independent attackers, most hijacks that can be characterised add an install-time hook, so a structural alarm would catch the majority. But at least one in five classifiable campaigns would slip through, and the result is sensitive to the campaigns whose mechanism is unknown.

Reproduce: count `campaigns[].mechanism` in `result.json`.
