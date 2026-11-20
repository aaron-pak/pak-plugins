---
name: catchup
description: Catch the user up on a piece of work. Report what was done, where it stands now, what is waiting on the user, and what to do next. Use when the user asks to be caught up, or asks for the status or the outcome of work, for example "catch me up", "where are we", "where did we leave off" or "what happened with that". The work can be in this thread or anywhere else. This skill only reports and never changes the work.
---

# Catch up

The user has been away from a piece of work and wants to know where it stands. Tell them what
was done, what state it's in now, what is waiting on them, and what you'd do next. Then stop. A
catch-up reports on the work and leaves it exactly as it was.

The user runs many threads at once and rarely watches one of them work. They send a thread off,
turn to something else, and come back minutes or weeks later. They didn't see the tool calls,
the reasoning or the dead ends, so assume their own last message is the last thing they know.
The catch-up has done its job when the user can decide what happens next from your reply alone,
without opening a thread, a diff or a pull request to check it.

The work can be in this thread or somewhere else. It can be finished, still running or left half
done, and it can belong to the user, another person or another agent. The job is the same in
every case.

## Find the work

If the work is in this thread, you already have most of it. After a compaction, the summary is
enough for the goal and the decisions, and the transcript is there for any fact the summary
lost.

If the work is somewhere else, work out which work the user means from what they said and from
the branch you're on, and ask when you can't tell. Then look where work leaves a trace:

- Earlier threads hold what the user asked for and what was tried. In T3 Code, use
  `t3_thread_search` and `t3_thread_read`. Claude Code keeps its transcripts in
  `~/.claude/projects/` and Codex in `~/.codex/sessions/`, and each machine has only its own.
- The repository holds what was made: branches, worktrees, commits and pull requests.
- An issue tracker, documents, chat or mail can hold more, when the environment has them.

Work doesn't always end in a pull request. It can be uncommitted files in a worktree, a page of
notes, or only a conclusion a thread reached.

One piece of work often runs through several threads, with restarts and changes of direction.
The user wants the present, so follow the work to its latest state and use the earlier threads
to explain how it got there. If the latest state isn't what the user asked for, say so.

## Report the present

A thread records what was true when it was written. Since then, a branch can have fallen behind
or been merged, checks can have finished, a reviewer can have answered, and other work can have
solved the same problem. So look again at anything your report depends on that could have
changed, and where the record and the present disagree, report the present.

How much to check depends on how long the work has sat. Twenty minutes after the user's last
message, little outside the thread has moved. After a week, the difference between the record
and the present may be the most useful thing in your report.

Checking mustn't disturb anything. Fetch and read as much as you need, but leave the files, the
branches and any running work as they are. `git merge-tree --write-tree <base> <branch>` shows
whether a branch still merges cleanly without changing a file.

## Write the report

Open with one sentence that gives the goal of the work and where it stands now. After that, the
user needs up to four things:

- **Done.** The results. Leave out the story of how they were reached, except where it explains
  a result.
- **Not done.** What is in progress, blocked or missing, and anything the user asked for that
  didn't happen.
- **Needs you.** Each decision or action only the user can take. Give what the choice changes,
  the evidence and your recommendation, so the user can answer on the spot.
- **Next.** What you'd do, and why.

Leave out a part that has nothing in it, and keep the report as short as the work allows. A
catch-up on twenty minutes of work can be three lines. Write for someone who wasn't there, in
plain words and not in the names a thread made up for things along the way.

Where a fact rests only on the record, or you couldn't check it, say so. The user will decide on
what you tell them, and a claim you repeat without checking reads the same as a fact.
