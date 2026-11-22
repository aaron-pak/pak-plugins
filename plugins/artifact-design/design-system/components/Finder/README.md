# Finder

A list you can search, filter and sort, for a reading list, a directory, places, products or anything else with more than about eight items.

- `.sk-finder` holds an `input type="search"`, a `.sk-seg data-sk-filter` (buttons with `value` set to a tag; `*` for all), a `.sk-seg data-sk-sort` (buttons with `value` set to a field, `-field` for largest first), a count `<b data-sk-shown>`, the `.sk-finder-list`, and a `.sk-finder-empty` state.
- Each `<li>` carries `data-tags="short novel"` and a `data-<field>` for each sort. Search matches every word you type against the row's text.
- Inside a row: a `div` with `h4` and `p` (and pills, if they help), then `.sk-finder-end` for the number that matters. Put `data-of="<field>"` on the text that shows a sort field: while the list is sorted by it, it turns from muted to ink in every row, and clay in the first row only.
- Rows slide to their new places as the order changes; new ones fade up; the count rolls. Below 560px the filters run the full width.
- The empty state says what to try and carries a `data-sk-reset` button, which clears the words and the filter.
