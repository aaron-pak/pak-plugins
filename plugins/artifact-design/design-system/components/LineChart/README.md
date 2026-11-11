# Line chart

A change over time. The first series is the one the chart is about: clay, with a soft area under it and a dot at its end. Others are grey. Names sit at the line ends, so there is no legend.

- `<div data-sk-chart="line" data-sk-data='{"x":[…],"series":[{"name":"October","values":[…]}]}' aria-label="…">`.
- `data-sk-note='{"at":"Oct 10","text":"Pumpkin menu starts"}'` hand-writes a note at that point; it flips side near the right edge.
- `data-sk-format='{"prefix":"$","suffix":"%","decimals":1}'` formats values; big axis numbers shorten (600k, 1.2M). `data-sk-h` sets the height.
- `data-sk-from="800"` starts the scale there instead of at zero, for lines whose story sits in a narrow band; say so in the heading or caption if the gap could mislead.
- Labels along the bottom fall at an even step (every 1, 2, 5 or 10) and always include the last one.
- It draws itself left to right when first seen, and hover shows each value. `Sketchbook.update(el, data)` redraws it with new data.
- Use `data-sk-colors="series"` only when two to four lines matter equally.
