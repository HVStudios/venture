# Exploratory analysis: exp-publish-anomaly-retrospective

**Not pre-registered.** Computed after the pre-registered verdict ("supported") to check the independence of the incidents.

- 56 of the 60 analysed incidents were published on 2026-08-04 and their OSV reports attribute them to the same Shai-Hulud campaign wave.
- The 60 incidents span only 9 package scopes; @qlik (21) and @nebula.js (16) alone account for 37.
- Counted by campaign instead of by package, the sample contains about 5 independent attacks, far below the 15 the design intended.

Interpretation: the pre-registered verdict stands as recorded, but it rests mostly on one worm campaign whose payload used `preinstall` hooks. It shows that this campaign would have been caught by an install-hook diff with a low false-positive rate (1.3% of legitimate releases). It does not establish that hijacks in general carry such signals. The asyncapi compromise (2026-07-14, outside the newest-60 sample) modified an existing file and would not have triggered either signal.

Reproduce: group the `incidents` in `result.json` by `published` date and by package scope, and read the campaign attribution in each OSV report (`ossf/malicious-packages`, `osv/malicious/npm/<package>/<id>.json`).
