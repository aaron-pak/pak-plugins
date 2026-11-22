# Motion

Quiet and once. See the Motion section for every timing.

- Anything hand-drawn is drawn by the pen: the stroke appears along its own line, from where a hand would start to where it would lift. A ring goes round its number, a tick goes down then up, an arrow runs from its tail to its tip and then gets its head, a cross is two strokes. Nothing hand-drawn is wiped on or popped in.
- One hand does one thing at a time: a number is there before it is ringed, a note is written before its arrow is drawn, an outline closes before its fill comes in.

- Inside `.sk-enter`, each direct child waits until it scrolls into view, then rises 8px and fades in; a section's parts follow in reading order, 60ms apart.
- A drawing lands its ground, then draws stroke by stroke, then fills. Notes are written word by word, stickies are laid down, meters fill, charts grow, timelines run from dot to dot.
- Only a big `.sk-num` of 100 or more counts up; stats on a report show their true value at once.
- Only the hero keeps moving, boiling at 12fps. A spot redraws two frames when you point at what it sits in.
- `Sketchbook.replay(element)` plays an entrance again. Under `prefers-reduced-motion` nothing moves and everything is in its end state.
