# Art

A drawing on its ground, anywhere below the hero. This is how a page keeps its drawn feel all the way down, instead of spending it all at the top.

- `<div class="sk-art" data-sk-draw="mountain" aria-label="…">`: a 240px tile. `data-size="s"` is 132px and `"l"` is 340px; `data-sk-shape="blob"` gives it the hero's blob.
- `data-tone` picks the ground: clay (the default), `oat`, `sage` or `ink`. On oat and sage the drawing keeps its one clay part. On ink the drawing is chalk.
- `data-sk-shape="panel"`: a wide flat ground that fills its column. As the first child of a `.sk-card` it becomes the card's header, edge to edge. Use it for a row of options, days or features, where a 64px spot would be too quiet.
- In a row, mix oat and sage and keep clay for the one that matters, such as the pick.
- Grounds are printed colour with a fine grain. They look the same by day and by night.
- A spot is still right inside a callout, a list or a small card. Art is for when the drawing should carry the section.
