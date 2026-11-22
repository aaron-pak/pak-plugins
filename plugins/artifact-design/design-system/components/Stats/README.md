# Stats

A row of key numbers, each under an ink rule (clay for the one that matters).

- `.sk-stats` > `.sk-stat` with a `.sk-label`, a `.sk-stat-v` (unit in `small`), then a `.sk-delta` or a short `p`, and optionally a sparkline.
- `.sk-delta data-dir="up|down|flat"` draws the arrow; it is good-green going up and bad-red going down, unless `data-tone` says otherwise (food thrown out going down is good). Its `span` says what it is compared with.
- `data-sk-key` on one stat; `data-sk-count` counts the number up as it comes into view.
- Three to five stats. Every one needs a comparison or a meaning.
