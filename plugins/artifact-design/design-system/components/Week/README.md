# Week

A week on an hour grid: days side by side, each event placed by its times, the hours down the left. Below 620px of its own width it becomes a list, day by day.

- `<div class="sk-week" data-from="9" data-to="18" data-now="Wed 11:20">` holds one `<section data-day="Wed" data-date="18">` per day, each holding `<article data-at="10:00-11:00">Title<span>a short second line</span></article>`.
- Times are written `9:00-10:30`, `2pm-3pm` or `14:00-15:00`; the event shows them as "9–10:30 am". `data-clock="24"` shows 24-hour times.
- Tones: none (a plain event), `line` (outlined: a regular or tentative slot), `ink` (blocked time, putty with an ink edge), `clay` (the one that matters, at most one).
- Events that overlap share the column. `data-now` draws a clay line at that time on that day and marks the day as today.
- Events rise in day by day as the week comes into view.
