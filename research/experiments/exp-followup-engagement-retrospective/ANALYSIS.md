# Exploratory analysis: exp-followup-engagement-retrospective

**Not pre-registered.** This breakdown was computed after the pre-registered verdict ("inconclusive"). Use it to generate hypotheses, not as confirmation.

Computed from `result.json` (same directory) with the script at the end of this file.

- Within LLVM only (same repository as the control): policy-closed PRs got an author reply in 38 of 47 cases (80.9%), versus 83 of 92 (90.2%) for merged LLVM newcomer PRs.
- Outside LLVM: policy-closed PRs got an author reply in 14 of 40 cases (35.0%). There is no same-repository control for these.
- 33 of 120 policy-closed PRs received no human comment at all before closing.
- Median time to author reply: 3.6 h (policy-closed, LLVM), 0.9 h (policy-closed, other repos), 6.1 h (newcomer-merged).

Interpretation: in a like-for-like comparison inside one repository, authors of policy-closed PRs reply almost as often as genuine newcomers. Follow-up engagement alone therefore looks like a weak filter. The lower reply rate outside LLVM may reflect differences between repositories rather than between contributors.

```python
import json, statistics
d = json.load(open("result.json"))
def st(rows):
    e = [r for r in rows if r["otherHumanComments"] > 0]; k = [r for r in e if r["authorReplied"]]
    h = sorted(r["hoursToReply"] for r in k)
    return len(e), len(k), len(k) / len(e) * 100, statistics.median(h)
pc = [r for r in d["rows"] if r["group"] == "policy-closed"]
print(st([r for r in pc if "/llvm/llvm-project/" in r["url"]]), st([r for r in pc if "/llvm/llvm-project/" not in r["url"]]),
      st([r for r in d["rows"] if r["group"] == "newcomer-merged"]))
```
