# Dot chart

Two measures of each thing, to show how they move together and which ones stand apart: rent against size, price against rating, effort against payoff when you have numbers.

- `<div data-sk-chart="dots" data-sk-data='{"x":"Floor area","y":"Rent a month","points":[["Wharf Lane",71,1520],…]}' data-sk-key="Wharf Lane,Hill Court">`. Each point is a name, the across value and the up value.
- The key points are clay, a little larger, and named in the heading face; the rest are `bar` dots. With ten points or fewer every point is named. Names take the first spot beside their dot that keeps clear of the other dots and names.
- The axis names sit at the ends with an arrow, so the chart reads "Rent a month, up; Floor area, across". `data-sk-format` formats the up axis and `data-sk-xformat` the across one. An axis starts at zero when the values are near it, and close to the lowest value otherwise; `"xFrom"`, `"yFrom"` set it.
- `data-sk-note='{"at":"Wharf Lane","text":"…"}'` writes a note pointing at one point. Pointing at a dot shows its name and both values.
- The dots land one after another as the chart scrolls into view.
