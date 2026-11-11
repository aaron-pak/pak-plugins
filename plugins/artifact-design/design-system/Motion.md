# Motion

Quiet, once, and in reading order. A page should feel as if someone is laying it out for you as you reach each part, then holds still so you can read. Everything can be read before it moves, and nothing waits on an animation.

## The pen

Anything hand-drawn is drawn by the pen. The stroke appears along its own line, from where a hand would start to where it would lift, at a hand's pace. It is never wiped on from one side, popped in or faded in.

| What | How the pen draws it |
| --- | --- |
| A ring round a number | from near the top, round against the clock, closing just past its own start. Its fill comes in once the ring has closed |
| A loop round a figure (`data-sk-ring`) | one loop round the words, 620ms |
| A line under a phrase (`data-sk-under`) | left to right, 1.6ms a pixel. On two lines, the second line after the first |
| A tick | one stroke, down then up |
| A cross | two strokes, each from the top, one after the other |
| An arrow | the shaft from its tail to its tip, whichever way it points, then the head |
| A drawing | stroke by stroke in drawing order, then its fills |

Two rules keep it honest. The pen moves at about the same speed whatever it draws, so a long arrow takes longer than a tick (150ms to 640ms). And one hand does one thing at a time: the number is there before it is ringed, the cards are down before the loop joins them, a note is written before its arrow is drawn, an outline closes before its fill comes in, and a second mark waits for the first.

Under the hood a pen stroke is the filled brush shape, masked by its own centreline, with the mask's dash offset animated (`.sk-pen`). A stroke that closes over itself, like a ring, is cut in two so the end of the stroke never shows under its beginning. At rest, in print and under reduced motion a pen stroke is simply drawn.

## Four curves, four durations

| Token | Value | For |
| --- | --- | --- |
| `ease-out` | cubic-bezier(0.2, 0.8, 0.2, 1) | things arriving: text rising, cards, bars and meters growing |
| `ease-draw` | cubic-bezier(0.45, 0, 0.2, 1) | the pen: brush strokes, rings, ticks, arrows, chart lines, timelines |
| `ease-settle` | cubic-bezier(0.3, 1.2, 0.5, 1) | a marker sliding into place with the slightest overshoot: the segmented thumb, the tab bar, the contents marker, switches |
| `ease-pop` | cubic-bezier(0.3, 1.4, 0.5, 1) | a small thing landing from nothing: a dot, a pin, a pill, a sticky note, a card lifting under the pointer. A touch past its place and back, never a bounce |
| `time-quick` | 180ms | hover and press: colour, border, a 2px lift |
| `time-move` | 300ms | a marker sliding (segmented, tabs, contents), a value changing, a dialog opening |
| `time-enter` | 520ms | a part rising 8px into view |
| `reveal-stagger` | 60ms | between parts arriving together, in reading order, at most five steps |
| `stroke-draw` | 260ms | one brush stroke drawing along its centreline |
| `boil-frame` | 83ms | one frame of the hero's boil (12fps) |

## Arriving, once per part

Put `.sk-enter` on `main`. Each direct child waits, invisible, until its top is 8% above the bottom of the window, then plays its entrance. Parts already on screen when the page opens go in reading order.

