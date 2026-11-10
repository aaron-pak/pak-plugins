# Cases from recorded moments

When the user points at a thread ("that reply where I got confused", "the turn where it spawned a
subagent for nothing"), build the case from the recorded moment rather than paraphrasing it. The
conversation before the moment becomes the history the run resumes, and the user's message becomes
the prompt. `principles.md`, "Cases from real moments", has the reasoning; this is the procedure.

1. **Find the moment.** A saved trace (`evals trace show <id>`), an id from the thread, or `evals
   sessions search --user-text '<words from their reaction>'`. `evals sessions turns <session>`
   lists a session's turns with each response's request id and what it did. For a target's saved
   traces run both `evals trace list --used <target>` (what the moment's turn used) and `--tag
   <target>` (what the user filed it under), and read each one's notes before keeping it. A note
   marked `inferred` is an agent's reading, not the user's.
2. **Decide with the user where the failure lives.** The first response of a turn is a decision
   case (`--kind decision`, one response, graded on it). Anything later in a turn, or the whole
   turn, is a turn case starting at the user's message. A run can only start at a user message, so
   a step after a tool result or inside a subagent is tested through its turn.
3. **Capture.** `evals capture --trace <id>` (or `--session <id> --moment <ref>`) `--out
   <work>/evals/<case>`, with `--plugin <dir>` when a plugin is under test. `<work>` is a folder
   outside the repository or ignored by git (`~/.claude/evals/suites/<name>` by default); capture
   refuses to write where git would commit it. Read `original.md` with the user. Everything in it
   after the cut (the agent's recorded turn, the user's reaction, the trace's notes) is evidence
   for grading and never reaches the agent under test.
4. **Write the graders from the user's reaction**: what they needed, as checkable claims rather
   than their exact words, plus `tool_used` for decisions ("no `Agent` call"). A decision case's
   judge sees only that one response, so quote the user's message and what they needed in the
   rubric. A turn case also needs its environment: fixtures, a mock for every MCP tool the turn
   called (capture lists them), or read grants (`Read(//absolute/path)`). Read grants show files
   as they are today, which may already hold the fix, and Bash runs in a sandbox that can't read
   the user's home. A task about the live state of the user's machine is a poor turn case.
5. **The recording must fail, for free.** `evals grade <case>` runs the deterministic graders on
   exactly what the agent did (`original-turn.jsonl`); read the judged rubrics against
   `original.md` yourself. If the recording passes, the graders miss the problem.
6. **Measure how often it fails.** Run the recorded setup several times with no change (`--runs
   5`). One bad reply was one draw, and the same moment often goes fine. A case that rarely fails
   can catch a regression but can't show a fix: tell the user, and tag it `regression`.
7. **Decide what to keep.** The capture as it is, or a cleaned, minimized or rewritten version,
   and how many variants. Each derived case must fail under the old setup about as often as the
   capture did, or it no longer tests the failure.

For instruction-file work, also capture a few turns that went right, as guardrails: a change
shouldn't fix one failure by breaking what worked.

## What a replay can and can't show

- **It leans toward what was recorded.** The history was written under the old setup, so a change
  only acts from the cut on, steered by everything already said. A change that moves a recorded
  case is likely real; one that doesn't may still help a conversation from its start. Confirm a
  winner on fresh cases.
- **Instruction files are replaced in the history.** With `instructions:` set, the recorded text
  of that scope is replaced in a copy of the history, rendered the way Claude Code renders a file
  (frontmatter and HTML comments dropped, a new `@import` not expanded), and written into the
  sandbox where a resumed session would re-read it.
- **The recorded reasoning is left out of every variant.** The API accepts a thinking block only
  in the exact conversation that produced it, so the agent resumes from what it said and did.
- **The agent can read its own past as a mistake.** Turns after an edited instruction were written
  under the old text. Cut the case at the first turn the change could affect.
- **A resumed session keeps its recorded system prompt**, so `system_prompt:` and a case's
  `append_system_prompt` have no effect on a recorded case; the run says so.
- **Under Codex, recorded Claude Code sessions can't be resumed.** Those cases fail there.

## Handling recorded content

Recorded sessions hold real content: names, internal systems, sometimes secrets. Ask before
putting captured cases anywhere shared, and read a captured history before committing it. Leave
`history.jsonl`, `original.md`, `original-turn.jsonl` and `results/` out of any repository unless
the user says otherwise. Never copy recorded content into a file the repository tracks, such as a
proposal or a cases page written outside the suite's own folder.
