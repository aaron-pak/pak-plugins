---
name: takeover
description: Take over earlier, unfinished work and finish it without a check-in. The result is a pull request that is ready for the user to merge. Use when the user asks to take over a pull request, a branch, a thread or other earlier work, or asks for earlier work to be finished for them.
---

# Takeover

The user is handing you earlier, unfinished work and trusts you to finish it. Decide what should
happen to the work, then do it, all the way, without a check-in. For a code change, you end at a
pull request that's ready for the user to merge. The merge itself stays with the user.

Takeover is [inherit](../inherit/SKILL.md) with the authority to act on your own call. Read the
inherit skill and follow it up to the call. Skip its last section, "Come back with the call":
you act on the call instead of waiting, and put the call and its evidence in your final report.

## Carry out the call

The work is yours, and so is the way it gets finished. If the call is to continue, finish what's
there. If the call is to rework, the earlier work is material to build from: keep the parts that
serve the intent and build the rest again, from nothing if that's the better way. Simplify where
the work is more complex than its intent needs.

Through all of that, keep what the work was for. Before you change or replace anything, list the
behavior the work was meant to have and the places where a user or other code meets it, and
check your result against the list, because a simpler version that quietly does less isn't the
same work. If part of that behavior no longer makes sense, say so in your report instead of
quietly leaving it out. Your limit in the other direction is the piece of work you took over.
Finish it, and leave nearby improvements out, even ones the same intent would welcome.

Building teaches you things reading couldn't. If what you learn changes the call, follow the new
call and say so in your report.

Dropping the work is also a way to finish it. If that's the call, build nothing, and report the
call and the evidence. Leave the pull request open and the branch in place, because closing and
deleting are the user's to do.

Where you build depends on whose work it is. The user's own work continues on its branch and in
its pull request, unless a rework replaces so much that a new branch and pull request are
clearer. If the work belongs to another person, build on a new branch and leave their branch and
pull request alone unless the user asked otherwise. Keep their authorship on the commits you
reuse, and credit them in your pull request. Their work can keep moving while you build, so look
at it once more before you finish.

## Finish

For a code change, the finish is [full-stop](../full-stop/SKILL.md), which takes a change to a
pull request that's tested, reviewed and ready to merge. Read it before you start, because its
rules on merging and on how to ask the user apply from the start, and follow its workflow once
the change is built. Asking for a takeover is asking for a "full stop", so you have the
permissions it gives. If the user asked for the work to be merged, follow
[full-send](../full-send/SKILL.md) instead.

Two things in that workflow differ for a takeover. Its first step, finishing the change, is the
building you've already done to carry out your call. And where it would ask the user because
another pull request makes the work obsolete, that's a drop, and the call is yours.

When the work isn't a code change, finish it in the form the intent calls for, and say where the
result is and what you couldn't check.

Your final report also covers the takeover itself: what you took over, your call and the reason
for it, and what you kept, changed or replaced. If your call rests on reading the intent more
widely than the task as it was worded, say that plainly, because the user wasn't there to agree
to it. List anything the user can now close or delete.
