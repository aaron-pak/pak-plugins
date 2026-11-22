---
name: council
description: Bring in several delegates to review the work or give feedback, sum up what they find, and fix and review again until they are satisfied. Use when the user says "council".
---

# Council

Bring in several delegates to help with the user's request, usually for review or feedback. If the user names council members, use those. Otherwise read `~/.config/pakstack/models.md`, which the `setup-pakstack` skill writes, and use the council it names. If the file is missing, ask the user to run `setup-pakstack`.

Before a review of code, address outstanding PR comments, fix known issues, and run relevant checks. Give council the updated implementation; do not defer known fixes until reviews return. If the user wants to discard the implementation and explore new ideas, skip fixes to code being replaced.

Start one delegate per member, in parallel. If a member is unavailable, report it instead of substituting.

Give each delegate the request and relevant context. For review or feedback, keep their work read-only. Collect their responses and summarize the useful findings, disagreements, and recommended next steps.

Do not wait idle. When a result arrives, check its findings against the code at once and decide what to fix while the other delegates run. Do not edit files while a delegate still reviews the same checkout. If the user's instructions mark a delegate as non-blocking, do not wait for it; treat a late result as feedback and do not record its score.

For a code review, ask each delegate for a score out of 10. Count each full review pass as one round. A fresh review after fixes starts a new round.

If the work ends in a pull request, put the results in the PR description. Put this section before the model and harness line at the end:

```markdown
## Council review

Rounds: 2

| Delegate | Round 1 | Round 2 |
| --- | --- | --- |
| <model 1> | 7/10 | 9/10 |
| <model 2> | 8/10 | 10/10 |
| <model 3> | 7/10 | 9/10 |
```

If a delegate gives no score, write `no score`. Do not invent one. If the PR is open, edit the description. Do not post a comment for this. If there is no PR, put the same results in the final reply only.

If you agree with their recommendations, make the changes and request a fresh review after. Continue this process until all delegates are satisfied with the outcome.

Do not let repeated reviews result in scope creep. It is your job to fight to keep scope limited.
