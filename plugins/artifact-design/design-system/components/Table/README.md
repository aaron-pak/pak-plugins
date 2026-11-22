# Table

Rows of facts: mono heads over a strong rule, Literata cells, hairline rows, tabular figures.

- Wrap it in `.sk-table-wrap` so a wide table scrolls inside its own box on a phone.
- `.sk-n` right-aligns numbers (heads too). `data-sk-key` on a row makes it ink and medium. `data-hover` tints the row you point at.
- Deltas, pills and marks sit in cells. `<caption>` holds the source, under the table.
- On a phone, `data-phone="hide"` on a `th` hides that column, so the columns that matter fit without scrolling. Hide the ones a reader can live without.
