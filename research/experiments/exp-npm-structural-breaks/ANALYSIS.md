# Exploratory analysis: exp-npm-structural-breaks

**Not pre-registered.** Computed after the audit, to see which rules carry the precision.

Audited flags by rule (a flag can match several rules):

| Rule | Audited flags | Genuine | Notes |
|---|---|---|---|
| exports-subpath-removed | 3 (#11, #15, #19) | 3 | One was confirmed by the maintainers' own deprecation message. |
| bin-removed | 1 (#7) | 1 | |
| peer-tightened | 2 (#2, #4) | 2 | Peer-conflict errors for users on the older peer major. |
| peer-added | 4 (#3, #13, #17, #18) | 1 | Usually documents an existing requirement; npm installs it. |
| exports-map-added | 7 (#5, #8, #10, #12, #14, #16, #20) | 6 | 5 of the 6 only via deep imports of undocumented files; #12 is a pairing artifact. |
| switched-to-esm | 5 (#8, #9, #10, #16, #20) | 4 | Only #16 breaks the root import; the others keep a `require` entry. |
| entry-removed | 2 (#1, #6) | 0 | Fields still served through exports conditions. |

- **Removal rules** (export path removed, CLI command removed, a peer's minimum major raised) were genuine in 6 of 6 audited flags here and 7 of 7 in the first audit (#4, #7, #8, #12, #15, #16, #19 there). They flag 17 of 400 packages in this population (4.3%) and 21 of 400 in the first (5.3%).
- **Additive rules** (exports map added, ESM switch, new peer, entry field removed) are where the judgement calls are. They mostly affect undocumented deep imports or are compensated elsewhere in the manifest.
- **Pairing flaw:** comparing each release with the previously *published* one pairs maintenance backports with a different line (vue-i18n 9.1.11 → 9.14.4). A real tool should compare with the next-lower version.

Interpretation: two independent samples now agree that a small set of removal rules is precise (13 of 13 audited flags genuine). But it fires for only about 1 in 20 popular packages over two years. That's worth a feature in an existing linter, not a standalone tool. The broader structural rule set doesn't reach 70% precision under any reading of the criteria.
