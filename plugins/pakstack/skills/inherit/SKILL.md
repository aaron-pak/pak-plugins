---
name: inherit
description: Take ownership of earlier, unfinished work, judge it against its intent and the project as it is now, and come back to the user with a call to continue, rework or drop it. Use when the user asks you to inherit earlier work, pick it back up, resume or revisit it, take a fresh look at it, bring an old branch or pull request up to date, or decide what should happen to it.
---

# Inherit

Someone started this work earlier and left it unfinished. It may have been the user, another person or another agent. The work is yours now. Understand what it was for, find out where it stands, and come back to the user with your honest call: continue it, rework it or drop it. Then work out the next step together.

## Own the intent

What you take on is the intent of the work, and the intent isn't the same thing as the work. The intent is what the user wanted from the work and why they wanted it. The task as it was worded is one way to serve that intent, and the work is one attempt at the task. So find the intent first, in what the user said and the reasons they gave, and measure the work against it.

Being the owner means the call is yours to make, and the call is only useful if it's honest. The earlier work has no claim on you because someone built it or because it took effort. It's also not suspect because it's old or because it isn't yours. Finishing work that no longer fits wastes the user's time, and so does rebuilding work that was sound. Make the call you'd make today, with everything the earlier work learned and everything it built in hand.

## Find where the work stands

You don't know what state the work was left in. It can be a pull request, a branch, uncommitted files in a worktree, notes, or only a conclusion in a thread. Look in earlier threads, in the repository, and in an issue tracker or documents when the environment has them, and ask the user when you can't tell which work they mean. In T3 Code, `t3_thread_search` and `t3_thread_read` find earlier threads. Claude Code keeps its transcripts in `~/.claude/projects/` and Codex in `~/.codex/sessions/`.

Earlier threads are where you learn the intent, the corrections the user made along the way, and what was tried and how it went. But a thread records what its writer believed at the time, so check what it says about the state of the work against the work itself.

Uncommitted files that belong to the work are part of it, and they can be its newest version. Read them and judge them with the rest, and leave them as they are.

If another thread is still working on this, tell the user and go no further. Two agents changing the same work undo each other.

## Bring it up to date

If the work has fallen far enough behind its base branch to matter, rebase it onto the current base. You can only judge the work against the code as it is now, and whoever continues the work needs a base to build on. The rebase is usually worth doing before you make the call. The exception is when you can already see the work won't continue in its current form, because then nobody will use the rebased branch.

A rebase must cost the work nothing:

- If the worktree is in use or has uncommitted changes, rebase in a separate worktree so those changes stay untouched. They won't be on the rebased branch, so say that when you report.
- Resolve each conflict so the work keeps its purpose and follows the newer code. Some conflicts are really a disagreement about design, where the base now does the same job another way. A conflict like that is a question for your call, not something to settle line by line, so abort the rebase and weigh the disagreement when you make the call.
- Check the result. `git range-diff` compares the commits before and after, and shows anything the rebase lost or brought back. Run the tests and checks for the area the work changes, and keep new failures apart from failures that were already there.

## Make the call

Two questions decide the call. Is the work a sound way to serve the intent, however far along it is? And does it still fit the project as it is now, with the current code and any other work on the same problem? A rebase, clean or hard, answers neither question, because it shows only whether the changes still apply. For work that isn't code, the second question is whether the facts the work depends on are still true.

- **Continue.** The intent and the approach both hold. What remains is to finish, and to fix what needs fixing on the way.
- **Rework.** The intent holds, and the way the work serves it should change: one part, the whole approach, or the task itself. Say what you'd keep.
- **Drop.** The work shouldn't be finished, in this form or another.

Each of the three is a good result when the evidence points to it.

## Come back with the call

Lead with the call and the reason for it. Then give the evidence, and keep what you saw apart from what you conclude from it, so the user can weigh your judgment for themselves. Say what you couldn't check, and what you'd do next.

If the call is to continue and you rebased a branch, push it, so the branch the user sees is the branch you judged. Use `git push --force-with-lease=<branch>:<sha>`, where `<sha>` is the remote commit you saw before the rebase. The push then fails if someone else pushed in the meantime, and if it fails, fetch and look again. Don't push to another person's branch unless the user asked for that.

Apart from the rebase and that push, change nothing before the user answers. Merging, closing and starting a rework all wait for the user.
