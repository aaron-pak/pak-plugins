# Player

A figure that changes step by step, with a sentence for each step, for showing how something unfolds: a search, a rumour spreading, a queue emptying, a recipe. People can play it, step through it or jump to any step.

- `<div class="sk-player" aria-label="…">` holds a `.sk-player-stage` (the figure) and an `<ol class="sk-player-steps">` with one `<li>` per step. The bar between them is built for you: Play, back, forward, a dot for each step and "2 of 6".
- In the stage, `data-sk-at` says when a thing shows: `"2"` only at step 2, `"2-"` from step 2 on, `"-3"` up to step 3, `"1,4"` at those steps. The stage also carries `data-step="2"`, so a page's CSS can restyle anything at a step.
- A chart in the stage changes with the steps: give each `<li>` the chart's data at that step in `data-sk-data`, and the bar that matters in `data-sk-key`. Bars grow or shrink to their new heights. Set `data-sk-max` on the chart to the largest value any step reaches, so the scale stays put while the bars move.
- For anything else, listen for `sk:step` (`detail.i` counts from 0, `detail.n` is the number of steps, `detail.step` is the `li`) and set attributes in the stage. The Explore page does this to cross off names in a search.
- Play moves on every 2.8 seconds (`data-sk-every="4000"` changes it), stops at the end and offers "Play again". It stops when it scrolls out of view. The arrow keys step and Space plays once the player is focused.
- Each step's words slide in from the side you're moving towards; under reduced motion they just change.
- Five to eight steps. Start each step with a bold sentence that says what changed, and keep the rest to one more line.
