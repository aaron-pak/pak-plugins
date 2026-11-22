---
name: ready-pr
description: Take a change to a pull request that is ready to merge, with the steps full-send and full-stop share. Use only when full-send or full-stop sends you here.
disable-model-invocation: true
user-invocable: false
---

# Ready PR

The user is not watching this thread, and wants the work completed end-to-end autonomously. Your updates and your final message go unread until long after you stop.

If the user did not explicitly request "full send" or "full stop" in some clear way, do not assume full autonomy. If they did, everything below applies.

The user grants you permission to:

- Force-push the PR's own branch with `--force-with-lease` after a rebase.
- Use the test methods that Proof needs, without asking first.

## Testing permission

A "full send" or "full stop" request is the permission. If a project file or other instruction says to ask before a test method, or to leave testing to the user, this request replaces that rule for this task.

That includes ask-first rules for computer use, browser automation, simulators and devices, running the app or a dev server, screenshots, and visual checks. Use the method that gives direct proof. List it in the report.

Rules about how to test still apply. Follow rules that name the correct command, fixture, or check. This permission only removes the ask-first or leave-it-to-the-user step. If a preferred method cannot prove the change, use a gated method under this permission.

It covers only the tests needed for this task. It does not add permission for the steps under "Asking the user", such as production changes or data deletion. It also does not bypass a harness or system approval prompt if one appears.

## Steps

1. **Finish the change.** Complete the goal from the user's request without expanding its scope. Handle the cases that can really happen: a guard or a test for a case that can't happen in practice adds code to maintain and protects nothing. If you are on the default branch, create a branch first.
2. **Prove it.** Get proof for every change you made. See "Proof".
3. **Get feedback.** Use the `review-loop` skill to verify changes.
4. **File the PR** with the `file-pr` skill. Rebase onto the latest default branch first. Add one short line to the description that says how you proved the change.
5. **Babysit the PR** with the `babysit-pr` skill. Get proof for each fix before you push it.

Then finish as the skill that sent you here says.

Stay active until you have finished that way. If you end your turn while checks are pending, the work stops, because nobody will prompt you again. Wait with the watcher from `babysit-pr`, so something wakes you when the PR changes.

## Proof

Proof is evidence you observed yourself in this session: command output, a reproduction, a screenshot. Use the most direct proof the change allows:

- For anything the user will see or run, use it the way they will and watch it work: run the app, call the command, hit the endpoint. Green mocked tests do not prove that the user experience works. Attach screenshots to the PR when they help and you have a way to upload them.
- For a fix, reproduce the original failure, then watch the same reproduction pass with the change in place.
- Run the checks that the repo's CI runs (typecheck, lint, tests).
- Add one focused test that fails without the change, when the behavior has none and the repo has a test setup.

When you cannot find a way to prove a change, you do not have full confidence. Ask the user.

## Merge gate

Full confidence means all of these are true on the latest commit:

- Your proof covers every change in the diff.
- The PR is ready, as `babysit-pr` defines it.
- GitHub reports the PR as mergeable.
- No human review still requests changes.

You can ignore automated reviews that request "needs human review" if you have high confidence in your changes.

## Asking the user

A question in a normal message goes unseen, and the thread looks done. To ask the user something, use the harness's question tool so the thread shows that it is waiting: `AskUserQuestion` in Claude Code, `request_user_input` in Codex, or the question tool your harness has. Put all the context in the question: the PR link, what blocks you, and the options with your recommendation first.

Ask only when you cannot continue alone:

- You cannot prove the change.
- The merge gate cannot pass, and you cannot fix that yourself.
- The next step is outside what you were granted: deleting data, touching production, changing things outside the repo, closing a PR, or force-pushing any other branch.
- The goal is ambiguous in a way that changes the result.
- Another PR makes this one obsolete.

Decide everything else yourself with sensible defaults, and list those decisions in the report.

If no question tool is available, or the tool returns no answer, take the safe path: leave the PR open and unmerged, and start your final message with the question.
