# Note

A margin note: a few words of Kalam in `accent`, with a small brush arrow at what it means. The one place handwriting appears.

- `<span class="sk-note">` has its arrow on the left, pointing down and left; `data-sk-point="right"` puts it on the right, pointing down and right; `"up-left"` and `"up-right"` point up at something above. In a chart, use `data-sk-note` instead (see Line chart).
- `data-sk-target="#id"` draws the arrow to that element wherever the layout puts it, so the note can sit in a row beside a number and still point at it. Leave about 40px between them.
- Notes write themselves on, arrow first, after the text beside them.
- A few words, one line, pointing at one real thing. A note that points at nothing, or explains instead of points, comes out.
- One or two per page.
