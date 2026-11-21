---
name: review-loop
description: Have one independent reviewer check a change over a few rounds, and fix what it finds without growing the change. Use when the user says "review loop".
compatibility: Needs the models file that the setup-pakstack skill writes.
---

# review-loop

This is a workflow for making your code changes more correct before (or sometimes after) filing a pull request. tl;dr - have an independent agent review your code in a loop.

Fix what the reviewer finds without expanding the scope of the change. A review tends to grow a change one finding at a time, so don't be scared to push back.

The reviewer rates each finding as a blocker, a should or a nit. A blocker means the intended case is wrong. A should is a real bug that callers will hit, within the intent. A nit is everything else.

## Budget

- Default: 3 rounds total. Round 1 is full. Later rounds check only changed code and open findings.
- Extend to 5 only for security, permissions, auth, data loss, or state/concurrency, while a blocker or should stays open with evidence. Or when the user asks.
- Stop early if a round returns only nits. Declined nits and comment, doc, or format-only fixes need no new round.
- One reviewer only. It must not start subagents or reviewers.
- Keep a ledger: id, severity, outcome, usage if returned. Never guess it.

## 1. Scope

Run `git status --short`. Do not stash, discard, or include unrelated changes. Limit review to the change paths if they separate cleanly. Otherwise stop and ask.

Find the base after `git fetch origin`:

- PR: `gh pr view <n> --json baseRefName,headRefOid`. Check out the branch only if clean. Confirm `HEAD` is the PR head, or ahead only by this change. Base: `git merge-base HEAD origin/<baseRefName>`.
- Local: `git merge-base HEAD origin/<default-branch>`. No remote: a base the user names, or `HEAD` for uncommitted changes only.

The change is base to working tree in those paths, with untracked files. Use one diff command all rounds. State intent and out-of-scope in 1-2 sentences. Run covering checks. Do not send code this change breaks. Note missing or pre-failing checks in the brief.

## 2. Start the reviewer

Read `~/.config/pakstack/models.md`, which the `setup-pakstack` skill writes, and choose the reviewer by it. Do not substitute a model. If the file is missing, ask the user to run `setup-pakstack`.

In T3 Code, use `delegate_task` every round (`role: "review"`, `mode: "async"`). Save `taskId`. New `clientRequestId` per round. `childThreadId` is storage, not the next target. Do not use `t3_thread_send`, `create_threads`, or `t3_thread_launch` for review. If T3 tools are not listed, try one direct `orchestrator_capabilities` call before you treat this as outside T3.

Outside T3, if the reviewer runs as a shell command, run it in the background, because a review can outlast a foreground command's time limit.

Do not edit scoped files while review runs. Wait for the notice. Do not poll or start a second reviewer. Timeout, error, or no reply is not approval. On failure, cancel, verify stop, restart with the ledger.

Round 1 brief (the reviewer gets no history):

```
Review only. Do not edit, commit, push, comment on PRs, or start subagents.
Repo: <abs path> Base: <sha> Intent: <intent> Out of scope: <scope> Checks: <results>
See: git diff <base> [-- <paths>]; git status --short (read untracked).
Read surrounding code. Find bugs, broken callers, mismatch with intent.
If the same bug appears in several places, report it once and list every place.
Skip style unless it hides a bug. Hold to the scope of the intent. Flag code,
tests, or guards the intent does not need. Other paths, rare cases, small
perf, extra compat: nits.
A bug that was already there, and that this change does not set out to fix, is a nit. Report it, but it does not block.
blocker = intended case wrong. should = real bug callers will hit, in intent. nit = rest.
Reply:
VERDICT: APPROVE or CHANGES
S1 [blocker|should|nit] <file>:<line> <claim>. Fix: <suggestion> (stable ids)
```

## 3. Answer findings

Check each finding and severity yourself. Another path, rare case, or small cost is a nit, whatever label it came with.

- Agree: fix it, without expanding the scope of the change. A fix that deletes or narrows code often beats one that adds a lock, cache, helper, or option. Add one focused test that fails without the fix, if intent needs it.
- Disagree: say why, with evidence (file:line, test, output).
- Out of scope or nit: decline in one line. List as follow-up.

Update the ledger. Re-run checks and `git diff --shortstat <base>`. If review grew the diff past the intent, cut that back first. Do not agree just to end the loop.

## 4. Next round

Start one only if budget remains and a blocker or should is open, behavior code changed, or approval does not cover the current behavior diff. Start the reviewer again, the same way. Send the round 1 brief, the ledger (`fixed:` / `disagree:` / `declined:` + evidence), the same base diff, and the change since last round. Tell the reviewer: open ids and changed code only. Mark each old id `resolved` or `still open: <reason>`.

## 5. Stop and ship

Agreed: APPROVE on the current behavior diff, no blocker or should open, no concern of your own. Stuck: an item stays disputed after two replies, or budget ends. Show both sides in 2-3 lines each. The user decides. Budget end is not approval.

Do not push during the loop. Push after agreement only if the user asked to push, ship, or update the PR. If the work ends in a pull request, add this to its description, before the model and harness line at the end:

`Reviewed with review-loop: <N> rounds with <model>. Verdict: approved`.

Add `on <effort>` only if verified.

Report: rounds, model, what the review changed, diff size before/after, fixed and declined findings with reasons, usage if exposed (else say not), pushed or not.
