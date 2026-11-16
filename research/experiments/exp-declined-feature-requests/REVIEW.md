# Manual review: exp-declined-feature-requests

Each sampled issue is an **opportunity** only if all four hold: (1) it is a genuine feature request, not a bug; (2) maintainers declined it (said they won't build it, or that it's out of scope), not merely closed it as stale or a duplicate; (3) it could be delivered as a separate add-on (extension, plugin, wrapper or companion tool) without forking the project; (4) no maintained third-party add-on doing it was found by a search of GitHub, npm and the tool's extension marketplace.

1. [microsoft/vscode#249826](https://github.com/microsoft/vscode/issues/249826): Add support for Bluetooth for web extensions (70 upvotes, 6 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Not declined by maintainers: VS Code's bot closed it automatically because it had fewer than 20 upvotes within its 60-day voting window (it passed 20 later). It's also not buildable as an add-on, since Bluetooth access for web extensions has to come from the platform.
2. [google-gemini/gemini-cli#5874](https://github.com/google-gemini/gemini-cli/issues/5874): Feature: Neovim IDE Integration (42 upvotes, 11 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Declined ("we don't have immediate plans to address this specific issue"), but already served: free third-party Neovim plugins exist, e.g. gutsavgupta/nvim-gemini-companion (85 stars, updated 2026-06-30) and vaijab/gemini-cli.nvim (updated 2026-04-09).
3. [microsoft/playwright#35294](https://github.com/microsoft/playwright/issues/35294): [Feature]: all locators only select visible elements by default (32 upvotes, 9 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Not declined: closed in a bulk retirement of the P3-collecting-feedback label, with the note "This doesn't mean the request is wrong." A maintainer also said the scope is substantial, so it's core work, not an add-on.
4. [Dokploy/dokploy#1851](https://github.com/Dokploy/dokploy/issues/1851): Move project to different organization (23 upvotes, 16 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Declined ("we are not proceeding with this for now"). Moving a project between organizations changes ownership inside Dokploy's own database; no API or add-on route was found (GitHub repository search: no results).
5. [netdata/netdata#19007](https://github.com/netdata/netdata/issues/19007): [Feat]: disable Netdata cloud sign-in splash (31 upvotes, 9 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Declined as a business decision ("it's not my decision"). The maintainer named existing workarounds (sign in, or use the /v3 endpoint), so an add-on would add little.
6. [usebruno/bruno#6816](https://github.com/usebruno/bruno/issues/6816): Change default workspace location (28 upvotes, 20 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Closed by a maintainer without explanation, so it counts as declined. But Bruno's default workspace location is core application behaviour; no extension route was found.
7. [OpenHands/OpenHands#5325](https://github.com/OpenHands/OpenHands/issues/5325): Support podman (25 upvotes, 26 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Not declined: closed automatically by a stale bot after 50 days of inactivity. A collaborator noted some users had it working.
8. [herdrdev/herdr#261](https://github.com/herdrdev/herdr/issues/261): Support placeholders in [worktrees].directory for sibling-folder layouts (24 upvotes, 13 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Closed by the maintainer, and already served by free third-party plugins mentioned in the thread (herdr-worktrunk and herdr-repo-worktrees).
9. [notepad-plus-plus/notepad-plus-plus#15932](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/15932): Request for Apolitical Release Notes and Documentation (35 upvotes, 13 comments, pay offers: 0)
   - Judgement: **not an opportunity**. Not a software feature: a request about the wording of release notes and documentation. No close event was recorded in the timeline.

## Tally

- Opportunities: 0 of 9.
- Not actually declined (closed by a bot or in bulk): 3 (#1, #3, #7). Declined but already served by free add-ons or workarounds: 3 (#2, #5, #8). Declined but not buildable as an add-on: 2 (#4, #6). Not a feature: 1 (#9).
- Offers to pay: 0 of 9 threads.
- Deviation: the pre-registered sample size was 20, but only 9 repositories had any qualifying request (31 requests in total, 19 of them in Playwright and VS Code). So all 9 eligible requests were reviewed. The thresholds are applied as absolute counts (at least 5 for success, at most 1 for failure).

Pre-registered verdict: **refuted**. 0 opportunities, at most 1 being the failure line.
