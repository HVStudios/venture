# Exploratory analysis: exp-wp-orphaned-demand

**Not pre-registered.** Notes made after the manual check.

- **Abandonment among popular plugins is lower than the old figure.** 158 of the 2,151 plugins with ≥ 10,000 installs (7.3%) went 24 months without an update. The 2015 "about half" figure covered the whole directory, including tiny plugins.
- **The download threshold didn't filter anything.** Every one of the 158 had at least 518 downloads in 30 days (median 1,118). Popular abandoned plugins keep being installed, but the threshold of 300 was too low to separate them. Downloads may also include automated installs (hosting set-ups, site migrations), which this experiment can't tell apart.
- **The tag rule overstates gaps.** Among the top 10 it found no alternative for 5, while a directory search found one for 4 of those. So the 59 "unserved by tag rule" in result.json is an upper bound, not a count of gaps.
- **The real pattern is "served, but not found."** Transients Manager (20,000 installs, 8,813 downloads a month) has a maintained twin with 20 installs. People keep picking the abandoned plugin because it is known and ranks well, not because nothing else exists. That's a discovery and migration problem, not a missing product. It's also harder to make money from: users would be paying to switch from something that still works.

Interpretation: building a replacement for an abandoned plugin is rarely filling an empty niche. It means competing with existing maintained plugins for users who haven't felt enough pain to switch. That's not the easy small-money opportunity the idea assumed.
