# Flow

A process: white cards, each with a spot drawing and a label, joined by labelled brush arrows. `data-sk-loop` adds a clay arrow back under the row with its caption.

- `<div class="sk-flow" data-sk-flow='[["task","Task","given to"],["agent","Agent","leaves a"],["transcript","Transcript"]]' data-sk-loop="…"></div>`. Each step is a drawing name, a label, and the words on the arrow that leaves it, so the row reads as a sentence: "Task given to Agent leaves a Transcript".
- Two to five steps. A label can run to two lines. It is drawn at its real width: across while each step gets 150px and each arrow's label fits between two steps, stacked top to bottom otherwise, with the loop running up the right side. Stacked, the cards fill the column, and a long name, note or arrow label wraps inside its own room.
- `<span class="sk-note" data-sk-note-at="3">…</span>` inside the flow sits over step 3 with an arrow to it; once stacked, it is written inside that card.
- Cards are laid down one by one, then each arrow draws, then the loop.
