---
name: hillclimb
description: Improve a plugin, skill, MCP server, instruction file or prompt against an existing eval suite, one measured change per round, with a held-out test split. Use when the user wants to hillclimb or optimize a target against its eval, asks to tune a skill, prompt, description or instructions against an eval, or runs /hillclimb.
---

# Hillclimb

Run the suite, read the failures, change one thing, run again, and keep the change only if it
helps cases nobody tuned on. The loop is simple; the discipline is what makes the result true:
read transcripts rather than summary numbers, know which change caused which effect, keep a
record, and never tune on the cases you report. **The result is the difference on the test split
against the baseline**, confirmed on fresh runs. Improvement on train is the process.

Everything goes through this plugin's `bin/evals` (`"${CLAUDE_PLUGIN_ROOT}/bin/evals"` in Claude
Code; elsewhere, two folders up from this skill's folder), called `$E` below; `$E help <command>`
lists options. `${CLAUDE_PLUGIN_ROOT}/docs/principles.md` has the reasoning behind each rule here.

## Before round 1

`$E status <suite>` must say the suite is ready: signed off, read, its graders checked against the
user, a named baseline. If it doesn't, finish the **build-eval** steps it names first; climbing a
suite nobody checked multiplies its errors. Then settle these with the user:

- **The suite can see the win.** `status` reads the signal against the suite file's `min_effect`
  (`$E plan <baseline>` has the detail). If a change that size is inside the noise, say so now and
  offer what it would take: more cases help far more than more runs. A baseline at 0.95 or above
  has nothing to climb; it needs harder cases.
- **The lever is wired.** Remove what you are about to tune and the score drops (the baseline
  variant shows this). If the score doesn't depend on the lever, tuning it is editing and hoping.
- **The low cases are real.** Read the baseline's lowest cases. A case nothing passes is usually a
  broken case or grader: try it once with more room (`--effort high`, a longer timeout) before
  believing it. Fix graders now and `$E grade <baseline>`.
- **Something measures the goal that the loop can't read.** The analyzer reads train runs and
  their grades, so every grader it sees becomes a target, and a change that can run the graders'
  own checks (a self-check, a linter, a checklist in the skill) raises the score whether or not the
  goal moves. Name one measure the analyzer never sees: a judge panel shown only the outputs,
  graders held back, or the user's own verdicts on a sample (`$E review`). It decides the winner.
- **Goal, scope and budget.** What to optimize (raise the score; hold it and cut cost or turns;
  move to another model and recover it), which makes every other metric a guardrail. What may
  change and what is off limits: the runner, graders and fixtures always are, unless the user
  approves each change. The cost of baseline plus every planned round from a measured pass, a
  ceiling, and when to check in: until plateau (three rounds inside the noise, or a guardrail
  regresses), every round, or N rounds. Whether the user approves each round's diff before it
  runs. Wait for the yes.

## Split and state

`$E split <suite> --seed <s> --out <state>` draws train and test at random, stratified by each
case's first tag, with `group:<name>` cases on one side, never by score: picking the worst cases
for train buys regression to the mean. Train is what the analyzer reads; test is never read and
decides which round wins. Check that the baseline's train and test means agree within noise, and
redraw if not. Under about 20 cases don't split: run everything and call the result directional.

Keep the loop on disk so it survives a lost session, in `<state>` = `<eval dir>/results/hillclimb-<name>/`:

- `state.json`: goal, guardrails, scope, off-limits, the plan and the user's yes in their words,
  the split, the stopping rule, the current and best round.
- `r0/`, `r1/`, …: each round's results (`--output-dir <state>/r<N>`), and for each round after
  the baseline `change.md` (the hypothesis, the behavior it targets, the trace lines cited) and
  `change.patch`.
- `narrative.md`: the round table and a paragraph on what is winning and why, rewritten each round.

Every round runs from the same `suite.yaml` with no overriding flags: `$E run <suite> --reuse
--output-dir <state>/r<N>`. `--reuse` takes the variants the round didn't touch (the baseline
variant, usually) from earlier rounds; the tuned variant runs whole, train and test, every round.
Edit a working copy that a variant points at, never the user's live file, until a winner is
chosen. If the harness version or the model serving the runs changes mid-loop, the run warns: make
the baseline again without `--reuse`, because comparisons across that change are broken. A round
cut off is finished with the same command plus `--resume`.

