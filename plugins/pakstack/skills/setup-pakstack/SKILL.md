---
name: setup-pakstack
description: Write ~/.config/pakstack/models.md with the user. The file records which models they hand which work to. Run it once on each machine, and again when the models they use change.
disable-model-invocation: true
---

# Setup pakstack

pakstack's skills name no model. When one hands work to another agent, such
as a reviewer or a council member, it reads `~/.config/pakstack/models.md` and
chooses by it. This skill writes that file with the user.

Ask the user which models and effort they want for which work: review,
council, and anything else they hand off. Name a model only after it has
answered a one-line prompt on this machine, because names from config files,
older setups and memory go stale. If the file exists, start from it.

Write the file in the form below. Give each purpose or scenario one line in
the user's words; its right side may name several models or a condition. Copy
the "Delegating to an agent" section as it is, then show the user the file.

```markdown
# pakstack models

- Review: <models and effort>
- Council: <models and effort>
- <purpose or scenario>: <models and effort>

## Delegating to an agent

There are several ways to hand work to another agent, and every harness has
its own names and tools for them. Use the method the user asks for, or your
own judgement when they don't say. If the model or the method asked for can't
be used, report that as a blocker. Never fall back silently.

| Method | What it is | In T3 Code | In any other harness |
| --- | --- | --- | --- |
| Subagent | Runs inside your session and reports back to you. It starts without your context, so brief it in full. | `delegate_task` | Your harness's subagent tools |
| Thread, also called a session | Runs on its own and outlives your turn. The user can open it and carry on in it. | `t3_thread_launch` | Your harness's or app's session tools, where it has them |
| Another provider's model | A harness starts only its own provider's models, so this needs a bridge. | Either tool above, naming the provider | That provider's CLI, run non-interactively (`claude -p`, `codex exec`) |
```
