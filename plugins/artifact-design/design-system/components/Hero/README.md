# Hero

The drawing beside the title: a fat brush drawing with white fills on a clay ground, printed with a fine grain.

- `<div class="sk-hero-art" data-sk-draw="board" data-sk-boil aria-label="…">` inside `.sk-hero`, after the title lockup.
- Layouts, by what the page is for:
  - default: title on the left, drawing on the right. Explainers, reports, decisions.
  - `data-layout="center"`: the drawing centred above a larger title. Launches, invitations.
  - `data-layout="bleed"`: the drawing runs off the right edge of the window. A place, a trip, something big.
  - `data-layout="band"`: the title, then one brush swipe of clay across the whole window, off both edges, with the drawing centred on it. Recipes and anything you make.
  - `data-layout="mark"`: a small drawing above the title. Tools, calculators, status pages, where the page's content should lead.
- Two or three names make a scene on a tile. `data-sk-scene="still"` sets them on one baseline like things on a table; `"orbit"` puts the first in the middle, the second low on the right, the third small at the top left. Left off, the page's seed picks. Everything in a scene stays inside the tile. Choose things that belong together, and no prop that means something else on the page.
- Ground: a soft blob by default; `data-sk-shape="tile"` for a rounded tile (good for an object or a scene); `"none"` for no ground (putty fills, or `data-sk-fill="ground"` to keep the white fills).
- `data-tone="oat"` or `"sage"` sets the hero on a quiet ground instead of clay, and the drawing keeps its one clay part. Clay is the default and the loudest; pick a quiet ground when the page has clay elsewhere near the top, such as a clay card for the pick.
- On clay, the drawing's clay accents turn ink so they don't vanish.
- A single drawing may run past its ground, as a bleed hero does. In the dark, ink would vanish off the clay, so the part outside the ground is drawn again in chalk.
- `data-sk-boil` redraws the hero by hand at 12fps, its ground and every drawing in it: four versions in a random order that never repeats a frame. A band's ground holds still. One boiling hero per page.
