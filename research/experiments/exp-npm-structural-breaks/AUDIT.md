# Audit sample (fixed seed, one per package family): exp-npm-structural-breaks

Criteria (same as exp-npm-metadata-breaks, fixed before judging): **genuine** = a user on a setup supported at release time can no longer install, import or run something that previously worked. **debatable** = affects only end-of-life Node lines, old patch levels within a supported line, or setups where npm merely warns. **not genuine** = a correction of already-wrong metadata, or a revert of something added by mistake.

1. `nuxt-security@2.2.0->2.3.0`: main field removed (was ./dist/module.cjs); types field removed (was ./dist/module.d.ts)
   - Judgement: **debatable**. The CommonJS entry (main and the exports `require` condition) and the `types` field were removed, but types are still served via exports conditions, Nuxt loads modules as ESM, and direct `require()` still works through require(esm) on Node 20.19+ and 22.12+. Only direct CommonJS consumers on older Node patch levels break.
2. `pinia-plugin-persistedstate@4.2.0->4.3.0`: peer pinia >=2.3.0 → >=3.0.0
   - Judgement: **genuine**. The optional pinia peer went from >=2.3.0 to >=3.0.0: projects still on pinia 2 get npm peer-conflict errors (ERESOLVE) on upgrade.
3. `eslint-plugin-oxlint@1.56.0->1.57.0`: new required peer oxlint@~1.57.0
   - Judgement: **genuine**. A new peer oxlint@~1.57.0 (pinned to the same minor) where 1.56.0 had none: projects with any other oxlint version installed get ERESOLVE. Users of this plugin normally have oxlint installed.
4. `@storybook/addon-vitest@10.6.2->10.6.3`: peer vitest ^3.0.0 || ^4.0.0 || ^5.0.0 → ^4.0.0 || ^5.0.0; peer @vitest/browser ^3.0.0 || ^4.0.0 || ^5.0.0 → ^4.0.0 || ^5.0.0
   - Judgement: **genuine**. The optional vitest and @vitest/browser peers dropped ^3.0.0 in a patch: projects on Vitest 3 get ERESOLVE.
5. `eslint-plugin-no-only-tests@3.3.0->3.4.0`: exports map added (blocks deep imports that previously worked)
   - Judgement: **genuine** (deep imports only). An exports map with only `.` was added: `require('eslint-plugin-no-only-tests/package.json')` and the shipped `rules/no-only-tests.js` can no longer be imported. The root import is unaffected.
6. `@nuxt/ui@3.0.2->3.1.0`: types field removed (was ./dist/types.d.ts)
   - Judgement: **debatable**. Same as #1: the CJS entry and `types` field were removed, types are still served via exports, and Nuxt loads modules as ESM. vue-router moved from dependency to optional peer, but Nuxt apps include it.
7. `boneyard-js@1.1.0->1.1.1`: bin removed: boneyard
   - Judgement: **genuine**. The CLI command was renamed from `boneyard` to `boneyard-js` in a patch release: scripts calling `boneyard` fail. Small blast radius: the command had existed for one day (1.0.0–1.1.0, all 2026-04-01).
8. `eslint-plugin-mdx@3.2.0->3.3.0`: exports map added (blocks deep imports that previously worked); type: (commonjs) → module
   - Judgement: **genuine** (deep imports only). Root import still works from CommonJS and ESM, but the new exports map blocks the previously shipped `lib/*` files (configs, processors, rules).
9. `eslint-plugin-import-x@4.9.4->4.10.0`: type: commonjs → module
   - Judgement: **debatable**. The switch to `type: module` kept a `require` condition for the root and a `./*` wildcard for deep paths. Deep paths now resolve to ESM files, which `require()` loads only through require(esm) on newer Node patch levels.
10. `eslint-plugin-testing-library@7.14.0->7.15.0`: exports map added (blocks deep imports that previously worked); type: (commonjs) → module
   - Judgement: **genuine** (deep imports only). Root import still works from CommonJS and ESM, but the new exports map blocks the previously shipped `dist/*` files (rules, configs, utils).
