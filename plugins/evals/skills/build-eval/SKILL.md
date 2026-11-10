---
name: build-eval
description: Build an eval suite for anything that shapes what an agent does (a plugin, a skill, an MCP server, an instruction file such as CLAUDE.md or AGENTS.md, a system prompt, a model or effort setting) and take it to a baseline the user trusts. Use when the user wants an eval, wants to measure or test one of those, asks how to tell whether a change helps, wants a case built from a session where an agent went wrong, or runs /build-eval.
---

# Build an eval

The product is a suite the user trusts enough to decide with, and one kept result to measure
changes against. A suite that runs but that nobody believes is worth nothing, so the work is
mostly choosing what to ask, reading what comes back, and getting the user's agreement.

Everything goes through this plugin's `bin/evals` (`"${CLAUDE_PLUGIN_ROOT}/bin/evals"` in Claude
Code; elsewhere, two folders up from this skill's folder), called `$E` below. One command drives
the build:

```sh
$E status <suite>     # what is done, what isn't, and the one thing to do next, with its command
```

Run it first and after every step, and do what it says. It reads files and calls no model. `$E
help` lists every command; `$E help <command>` its options. The step order, the sign-off records,
the statistics and the bookkeeping are in the tool. This skill is the judgement the tool can't have.
The docs it points to are in `${CLAUDE_PLUGIN_ROOT}/docs/`: `case-format.md` (every file format),
`principles.md` (the reasoning), `audit.md` (what only reading can check) and `recorded-cases.md`.

## Who decides what

**The user owes four answers.** Ask for them; never fill them in yourself, unless they hand one
over in so many words ("you choose what to test", "your call"). Then it is yours to decide, and the
record says so: `$E gate <suite> <which> --delegated --said "<the words that handed it over>"`. A
delegation is not an approval. Keep the spend small, and say in the hand-over which choices were
yours and that they haven't read the cases or the graders.

1. What is under test, and against what: no plugin, the old version, another model.
2. What a good result and a bad one look like, and which failures they have actually seen. Real
   material beats description: sessions, saved traces, bug reports, their own examples.
3. The smallest improvement they would act on (`min_effect` in the suite file, 0 to 1).
4. What a run may cost (`max_cost_usd`). Every run spends money on their account.

