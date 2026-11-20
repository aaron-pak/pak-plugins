---
name: full-send
description: Trigger this if the user says 'full send'.
---

# Full Send

Take the work from its current state to a merged PR. You own it the whole way.

Read [ready-pr](../ready-pr/SKILL.md) and follow it. Then:

6. **Merge** when the merge gate passes. The user grants you permission to
   merge.
7. **Report** in your final message: the PR link, the merge commit, your proof,
   and each decision you made for the user.

## Merging

Merge with the method the repo uses. Check the allowed methods and recent merged
PRs. If the repo uses a merge queue or auto-merge, stay until GitHub reports the
PR as merged. Merge through branch protection as configured. Never use `--admin`
or other bypasses.
