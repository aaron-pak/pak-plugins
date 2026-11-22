# Drawing

Every page gets a drawing of the real thing where it helps you find your way: a hero at the top, spots beside features, options, callouts and empty states, flows for a process. A dashboard or tool page keeps its drawings small (the brand mark, a spot in a callout) so the data leads.

## The brush

A line is a centerline turned into a filled shape that tapers: full width in the middle, about a fifth at the start and two fifths at the end, with a little seeded unevenness so no two strokes match. Shapes close with a soft, slightly lumpy outline. bundle.js does this for every drawing (`Sketchbook.ink.brush`), so a page names drawings rather than drawing them.

| Use | Weight token | Fills |
| --- | --- | --- |
| Hero, on the clay blob, tile or swipe | `brush-hero` (7) | `fill-on-clay`, lines in `ink-on-clay`; clay accents turn ink. Fills are painted at full strength from the first frame, so the hero never passes through pink |
| Hero with no ground (`data-sk-shape="none"`) | `brush-hero` (7) | `putty`, or `ground` with `data-sk-fill` |
| Spot, on the paper | `brush-spot` (5) | `putty` |
| Spot inside a white card | `brush-spot` (5) | `putty`, with `card` where the paper shows through |
| Inside a flow card | `brush-flow` (5.5) | `putty`, never clay: the flow's one clay thing is its loop |
| Arrows | `brush-arrow` (4); a note's arrow 2.6 | none |

The brush keeps its weight in real pixels, so a drawing drawn small gets a relatively fatter brush and still reads as the same hand. Two colors per drawing: ink plus one fill. Clay appears as the hero's ground or the one thing that matters, not as a third color inside a spot.

## Heroes and scenes

`data-sk-draw` takes up to three names. One name is a single drawing on a clay blob. Two or three make a scene on a rounded clay tile, and everything in a scene stays inside the tile: ink that leaves the clay would vanish on the dark board.

- `data-sk-scene="still"` sets them on one baseline, like things on a table: the subject large on the left, the others smaller beside it.
- `data-sk-scene="orbit"` puts the subject in the middle, the second low on the right and the third small at the top left.

Leave `data-sk-scene` off and the page's seed picks one, so two pages in a row don't share a composition. Pick things that belong together in the real world (a laptop, a bulb and a tick for a tour; a cake and a glass for a birthday supper), never three ways of saying the same thing, and never a prop that means something else on this page (rain beside the option you recommend).

A hero with `data-layout="band"` runs one brush swipe of clay across the whole window, off both edges, with the drawing centred on it. Every drawing in a hero boils, and so does its ground.

## The set

Name a drawing in `data-sk-draw`. There are 56. Pick the one that is the real thing in the text; when none is, use a spot-free layout rather than a near miss. Older names from the first Sketchbook still work.

| Name | Is | Means | Older name |
| --- | --- | --- | --- |
| `board` | a clipboard of checked rows | a suite, a checklist, a review | `clipboard` |
| `agent` | three linked nodes | an agent, a model, a system | `network` |
| `task` | a page with lines | a task, a prompt, a doc | `doc` |
| `transcript` | a scroll | a run, a log, what happened | `scroll` |
| `grader` | a magnifying lens | a grader, a check, inspection | `lens` |
| `score` | a sprout | a score, growth, a result | `sprout` |
| `cards` | a fanned stack | cases, options, examples | |
| `bulb` | a light bulb | an idea, a finding | |
| `chat` | two speech bubbles | a conversation, feedback | |
| `folder` | a folder | files, a project | |
| `check` | a brush tick | passed, done | |
| `cross` | a brush cross | failed, ruled out | |
| `chart` | a bar chart in a frame | numbers, a report, a dashboard | |
| `calendar` | a calendar page | a date, a schedule, a plan | |
| `clock` | a clock face | time, waiting, a deadline | |
| `pin` | a map pin | a place, a stop, an address | |
| `lock` | a padlock | security, a key, privacy | |
| `code` | a window with a tag | code, a script, a developer page | |
| `gear` | a cog | settings, a setup, how it works | |
| `book` | an open book | reading, a guide, a lesson | |
| `flag` | a flag on a pole | a milestone, a goal, a launch | |
| `mail` | an envelope | a message, an invitation, contact | |
| `laptop` | an open laptop | a device, an app, a tool | |
| `database` | a stacked cylinder | data, a server, storage | |
| `cloud` | a cloud, nothing falling from it | a service, a sync, online | |
| `shield` | a shield with a tick | safety, a review, protection | |
| `scale` | a balance | a comparison, a decision, fairness | |
| `box` | a parcel | a delivery, a package, a release | |
| `target` | a target | a goal, a focus, accuracy | |
| `pencil` | a pencil | writing, editing, a draft | |
| `photo` | a framed picture | photos, images, a gallery | |
| `gauge` | a dial with a needle | a score, a level, a reading | |
| `blossom` | a branch in flower | spring, a season, something growing | |
| `train` | a train front | a journey, a commute, travel by rail | |
| `suitcase` | a suitcase | a trip, packing, luggage | |
| `house` | a house | a home, a mortgage, rent, a place to live | |
| `bowl` | a steaming bowl | soup, noodles, a meal in a bowl | |
| `map` | a folded map with a route | a route, directions, a plan of a trip | |
| `ticket` | a ticket stub | a booking, an event, entry | |
| `cup` | a cup with steam | coffee, a break, a café | |
| `mountain` | two peaks | a hike, a challenge, the outdoors | |
| `gift` | a wrapped present | a birthday, a celebration, a reward | |
| `briefcase` | a briefcase | work, a job, a career | |
| `pan` | a skillet with three eggs | cooking, a one-pan recipe | |
| `phone` | a phone | a call, an app, a mobile device | |
| `plane` | a plane | a flight, travel | |
| `car` | a car | a drive, a commute, a road trip | |
| `moon` | a crescent moon and a star | night, sleep, rest | |
| `heart` | a heart | something loved, health, thanks | |
| `sun` | a sun | daytime, summer, the weather | |
| `leaf` | a leaf | nature, the season, something green | |
| `coin` | a coin | money, a price, savings | |
| `cake` | a cake with candles | a birthday, a party | |
| `glass` | a glass of wine | a toast, a dinner, a party | |
| `bed` | a bed with a sleeper's z | sleep, a hotel, a night's stay | |
| `computer` | a small desktop box | a home server, a Mac mini, a computer that stays on | |

