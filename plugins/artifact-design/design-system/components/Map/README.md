# Map

The parts of a system on a grid, joined by labelled brush arrows: how an order, a photo or a request gets from one place to the next. White cards for the parts, the words on every arrow. Mark the one part that matters with `"key": true` and it turns clay-soft.

- `<div class="sk-map" aria-label="…" data-sk-map='{"nodes":[{"id":"site","a":"Order site","sub":"On the customer’s phone","draw":"phone","at":[0,0]},…],"links":[{"from":"site","to":"pay","if":"asks for the money"},…]}'></div>`
- A node is a part: `a` its name, `sub` a short second line, `draw` an optional spot, `at` its column and row, counted from 0. Up to four columns and three rows.
- A link is an arrow: `from` and `to` name nodes, `if` is the words on it, written so they read from one part to the other ("asks for the money"). Two links between the same pair become two arrows side by side, each with its words on its own side. `"hot": true` draws one arrow in clay.
- Put parts that talk next to each other, in a row or a column, so every arrow runs straight. An arrow across a corner works; one that crosses a card doesn't, so move a part instead.
- Cards in a row share a height. Drawn at its real width: across while every column gets 200px, otherwise a list, part by part, each followed by an arrow for each thing it sends, with the words and the part it goes to.
- Cards are laid down in the order of `nodes`, so list them in the order a reader should follow; each arrow draws once both its ends are there. A screen reader gets every arrow as a sentence.