11. `shaders@3.0.443->3.0.444`: exports removed: ./pixi
   - Judgement: **genuine**. The `./pixi` export was removed in a patch release and never came back (last present in 3.0.443): `import 'shaders/pixi'` fails.
12. `vue-i18n@9.1.11->9.14.4`: exports map added (blocks deep imports that previously worked)
   - Judgement: **not genuine**. A harness artifact: 9.1.11 is a 2025 backport on the old 9.1 line, paired by publish date with 9.14.4. The 9.x exports map dates from 9.2.0 (2022), so no user upgrading within a line saw this change. The fix is to compare with the next-lower version, not the previously published one.
13. `eslint-plugin-mocha@11.0.0->11.1.0`: new required peer eslint@>=9.0.0
   - Judgement: **not genuine**. A metadata correction: the 11.0.0 changelog already lists "Stop supporting ESLint versions < 9". The peer added in 11.1.0 only documents it.
14. `eslint-config-turbo@2.3.1->2.3.2`: exports map added (blocks deep imports that previously worked)
   - Judgement: **genuine** (deep imports only). The new exports map (`.`, `./flat`) blocks `require('eslint-config-turbo/package.json')` and the shipped `.eslintrc.js`. The root import is unaffected.
15. `@scalar/api-reference@1.51.0->1.52.0`: exports removed: ./ssr
   - Judgement: **genuine**. The `./ssr` export was removed in a minor release and never came back (present 1.48.8–1.51.0): `import '@scalar/api-reference/ssr'` fails.
16. `prettier-eslint@17.0.1->17.1.0`: exports map added (blocks deep imports that previously worked); type: commonjs → module
   - Judgement: **genuine**. 17.0.1's root did `module.exports = format`. 17.1.0 is ESM-only with `export default format` and no `require` condition. On old Node `require('prettier-eslint')` fails; on Node with require(esm) it returns a namespace object, so calling it as a function throws.
17. `@typescript-eslint/rule-tester@8.59.1->8.59.2`: new required peer typescript@>=4.8.4 <6.1.0
   - Judgement: **debatable**. A new required peer typescript >=4.8.4 <6.1.0. No released TypeScript was excluded at release (2026-05; latest 6.0.3), and users of a TypeScript rule tester have TypeScript. Matches #3 of the first audit.
18. `splitpanes@3.1.6->3.1.8`: new required peer vue@^3.2.0
   - Judgement: **debatable**. A new required peer vue ^3.2.0. Only Vue 3.0–3.1 projects (2021 releases) are excluded, and npm installs the peer automatically.
19. `eslint-plugin-cypress@5.3.0->5.4.0`: exports removed: ./flat
   - Judgement: **genuine**. The `./flat` export was removed in 5.4.0. The maintainers deprecated 5.4.0 with the message "accidentally includes breaking changes from 6.0.0".
20. `eslint-mdx@3.2.0->3.3.0`: exports map added (blocks deep imports that previously worked); type: (commonjs) → module
   - Judgement: **genuine** (deep imports only). Same release train as #8 (eslint-mdx is the parser package): the root still works, but the new exports map blocks the previously shipped `lib/*` files.

## Tally

- Genuine: 13 of 20 (65%). Debatable: 5. Not genuine: 2.
- Of the 13 genuine flags, 5 (#5, #8, #10, #14, #20) are genuine only because an added exports map blocks deep imports of files the package shipped but did not document. Counting those as debatable gives 8 of 20 (40%).
- #8 and #20 are one release train (eslint-plugin-mdx and its parser eslint-mdx), which the one-per-family rule does not merge because both are unscoped.

Pre-registered verdict: **inconclusive**. 13 of 20 genuine is between the failure line (fewer than 10) and the success line (at least 14). The frequency criterion was met (12.3% of packages). Under a stricter reading of deep imports it would be refuted (8 of 20). Under no reading is it supported.
