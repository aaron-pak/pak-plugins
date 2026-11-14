# What makes an eval trustworthy

An eval is worth what the decisions made with it are worth. These are the ideas the build-eval,
run-eval and hillclimb skills lean on, and that `evals status` checks where a file can show them. They come from Anthropic's "Demystifying evals for AI agents", "Automating
eval design and hillclimbing with Claude", the `claude plugin eval` docs (whose runner `evals run`
ports) and the eval guides in the `claude-api` skill, restated for this plugin's setup.

## Read the transcripts

A score is a summary of transcripts, and most surprising scores are bugs in the eval, not facts
about the model. Read the runs behind any number you act on: what the agent did, what the grader
saw, why it passed or failed. Each run has a `transcript.html` beside its trace, linked from
`report.html`: how it was graded, each judge vote with its reason, and every message and tool call
in order. `evals transcript <results> <case>` prints the same as text. The raw event stream
(`tracePath`) is for programs.

Reading comes before grading, too. What to check is rarely knowable before seeing what the agent
does with the prompt, and graders written first check what the author imagined would go wrong. A
case can run with no graders: its runs are kept and left out of every score. Read them, note what
went wrong and how often, write a grader for each kind of failure worth catching, and `evals grade
<results>` grades those same runs. Start a suite this way, and add a grader the same way whenever
transcripts show a failure no grader names.

Keep what was seen. `evals note` records a reading of a run beside it: pass or fail, the kind of
failure in a few words, whose fault. Name failures loosely at first and let the names settle as
they repeat; a kind that shows up on several runs is worth a grader, and `evals failures` counts
them and says which no grader catches. Whose fault matters as much as what: a failure of the
grader or of the case as written is fixed in the suite, and tuning the target against it makes the
target worse. An agent's reading is a lead. The user's own verdict is a label, and the only thing
graders are checked against: `evals review` gives them a page to mark runs on before they see a
grade or know which variant made what.

## Start from real failures

Twenty to fifty cases drawn from things that actually went wrong beat hundreds of invented ones.
Saved traces are the first source, then the user's sessions, then their own examples; synthesize
last, anchored on real cases. Saved failures alone skew toward the obvious and the memorable, so
also sample ordinary uses nobody complained about.

Keep the two apart. The **core** is a random sample of the user's real asks, picked before anyone
knows how a version does on them, and it is what the headline reports: how the target does on
the work it will meet. **Failure cases** go on top (the asks a version got wrong, and variants of
them), tagged so they report as their own number. A suite built from one version's failures is
adversarial to that version: any rival looks better on it, partly by regression to the mean, so
never read a gain on failure cases as a gain on the work. Compare versions on cases neither was
tuned against.

## Both directions

Every behavior has a twin: ask when it should and don't ask when it shouldn't; fire the skill when
it applies and stay quiet when it doesn't; act and refrain. A suite that tests only one side is
won by always doing that side. Every suite has at least one case where the target must not act.

## Grade outcomes, cheapest first

Grade what the run left behind, not the narration. In order of preference: a deterministic check
(a regex on the reply or a file, a file that exists, a mock call's arguments), a binary criterion,
a judged rubric of concrete PASS and FAIL claims, a preference judgment. Tool checks are guardrails
("never called Bash with rm") and say whether the target engaged; they are never a case's only
scored grader. Keep judged graders on short text: a judge reading a long file or a long trace is
noisier than a regex over it.

## Graders the change can't see

Whatever the loop reads becomes a target. The analyzer reads train traces and their grades, so a
change can learn the graders' checks, and when the thing being tuned can run those same checks
itself (a self-check tool, a linter, a checklist), the score rises whether or not the goal does.
Keep the measure that decides independent of what the change could see: a judge shown only the
outputs, graders held back from the analyzer, or the user's own labels on a sample. A checker's
report shown to a judge is evidence to check against the output, never a verdict to copy: it
misses things, it can be wrong, and a version tuned to it will clean exactly what it reports.
Leave it out of `judge --evidence` when a version under comparison was tuned against it.

Grade every arm with the same graders. A probe or rubric fixed mid-loop leaves earlier rounds
graded by the old one; `evals regrade` grades kept runs again, and the runner records a digest of
each case's graders so `evals compare` warns when two results were graded differently.

## Judges

Runs and judges use Opus, the runner's default; never a small model as the judge. A judge from the same family as the agent under test can prefer
answers like its own, and here both are Opus, so the check is calibration: the judge must agree with
the user on clear-cut cases (about 9 in 10 or better) before its scores steer anything, and it must
fail an empty reply, "I don't know" and a confident answer to the wrong question. Agreement on work
the user passed says nothing about work they'd fail: the labels need both kinds (at least three of
each), and `evals agree` prints the agreement with its interval and the agreement beyond chance, so
19 of 20 on a sheet of 19 passes isn't mistaken for a checked judge.

