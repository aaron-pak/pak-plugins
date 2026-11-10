# Cases, suites and results

The file formats and what a run does with them. Everything goes through one command, `bin/evals`
at this plugin's root (`${CLAUDE_PLUGIN_ROOT}/bin/evals` in Claude Code; elsewhere, two folders up
from a skill's folder). `evals status <suite>` says what a suite needs next, `evals help` lays the
commands out, and `evals help <command>` lists a command's options, so this page doesn't repeat
them. `evals run` reads the same case files as Claude Code's `claude plugin eval` and adds to them;
only `run`, `grade` and `judge` call a model.

## Where things live

- **Traces** (bookmarks of moments in sessions): `$EVALS_HOME/traces/`, default
  `~/.claude/evals/traces/`. Set `EVALS_HOME` to keep them somewhere else, such as a private
  repository's checkout.
- **Suites with recorded content** (captured cases, results): a working folder under
  `$EVALS_HOME/suites/<name>/`, or any folder git ignores. `evals capture` refuses to write where git
  would commit it.
- **Suites with no recorded content**: they may live in the plugin, under `evals/` (or the folder
  `plugin.json` names in `experimental.evals`), with `results/` git-ignored.

A suite folder holds an `evals/` folder, and is itself the target of a run: `evals run <suite
folder>`. In `evals/`:

```text
suite.yaml        how the suite runs and what it compares (`evals init` writes one)
<case>/           one folder per case
_<anything>/      what cases share, such as a project several of them work in; never a case
gates.json        the user's sign-offs, written by `evals gate`
results/<time>/   one folder per run of the suite, git-ignored
```

A case says which plugin it tests with `plugins:` (paths relative to the case folder) unless the
suite file's variants do; with none, it runs against the harness alone.

## A case

```text
<suite>/evals/<case>/
├── prompt.md          # optional frontmatter (run limits, tools, tags); body: the user's message
├── case.yaml          # optional: schema_version "1.1", name, plugins, context.*, execution.*
├── workspace/         # optional: the files the run's working folder starts with
├── graders/<name>.md  # one per grader; frontmatter: type and options; body: the rubric, pattern or command (none yet: see `evals grade`)
├── known/<name>/      # optional: answers whose verdict is known, which `evals check` tries the graders on
├── mocks/<server>/<tool>.md   # optional: this case's MCP mocks
└── fixtures and scripts the case names
```

Tags sort the cases: the layer first (`core`, a sample of real asks, what the headline reports;
`failure`, an ask a version got wrong; `regression`, kept passing and never tuned on), `negative`
where the target must not act, and `group:<name>` on cases cut from one session, which a split
keeps on one side. Scores are reported by tag beside the overall score.

**A project to work in.** Most asks to a coding agent are about a project that is already there.
A case's `workspace/` folder is copied into the run's working folder before the agent starts, so the
agent finds the files where it stands and changes its own copy. `workspace: <folder>` in `prompt.md`
(or `context.workspace` in `case.yaml`) names a folder somewhere else, relative to the case, which
is how several cases share one project: `workspace: ../_projects/api`. The workspace counts in the
case's input digest. Each run records what it did to those files (`changes`: created, modified,
deleted), the transcript page lists it, and graders can read it (the `changes` target below).

