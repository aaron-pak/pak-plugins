# Segmented control and tabs

- `.sk-seg`: two to four options for the same view (a period, a unit). A white thumb slides to the chosen one. Mark it with `aria-checked="true"`; it fires `sk:change` with `detail.value` (the button's `value` or its text).
- `.sk-tabs`: separate views of one thing. Buttons with `aria-controls` pointing at `.sk-panel`s; a clay bar slides under the chosen tab, the panel fades in, arrow keys move between tabs.
- Use the segmented control to change data in place, tabs to change what you are looking at.