Each vote quotes the part of what it was shown that decides it, gives a reason, and ends PASS,
FAIL or UNKNOWN. Two votes are taken and a third when they differ; the majority wins. UNKNOWN is
the judge's way out when what it was shown can't settle the criterion, and a grade that ends
UNKNOWN leaves the whole run ungraded: scoring the run on its other graders would pass a run whose
real check never got an answer. How often the first two votes differ is the judge's own noise
(`evals plan` and the run's summary print it); a rubric that splits its judge one time in ten
needs tightening before more runs can help. A judge reading a trace sees its first and last 12
messages.

When the quality is a judgment of taste (a page's design, a reply's tone), a rating saturates and
two good versions both pass. A pairwise judgment is more sensitive: `evals judge A --against B`
shows a judge both outputs of a case, in both orders to cancel its preference for a position, and
reports B's share of the cases and a sign test. One Opus judge at high effort is the default; a
judge from a second model family is worth its cost when one family's taste could decide (the
agent under test is the judge's own family and the call is close) or calibration shows the first
judge disagreeing with the user. Read the pairs where the two orders (or two judges) disagree, and
calibrate against the user's own picks on a sample (`evals label` on the saved judgements, then
`evals agree`) before the panel steers anything. Fix the rubric before the first round and never
tune it on the results.

## When a change is real

**Planning.** Before a suite is used for a decision, put three numbers side by side: the noise
(the expected 95% half-width of a paired difference between two runs of the same setup), the
headroom (the best possible score minus the baseline) and the smallest change the user would act
on. `evals plan <baseline results> --min-effect <x>` prints all three from one result, with the
cases or runs it would take when the change can't show and what each further result costs. For a
pass rate the noise is roughly `1/√(cases × runs)`: 20 cases × 3 runs is about ±13 points,
50 × 3 about ±8. If the noise is wider than the headroom or the smallest change worth acting on, the
suite can't answer the question: say so before anything is spent, and offer more cases (they help
far more than more runs, because a case's runs share its difficulty), a finer metric, or trimming to
the cases that discriminate for iteration with a full confirm at the end. An A/A run (the same setup
twice) measures the noise directly.

Two things keep that reading honest on a small suite. A few runs that agree don't show that a case
never varies, so `plan` never reports a noise of 0: it counts one unseen case, as noisy as a case
can be, in the pool. And quiet runs are not enough for a change to show: an improvement can only
come from the cases with room above their score, and `compare` takes its interval from how much the
per-case differences vary, so a change that has to land in 3 of 12 cases carries a wide interval
however steady each case is. `plan` prints the interval such a change would carry and calls it
detectable only when that is under the change itself.

**Deciding.** Compare two results with `evals compare A B`. A change is real when:

- the 95% interval on the paired per-case difference excludes zero,
- the difference is at least the smallest change the user would act on, and
- no guardrail (cost, turns, time, an untouched behavior) moved the wrong way beyond its own interval.

With fewer than about 20 paired cases, call any result directional. A difference inside the noise
is a tie, whichever way it points: between tied versions, keep the one with fewer moving parts. The sign test (cases better
against cases worse) is the check that doesn't assume a shape; when it and the interval disagree,
say so.

**What counts.** A run that timed out, hit an API error, failed its scaffold or got no verdict
from a judge says nothing about the thing under test. The runner keeps it, names why (`failure`),
and leaves it out of every score and difference; it is never averaged in as a 0, and the count is
printed beside the score. A run that hit the turn cap is behavior and stays in, and so is a run a
mock stopped. Leaving runs out has its own trap: a version that makes the agent slow loses its
worst runs to timeouts and looks better for it. So `compare` warns when two results broke at
different rates, and the fix is to make the broken runs again (`evals run --resume`), not to read
around them. A score always comes with its interval and with how many runs it left out.

**The same setup.** A comparison holds only when one thing changed. Write the setup down once, in
the suite file (`suite.yaml`: the model, the effort, the judge, the runs per case, the tools), and
name each thing you compare as a variant of it, so the setups differ by exactly what the file says
and nothing depends on remembering flags. Variants run in one command with their runs interleaved,
so they also share the hour and the API's state; two results made days apart differ by whatever
changed in between. Each result records the
harness and its version, the model asked for and the model that served each run (an alias can
move, and a fallback can serve part of a suite), the effort, the judge, a digest of the plugin's
files and the suite file's hash; `compare` warns when these differ, and a flag that overrides the
file says so. A stronger model or more effort is itself a change worth
trying before a rewrite: run the baseline again with `--model` or `--effort` and compare.