`prompt.md` frontmatter: `name`, `description`, `tags`, `plugins`, `workspace`, `runs` (default 3; a case that names its own keeps it under a suite file's `runs`, so a costly case can ask for fewer and a noisy one for more), `model`,
`max_turns` (default 10), `timeout_seconds` (default 300), `allowed_tools`, `append_system_prompt`,
`env` (`EVAL_*` keys only), `user` and `user_turns` (a simulated user; see below), `followups`
(the user's next messages, word for word; see below), `judge_context` (files or folders, relative
to the case folder and named to judges from their own folder down, that every judge sees beside the work, such as the material the agent was given, so it
can check what the work says against its sources; they count in the grader digest),
`judge_steps` (what a user does on the work's first page before a judge panel looks again: a list
of `click: <selector>`, `fill: <selector>` with `value:`, `press: <key>`, `wait: <ms>` and
`shot: <name>`, with Playwright selectors such as `text=Next` or `#k`; see the panel below).
Unknown keys are errors. In `case.yaml` the run fields sit under
`execution:`, and only `case.yaml` has `context.scaffold_script` (runs with `--scaffold`),
`context.history_file` (a recorded conversation to resume; the prompt is the next user turn),
`context.add_dirs` (read-only fixture folders) and `context.instructions` (an instruction file the
run loads; see below). `prompt.md` overrides `case.yaml` where both set a field.

Graders (`type:`), each with `weight` (default 1; 0 runs it and reports it without scoring it, for
a script that prepares what later graders read, or an indicator), `role` and `arm` (`with-only` or
`both`).

**What a grader is for (`role:`).** A case usually checks two different things: that the task got
done, and the one behaviour the case exists to measure. Averaged together they hide the second: a
run that made the page and broke the rule about pages scores a half, and a suite of such cases
reads "within noise" while the behaviour flips on every run. So:

- `role: target` (the default) is what the case measures. The run's score is the weighted share
  of its targets that passed.
- `role: prerequisite` is what must hold for the targets to mean anything (a page was made at all,
  the program still runs, the question was answered). It earns nothing by passing, and the run
  scores 0 when it fails. A case with prerequisites alone scores 1 when all of them pass.
- `role: reported` (the same as `weight: 0`) is counted and never scored: whether it delegated,
  whether it ran the tests. The suite summary counts every reported grader by variant.

**Known answers.** A grader can fail a right answer or pass a wrong one, and a paid run shows
either only by luck. Keep the answers a grader was written against beside it, and `evals check
<suite>` grades them for free with the code that grades a run:

```
<case>/known/pass/             an answer every grader should pass
<case>/known/fail-<why>/       one that should not score a full 1; when <why> is a grader's
                               name, that grader is the one that should fail it
```

Each holds any of `reply.md` (the agent's last message), `work/` (files laid over the case's
workspace, as the run would have left them), `deleted.txt` (paths the run removed, one a line) and
`calls.jsonl` (tool calls, one `{"tool": "Bash", "input": {"command": "npm test"}}` a line). Write
one `fail-` for each way a grader should catch, including the near misses (a dark theme set by a
meta tag when the pattern was written for a media query). `status` says which cases have no
answer of either kind; judged graders are left out, since they need a model. The answers are never
shown to the agent and are no part of a case's digests.

The types:

| type | passes when | costs |
|---|---|---|
| `regex` | `pattern` (JavaScript, `flags`) is in the `target`: `last_message` (default), `trace`, `files` (the names of the files the run created, one per line), `changes` (what the run did to its working folder, a line per file as `git status --short` writes it: `A src/new.js`, `M src/old.js`, `D gone.js`), `{source: file, path: …}` (what one file in the working folder says), `mock_calls`; `match: not_contains` or `count:N` | free |
| `tool_used` | calls to `tool` whose JSON input matches `input_match` number between `min` (1) and `max` | free |
| `tool_order` | the first `before` call precedes the first `after` call | free |
| `file_exists` | a file the run created matches `path` (or none, with `exists: false`) | free |
| `llm` | a judge, shown the user's request (the prompt and any `followups`), the case's `judge_context` and the output in focus, votes PASS on the rubric (the body) at least 2 of 3 times (a third vote only when the first two split); each vote quotes what decides it, gives a reason, and may answer UNKNOWN when what it is shown can't settle the criterion, and a grade without a PASS or FAIL majority is kept but not scored; `focus` as `target` | judge |
| `baseline` | a judge finds the run at least as good as the reference transcript `baseline_file` | judge |
| `script` | `command` (bash, run from the case folder after the run, `timeout_seconds` default 120; the file's body when the frontmatter has none, which spares a pattern YAML's quoting) exits 0. It often runs code the agent wrote, so it gets the operator's environment without anything that looks like a credential (names holding TOKEN, KEY, SECRET, PASSWORD or AUTH, and the `ANTHROPIC_`, `CLAUDE_`, `AWS_`, `OPENAI_`, `GITHUB_` families); `pass_env: [NAME]` passes one it needs; a last `SCORE: x` line (0 to 1) is kept as the grade's score | free |

A `script` grader is the suite's own code, not the agent's: it sees `EVAL_CASE_DIR`, `EVAL_CWD` (the
run's working folder, which may be gone), `EVAL_RUN_DIR` and `EVAL_OUTPUTS` (the kept outputs),
`EVAL_TRACE`, `EVAL_LAST_MESSAGE` and, with two arms, `EVAL_ARM`, and its output (the last 4,000
characters) is the explanation. Use it for checks a regex can't make, such as loading a page the
run published in a browser, or running the suite's own test (one the agent never saw) against the
project the run left: `node "$EVAL_CASE_DIR/check.mjs"`, reading the project from `EVAL_CWD`. `claude plugin eval` has no such grader; a case that uses one runs only
here.

Mocks: `mocks/<server>/<tool>.md` in the suite or the case; the body is the tool's result
(`{{input.<field>}}`, `{{file:fixtures/…}}`); frontmatter `expect:` guards the input (a violation
aborts the run with score 0), `error: true` returns an error, `type: agent` has the judge answer as
the server (with `abort_when`), `_server.md` answers several tools, `_tools.json` carries the real
tool descriptions. Unmocked tools aren't available. Real servers only with `--allow-real-servers`
or `--mocks off`.

**A simulated user.** `user:` holds a persona and goal ("A PM who wants the plan on one page and
pushes back on jargon"). After each of the agent's turns the judge model, playing that user, reads
the conversation so far and writes the next message, or `DONE` when the goal is met or they'd give
up; the agent's session continues with it, up to `user_turns` more messages (default 2, at most
10). The run is graded as one conversation: `last_message` is the agent's last reply, `trace` holds
every turn, and the run's `conversation` lists each message and reply. Use it where the work only
shows over a few turns: a clarifying question, a revision on feedback, a correction.

**Scripted follow-ups.** `followups:` lists the user's next messages, which are sent word for word,
one after each of the agent's turns, with no model in between; the run is graded as one
conversation, as with a simulated user. Use it for a real user's own follow-up ("hmm its a bit hard
to follow. can we make them more like pretty logs?"), where a simulated user could paraphrase it.
A case has `followups` or `user`, not both; `claude plugin eval` has neither.

## The suite file

`<suite>/evals/suite.yaml` pins how the suite runs and names the setups it compares, so a result
doesn't depend on someone remembering a line of flags. Without one, a suite runs as before, from
flags alone.

```yaml
# What every run shares. Each key is a `run` flag by another spelling.
model: opus
effort: high
judge_model: opus
runs: 3
allow_tools: [Read, "Bash(npm test *)"]
max_cost_usd: 60                # the most one run of the suite may spend; the user approves it
min_effect: 0.1                 # the smallest score change worth acting on; verdicts are read against it

# The setups under test. Each may set: plugins, instructions (with instructions_scope and
# instructions_name), system_prompt, harness, model, effort, env, allow_tools, disallow_tools.
variants:
  native:
    plugins: []                 # no plugin at all
  plugin:
    plugins: [../../plugins/my-plugin]
  plugin-brief:
    plugins: [../../plugins/my-plugin]
    instructions: briefs/pages.md
    env: { MY_FLAG: "1" }
baseline: native                # default: the first variant

# The judge panel, when the decision is a judgement (see `evals judge` below).
panel:
  rubrics: { look: rubrics/look.md, works: rubrics/works.md }   # or rubric: one-file.md
  files: ["**/*.html"]
  reply: false
```

- **Shared settings**: `harness`, `model`, `effort`, `judge_model`, `judge_harness`, `runs`,
  `ablation`, `threshold`, `allow_tools`, `disallow_tools`, `env`, `instructions`,
  `instructions_scope`, `instructions_name`, `system_prompt` (a file whose text is added to every
  run's system prompt), `scaffold`, `mocks`, `max_cost_usd`, `min_effect`, `concurrency`, `tags`,
  `plugins`. Paths are relative to the suite file. Unknown keys are errors, and every
  problem in the file is reported at once. `runs` is the count for every case whose own file names
  none; `--runs` on the command line goes over both.
- **A flag still wins** over the file, and the run says so (`⚠ --model sonnet overrides the suite
  file's model: opus`), because that result is no longer the setup the file records. Each result
  records the suite file's path and hash. `--suite <file>` names a suite file somewhere else, and
  `--no-suite` ignores the one that is there.
- **Variants** are the suite's arms. A variant's settings go over the shared ones (`env` merges
  key by key; everything else replaces), and its `plugins` are what every case loads in that
  variant, whatever the target or the case's own `plugins:` say. What must be the same for two
  variants to be compared (`runs`, `threshold`, the judge, the tags) can only be set for the whole
  suite. With variants, each runs as one arm (`ablation: none`) unless the file says otherwise:
  "without the plugin" is a variant with `plugins: []`.
- **One run covers them all.** `evals run <suite>` runs every variant (`--variant a,b` for some)
  with their runs interleaved: run 1 of a case in each variant, then run 2. Variants run one after
  another would differ by the hour, the API's mood and the rate limits as well as by what they
  are. They share one `max_cost_usd` and one `--concurrency`.
- **The results** are a folder per variant, each an ordinary results folder that every command
  below reads (`<out>/<variant>/aggregate-result.json`, with `suite.variant` naming it), and beside
  them `suite-result.json` and `report.html`: each variant's score with its interval and the runs
  left out, each variant against the baseline case by case (the same paired difference, interval,
  sign test and verdict `evals compare` gives, with the difference by tag and its own interval), every
  grader's pass count by variant where the variants differ or the grader is only reported (a name
  several cases share is also counted over them), which sign-offs were delegations, and what the
  panel said. `evals compare <out>` prints that summary again; `--resume --output-dir <out>` resumes every variant.

## Results kept and used again

A result is worth keeping because it can stand in for running the same thing again. Each result
records two digests. A case's **input digest** covers what the case gives the agent: the prompt and
run limits, the history it resumes, its fixtures, scaffold and instruction file, and every layer of
mocks (not the graders: changing how a run is graded doesn't change the run). A result's **setup
digest** covers what was chosen for every run: the harness, the model and effort asked for, each
plugin's files, the instruction file, the system prompt, the tools and the environment.

- `evals run --reuse` takes, for each variant, every run a stored result of this suite holds for
  the same setup on a case whose input digest is unchanged, and makes only the rest. Reused runs
  are copied into the new result with their traces and outputs and marked `reused`; where their
  case's graders changed since, they are graded again after the run. `--reuse-from <results>`
  names the result to take from, and says why when nothing could be taken.
- What a setup doesn't cover is what moves underneath it: the harness's version and the model
  behind an alias. Reuse warns when the stored runs came from another harness version or are a week
  old, and `compare` names every such difference. When a call is close, make both sides fresh.
- `evals history <suite>` lists every stored result with how it stands against the suite now:
  `current`, or how many cases changed, were added, or have graders to run again.
- `evals name <results> <name>` (or `run --name`) names a result. `compare`, `--against` and
  `--reuse-from` take a name, `latest` or `previous` wherever they take a folder.
  A name finds one result: giving it again moves it to the newer result and says which one had it.
  `run --name` leaves a result unnamed when no run in it counts (a refused login, say).
- `evals run --against <results>` compares, after the run, each variant with itself in that
  result; a variant whose runs were all reused from it is reported as unchanged.
- `evals compare` leaves out, and names, the cases whose input digest differs between two results.

## Notes on runs

What someone saw in a run is kept beside it, in `<results>/review.jsonl`, one line per note: the
case, arm and run, a verdict (`pass` or `fail`), `modes` (the kinds of failure, as short names),
`cause` (`target`, `grader`, `case` or `harness`: whose fault), a note, and `source`: `agent` for a
reading recorded with `evals note`, `user` for the user's own verdict (`evals note --user`, or
marks imported from the `evals review` page). The newest note from each source stands, and the
user's outranks an agent's. `evals failures <results>` counts the kinds of failure by variant, says
how many of those runs the graders failed, and checks the graders against the user's verdicts: the
runs they passed that the user failed, and the reverse. The verdicts stay with the runs, so a
grader fixed later is checked against them again by `evals grade`, for free. A run that a later
result takes with `--reuse` brings its notes along (each marked `carriedFrom`), so a run that was
read stays read.

## Sign-offs

`evals gate <suite> inputs|grading|cost --said "<the user's words>"` records an approval in
`gates.json` with a digest of what was approved: each case's input digest (inputs), each case's
grader digest and the panel's rubrics (grading), or the suite file's `max_cost_usd` (cost). A
sign-off stops standing when what it covered changes, and `evals status` asks for it again, naming
the cases that are new or changed. `evals cases <suite> --html` writes the page to show the user:
each case's message, what else the agent is given, and what decides a pass.

A user who hands a decision over ("you choose what to test", "your call on the budget") has approved
nothing they saw, and the record says so: `evals gate <suite> inputs --delegated --said "<the words
that handed it over>"`. A delegated gate stands while the agent changes the cases or graders, since
the choice is the agent's, and `status` marks it with what it means: the user hasn't read the cases,
or what decides a pass. A delegated cost still lapses when the ceiling is raised. Say which
choices were the agent's wherever a score from the suite is reported.

## A run

```sh
E="${CLAUDE_PLUGIN_ROOT}/bin/evals"
$E run <suite or plugin> [--harness claude|codex] [--runs 3] [--ablation with-without|none] \
  [--case <glob>]... [--tag <t>]... [--allow-tools Write --allow-tools "Bash(npm test *)"] [--scaffold] \
  [--env KEY=value]... \
  [--instructions <file> [--instructions-scope project|user] [--instructions-name AGENTS.md]] \
  [--max-cost-usd <usd>] [--output-dir <dir> [--resume]] [-j 4] [--keep-temp] \
  [--suite <file> | --no-suite] [--variant <name>]...
```

Every setting here can live in the suite file instead (above), which is where a suite you will
run more than once should keep them.

- `--resume` with an `--output-dir` that already holds results keeps each case there whose runs all
  finished, runs the cases that aren't there (or stopped part way, or whose prompt changed since),
  and writes one result with both. It picks up a run that stopped, or adds a case to arms that ran
  before it existed, without paying for the rest again. A kept case whose graders changed is
  named; `evals regrade` grades it again without running it.

- Runs and judges are Opus by default (`--model`, `--judge-model` to change; `--judge-harness`
  picks where the judge runs, Claude Code by default). Under `--harness codex` the run uses Codex's
  own default model unless `--model` names one.
- `--ablation with-without` (the default when a plugin resolves) adds a no-plugin arm and reports Δ.
  Under it, `tool_used: Skill` graders and `arm: with-only` graders are indicators, not scored;
  under `none` they score. Keep one mode for every run you'll compare. A case with a history file
  runs one arm unless `--ablation with-without` is passed.
- A run can't read the suite that grades it. Claude Code's file tools and its shell sandbox are
  denied the suite's `evals/` folder (every case's prompt, graders, hidden checks and known
  answers), the folder the results are written to, and the instruction file and system prompt
  under test, wherever they are on disk, beside the operator's home (checked on Claude Code 2.1.322
  with a file planted in a suite outside the home: read before this rule, refused by Read and by
  `cat` after it). Codex's sandbox limits writes and not reads, so keep a suite for Codex under the
  home folder, which it is never given.
