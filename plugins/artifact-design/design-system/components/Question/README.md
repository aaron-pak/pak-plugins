# Question

One question that checks itself, alone or as a step in a quiz.

- `<form class="sk-quiz">` with a label, a heading, a `fieldset` of `.sk-radio` (one answer) or `.sk-check` (several), and `data-right` on each right answer. A button with `data-sk-check` checks it.
- Checking marks every row with a brush tick or cross, locks the answers, sets `data-done="right|wrong"` on the form, and shows the `[data-sk-if="right"]` or `[data-sk-if="wrong"]` callout. Explain why in both, not just "Correct".
- In a quiz, `data-sk-next="Next question"` turns the button into the way on; listen for `sk:answer` (`detail.right`) to keep score and `sk:next` to move on. Number keys pick an answer and Enter checks. To load the next question, put a new `form.sk-quiz` in place of the old one and call `Sketchbook.mount()` on its parent.
