# Chat and tool calls

A conversation or an agent run, for transcripts and logs.

- `.sk-chat` > `.sk-msg data-from="user|assistant|system"`, each with `.sk-who` (name and `time`) and `.sk-body`. The user's turns sit on the panel; the assistant's on the paper; system lines are mono in a dashed outline.
- `<details class="sk-tool">`: a tool call. The summary has the tool name, its argument in `code`, and a time or a result pill; it opens to the output. `data-state="error"` edges it in red.
- Put a verdict or summary in a `.sk-split` side panel beside a long run.
