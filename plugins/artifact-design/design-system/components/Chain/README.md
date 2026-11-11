# Chain

A row of dots, one per day or per item: a streak, a run of picks, attendance.

- `<div class="sk-chain"><i data-on></i><i></i>…</div>`. `data-on` fills ink; an empty dot is a day missed; `data-rest` shrinks a dot to a small grey point for a day that wasn't due, so a habit that isn't daily isn't shown as failing. `data-tone="clay|bad"` fills that colour; `data-today` rings the current one in clay.
- `data-week` opens a small gap after every seventh dot. `<div class="sk-chain-days" data-week>` puts day letters under the dots, one `span` each.
- `data-size="l"` makes rounded squares, for a progress row of choices. Explain the colours beside it.
