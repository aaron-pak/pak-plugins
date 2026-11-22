# Button

Pill buttons, as Anthropic's pages do them: ink with white text, turning clay on hover.

- `data-sk-ghost` (outline) for the second choice, `data-sk-quiet` (underlined text) for the third, `data-tone="clay"` for the one call to action on a launch page.
- `data-sk-arrow` adds a small arrow that nudges right on hover. `data-size="s|l"`. A `kbd` inside shows the shortcut.
- `aria-disabled="true"` or `disabled` fades it to 40%.
- `.sk-icon-btn` is a round button for one glyph; give it an `aria-label`.
- One primary button per view. Labels are verbs that say what happens.
- `data-sk-copy-text="…"` copies those words when pressed, and `data-sk-copied="…"` is what the toast says after (for a reply someone can paste, or a tracking summary). `data-sk-copy="#id"` copies an element's text.
- Every button does something real on the page: it changes something, copies, downloads or opens. Leave out a button that would only pretend.
