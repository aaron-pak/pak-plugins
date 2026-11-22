# Dialog, toast and tooltip

- Dialog: `<button data-sk-open="#id">` opens `<dialog class="sk-dialog" id="id">`; it rises in over a soft scrim. `[data-sk-close]` and a click on the scrim close it; a `.sk-x` is the close button; a `footer` holds the buttons, primary last.
- Toast: `Sketchbook.toast('Saved for the driver', { tone: 'good'|'warn'|'bad', ms })` rises at the bottom with a brush tick and leaves after a moment. Say what happened in a few words.
- Tooltip: `data-sk-tip="…"` on anything focusable shows a small ink label on hover or focus. Charts use it for every value.