They also give three sign-offs, each recorded with their words by `$E gate`: the inputs (these are
the right questions), the grading (this is the bar I'd hold the work to) and the cost. Silence is
not a yes, and neither is your judgement that it's fine. A sign-off lapses by itself when what it
covered changes, and `status` asks again.

**The tool decides, so don't re-argue or rebuild it:** Opus runs and judges, 3 runs per case, a
sandbox per run, runs that broke left out of scores rather than counted as 0, intervals and the
rule for when a difference is real, which stored runs can be reused, and the order of the steps.

**You decide** which one flow to test, which cases, what each grader checks, and what the runs show.

## The steps, and the judgement each needs

**Start.** Read the target yourself and say what you found: its skills, commands, hooks, servers,
the descriptions that make them fire, any contradiction between its README and its skills. Pick
**one flow**; a plugin with four skills is four suites. `$E init <folder>` writes the suite file
(`--plugin <dir>`, `--instructions <file>` or `--system-prompt <file>` name what is under test).
A suite holding recorded sessions lives outside any repository (`~/.claude/evals/suites/<name>`);
one with no recorded content may live in the plugin under `evals/`. The target is read-only: note a
fix the user asks for as a follow-up, and test it as it is.

**Cases.** Twenty to fifty drawn from what really happened beat hundreds invented. Take real
material first (`$E trace list`, `$E sessions search`, then the user's examples) and synthesize
last, anchored on real ones. Build two layers and tag each case with its layer first: `core`, a
sample of ordinary real asks picked before any version runs on them, which the headline reports;
and `failure`, asks a version got wrong, which report as their own number because a suite of one
version's failures flatters whatever replaces it. Tag `negative` where the target must not act
(every suite has at least one, or it is won by always acting), and `group:<name>` on cases cut
from one session. Add one or two hard cases on purpose: the ambiguous ask, the misleading file, the
user who pushes to cut a corner. A prompt that names the skill tests its work; one in the user's
plain words tests whether it fires. A case from a recorded moment is cut with `$E capture`:
`docs/recorded-cases.md` has that procedure and its traps.

Most asks to a coding agent are about a project that is already there: give the case one, as
its `workspace/` folder or a shared `_projects/<name>` that several cases name with `workspace:`.
Make it small and real enough to be worth reading (a README, a few modules, tests that pass), and
plant what the case is about where a careful reader finds it.

**Inputs gate.** `$E cases <suite> --html` writes the page to show. Ask whether these are asks
they'd really send, what is missing, and what doesn't matter. Change what they say, then record
their words.

**Cost gate.** `$E run <suite> --max-cost-usd 0` loads everything for free. Before there is a
result, propose a small ceiling for a first pass and say it is a guess; afterwards `$E plan
<results>` prices a result from real runs. Set `max_cost_usd`, then record their words.

**First run, then read.** When nobody can yet say what the target gets wrong, run the cases with
no graders: the runs are kept unscored. Read them (`$E transcript <results> <case>`) and record
each reading with `$E note`: pass or fail, the kind of failure in two or three words, whose fault.
Use the same words for the same failure, so `$E failures <results>` can count them. This is where
graders come from; graders written first check what you imagined would go wrong. Read at least ten
runs, the worst first, and never report a number whose transcripts nobody read.

**Graders.** One per kind of failure worth catching, as `<case>/graders/<name>.md`. Prefer, in
order: a deterministic check (a regex on the reply or a file, a file that exists, a mock call's
arguments), a `script` for what a regex can't do, then a judged rubric of concrete PASS and FAIL
claims. Grade what the run left, not its narration, and let a different valid route pass. For a
change to a project, the strongest check is the suite's own test run against the project the run
left (a `script` grader; the agent never sees the test), and `target: changes` says which files it
touched ("no test file added or modified" is one `not_contains` pattern). Mark what must hold
before the measure means anything as `role: prerequisite` (the page exists, the fix works): it earns
nothing, so the score is the behaviour the case is about and not half of it. Then write the answers
each grader was written against, as `<case>/known/pass/` and one `known/fail-<grader>/` per way to
fail, near misses included, and run `$E check <suite>` until every one is graded as it should be.
It is free, and it is the only check of a grader that doesn't wait for a paid run to stumble on the
answer. Tool
checks are guardrails ("never called Bash with rm"), never a case's only scored grader. Don't lift
pass criteria from the target's own SKILL.md: that is the author's intent, not the user's
experience. Grant exactly the tools the graders need, and size `max_turns` and `timeout_seconds`
to the work. Work the user looks at (a page, a document) is judged after the runs by a panel
declared in the suite file's `panel:`; work that shows over several turns gets `followups:` (the
user's real next messages) or a simulated `user:`. If the flow calls MCP tools, mock every one;
no case reaches a real service. `docs/case-format.md` has each format.

**Grading gate, then grade.** Show the user what decides a pass (the same cases page), record
their words, and `$E grade <results>` grades the runs already made. Nothing runs twice.

**Check the graders against the user.** `$E review <results>` writes a page where they mark runs
Pass or Fail before seeing any grade. Import it, and `$E failures <results>` shows where the
graders passed what they failed and the reverse. Fix those graders and grade again; their verdicts
stay with the runs, so every later version of a grader is checked for free. If the user softens a
grader until it always passes, push back once ("what version of this would catch a real
regression?"), then do it and say so in the hand-over.

**Signal.** `status` reads what the suite can show. Saturated (near 1.0): it can only catch
regressions, so add harder cases before trying to improve anything. Noise wider than `min_effect`:
more cases help far more than more runs. A case no run passes is a broken case or grader more often
than a hard one: read it.

**Baseline.** `$E name <results> <name>` keeps the result. Hand over the report path and one
line: the score with its interval, the difference against the baseline variant with its interval,
and how many runs were left out. Measuring a change against it is the **run-eval** skill;
improving the target against it is **hillclimb**.

## Notes by target

- **Plugin or skill:** the baseline variant is no plugin. When the honest alternative isn't
  nothing (a built-in tool, three lines of instructions), make that a variant too.
- **MCP server:** test it as the plugin that carries it. What matters is whether the model picks
  the right tool from the user's words, passes the right arguments and asks before writing: mocks
  with `expect:`, `mock_calls` graders, and a fresh `_tools.json` whenever descriptions change.
- **Instruction file:** `instructions:` loads it the real way, as CLAUDE.md or AGENTS.md. Recorded
  moments are where real failures are; also capture turns that went right as guardrails.
- **System prompt:** `system_prompt:` adds a file's text to every run's system prompt.
- **Model or effort:** variants that differ only by `model:` or `effort:`. Try this before a
  rewrite; it is often the cheapest improvement.

## What goes wrong

- Plausible cases and rubrics that the user never read.
- Anything paid before the cost sign-off, or while a design question is open.
- Passing `--user` on a note, or writing a gate's words, for something the user didn't say.
- Trusting a zero: a $0.00 run, a 0-turn run or a column that never changes is a wiring bug first.
- One suite for six flows.
