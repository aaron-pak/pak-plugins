# Audit checklist

`evals status <suite>` checks what a file can show: that the cases load and the setup is pinned,
that the user signed off the cases, the grading and the cost as they are now, that a result covers
the suite, that its runs were read and are graded by today's graders, that the graders agree with
the user's verdicts, and whether the suite can show a change of the size that matters. Run it
first and clear what it lists.

This page is the rest: what only reading the cases, the runs and the graders can tell. Use it
before a suite's first full paid run and before round 1 of a hillclimb. Report what you find as
observations with evidence (the case, the file, the transcript line) and one fix each, most
misleading first. An audit that finds nothing is a valid result. A broken suite gives confident
numbers that point the wrong way, and hillclimbing on one multiplies the error.

## The cases

- **Clear pass and fail.** Two careful people shown the same output would agree. "A good summary"
  is not a criterion.
- **A known-good answer passes.** Each case has an answer that passes its graders: the user's own,
  or one they accepted. A case nothing passes is broken more often than it is hard.
- **The answer isn't reachable.** Not in the prompt, the history, a fixture, a mock, a read grant
  or a file in the workspace. Under optimization the agent finds it.
- **Symptom, not investigation.** A case that asks the agent to find or fix something gives it
  what a user would report, not the file and line.
- **Real shape.** The user's words, length and turns. A captured case says which kind it is (turn
  or decision), and the user agreed where the failure lives.
- **A core from real use.** Cases tagged `core` are a sample of real asks picked before any
  version ran on them. `failure` cases came from one version's misses and flatter every rival, so
  they are read on their own line.
- **Negatives that could fail.** A `negative` case is one the target is tempted by; a case it
  would never act on anyway tests nothing.
- **Fresh.** Cases that depend on live facts, or on files read through grants, say when they were
  last checked.

## The runs

- **A zero is a bug until proven otherwise.** A $0.00 cost, a 0-turn run, a grader that fails in
  every run of every variant, or a column that never changes is a wiring problem first.
- **The tools match the graders.** A tool listed as `not granted` in the run's output is a run
  that couldn't do the task. A run that hit `max_turns` or its timeout without finishing is a
  limit problem (except a decision case, where the cap is the point).
- **Mocks cover the flow.** Every MCP tool the flow can call is mocked, and `expect:` isn't
  narrower than what a correct agent would send: a run a mock stopped is a scored 0.
- **The right setup ran.** The result shows the harness version, the model asked for and the one
  model that served the runs, the judge, and the plugin resolved. No run printed "overrides the
  suite file", or the override is the thing being tested.
- **The variants differ by one thing.** A variant that adds a plugin and also a long instruction
  file answers neither question.
- **The mechanism engages.** Without the thing under test the score drops, and with it the
  transcripts show it at work: the skill fired, the tool was called, the rule was followed.
- **Plumbing is not behavior.** The runs left out (timeouts, API errors, no verdict) are few, are
  not more on one side of a comparison, and none is a failure of the target in disguise. A judged
  grade that ended UNKNOWN means the judge wasn't shown what the criterion needs: fix the grader.
- **Reused runs are still fair.** Where a result reused stored runs, the run printed no warning
  about another harness version or old runs, or the decision isn't close.

## The graders

- **The grader checks what the prompt asks.** A prompt that asks for an explanation isn't graded
  only on a number; "at least three" isn't graded as "more than three".
- **Outcomes over paths.** A different valid route passes.
- **Oracle and nulls.** A known-good answer passes; an empty reply, "I don't know" and a confident
  answer to the wrong question fail. Keep them in the case as `known/pass/` and
  `known/fail-<grader>/` and `evals check <suite>` grades them for free, files and tool calls
  included; `status` names the cases that have neither. A judged grader is checked by reading its
  verdicts.
- **The score is the measure.** What a case exists to measure is its target; what must hold first
  is a `role: prerequisite`, which earns nothing. A case whose task graders and rule graders share
  the score reports half credit for breaking the rule.
- **The recorded failure fails.** For a captured case, `evals grade <case dir>` shows the
  recording failing, and the judged rubric read against `original.md` would fail it too.
- **Not too rigid, not too lenient.** A regex survives formatting, casing and a sentence around
  the answer; a wrong but plausible answer fails.
- **Cheat-resistant.** No shortcut satisfies the graders without doing the task: quoting the
  rubric, an empty file a lenient pattern accepts, doing nothing.
- **The user's verdicts cover both kinds, on clear cases.** `evals failures` needs at least three
  runs the user passed and three they failed; graders that pass everything agree with a sheet of
  passes. For one judged grader that is off, `evals label` and `evals agree` check it grade by
  grade.
- **The judge agrees with itself.** Around one judged grade in ten needing a third vote means the
  rubric reads two ways; tighten it.
- **Atomic.** Separate properties are separate graders, weighted if they matter differently.
- **Independent of the change.** If the thing being tuned can run the graders' own checks (a
  self-check tool, a linter, a skill that lists the rubric), something else decides the winner: a
  judge shown only the outputs, graders the analyzer never reads, or the user's verdicts.

## Before a hillclimb

- **The split is random.** Train and test were drawn by `evals split`, with siblings of one source
  on the same side, and their baseline means agree within noise.
- **One environment.** Every round ran from the same suite file, on the same harness version and
  model; the baseline was made again when either moved.
- **The headline recomputes** from the per-run scores, over the runs that count.