- Each run gets a fresh temporary home, working folder and config folder: none of the user's
  settings, instruction files, memory, hooks, MCP servers or plugins load, and only the PATH,
  locale, proxy and model credentials pass through from the environment, plus each `--env
  KEY=value` (one flag per variable; the runner's own HOME, TMPDIR, PATH and config folders can't be
  set this way; `KEY=` sets it empty, which is how to undo one the runner sets, such as
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, since Claude Code takes any non-empty value, `0`
  included, as on) and the case's `env`. The plugin and `add_dirs` folders are copies, so a run can't
  change the originals. Under Claude Code, the file tools are denied the user's home and the run's
  results folder, and can't write the plugin; Bash runs in Claude Code's OS sandbox, which can't
  read the user's home. Codex runs in its read-only sandbox, or workspace-write when the case grants
  Bash, Write or Edit; Codex's sandboxes limit writes and network, not reads, so a Codex run can
  read files outside its folders.
- `--allow-tools` takes one rule per flag, so a rule with spaces (`Bash(git log *)`) stays whole.
- Runs never ask for permission. Read-only tools are always granted. The suite file's
  `allow_tools` (or `--allow-tools`) says what else runs may use: a case that names no
  `allowed_tools` gets all of it, and a case that names some gets those of them that were granted,
  with a warning for the rest. Mocked tools are granted automatically.
