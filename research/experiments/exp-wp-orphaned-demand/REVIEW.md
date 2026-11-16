# Manual check: exp-wp-orphaned-demand

For each of the 10 most-downloaded live orphans, a research session searches the directory for a maintained plugin (updated in the last 12 months) that does the same job for most users. **Unserved** = none found. **Served** = at least one found (named). Judged before any monetisation analysis.

1. `health-check` (Health Check &amp; Troubleshooting): 200,000 installs, last updated 2024-07-25, 24747 downloads in 30 days. Tag-rule alternatives: none.
   - Judgement: **served**. Its troubleshooting mode (plugins off for your session only) is offered by maintained wp-safe-mode (2,000 installs, updated 2026-09-24) and plugin-detective (5,000, updated 2026-11-03). Its site checks and debug info also ship in WordPress core as Site Health (background knowledge, not checked in this session). It's a WordPress.org team project.
2. `yet-another-related-posts-plugin` (YARPP &#8211; Yet Another Related Posts Plugin): 100,000 installs, last updated 2024-11-11, 13916 downloads in 30 days. Tag-rule alternatives: contextual-related-posts.
   - Judgement: **served**. Maintained related-posts plugins: contextual-related-posts (50,000, updated 2026-11-03), intelly-related-posts (100,000, updated 2026-08-03), plus Jetpack's related posts.
3. `transients-manager` (Transients Manager): 20,000 installs, last updated 2024-10-18, 8813 downloads in 30 days. Tag-rule alternatives: none.
   - Judgement: **served**, barely. leira-transients (updated 2026-02-24) does the same job (browse, search, edit and delete transients), but it has only 20 installs against this plugin's 20,000. The alternative exists but almost nobody has found it.
4. `disable-json-api` (Disable REST API): 80,000 installs, last updated 2023-09-14, 8379 downloads in 30 days. Tag-rule alternatives: integromat-connector.
   - Judgement: **served**. disable-wp-rest-api (30,000, updated 2026-08-10) does the same job.
5. `limit-login-attempts` (Limit Login Attempts): 200,000 installs, last updated 2023-04-04, 7974 downloads in 30 days. Tag-rule alternatives: loginizer, sg-security, two-factor, wps-limit-login, hide-my-wp.
   - Judgement: **served**. limit-login-attempts-reloaded (1,000,000, updated 2026-11-13), plus security suites such as Wordfence and sg-security.
6. `simple-taxonomy-ordering` (Simple Taxonomy Ordering): 10,000 installs, last updated 2023-03-22, 6828 downloads in 30 days. Tag-rule alternatives: acf-extended, catch-ids, term-management-tools, wp-term-order.
   - Judgement: **served**. taxonomy-terms-order (500,000, updated 2026-10-30) and custom-taxonomy-order-ne (50,000, updated 2026-09-28).
7. `ts-webfonts-for-sakura` (TS Webfonts for さくらのレンタルサーバ): 30,000 installs, last updated 2024-02-14, 5630 downloads in 30 days. Tag-rule alternatives: none.
   - Judgement: **unserved**, but not addressable. A web-font plugin from the hosting company Sakura Internet, which works only on its own servers with fonts licensed to its customers (the description says it won't work elsewhere). No third party could offer a replacement.
8. `recaptcha-for-mw-wp-form` (reCAPTCHA for MW WP Form): 30,000 installs, last updated 2024-05-09, 5046 downloads in 30 days. Tag-rule alternatives: mw-wp-form.
   - Judgement: **served**. MW WP Form itself is maintained (minimal maintenance, updated 2026-09-27), and gdpr-compliant-recaptcha-for-all-forms (5,000, updated 2026-11-04) protects MW WP Form forms against spam. It uses a proof-of-work check rather than reCAPTCHA, but does the same job.
9. `display-posts-shortcode` (Display Posts &#8211; Easy lists, grids, navigation, and more): 70,000 installs, last updated 2024-10-14, 4964 downloads in 30 days. Tag-rule alternatives: none.
   - Judgement: **served**. list-category-posts (70,000, updated 2026-07-07), content-views-query-and-display-post-page (100,000) and latest-post-shortcode (4,000) list posts via shortcodes or blocks.
10. `blogger-importer` (Blogger Importer): 50,000 installs, last updated 2024-10-21, 4886 downloads in 30 days. Tag-rule alternatives: none.
   - Judgement: **served**. blogger-importer-extended (4,000, updated 2026-10-20) imports Blogger blogs.

## Tally

- Unserved: 1 of 10, and that one (#7) is a hosting provider's own plugin that no third party could replace. Served: 9.
- The automated tag rule found no alternative for 5 of these 10 (#1, #3, #7, #9, #10). A directory search found one for 4 of them, so the tag rule overstates gaps.

Pre-registered verdict: **refuted**. 158 live orphans is well above 10, but only 1 of the 10 most-downloaded is unserved (failure line: fewer than 2). Abandoned plugins' demand is almost always already served by a maintained alternative.
