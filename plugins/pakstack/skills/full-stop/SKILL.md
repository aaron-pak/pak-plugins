---
name: full-stop
description: Take the work to a pull request that is ready for the user to merge, and never merge it. Use when the user says "full stop", even as a closing "Full stop." that reads like emphasis.
---

# Full Stop

Take the work from its current state to a PR that is ready for the user to merge, then hand it back. Never merge it.

Read [ready-pr](../ready-pr/SKILL.md) and follow it. The rules below apply from the start.

## No merging

You may commit, push, rebase, fix conflicts, and use `--force-with-lease` on this task's branch. Never merge, enable auto-merge, enter a merge queue, push to the default branch, bypass branch protection, or delegate those actions.

Disable existing auto-merge and remove the PR from any merge queue before work begins; check again before each push. Report these changes. If you cannot prevent automatic merging, report the blocker before proceeding.

## Stop at the gate

The work ends with a handoff. Proof must cover the final diff; recheck behavior changes and meaningful conflict fixes before handoff.

Fetch the target branch and check the live PR's head, base, checks, reviews, and mergeability. Confirm it is open, not a draft, and not set to merge without the user. If someone else merged it, report that instead.

- **Ready to merge:** the merge gate passes. Leave the PR open and unmerged.
- **Waiting for required approval:** only human approval remains. Confirm that this is the actual blocker.
- **Blocked:** explain what prevents readiness, what you tried, and what is needed. Follow ready-pr's rules for asking the user.

Report the PR link, final head, verdict, proof, reviewer outcome, and remaining risks. State whether the PR is still open and unmerged.
