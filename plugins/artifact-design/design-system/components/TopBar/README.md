# Top bar

A sticky bar for tools, dashboards and viewers: a brand with a small spot, a few links, and the theme switch. It gains a hairline once the page scrolls.

- Put it before `main`: `<header class="sk-bar" data-width="wide"><div class="sk-bar-in">…</div></header>`. Match `data-width` to the page.
- Mark the current link with `aria-current="page"`. Keep it to three or four links; it scrolls sideways if it must.
- `[data-sk-theme]` on any button switches light and dark (the glyph turns).
- A plain explainer or report doesn't need one.