## Train, test and confirm

Tuning on the cases you report overfits them. Split the cases at random, stratified by their first
tag, with every case from one source session or failure on the same side. Change things by reading
train; choose the winner by test; report a fresh confirm run of the baseline and the winner, since
choosing by test makes the winner's test score optimistic. Never paste a failing case's specifics
into the thing being tuned: fix the behavior, not the example.

## Cases from real moments

A recorded session can be cut into a case: the conversation before a turn becomes the history the
run resumes, and the user's message becomes the prompt (`evals capture`). The run replays from that
message on, so the earliest a case can start is a user message; a response in the middle of a turn
can't be replayed on its own, only the turn that contains it.

- A **turn case** reruns the whole turn and grades where it ended up. Use it when the failure built
  up over the turn, or sits inside it.
- A **decision case** grades only the first response (`max_turns: 1`): what the agent said or which
  tool it reached for first. Use it when the moment was the turn's first response. Hitting the turn
  cap is expected there and shows as a run error.

The history is real content: names, internal systems, sometimes secrets. Captures go outside any
repository, in a folder git ignores, and are read before anything is shared.

**Off-policy bias.** A replayed history was written by the old setup. A change can only show its
effect from the cut on, and the agent is steered by everything the old setup already said and did,
so recorded cases lean toward the recorded behavior. A change that moves them is likely real; one
that doesn't may still help a conversation from its start. Confirm a winner on fresh cases.

Two more effects of an edited history. The agent's reasoning is signed and only valid in the exact
conversation that produced it, so a replay never carries it: the runner removes it from every arm,
and the agent resumes from what it said and did, not from what it thought. And the turns after an
edit were written under the old text, so the agent can read its own earlier replies as mistakes
against the new one and spend its reply apologizing for them. Cut the case at the first turn the
change could affect, and when a grader sees a correction of the past, read it as this effect.

## Captured versus derived

A capture is the situation exactly as it happened, which is its value and its limit: one draw of
a noisy process, with incidental detail. Before tuning on a capture, run it several times without
any change. If it rarely fails, it can catch a regression but can't show a fix; keep it for the
regression suite. A derived case (the capture minimized, cleaned, rewritten, or turned into several
variants of the same shape) generalizes better, but it must fail under the old setup about as often
as the capture did, or it no longer tests the failure.

## Isolation

Each run gets a temporary home, working folder and config folder: no user settings, instruction
files (unless the case loads one on purpose), memory, hooks, MCP servers or other plugins load, and
writes stay inside the run's folders. Claude Code's file tools and its Bash sandbox also can't read
the user's home. In the run's own config folder, commands can read only `projects/` (the sessions
of the run and any a case seeded), while the file tools can read all of it. Codex's sandbox limits writes and network but not reads, so a Codex run can see
files a Claude Code run can't. That is what keeps runs from touching real sessions and services.
MCP servers are mocked unless real ones are explicitly started, and no case may reach a real
service. Anything the agent must not see (expected answers, graders, the evidence in `original.md`)
stays out of the workspace and its read grants; under optimization the agent will find it.

## Results that last

Each run writes its results (the per-run grades, transcripts and kept outputs) to
`<eval dir>/results/<time>/`, or under `$EVALS_RESULTS` when that is set. The results file is saved
after every run, so a suite that is killed or runs out of usage keeps what it paid for, and
`evals run --resume` makes only what is missing; a judge panel saves and resumes the same way. A cloud session's
container is reclaimed when it ends, so there set `EVALS_RESULTS` to storage that outlives it, or
copy each round out as it finishes: a comparison can only be checked, regraded or judged again
while its runs exist.

A kept result can stand in for running the same thing again. `evals run --reuse` takes every run
a stored result holds for the same setup on an unchanged case, so measuring a change costs only
the runs the change touches, and a baseline is paid for once. That is exact about what it can
see (the files, the settings, the case) and blind to what moves underneath: the harness's version
and the model behind an alias. It warns about both, and `compare` names them. Reuse for a first
look and for clear results; when a call is close or the stored result is old, make both sides
fresh in one run, where they share the hour and differ only by the change. Name the results worth
keeping (`evals name`), and `evals history` says which still measure the suite as it is.

## A living suite

Cases that always pass, in every setup, stop discriminating: move them to a regression suite that
is run but never tuned on (`evals plan` lists them, and warns when the score reaches 0.95 and the
suite can only show regressions). A case no run ever passes is as likely a broken case or grader as
a hard one: read a transcript before keeping it. New failures from real use become new cases. When the target, the model
or Claude Code changes, rerun the baseline; comparisons across a changed environment are broken.
