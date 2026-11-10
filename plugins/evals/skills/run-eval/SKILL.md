---
name: run-eval
description: Run an existing eval suite and say what the result means. Get a score, measure a change against a kept baseline, compare versions, or answer from results already paid for instead of running again. Use when the user asks to run the evals, asks whether a change helped or which version is better, wants a score for a plugin, skill, MCP server, prompt, instruction file or model, or asks what earlier results showed.
---

# Run an eval and read it

A suite exists; the user wants an answer from it. The answer is a difference with an interval and
a verdict, or a score with an interval, plus what it rests on. It is never a bare number.

Everything goes through this plugin's `bin/evals` (`"${CLAUDE_PLUGIN_ROOT}/bin/evals"` in Claude
Code; elsewhere, two folders up from this skill's folder), called `$E` below. `$E help <command>`
lists a command's options. Runs cost money on the user's account; the other commands are free.

## First: can the suite answer?

```sh
$E status <suite>
$E history <suite>
```

`status` says whether the suite is ready to measure a change, and if not, which step is missing.
Say what is missing before giving any number: a score whose runs nobody read, or whose graders
were never checked against the user, is a weaker claim, and the user should hear that with it. If
there is no suite, that is the **build-eval** skill. `history` lists every result already paid
for, and whether each still measures the suite as it is now.

## Which question is it?

**"What does it score?"** If `history` shows a result that is `current` for the setup they mean,
the answer is already paid for: read it out with its interval. Otherwise `$E run <suite> --reuse
--name <name>` makes only the runs no stored result holds.

**"Did my change help?"** The change is to something a variant loads (the plugin's files, the
instruction file, the prompt). Run it against the kept baseline:

```sh
$E run <suite> --reuse --against <baseline name> --name <new name>
```

Variants whose setup didn't change are taken from stored results; the changed one runs again and
is compared with itself as it was. The output has two comparisons: each variant against the
suite's baseline variant now, and the changed variant now against then. The second answers the
question.

**"Which of these is better?"** Make each one a variant in `suite.yaml` (a folder, a file, a
model, an effort) and `$E run <suite> --reuse`. Variants made in one run have their runs
interleaved, so they share the hour and the API's state, which is the fairest comparison there is.

**"What changed between these two results?"** `$E compare <A> <B> --in <suite>`, by folder or by
name. Two runs of a suite compare each variant with itself.

## What reuse knows and doesn't

A stored run is reused only when its setup is the same (the harness, the model and effort asked
for, the plugin's files, the instruction file, the system prompt, the tools, the environment) and
its case gives the agent the same things. That part is exact. What can move underneath without
changing a setup is the harness's version and the model behind an alias, and the run warns when
the stored runs are from another harness version or are a week old. So: reuse freely for a first
look and for clear results. When the call is close, the stored result is old, or the warning
shows, make both sides fresh in one run (drop `--reuse`), because then they differ only by the
change.

## Reading the result

- **A change is real** when the 95% interval on the paired per-case difference excludes zero, the
  difference is at least the suite's `min_effect`, and cost, turns and time didn't move the wrong
  way beyond their own intervals. The verdict line applies this rule; quote it.
- **Within noise is a tie**, whichever way it points. Between tied versions keep the simpler one.
- **Under 20 paired cases is directional**, however large the difference.
- **The headline is the `core` cases.** The by-tag line gives `failure` cases their own number; a
  gain there alone isn't a gain on the work.
- **Runs left out** (timeouts, API errors, no verdict from a judge) are counted beside every
  score. More than a few, or more on one side, and the result isn't ready: `$E run <suite> --resume
  --output-dir <results>` makes them again.
- **Cases that changed** between two results are left out of the comparison and named.

Then read the runs behind it. `compare` lists the cases that moved; read at least those (`$E
transcript <results> <case>`), and record what you saw with `$E note`. Read runs the graders passed
as well, one in every case: a grader that passes what it shouldn't is found nowhere else, and
`status` keeps "runs read" open until every case has a note and some passed runs do. Your own notes
agreeing with graders you wrote checks nothing. The summary's "grader by grader" lines count each
grader by variant, reported ones included: look there for what a score averaged away, and in the
traces for what no grader asked (did it run the tests, which tools it reached for). A difference
nobody has looked inside is a number, not a finding. If a judged score jumps further than the change could
explain, suspect the judge before the change: read its quoted reasons.

## Saying it

One or two lines: the difference (or score) with its interval and the verdict, over how many
cases, how many runs were left out, how many were reused and from when, and the setup it holds
for (harness and version, the model that served). Then what you saw in the transcripts. A result
on one model or harness says nothing about another.

The user judges by looking, so give them something to look at, not a path. `$E view <results>`
writes `view.html`: the report, every run's transcript and the files the runs left, in one page
that opens anywhere. Hand it over with the result (publish it as a private page where the session
can), and say which runs to open first: the cases that moved, and any run you noted as a failure.

Name a result worth keeping (`--name`, or `$E name <results> <name>`). In a cloud session set
`EVALS_RESULTS` to storage that outlives it, or the stored results the next comparison needs are
gone.

## What goes wrong

- Running everything again when `history` already has the answer, or reusing when the call is
  close and the stored result is stale.
- Reading a sign as a win.
- Comparing results that overrode the suite file's settings differently; the run says when a flag
  overrides the file.
- Reporting a score without its interval, its left-out runs, or the transcripts read.
