# Tree

A question that branches: white cards for questions, putty panels for answers, every branch a labelled brush arrow. Mark one answer with `"key": true` and it turns clay-soft, and the arrows that lead to it turn clay, so the page shows the way you went or the way most cases go.

- `<div class="sk-tree" aria-label="…" data-sk-tree='{"q":"Is it urgent?","kids":[{"if":"Yes","a":"Do it now","key":true},{"if":"No","a":"Friday’s list","sub":"Look at it once a week."}]}'></div>`
- A node is `q` (a question, with `kids`) or `a` (an answer). `if` is the words on the arrow into it, `sub` a short second line, `draw` an optional spot.
- Two to six answers, three levels at most. Keep each card to a few words; the `sub` line carries the detail.
- Drawn at its real width: across while each answer gets 150px, otherwise an outline that steps in, its arrows running down the left and turning in to each card.
- Cards are laid down level by level, then each arrow draws. A screen reader gets the same tree as a nested list.
