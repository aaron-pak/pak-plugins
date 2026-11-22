# Slides

A deck that reads as a page and presents full screen.

- `<div class="sk-deck">` with a `.sk-deck-bar` (a counter in `[data-sk-deck-n]` and a `[data-sk-present]` button), then one `<section class="sk-slide">` per slide.
- Each slide is laid out at 1280×720 and scaled to fit, so a slide looks the same on a laptop, a projector and a phone. On a phone the slides reflow to read down the page instead.
- `data-tone="clay"` for the title slide, `"ink"` for the closing ask; the rest stay on paper. Inside: `.sk-title`, `.sk-h2`, `.sk-num`, a chart, a two by two, `.sk-slide-split` for text beside a drawing.
- Arrow keys and Page Up / Page Down move between slides when the deck is pointed at, focused or presenting. One point per slide, said in its heading, and one clay thing on it: the bar, the number or the word that is the point.
- A horizontal bar chart on a slide draws slide-sized: thick bars with their names above them.
- Present opens straight on the slide you were reading, full screen, with a round × to close (or Esc). Printing puts one slide on each landscape page, edge to edge.
