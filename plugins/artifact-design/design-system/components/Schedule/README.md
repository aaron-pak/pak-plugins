# Schedule

One day, hour by hour: for an itinerary, an event programme, a conference day.

- `<ol class="sk-schedule"><li><time>7:00</time><div><h4>…</h4><p>…</p></div><span class="sk-pill">…</span></li></ol>`. The time sits in its own column in mono; the pill is optional.
- `data-kind="travel"` sets a row in smaller muted text behind an arrow, between dashed rules, so getting between places reads as the gap it is. `data-kind="meal"` adds "· meal" after the heading.
- `data-booked` puts a tick in the row's pill; give it a clay pill ("Booked") so you can scan for what you can't move.
- Put each day in its own section with the day as the heading.