## The loop

**Analyze.** Unless the next change is obvious, start a fresh analyzer subagent each round. Give
it only: each train run's transcript as text (`$E transcript`, one file per run) with its grades,
`$E failures <last round>` if runs were noted, each train case's score in every round so far, the
current artifact, the scope and off-limits, the target metric, the guardrails and the noise. Runs
that broke aren't behavior; leave them out. Ask for the single behavior that costs most on train,
how many cases show it, and one change, as a diff, that fixes it at the root, quoting the trace
lines that motivate it. If no behavior costs more than the noise, it says so instead. You never
read test runs, and never pass test results to the analyzer.

**Apply.** One hypothesis per round, even when it touches several places, so you know what worked.
Fix the cause (rewrite the section, add the missing rule, fact or tool), not a reworded line: a
change smaller than the noise is kept or reverted by chance. Describe the failing behavior; never
paste a train case's specifics into the artifact. Cut platitudes and restated defaults from the
diff. Save `change.md` and `change.patch`.

**Run**, in the background, and wait for it to finish; a half-landed round can show a sign that flips.

**Decide.** `$E compare <state>/r<best> <state>/r<N> --case-list <state>/test.txt` gives the tuned
variant's paired difference on test; the same with `train.txt` is the overfitting check. Keep the
change only if test improves by the rule (the interval excludes zero, the difference reaches
`min_effect`, no guardrail regresses). Revert when test is within noise, when train rose and test
stayed flat (it overfit), or when it regressed. Within noise is a tie whatever its sign: keep the
round with fewer moving parts. A round where one side lost many more runs than the other is void
until `--resume` makes them again; a round graded by other graders is void until `$E grade` on
both. Update `state.json` and `narrative.md`, and give the user one line: "r3 test 0.71 → 0.74,
change: …".

**When the round is a judgement.** For a quality the graders only bound (a page's look, a reply's
tone) per-case scores saturate and the difference can't move. Decide the round on the suite file's
pairwise panel over test: `$E judge <state>/r<best>/<variant> --against <state>/r<N>/<variant>
--case-list <state>/test.txt`. The rubric is fixed before round 1, never tuned, checked against
the user's own picks (`$E label`, `$E agree`), and judges see only what a user would. Decide on the
axis the round targets; the per-case scores stay as guardrails.

**When it stalls.** After two or three rounds with no test change beyond noise, stop changing
content and sort every remaining train failure by cause (`$E note --cause`, then `$E failures`):

| cause | tell | instead of another content round |
|---|---|---|
| the target | the agent lacked a fact or rule and guessed | keep going |
| the grader | the output looks right but fails | fix it, `$E grade` every round you compare, see if the ranking changed |
| the case | the ask is ambiguous, or the answer leaks | fix or drop the case, and go back to the user: the inputs changed |
| plumbing | timeouts, API errors, a failed scaffold | fix it, then `--resume` each round |
| structure | the content exists but isn't reached; the same finding recurs | reorganize rather than add |
| variance | identical setups flip as much as rounds differ | report best so far; offer more runs or cases |

## Report

Leave the target at the round that won on test. Test also chose the winner, so its test score is
optimistic: before reporting, run a **confirm**, fresh runs of the baseline and the winner as two
variants in one run with no `--reuse`, on held-back cases nobody read (or test, if none were kept
back). Then report:

- **The headline:** the confirm's paired difference on the `core` cases with its interval and
  verdict; `failure` cases on their own line. If it isn't real by the rule, say so plainly and
  recommend not merging.
- The round table (change, train, test, cost, turns), each change still applied with a sentence
  on why, failures by cause, and the runs each result left out.
- The setup the numbers hold for: harness and version, the model that served, effort, judge.
- Two or three before-and-after transcript pairs for the behavior targeted, and what to try next.

## What goes wrong

- Reading test runs, or letting test results shape a change.
- Leaving expected answers where the agent can reach them; under optimization it finds them.
- Deciding on graders the change can run itself, or a judge shown a checker's report the change
  was tuned against.
- Reading a sign as a win, stacking unrelated edits in one round, or grinding content at a wall
  instead of sorting the failures.
- Changing the suite, the split or the budget without going back to the user.