- Claude Code runs Bash in its OS sandbox, which is built in on macOS and needs `bubblewrap` and
  `socat` on Linux. A run that is allowed Bash refuses to start without them, so `evals run` says
  which is missing before anything is spent.
- A transcript can show Bash calls in a run that was not allowed Bash. Claude Code itself runs
  read-only shell commands (`ls`, `cat`, `find`) without a rule, as it does in a user's session, and
  only inside the run's working folder: a command that reads the operator's home or the run's
  config folder is denied (checked on Claude Code 2.1.322 with a file planted in each). To take the
  shell away altogether, `disallow_tools: [Bash]`.
- **Instruction files load for real.** `--instructions <file>` (or a case's `context.instructions`,
  relative to the case) is written where the harness reads it: `CLAUDE.md` (Claude Code) or
  `AGENTS.md` (Codex) in the working folder, or the user's config folder with
  `--instructions-scope user`. Without one, no instruction file loads, unless the case's workspace
  brings its own (`CLAUDE.md`, `AGENTS.md`, `.claude/`), which is part of the project and loads
  under every variant. When any variant of a suite sets `instructions`, every variant runs with
  instruction files loading the same way, so a variant without one differs from the others by the
  file alone. A recorded case's history
  already holds the files its session loaded, so there the recorded text of that scope is replaced
  in a copy of the history (rendered the way Claude Code renders a file: frontmatter, HTML comments
  and trailing whitespace dropped, `@imports` not expanded). An A/B of two instruction files is two
  variants in the suite file, each with its `instructions:`.
- **A recorded case resumes the way it would at home.** Claude Code re-reads a resumed session's
  instruction files and tells the model about any that changed or vanished, so the runner writes
  each file the history holds (after any replace) into the sandbox, where the recorded cwd, the
  folders above it, or the user's config folder map to, and moves the history's paths to match. A
  file with no place there (a managed file, or one more than two folders above the recorded cwd) is
  noted, and the model is told it's no longer present.
