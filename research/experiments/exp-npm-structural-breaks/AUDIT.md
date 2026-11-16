# Audit sample (fixed seed, one per package family): exp-npm-structural-breaks

Criteria (same as exp-npm-metadata-breaks, fixed before judging): **genuine** = a user on a setup supported at release time can no longer install, import or run something that previously worked. **debatable** = affects only end-of-life Node lines, old patch levels within a supported line, or setups where npm merely warns. **not genuine** = a correction of already-wrong metadata, or a revert of something added by mistake.

1. `nuxt-security@2.2.0->2.3.0`: main field removed (was ./dist/module.cjs); types field removed (was ./dist/module.d.ts)
   - Judgement: _pending_
2. `pinia-plugin-persistedstate@4.2.0->4.3.0`: peer pinia >=2.3.0 → >=3.0.0
   - Judgement: _pending_
3. `eslint-plugin-oxlint@1.56.0->1.57.0`: new required peer oxlint@~1.57.0
   - Judgement: _pending_
4. `@storybook/addon-vitest@10.6.2->10.6.3`: peer vitest ^3.0.0 || ^4.0.0 || ^5.0.0 → ^4.0.0 || ^5.0.0; peer @vitest/browser ^3.0.0 || ^4.0.0 || ^5.0.0 → ^4.0.0 || ^5.0.0
   - Judgement: _pending_
5. `eslint-plugin-no-only-tests@3.3.0->3.4.0`: exports map added (blocks deep imports that previously worked)
   - Judgement: _pending_
6. `@nuxt/ui@3.0.2->3.1.0`: types field removed (was ./dist/types.d.ts)
   - Judgement: _pending_
7. `boneyard-js@1.1.0->1.1.1`: bin removed: boneyard
   - Judgement: _pending_
8. `eslint-plugin-mdx@3.2.0->3.3.0`: exports map added (blocks deep imports that previously worked); type: (commonjs) → module
   - Judgement: _pending_
9. `eslint-plugin-import-x@4.9.4->4.10.0`: type: commonjs → module
   - Judgement: _pending_
10. `eslint-plugin-testing-library@7.14.0->7.15.0`: exports map added (blocks deep imports that previously worked); type: (commonjs) → module
   - Judgement: _pending_
11. `shaders@3.0.443->3.0.444`: exports removed: ./pixi
   - Judgement: _pending_
12. `vue-i18n@9.1.11->9.14.4`: exports map added (blocks deep imports that previously worked)
   - Judgement: _pending_
13. `eslint-plugin-mocha@11.0.0->11.1.0`: new required peer eslint@>=9.0.0
   - Judgement: _pending_
14. `eslint-config-turbo@2.3.1->2.3.2`: exports map added (blocks deep imports that previously worked)
   - Judgement: _pending_
15. `@scalar/api-reference@1.51.0->1.52.0`: exports removed: ./ssr
   - Judgement: _pending_
16. `prettier-eslint@17.0.1->17.1.0`: exports map added (blocks deep imports that previously worked); type: commonjs → module
   - Judgement: _pending_
17. `@typescript-eslint/rule-tester@8.59.1->8.59.2`: new required peer typescript@>=4.8.4 <6.1.0
   - Judgement: _pending_
18. `splitpanes@3.1.6->3.1.8`: new required peer vue@^3.2.0
   - Judgement: _pending_
19. `eslint-plugin-cypress@5.3.0->5.4.0`: exports removed: ./flat
   - Judgement: _pending_
20. `eslint-mdx@3.2.0->3.3.0`: exports map added (blocks deep imports that previously worked); type: (commonjs) → module
   - Judgement: _pending_