| What | How |
| --- | --- |
| A block | rises 8px and fades in over `time-enter` with `ease-out`. Inside a `.sk-section`, each child follows the last by `reveal-stagger` |
| A drawing | drawn the way a hand would draw it. The ground is painted on first: a blob or tile opens as a circle from its middle over 400ms, and a band's ground is swept on from the left over 500ms. Then each brush stroke draws along its centreline in drawing order, `stroke-draw` each. Only then do the fills come in under the lines, each one growing from its own middle over 220ms, 40ms apart, so the colour never shows before the outline that holds it. A whole drawing takes about a second |
| Art below the hero | the same as a hero's drawing: stroke by stroke, then fills, the first time it is seen. Its ground is there from the start and it never boils |
| A hand mark | the pen draws a line under its phrase or a loop round its number, 700ms after the words are seen. A phrase on two lines gets one stroke a line, the second after the first |
| A flow | the cards are laid down left to right 120ms apart. Each arrow leaves its card as the next one lands, drawn from tail to tip, and its label comes with it. The loop is drawn last, all the way back, and a note on the flow is written after that |
| A tree | each arrow is drawn down from its question, and its card lands as the arrow arrives, 90ms apart |
| A map | its cards are laid down in reading order, 90ms apart; each arrow is drawn from the part that sends to the part that receives, once both are on the page |
| A week | its events rise into their slots, one day after another |
| A note | is written word by word at a writing pace, after the text it sits beside. Then its arrow is drawn, from the words towards the thing. A note that points at a ringed or underlined thing waits until that mark is drawn |
| A sticky note | is laid down: drops 6px and turns 3° into place with a slight overshoot |
| A big number (`.sk-num`, 100 or more) | counts up from zero over 700ms (`data-sk-count="1200"` sets the time), keeping its width so nothing shifts. A smaller number, and every stat on a report, shows its true value at once |
| A meter | fills from zero to its value |
| A chart | bars grow from the axis 30ms apart; a line draws left to right, its end dot lands as the line arrives, and the tint under it comes in after; values and names fade in last. A chart's note comes after the chart, words first, then its arrow |
| A timeline | each dot lands, then its line runs to the next dot and reaches it as that one lands, 200ms apart |
| Steps | the pen rings each number in turn, 150ms apart, and each ring's fill comes in once it has closed |
| A terminal | once 40% of it is in view, each `$ ` command types itself at 34ms a character, then the lines under it print 70ms apart |

Each part plays the first time it is seen and never again, so scrolling back up is calm. `Sketchbook.replay(box)` plays a box's entrance again, for a "play again" control.

## Always: the hero, and only the hero

`data-sk-boil` redraws the hero by hand every `boil-frame`, 12 times a second: four drawings from four seeds of the same brush, the ground redrawn with them, shown in a random order that never repeats the last frame, so the eye never catches a loop. A band's ground is the exception and holds still, because a whole edge of the page shimmering is too much. It is the shimmer of hand animation, not a filter wobble. It starts once the hero has drawn itself on and stops while the hero is off screen or the tab is hidden. One hero per page, and only the hero boils.

The only other loop is the pulse of something live (`.sk-live`, a live pill, a timeline's "now"): one soft clay ring every 2.4s.

## In response to you

- Hover: colours and borders change over `time-quick`. A link card lifts 2px and a choice's picture 3px. A button's arrow nudges right.
- Pointing at a button, link or card that holds a spot redraws the spot for two frames (83ms each, a new seed each time), then it rests on its usual drawing. It is the same hand checking its line, not a wiggle.
- Controls slide rather than jump: the segmented thumb, the tab bar and the contents marker move over `time-move` with `ease-settle`.
- A list you search, filter or sort keeps its place: rows that stay slide to their new positions over `time-move`, rows that come back fade up, and the count rolls.
- A value that changes (`Sketchbook.set`) rolls the old text up and the new text in, and lands on the latest value if you change it again mid-roll.
- A deck opens to Present without a flash: the slides jump straight to the one you were on, then crossfade from there.
- A checkbox's tick is drawn by the pen, down then up, and a task's text is struck through after it. A switch's knob slides. A disclosure opens to its height. A flip card turns over. A dialog rises over a fading scrim, and a toast rises from the bottom, its tick drawn as it lands, and leaves on its own.
- Checking a quiz answer draws a tick or a cross beside each choice, one mark after another, then the explanation rises in.
- A player's step: its words slide in 12px from the side you're moving towards, things in the stage fade in or out over 320ms, and bars grow or shrink to their new heights over 420ms. Play moves on every 2.8 seconds and stops at the last step, or as soon as the player leaves the screen.
- A form in steps slides the next step in from the right (and back from the left) over 320ms while the form eases to the new step's height, and the pen ticks each finished step's number.

## Rules

- Never animate to decorate: no parallax, no scroll-jacking, no looping ornaments, no hover wiggles on text.
- Never wipe, pop or fade a hand-drawn thing on. If a hand drew it, the pen draws it.
- No bounces. `ease-pop` goes a touch past and back; nothing overshoots more than that.
- Nothing moves under `prefers-reduced-motion`: every part shows in its end state, numbers show their final value, charts are drawn, the hero holds still. Printing shows everything too.
- Motion never carries meaning alone; the end state says everything.
- Every control does something real: it changes the page, copies something, downloads something or opens something. If a button would only pretend (a fake "Saved", a period switch with no data behind it), leave it out.