- **A recorded case resumes without its old reasoning.** The API keeps a signed thinking block only
  in the exact conversation that produced it: change anything before it (an instruction file, the
  tool list, a path) and the block is dropped. A sandbox always changes something, and a variant
  changes more than its baseline, so the runner removes the recorded thinking from every arm and
  says so in the run's notes; both arms then resume from the same visible history. The turns after
  an edit were still written under the old text, and the model can notice that (an edited rule its
  earlier replies didn't follow reads as its own mistake), so a decision point is best cut at the
  first turn the change could affect.
- A resumed Claude Code session reuses the system prompt it recorded, so a recorded case's
  `append_system_prompt` has no effect (noted on each run).
- `--max-cost-usd 0` loads every case and runs nothing: a free check that the suite parses (exit 2).
  It keeps no result, so it never stands as the suite's newest.
  Otherwise the ceiling is checked before each run starts; a run that crosses it skips its judged
  graders.
- **A run that broke doesn't count.** A timeout, an API error, a failed scaffold, a judge that gave
  no verdict (it failed, answered UNKNOWN on a grader the score needs, or was skipped at the cost
  ceiling): the run is kept with a `failure` (`timeout`, `api_error`, `harness_error` or
  `ungraded`; `no_graders` when its case has none yet) and left out of every score, pass rate and
  difference, with the count beside them.
  Averaged in as a 0 it would read as the agent failing. Hitting `max_turns` is behavior and counts,
  and so does a run a mock stopped (`expect:`, `abort_when`), as the 0 the case's author wrote that
  rule to give. A case with no run that counts is left out of the suite's score and fails the run.
- **Nothing is lost when a suite stops.** `aggregate-result.json` is saved after every run (marked
  `partial` until the last one). After 3 runs in a row end on an API error the suite stops
  (`partialReason: api_errors`): the API is down or the account is out of usage. `--resume` with the
  same options and `--output-dir` keeps every run that counts and makes the rest: the missing
  ones, the ones that broke, a case added since, or more `--runs`. A case whose prompt changed
  runs again; a finished case whose graders changed is kept whole for `evals regrade`.
- `--effort low|medium|high|…` runs every case at that reasoning effort (the harness's own word
  for it), and the result records it. Each run records the model that actually served it
  (`servedModels`), and the run says so when that isn't the model asked for or when the suite's
  runs were served by more than one: a score belongs to the model that answered.
- The agent's credentials: Claude Code takes `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`),
  `ANTHROPIC_API_KEY` or a provider's variables from the environment, or copies
  `~/.claude/.credentials.json` (a macOS keychain login can't be passed to an isolated run). Codex
  takes `OPENAI_API_KEY` or copies `~/.codex/auth.json`.
- Exit code: 0 when every case reaches `--threshold` (default 1) with no errors, 1 otherwise, 2 for
  a partial run (cost ceiling, interrupted, refused credentials, or repeated API errors).

Results: `<output dir>/aggregate-result.json` (default `<eval dir>/results/<timestamp>/`, or
`$EVALS_RESULTS/<target>-<timestamp>/` when `EVALS_RESULTS` is set: point it somewhere that
outlives a cloud session), and `report.html` beside it, which links a `transcript.html` for every
run (beside its trace: how the run was graded, each judge vote with its reason, the files it left,
and every message and tool call in order). The top level has `harness`, `harnessVersion`, `costUsd`, `partial`,
`partialReason` and `suite` (with `instructions`: the file, its hash and scope; `effort`;
`servedModels`; and for each plugin under test a `sha256` of its files, so two results can say
whether they ran the same plugin). Per case,
`cases[].aggregates` (`score`, `passRate`, `allRunsPassed`, `anyRunPassed`, `gradedRuns`,
`ungradedRuns`, `scoreWithout`, `delta`), all over the runs that count, and in
`aggregates` the suite's `overallScore` with `scoreHalfWidth` (its 95% interval over cases),
`casesGraded`, `runsUngraded` and `failures` (the runs left out, by reason), `judged` (judged
grades, how many needed a third vote because the first two differed, how many ended UNKNOWN),
`allRunsPassRate` (pass^k: the share of cases where every run passed, the
number that matches daily use better than an average) and `anyRunPassRate` (pass@k: at least one
run passed, the number for a task you can retry), and per run `cases[].arms.with[]` /
`.without[]` with `run` (its number), `score`, `failure`, `turns`, `costUsd`, `judgeCostUsd`, `durationSeconds`, `error`,
`aborted`, `skippedPaidGraders`, `servedModels`, `tracePath` (the run's event stream, kept in
`runs/<case>/<arm>-<n>/trace.jsonl` with the mock calls beside it), `finalMessage` (the agent's last
reply), `outputs` (every file the run wrote or changed under its home, the working folder and
anything beside it such as a tool's own store, and under its temporary folder as `tmp/...`, kept in
`runs/<case>/<arm>-<n>/outputs/`; caches, virtualenvs, symlinks and harness config are left out, and
pages and documents are kept first when a cap of 20 MB a file, 80 MB or 500 files is reached), `conversation` (with a simulated user) and `graders[]` (`passed`,
`scored`, `explanation`, `judgeVotes`, and for a judged grade `judgeVerdicts` (PASS, FAIL or UNKNOWN), `judgeReasons` (each vote's quote and reason) and `unknown`, `evidence`, and a script's own `score`). Each case also
records `gradersSha256`, a digest of its graders and the files their script commands name;
`evals compare` warns when two results' digests differ for a case.

A result also keeps a copy of what every run was given, in `given/` beside the runs: each plugin's
text files (`given/plugins/<name>/`), the instruction file (`given/instructions/`) and the text
added to the system prompt (`given/system-prompt/`). The digests say whether two results ran the
same thing; the copy says what that thing was, after the files have moved on, and the report lists
it under "What every run was given". Files that aren't text, any over 200 KB and whatever would take
the copy past 4 MB are left out and named in `suite.given.skipped`.

`evals split [target] --seed <s> --out <dir>` draws a hillclimb's train/test split: at random,
stratified by each case's first tag, with cases tagged `group:<name>` kept on one side and each
stratum's test share rounded so the strata add up to the suite's (`--test`, default 0.5). The
seed makes it repeatable, and it never reads scores. It writes `split.json`, `train.txt` and
`test.txt`, and the lists into `<dir>/state.json` when one is there. `--case-list <file>` (one
case name or glob a line) selects cases in `run`, `regrade`, `compare` and `judge`, and `--tag`
in `compare` and `judge` keeps the cases a result records with that tag, such as `core` for a
headline.

`evals plan <results> [--min-effect 0.1] [--rounds 5] [--cases n] [--runs n] [--json]` says what
a suite can and can't show, from one result (run it on the baseline before a hillclimb's first
round, while changing the suite is still cheap): the score with its 95% interval; how far two
results from this suite would differ if nothing changed, from the spread of runs of the same case
(with one run per case that can't be measured, and the figure is the worst case); the headroom
above the score; whether a change of `--min-effect` could be seen, and if not, how many cases or
runs per case it would take (`--cases` and `--runs` ask "what if"); which cases pass on every run
(they guard against regressions and can't show an improvement), on none (read a transcript before
trusting them: a case no run passes is often a broken case or grader) and on some (the ones a
change can move); how often the judge's first two votes disagreed; and what another result, or
`--rounds` of them, costs. It warns when the suite is saturated (a score of 0.95 or more), when
half the cases always pass, when a tenth of the runs broke, and when the judge disagreed with
itself on a tenth of its grades.

`evals transcript <results> <case> [--arm with|without] [--run n] [--full]` (or `evals transcript
<trace.jsonl>`) prints one run as text: its grades, then each message, thought and tool call with
its result in order, long results cut unless `--full`. Read this, or the run's `transcript.html`,
and never the raw `trace.jsonl`. `evals report <results> [--out file]` writes the report and every
transcript page again, for results from before the pages existed.

`evals view <results> [--out file]` writes the reports again and then `view.html`, one page that
holds the report, each variant's report, every run's transcript, and the text files and pictures
the runs left. The reports link each other as files in folders, so they read well only on the
machine that made them; `view.html` can be opened anywhere, sent, or published by itself, and is
what to give the user when they want to look inside a result. A list down the side has every run
and file, the bar steps from one run to the next, and a run names the same case under the other
variants. A web page a run left is shown as text, and drawn on request in a frame cut off from the
page. Files that are neither text nor a picture, a picture over 1.5 MB, and whatever would take the
files past 10 MB are left out and named in the command's output; a text file over 300 KB is cut.

`evals grade <results>` is the grading pass over runs that are already made. It takes one result
or a suite's folder of variants, and does what is still owed:

- **Case graders**, on the cases that need it: ones whose graders changed since their runs were
  graded, which includes graders written after the runs were made, and ones with a run a judge
  left without a verdict. The rest are left alone (`--all` grades every case again, which is what
  `evals regrade` does for one result). `--free`, `--case` and `--judge-model` work as in
  `regrade`.
- **The suite file's panel**, judging only what it hasn't judged: each variant against the
  baseline pair by pair, or a score per run (`mode: rating`, the default for a suite without
  variants). Judgements are saved under `<results>/judgements/` in a file named for what was
  judged (`pairwise-<baseline>-vs-<variant>.json`), and a second `grade` keeps them. A rubric
  that changed since can't keep its judgements: the file is set aside and judged afresh.
  `--no-panel` skips the panel; `--max-cost-usd` caps the pass.

So a case can run before it has graders. A case folder with only `prompt.md` loads with a note, its
runs are kept (`failure: no_graders`) and left out of every score, and the report links their
transcripts. Read them, write graders for what you saw go wrong, and `evals grade <results>` grades
the same runs: deciding what to check after reading what the agent did, without paying for the
runs twice.

`evals regrade <results>` grades the kept runs again with each case's graders as they are now:
from the saved `trace.jsonl` and `outputs/` (a script grader's `EVAL_CWD` is `outputs/work`,
holding the files the run wrote or changed; for a case with a workspace it is the project as the run
left it, put together again from the workspace, those files, and the deletions the run recorded). It rewrites `aggregate-result.json` and `report.html`,
keeps the old results under `regrades/<time>/`, and lists each regrade in `regrades[]`. `--free`
reruns only the graders that cost nothing and keeps each judged grade while its grader is unchanged
(a changed one leaves the run ungraded). Graders that read `mock_calls` keep their grade, since
the pairing of a call with its mock's answer isn't replayed.

Tool names: Claude Code names a plugin's MCP tool `mcp__plugin_<plugin>_<server>__<tool>` and Codex
`mcp__<server>__<tool>`; a mocked tool answers to `mcp__<server>__<tool>` under both, so write
graders with that name. Under Codex a shell command is `Bash`, a file edit is `Edit`, and reading a
skill's `SKILL.md` also counts as a `Skill` call for that skill.

## More on some commands

`evals help <command>` has each command's options (`$E` below is `bin/evals`). This is what the
options don't say.

**Sessions** (read from `$CLAUDE_CONFIG_DIR/projects`, default `~/.claude/projects`):

- `$E sessions list [--since 7d] [--project <part>]`: recent sessions with their first message.
- `$E sessions search [--since 7d] [--used <tool|skill|server>] [--user-text <regex>]`: turns that
  used something, or user messages matching words; a text match prints the request id of the reply
  the message reacted to.
- `$E sessions turns <session>`: each turn's user message and each response's request id, tools and
  text, with notifications that arrived mid-turn.

**Traces:**

- `$E trace save --session <id|path> [--moment <ref>]... [--note <text>] [--user] [--good] [--tag <t>]... [--copy]`.
  A moment is a request id (`req_…`), a record uuid, or words from the user message that reacted to
  it; without one, the reply the latest user message reacted to. A message stands for the reply
  before it, or, when notifications arrived in that turn, the reply before the first of them (save
  warns). Notes are inferred unless `--user`. Saving the same moments again adds the note to the
  existing trace. The trace records the environment: Claude Code version, model and effort, working
  folder and branch, the instruction files loaded (path and hash) and, read at save time, the
  folder's commit and whether it had uncommitted changes. `--copy` freezes a copy of the transcript.
- `$E trace show <id>`: notes, environment, and each moment's user message, reply and reaction.
- `$E trace list [--tag t] [--used name] [--source user|inferred] [--good|--bad]`. `--used` matches
  what the moment's turn used: a tool, a skill (`plugin:skill`, `skill` or `plugin`), an MCP server.
- `$E trace update <id> [--set-note <text>|--add-note <text>] [--user] [--moment <ref>]... [--tag t] [--untag t] [--good|--bad]`.

**Capture** a recorded moment as a case:

```sh
$E capture --trace <id> [--moment <n>] --out <suite>/evals/<case> [--kind turn|decision] [--plugin <dir>] [--tag t]
$E capture --session <id> --moment <ref> --out …
```

It writes `history.jsonl` (the conversation before the moment's turn, exactly as a resumed session
sees it), `prompt.md` (the user's message), `case.yaml` (`context.history_file`, `max_turns`, tags,
`plugins:` from `--plugin`), `original-turn.jsonl` (what the agent did in the turn) and `original.md`
(the grading evidence: the trace's notes, every response in the turn, the user's reaction). It
writes no graders. `--kind decision` sets `max_turns: 1` and is refused when the moment isn't the
turn's first response. Images in the user's message can't be carried into the prompt (it warns).

**Grade** for free: `$E grade <case> [--transcript <jsonl>] [--text-file <file>]` runs the
`regex` (on `last_message`, and `trace` approximated from the transcript), `tool_used` and
`tool_order` graders against the recorded turn (default `original-turn.jsonl`), another transcript
in Claude Code's session format, or a text given as the final message. Judged graders are listed, not run.

**Instruction files in a history:** `$E instructions list <history.jsonl>` shows the files a
recorded case loaded; `$E instructions rewrite <history.jsonl> --replace <recorded path> --with <file>`
(or `--remove <path>`, `--add <path> --with <file>`) edits them by hand, in the record and in the
text the model was sent. `evals run --instructions` does the replace for you.

**Check the judge:** `$E label <results> [--out labels.md]` writes every judged grade as a blind
sheet (what the judge saw and the criteria, no verdicts); mark each `verdict: pass` or `fail`, then
`$E agree <results> labels.md` reports how often the judge agreed, split into too lenient and too
strict, and lists apart the grades it answered UNKNOWN. `$E label <results> --html` writes the
same sheet as a page with Pass and Fail buttons: marks are kept in the browser, and "Download
labels" saves the sheet `agree` reads. `agree` prints the agreement with a 95% interval (19 of 20
is "somewhere from 76% to 99%"), how many of the labels were a pass and a fail, and the agreement
beyond chance (Cohen's kappa: 1 is perfect, 0 is what two coin-flippers with those pass rates would
get). Fewer than 20 labels is a hint, not a number, and so is a set with under 3 of either kind: a
judge that said PASS every time agrees 19 times in 20 with a user who passed 19, and has shown
nothing. Such a grader stays uncalibrated until it has been checked on both.

**Judge what the runs made** with a panel, after the runs:

```sh
$E judge <results> --rubric [<axis>=]rubric.md... [--against <results B>] [--judges opus] [--effort high] \
  [--arm with|without] [--against-arm with|without] [--case <glob>]... [--files <glob>]... \
  [--evidence <glob>]... [--shots views.json] [--choices GOOD,BAD] [--max-cost-usd <usd>] \
  [--no-render] [--no-reply] [--no-source] [--no-context] [--motion <ms>] [--refs <dir>] \
  [--resume <judgements.json>] [-j 4]
$E judge <results>                        # the panel the suite file declares, with no flags
$E judge <results A> --against <results B>   # the same rubrics, over two results (two hillclimb rounds, say)
```

A suite file's `panel:` holds the rubrics, the judges and what they are shown, under the names of
the flags (`rubrics` or `rubric`, `judges`, `effort`, `mode`, `files`, `evidence`, `shots`, `refs`,
`choices`, `motion`, and `reply`, `source`, `context`, `render` as true or false). Without
`--rubric`, `judge` uses it, and a flag still overrides the setting it names; on a suite's folder of
variants it judges each variant against the baseline, as `evals grade` does. Keep the panel in the
file once it is settled: every round is then judged by the same rubric with the same view, which
is what makes two rounds' shares comparable.

Runs that broke for reasons outside the agent (timeouts, API errors, a failed scaffold; not
the turn cap or a judged grader without a verdict) aren't judged and are listed as not judged in the summary, one line per reason, as are pairs left out by
`--max-cost-usd` or a judge that answered twice without a verdict. `--files` names the deliverable among the kept outputs (`published/**`, say), so the judges see the
pages a run published and not its drafts or scratch files; a rated run that left none of them
isn't sent to a judge, and the summary lists it under "not judged" as no output, for the report to
count as the failure it is. The same holds for a pair: when either side left no deliverable no
judge is asked, and the summary counts those pairs apart as "no output from A", "no output from B"
and "no output on either side". Whether a page got made is one question, which a `file_exists`
grader answers for free; which of two pages is better is another, and a judge handed a page and
nothing answers the first while the summary reports it as the second. The panel's file is saved as
judgements come in, the panel stops after 3 judgements in a row that no judge answered, and
`--resume <that file>` (same rubric) keeps what was judged and asks only for the rest. `--against-arm` compares one
result's with arm against another's without arm (or the same result's two arms).

Each judge is an agent that reads a blind folder per run: `request.md` (the user's messages),
`reply.md` (the agent's replies, left out with `--no-reply`, so a judge weighs the work and not
the agent's account of it), `files/` (the run's kept outputs, never a hidden folder such as a
tool's `.versions/` when `--files` names the deliverable), `refs/` with `--refs <dir>` (reference
images, such as stills of the look the user wants), `context/` (the case's `judge_context`,
copied beside its runs when they ran; beside X/ and Y/ in a pair, since it's the same for both;
`--no-context` hides it), `evidence/` (files beside each run that `--evidence` names, globs relative
to the run's folder, such as a script grader's report or a page's rendered text; the judge is told
they are evidence to check, not a verdict) and, for HTML outputs, `shots/` (by default desktop and
phone, each light and dark, a screen at a time from the top so text keeps its real size, phones at
twice the pixels; up to 5 desktop and 6 phone screens in light and the first 2 in dark, rendered with the operator's Playwright and
Chromium or Chrome; without one the judges read the source alone and the summary says so).
`--shots views.json` names other views: a list of `{"name", "width", "height", "scheme": "light"
or "dark", "scale" (1), "screens" (3)}`. A case's `judge_steps` are taken on its first page in the
first two views, each `shot` step and the end photographed (`-step-<name>` and `-after` frames),
with `shots/steps.txt` saying which steps worked: a step that fails is evidence the page doesn't do
it. `--motion 600` adds a second frame of each page's first screen 600 ms after the first, so a
judge can see what moves. Without
`--against` each run gets a 0-10 score from each judge, summarized per judge with a 95% interval
over cases and the judges' average gap; with `--choices SEND,FIX` (the good answer first) each
judge picks one, or UNSURE when what it's shown can't settle it, quoting where it is, and the
summary gives the good answer's share of the decided outputs with a 95% Wilson interval and its
mean over cases. A choice is the plainest headline for "would the user use this as it is". With `--against`, each case's runs are paired A's i-th with
B's i-th and each pair is judged twice with the sides swapped, so a taste for one position cancels;
the summary gives B's share (1 = B won both orders, 0.5 = a split or a tie), cases B is ahead and
behind with a sign test, and how often each judge picked the same side in both orders, which is
the first thing to read: a judge that flips with the order is guessing. Judges are `opus` (the
default, alone), `fable`, a model id, or `codex:<model>` to judge under Codex; name two
(`--judges opus,fable`) when a second model family's view is worth its cost. `--no-source` shows
each page only as its screenshots, so file names and markup can't tell a judge whose work it is;
pair it with `--evidence page-text.md` or the like when the judge must check wording. Leave out of
`--evidence` any report on checks a version was tuned to pass. Each `--rubric` is an axis (named
`<axis>=file`, or after the file) judged in a call of its own, so one quality's verdict doesn't
color another's; the summary gives each axis apart, and a round is decided on the axis it targets.
Before judging, each axis's calibration is printed: uncalibrated until `$E agree` on these judges'
picks of this rubric clears 8 in 10 on at least 20 labels. Everything (prompts, every verdict,
the summary, and the settings: models, effort, each axis's rubric and hash, its calibration, the
file and evidence globs, the views, reply, context and refs) is saved in `<results>/judgements/`. Judging after the runs means the same outputs
can be judged again with another rubric or other judges without paying for the runs twice.

**Check the panel against the user** before its picks steer anything:
`$E label <results>/judgements/<file>.json [--sample 20] [--out <dir>]` lays out the outputs it
judged (pages and screenshots) in a folder with `sheet.md`, blind to its picks. A pairwise sheet
shows each pair's sides as X and Y, swapped at random per pair, with `pick:` to fill in (`X`, `Y`
or `tie`); a rating sheet asks for `score:` from 0 to 10. `$E agree <file>.json <dir>/sheet.md`
then gives how often the panel, and each judge, picked what the user picked (for ratings, scored
within a point), and lists where it didn't; with several axes the sheet has a `pick <axis>:` line
for each. Each `agree` is recorded in `$EVALS_HOME/calibration.jsonl` by rubric hash and judges, for
`judge` to read; `agree` on an `llm` grader sheet records each grader's criteria the same way, and
`run` and `regrade` then say which judged graders are uncalibrated (a bar of 9 in 10).

**Compare** two results: `$E compare <A> <B> [--cases <glob>]... [--keep-errors] [--min-effect 0.1] [--json]`
(each a results folder or an `aggregate-result.json`). It pairs cases by name and reports B against
A: the mean per-case score difference with a 95% t interval, cases better, same and worse with a
sign test, the half-width run-to-run noise alone would give, pass^k on each side, the same for turns, cost and seconds
(marked when one moved by more than its interval: a change that buys its score with twice the
turns should say so), the runs that broke on each side with the reasons (left out of the scores;
`--keep-errors` counts them as 0, as results did before), whether both results ran the same plugin
files, the cases that moved, and a verdict by the rule in
`principles.md`. It warns when the cases differ, a result is partial, the setups differ (harness,
model asked for and served, effort, judge), fewer than 20 cases are paired, a tenth of a result's
runs broke, or the two sides broke at rates 10 points apart. Leaving broken runs out is only fair
when both sides broke about as often: a side that lost a fifth of its runs to timeouts lost its
slowest ones, and what is left flatters it. Make them again (`run --resume`) and compare then.

## What isn't possible here

- A decision point inside a turn (after a tool result) or inside a subagent: a run can only start at
  a user message. Capture the turn instead.
- Replaying the calls a mock answered: a regrade keeps the grade of a grader that reads
  `mock_calls`, and a new or changed one needs the case run again.
- Reading the model a Codex run was served by: its event stream doesn't say, so `servedModels` is
  recorded under Claude Code only.
- Codex as the agent under test can't resume a recorded Claude Code session (those cases fail),
  doesn't cap turns (`max_turns` is ignored; the timeout holds), can't allow tools one by one, runs
  no plugin hooks, and reports no cost (so `--max-cost-usd` can't bound it). Reading Codex
  sessions for traces isn't built yet.
- Trusting `--harness codex` as much as the default: every real run so far was under Claude Code.
  The Codex side is covered by this plugin's tests against a stand-in, and no suite has yet been
  run against a real Codex login, so read a Codex result's run records before believing its score.
- A grader reading an image: graders in a case see text only. `evals judge` shows its judges
  screenshots of HTML outputs when Playwright is installed.