To add a drawing: describe it as a few strokes and one or two filled shapes in `gen/art.js`, keep it to ink plus one fill, render it as a hero and a spot in both themes, and add it here.

## Flows and arrows

- A flow is two to five steps, written as `data-sk-flow='[["drawing","Label","arrow label"], …]'`. Each step is a white card (`card`, 1px `line`, `radius-card`) with a spot drawing and its label in Bricolage 600; a long label wraps to two lines. The third item labels the arrow leaving that step ("given to", "leaves a"), in Literata above the arrow, so the row reads as a sentence. The last step has no arrow label.
- A flow lays itself out at the width it has: across while each step gets 150px or more, stacked top to bottom below that. The text stays at its true size either way.
- `data-sk-loop="caption"` adds one clay arrow from the last step back to the first, under the row (or up the right side when stacked). It is the flow's only clay.
- A `<span class="sk-note" data-sk-note-at="n">` inside the flow is a margin note in Kalam over step n (counting from 1), with an arrow down to it; when stacked, the note is written inside that step's card.
- A standalone arrow is `Sketchbook.arrow(x0, y0, x1, y1, bend)`: a brush curve with a two-stroke open head. Never a filled triangle, never a dotted line.
- A tree (`data-sk-tree`) uses the same cards and arrows for a question that branches: each arrow carries the answer that leads down it, and the arrows to the key answer are clay.
- A map (`data-sk-map`) uses them for the parts of a system: cards on a grid, each arrow carrying what one part sends or asks of the next. Put parts that talk side by side so every arrow runs straight; an arrow that would cross a card means a part is in the wrong place.
- Every line is an arrow between two labeled things. No dangling lines, no lines that mean nothing.

## Art, grounds and hand marks

A hero is not the only place for a drawing on a ground. `.sk-art` puts one anywhere: a 240px tile beside text, or `data-sk-shape="panel"`, a wide flat ground that heads a card or a column.

- Grounds: clay, `oat`, `sage` and `ink`. All are printed with a fine grain, the tooth of a risograph, sized to the ground so it looks the same on a small tile and a wide panel. They don't change in the dark.
- On clay every fill turns paper and the clay parts turn ink. On oat and sage the fills are paper and the one clay part stays clay, so a row of quiet tiles still has small sparks of clay. On ink the drawing is chalk.
- In a row, mix oat and sage, and keep clay for the one that matters.
- Art draws itself on the first time it is seen, like a hero, and then holds still. Only the hero boils.
- A hand mark is the same brush in clay: a line under a phrase or a loop round a number. The loop is one stroke that starts a little wide and closes past its own start without meeting it.

## Charts

Charts stay clean vector, as Anthropic's do: flat bars with no outline and rounded tops, clay for what matters and `putty` for the rest, thin `line` gridlines, labels in Literata at their true size (bundle.js draws each chart at the width it has, so text never scales). The brush comes in only for a note and its arrow pointing at what to see (`data-sk-note`), and for the marks in tables.

## In the dark

The brush lines in spots and flow arrows take the `sk-chalk` filter, a fine grain that eats into the stroke so it reads as chalk. A hero's lines stay solid, since they sit on clay, which stays clay in the dark; its ivory fills dim to `#e6e0d3` so they don't glare. Where a hero's drawing runs past its ground, the part outside is drawn again in chalk, so it doesn't vanish into the dark page. The clay quote mark stays solid paint. Cards and text stay clean.
