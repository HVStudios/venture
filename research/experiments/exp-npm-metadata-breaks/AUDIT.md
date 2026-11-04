# Audit sample (fixed seed): exp-npm-metadata-breaks

Criteria, fixed before judging: **genuine** = a user on a setup supported at release time can no longer install, import or run something that previously worked. **debatable** = affects only end-of-life Node lines, old patch levels within a supported line, or setups where npm merely warns. **not genuine** = a correction of already-wrong metadata, or a revert of something added by mistake. Judged by a research session using registry metadata and release dates.

1. `@inquirer/confirm@6.1.0->6.1.1`: engines.node >=23.5.0 || ^22.13.0 || ^21.7.0 || ^20.12.0 → >=23.5.0 || ^22.13.0 || ^20.17.0
   - Judgement: **debatable**. Drops Node 21 and 20.12–20.16 only; both lines end-of-life when released (2026-05). Part of one @inquirer release wave.
2. `@eslint/js@10.0.0->10.0.1`: engines.node ^18.18.0 || ^20.9.0 || >=21.1.0 → ^20.19.0 || ^22.13.0 || >=24
   - Judgement: **not genuine**. Correction: eslint 10.0.0 itself already required ^20.19.0 || ^22.13.0 || >=24; @eslint/js 10.0.0's wider range was wrong.
3. `@typescript-eslint/typescript-estree@8.17.0->8.18.0`: new required peer typescript@>=4.8.4 <5.8.0
   - Judgement: **debatable**. An optional typescript peer became required with <5.8.0; no released TypeScript was excluded at release (2024-12), and users of a TypeScript parser have TypeScript.
4. `@hookform/resolvers@5.7.1->5.8.0`: peer vest >=3.0.0 → >=6.0.0
   - Judgement: **genuine**. Optional peer vest raised from >=3 to >=6: projects with vest 3–5 hit npm peer-conflict errors (ERESOLVE).
5. `@tanstack/router-generator@1.161.3->1.161.4`: engines.node >=12 → >=20.19
   - Judgement: **debatable**. Node >=12 → >=20.19 in 2026-02: excludes end-of-life Node 18 and old 20.x patch levels only.
6. `@inquirer/core@11.2.0->11.2.1`: engines.node >=23.5.0 || ^22.13.0 || ^21.7.0 || ^20.12.0 → >=23.5.0 || ^22.13.0 || ^20.17.0
   - Judgement: **debatable**. Same @inquirer wave as #1.
7. `better-auth@1.6.30->1.7.0`: exports removed: ./plugins/mcp/client, ./plugins/oidc-provider, ./plugins/mcp/client/adapters
   - Judgement: **genuine**. Export paths ./plugins/mcp/client, ./plugins/oidc-provider and ./plugins/mcp/client/adapters removed: those imports fail.
8. `better-result@2.7.0->2.8.0`: bin removed: better-result
   - Judgement: **genuine**. The better-result CLI (present 2.0.0–2.7.0) was removed in 2.8.0.
9. `@tanstack/react-start-server@1.131.50->1.132.0`: engines.node >=12 → >=22.12.0
   - Judgement: **genuine**. Node >=12 → >=22.12.0 in 2025-09 excludes Node 20, still supported at the time.
10. `@inquirer/external-editor@3.0.1->3.0.2`: engines.node >=23.5.0 || ^22.13.0 || ^21.7.0 || ^20.12.0 → >=23.5.0 || ^22.13.0 || ^20.17.0
   - Judgement: **debatable**. Same @inquirer wave as #1.
11. `@better-auth/telemetry@1.3.34->1.4.0`: types field removed (was ./dist/index.d.ts); new required peer @better-auth/core@1.4.0
   - Judgement: **debatable**. The types field was removed but types are still served via exports conditions; @better-auth/core moved from dependency to peer, which npm 7+ installs automatically.
12. `@better-auth/core@1.4.22->1.5.6`: exports removed: ./utils; new required peer @opentelemetry/api@^1.9.0
   - Judgement: **genuine**. Export ./utils removed: imports of @better-auth/core/utils fail.
13. `@supabase/supabase-js@2.78.0->2.79.0`: engines.node (none) → >=20.0.0
   - Judgement: **debatable**. Node >=20 added in 2025-11; only end-of-life Node 18 is excluded.
14. `@supabase/realtime-js@2.78.0->2.79.0`: engines.node (none) → >=20.0.0
   - Judgement: **debatable**. Same as #13 (same Supabase release).
15. `@better-auth/core@1.4.20->1.5.0`: exports removed: ./utils
   - Judgement: **genuine**. Same ./utils removal as #12, seen from a different version pair.
16. `oxlint@1.36.0->1.37.0`: bin removed: oxc_language_server
   - Judgement: **genuine**. The oxc_language_server binary was removed: editor integrations invoking it break.
17. `@inquirer/editor@5.2.0->5.2.1`: engines.node >=23.5.0 || ^22.13.0 || ^21.7.0 || ^20.12.0 → >=23.5.0 || ^22.13.0 || ^20.17.0
   - Judgement: **debatable**. Same @inquirer wave as #1.
18. `@inquirer/rawlist@5.3.0->5.3.1`: engines.node >=23.5.0 || ^22.13.0 || ^21.7.0 || ^20.12.0 → >=23.5.0 || ^22.13.0 || ^20.17.0
   - Judgement: **debatable**. Same @inquirer wave as #1.
19. `@tanstack/router-plugin@1.167.32->1.167.33`: bin removed: intent
   - Judgement: **genuine**. The intent CLI (shipped in 35 versions over 6 weeks, from 1.166.13) was removed in 1.167.33.
20. `@inquirer/prompts@8.5.0->8.5.1`: engines.node >=23.5.0 || ^22.13.0 || ^21.7.0 || ^20.12.0 → >=23.5.0 || ^22.13.0 || ^20.17.0
   - Judgement: **debatable**. Same @inquirer wave as #1.

## Summary

Genuine: 8 of 20 (40%). Debatable: 11. Not genuine: 1.

Pre-registered verdict: **refuted**. Fewer than 50% of audited flags are genuine (the frequency criterion, 20.0% of packages, was met exactly).
