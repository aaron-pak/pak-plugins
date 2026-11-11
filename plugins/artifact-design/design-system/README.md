Sketchbook is Anthropic's public look, made a little more alive. It keeps their ivory paper, near-black ink, clay accent and fat tapering brush, and adds what a working page needs: drawings that draw themselves stroke by stroke, a brush tick in a checkbox, a chart that grows as you scroll to it, a hero that boils like a hand-redrawn frame. It should feel calm, warm and exact, like a good studio made it for this one page. Never cute in the words, never like a template. Cute lives in the drawings.

## Start from a page

Pick the page kind closest to the request and start from its example in the **Pages** group. Each one is a complete page, and each shows a different set of parts.

| The request | Start from | Its parts |
| --- | --- | --- |
| Teach or explain an idea | Explainer | hero with a hand underline, a flow on an oat band, a ringed big number with an aimed note, three drawings on oat and sage panels, quote, a sage band to close with a sticky |
| Choose between options | Decision | scene hero on sage, option cards headed by drawings with the pick on clay, comparison matrix, the reason on a sage band, rail section |
| Report progress on a project | Status | mark hero, status pill, meter with a goal, stats, row timeline, callouts, task list, the ask on an oat band |
| Show numbers over time | Dashboard | top bar, segmented control, stats with sparklines, line, bar and ranked charts, table with deltas |
| Work something out | Calculator | mark hero, fields, slider, toggle, sticky result panel, stacked bar, live chart, phone dock |
| Track a habit or a list | Tracker | aligned ledger, streak dots grouped by week, day letters, day stepper |
| Ask someone to pick | Picker | side-by-side choices with scrolling mini pages, progress, keyboard keys |
| Read a log, chat or agent run | Transcript | chat, tool calls, verdict panel with marks, summary first on phones |
| Walk through code | Code walkthrough | table of contents, code with pins in the gutter, diff, results table |
| Check understanding | Quiz | the quiz part: answers, check, marks on the rows, feedback, Next |
| Follow something moving | Journey | scene hero, live tag, route timeline, newest-first scan history, dialog, toast |
| Introduce a product or tool | Tour | centred hero with a scene, a player that shows the product changing step by step, numbered steps with commands, FAQ, a plain closing section |
| Plan a trip or a day | Itinerary | bleed hero, day cards headed by drawings on sage and oat, timeline, one rail section per day with a schedule, budget, bookings |
| Cook something | Recipe | band hero, stats, ingredients that scale with servings, method steps, callout |
| Invite people | Invitation | centred hero, the three facts, a reply form, sticky |
| Study for a test | Study notes | tile hero, the idea in one sentence on a sage band, flow, worked example with a histogram, two by two, flip cards, quiz |
| Write up findings to read | Report | contents that follow your reading, stats, a dot chart with named points, comparison matrix, quote and sticky side by side, next steps, notes |
| Present to a room | Deck | slides at 16 by 9, Present mode with arrow keys, clay and ink slides, chart and two by two on slides |
| Fix something, or say what to do when | Runbook | mark hero, a decision tree with the usual way in clay, steps with commands, a rail of things never to do |
| Plan a week | Planner | mark hero with a live pill, a week on an hour grid with a now line, a checklist and a sticky |
| Browse a long list | Directory | mark hero, search, filters, sort, rows that slide into their new order, an empty state |
| Show how a process unfolds | Explore | a figure you play or step through, names crossed off step by step, a running tally, a ranked chart, a hand-written note |
| Take an application or a booking | Apply | mark hero, a form in steps, choices as cards, a row of days, a review with Change buttons, a done state, a row timeline |
| Explain how a system fits together | Architecture | mark hero, a map of the parts joined by labelled arrows on an oat band (a list on phones), a table of what happens when each part stops, steps with times, callouts |
| Launch a command-line tool | Launch | tile hero with an install command and Copy, a terminal that types itself, cards headed by drawings, a rules table, FAQ, a sage band to close |

Mix freely: a status report can carry a chart, a tour can carry a quiz. Keep the page's one job clear in its title.

Give the page a pace. A working page (a tool, a dashboard, a tracker) stays quiet so its content leads. A page that is read top to bottom (an explainer, a decision, a launch, a trip) should change temperature on the way down: drawings on grounds in the middle, one oat or sage band for the main diagram or the main sentence, and one for the thing it asks for at the end.

## Content fundamentals

- Write the way a knowledgeable person talks: short, plain sentences, active voice, "you" for the reader. No emoji, no exclamation marks, no hype, no jokes in the copy.
- Headings state the point, not the topic: "Sales are up 12%, and mornings did most of it", not "Sales overview". Every section heading does this, including above a chart: the heading says what the chart shows.
- Sentence case everywhere. The mono `label` above a heading, table heads and axis names are the only uppercase text ("DAILY SALES").
- Use real content, real units and real names from the subject. Buttons say what they do ("Approve the day", "Check answer"), never "Submit" or "Click here".
- A margin note is a few words pointing at one real thing. A sticky note holds a real caveat. A quote is someone's real words with its source. If one of these has nothing real to point at, leave it out.
- Numbers: thousands get commas, units sit beside the number in `small` (keep them to a word or two; they never wrap), a change says what it is compared with ("12% vs Sept 1–15"). Estimates say so.
- Maths: write real characters (×, ÷, −, √, α, β, ≤) in the text face, not code. Put a formula on its own line in `.sk-formula`; draw a bar over a letter with `<span class="sk-over">x</span>`.

## Visual foundations

**Colour.** The page is `paper` (ivory). Headings and drawn lines are `ink`. Running text is `text`, secondary text `muted`. A raised surface is `card` (warm white, never pure white) or `panel`. Hairlines are `line` and are never text.
- Clay is the one strong colour. `clay` fills: the hero's ground, the one bar that matters, the quote mark, the current step, a recommended column. `accent` is clay dark enough for text and lines on paper: a note, a link, a focus ring. Clay text under 24px always takes `accent`.
- Grounds are what drawings sit on: `clay`, `oat` (putty's colour, as a ground) and `sage`, a soft grey-green from Anthropic's own tiles. Oat and sage are only ever grounds for a drawing, never text, a button, a chart or a tag. A fourth ground, ink, carries a chalk drawing. Every ground is printed with a fine grain and looks the same by day and by night.
- `putty` is the quiet second fill: inside drawings, a track behind a meter. `bar` is the fill for bars that aren't the point.
- `good`, `warn` and `bad` (with their `-soft` grounds) mean state only, and always come with a word, a tick or a cross. `warn` is a warm brown on putty, never yellow, so it can't read as highlighter or clash with the sticky note.
- Charts: one series is clay and everything else is `bar` or grey. Parts of a whole take one family: clay, then four warm greys from dark to light. The sky, olive and fig series colours (`s2`–`s4`) are only for a line chart with two to four named series that are equally important.
- Never add a second strong colour beside clay: no blue links, no colour per card, no rainbow tags. Sage and oat are quiet on purpose; they sit under drawings and never compete with clay.

**Type.** Three families and a hand.
- Bricolage Grotesque 600 (`font-display`) for every heading and for UI text: `.sk-title`, `.sk-h2`, `.sk-h3`, `h3`/`h4`, buttons, labels on controls, `dt` terms, big numbers (at 560). Headings are set a little tight (−0.02em) and balance their lines; numbers are lining.
- Literata (`font-text`) for everything you read: `.sk-lede`, body, `.sk-small`, captions, table cells, quotes, formulas.
- JetBrains Mono (`font-mono`) for the `.sk-label` above a heading, `time` stamps, table heads and code.
- Kalam (`font-hand`) only for a margin `.sk-note`, in `accent`. Never a heading, never a sentence.
- Running text stays near `measure` (66ch). Numbers in tables, stats and meters are tabular.

**The brush.** Lines in drawings and arrows are fat, tapering brush strokes stored as filled shapes: thick in the middle, thin at the ends, a little uneven. The brush keeps its weight in real pixels, so a small spot gets a relatively fatter stroke and never turns into a thin pen line. Never hatching or shading. bundle.js draws every drawing, arrow, tick and step ring this way; you name the drawing, you don't draw it.

**Drawings.** One drawing per idea, from the 56 in the Drawing section. A hero sits on a clay ground (a blob, a rounded tile for a scene, or a brush swipe for a band), seeded from the page title so every page's ground is its own; on that ground the fills turn paper and every line stays ink. Spots sit on the paper with putty fills. Below the hero, use Art (`.sk-art`) wherever the drawing should carry the section: a tile beside text, or a panel heading each card in a row of options, days or features. On oat and sage a drawing keeps its one clay part; on ink it is chalk. A drawing is a thing, never a mascot or a hand acting as a character.

**Hand marks.** One clay brush line under a phrase (`data-sk-under`) or round a number (`data-sk-ring`), the way you'd mark a printout. For the claim in the title, the number that matters, the phrase to leave with. One in a view, two or three on a page.

**Heroes.** Vary them; a run of pages that all open with title-left, blob-right reads as a template.
- Split (the default): title on the left, drawing on its ground on the right.
- `data-layout="bleed"`: the drawing grows and runs off the right edge of the screen. For a page with one strong picture (a trip, a season).
- `data-layout="band"`: one brush swipe of clay across the whole window under the title, running off both edges, with the drawing centred on it. For a recipe, a launch, an event.
- `data-layout="mark"`: a small drawing above the title. For tools, reports and anything that should get to the content fast.
- `data-layout="center"`: centred, drawing above. For an invitation or a product.
- A scene: name two or three drawings, `data-sk-draw="photo house cloud"`, on a tile. `data-sk-scene="still"` sets them on one baseline like things on a table; `"orbit"` puts the subject in the middle with the others at the lower right and upper left. Left off, the page's seed picks. Everything stays inside the tile, and every prop belongs with the subject in the real world.

**Sections.** A page is a run of sections, each a direct child of `main`, `space-56` apart, each opening on a hairline. Vary their shape:
- the default: heading, then content;
- `data-mode="band"`: a full-width panel (`data-tone="clay"` for clay-soft) to change the pace, at most twice a page;
- `data-mode="band" data-tone="oat"` or `"sage"`: a full-width strip of a quiet ground with a fine grain. For the page's main diagram, its idea in one sentence, or the ask at the end, where it runs to the bottom edge. Any part works inside it, and a `.sk-statement` keeps its clay `<em>`. Two at most on a page, one of each colour, never back to back. A sticky note needs sage: it is too close to oat to show;
- `data-mode="statement"`: one big sentence in `.sk-statement`, with `<em>` for the clay words;
- `data-mode="rail"`: the heading stays in a left column while a long list, schedule or set of callouts scrolls beside it.
Every section gets one visual: a drawing, chart, flow, big number, timeline, schedule or note. Pages fail when the second screen turns into prose and identical cards.

**Surfaces.** Lay things on the paper. `.sk-card` is `card` with a 1px `line` border, only for a separate object you could pick up: an option, a result, a day. Panels (`.sk-callout`, the code head, the user's chat turn) are `panel` or a `-soft` tone with no border; a warning callout, and every toned callout in dark mode, has a coloured edge: a straight bar down the left side, with the two corners it touches square. An edge never bends round a rounded corner, here or on anything you build. One shadow, `shadow-raise`, for things that float: a dialog, a toast, a tooltip, a picked thumb. No gradients, glass or glow.

**Layout.** Plenty of paper. `.sk-page` is `page-max` (1040px); `data-width="wide"` (1240px) for dashboards, viewers and tools; `data-width="narrow"` (760px) for a single column like a quiz, a tracker or an invitation. Below 760px everything stacks to one column, a hero's drawing moves above the title at 132px, stats go two across, tables keep a readable width and scroll inside their own box with a fade at the edge, and flows stack. A flow or a chart picks its layout from its own width, not the screen's.

**States and focus.** Selected and pressed are `ink` with `on-ink` text, or a card thumb on a putty track. A card that is a link (`a.sk-card`, `button.sk-card`, `data-sk-link`) lifts 2px and darkens its border on hover; a choice lifts 3px; a button darkens a little and its arrow nudges right. Focus is a 2px `accent` ring with a 2px gap. Disabled is `aria-disabled="true"`: an outline in `muted`, no hover. `hidden` always hides, whatever the part.

**Dark theme.** Night: warm charcoal paper, cream ink, clay stays clay. A drawing's ground is printed colour and doesn't change. An oat or sage band does: at night it is a deep tint of the same colour with cream type, so nothing on a night page is a bright block with day controls inside it, and nothing on a day page is a night block. One theme a page: never set `data-theme` on anything inside the page. Brush lines get a fine chalk grain, sized to the drawing so it reads as chalk at any size; a hero on its clay ground stays clean. Notes and quote marks stay clean. Use only tokens and classes so everything turns together; never hard-code a colour.

**Motion.** Quiet, once, in reading order. As each part scrolls into view it rises 8px and fades in over 520ms, the parts of a section 60ms apart. A hero's ground is painted on first, then its drawing draws itself stroke by stroke, then the fills grow in under the lines. Everything hand-drawn is drawn by the pen, along its own line from where a hand would start to where it would lift: a ring goes round its number, a tick goes down then up, an arrow runs from tail to tip and then gets its head. Nothing hand-drawn is wiped on or popped in. One hand does one thing at a time: flow, tree and map cards lay down one by one with each arrow drawn towards its card (a map's arrow once both its ends are there), the loop last; a note is written word by word after its part, then its arrow is drawn towards the thing; a hand mark is drawn a beat after its words arrive, and a note that points at it waits for it. Big headline numbers of 100 or more count up; stats show their true value at once. Charts grow, meters fill, timelines draw to "now". Then only the hero moves, boiling at 12fps while it's on screen, four hand-drawn frames in a random order. Pointing at a link, button or choice redraws its spot for two frames. Controls slide. See the Motion section. `prefers-reduced-motion` turns all of it off and shows the end state.

**Print.** Oat and sage bands go back to paper, and a hand mark becomes a plain clay underline. Every page prints as a document: white paper, no top bar, contents, buttons or toasts (a link that leaves the page prints its address); everything shown in its end state; closed answers printed open; charts, flows, trees and maps redrawn at the printed width; a player shows its last step with every step's words listed; a form in steps prints every step, one under the other, to fill in by hand; a deck prints as its slides alone, one per landscape page; cards, charts, figures, steps and tables of eight rows or fewer never split across a page. Mark words that only make sense on a screen with `data-screen-only`.

## Iconography

No icon font and no emoji. The drawings are the icons, a fixed set in one hand (see Drawing). Small marks in tables and lists are brush marks too: `data-sk-mark="yes|no|part|dot"`. A button that moves you on gets a small brush arrow (`data-sk-arrow`). Need a new drawing? Add it to the set in the same hand rather than reaching for a stock icon.

## Do and don't

- Do: one clay thing per view, drawings on grounds below the hero and not only at the top, one or two oat or sage bands on a page that is read top to bottom, a visual in every section, headings that say the point, real numbers with their comparison, a note with an arrow at the thing that matters, a different hero and section shape where the content allows.
- Do: show a process as a flow or steps, a change over time as a line, a ranking as horizontal bars, a part of a whole as a stacked bar, a single number as a big number with its source, a day as a schedule, a trade-off as a two by two.
- Don't: gradients, glossy shadows, glass, neon, cold greys, pure white or black grounds (a dark slide is the one exception), a second strong colour, a colour per card.
- Don't: a page that is the same quiet ivory from the second screen to the last, a band on every section, a hand mark on every heading, sage or oat as anything but a ground.
- Don't: stock icons, emoji, mascots, hands as characters, rows of identical cards, pills on everything, a legend where a direct label would do.
- Don't: handwriting for headings or sentences, stamps, highlighter, graph paper, cut-paper collage, more than one boiling hero, anything that loops except the hero and a live dot.

## Using it on a page

Load three things, then write markup. bundle.js finds the markup and draws, wires and animates it.

1. `tokens.css` (built from this system's tokens). A page that should follow the viewer's theme leaves `data-theme` off `<html>`: the runtime writes the viewer's theme there before the page paints and keeps it in step, so every theme rule applies the same way however the theme was chosen. Set `data-theme` yourself only to pin a page to one theme.
2. `components/bundle.css`. It imports the four Google Fonts.
3. `components/bundle.js`, at the end of `body` or with `defer`.

Wrap the page in `<main class="sk-page sk-enter">`. Its direct children reveal one by one as they scroll into view, so keep each section a direct child.

### Page frame

| Markup | What you get |
| --- | --- |
| `<main class="sk-page sk-enter" data-width="wide">` | the page column; `wide`, default or `narrow` |
| `<header class="sk-bar" data-width="wide"><div class="sk-bar-in"><a class="sk-brand"><span class="sk-spot" data-sk-draw="chart"></span>Name</a><nav class="sk-nav"><a aria-current="page">…</a></nav><button class="sk-icon-btn" data-sk-theme aria-label="Switch light and dark"><span class="sk-theme-glyph"></span></button></div></header>` | a sticky top bar, before `main`; gains a hairline once you scroll |
| `<div class="sk-hero" data-layout="bleed"><div>label, title, lede, buttons</div><div class="sk-hero-art" data-sk-draw="blossom" data-sk-boil aria-label="A branch of blossom"></div></div>` | the hero; layouts `bleed`, `band`, `mark`, `center` or none for split; on the art, `data-sk-shape="tile"` for a square ground or `"none"` for none, and several names for a scene |
| `<section class="sk-section" data-mode="rail"><header><div class="sk-label">…</div><h2 class="sk-h2">…</h2><p>…</p></header>…</section>` | a section on a hairline; modes `band` (with `data-tone="oat"` or `"sage"` for a band on a quiet ground), `statement`, `rail`; `data-plain` drops the line; `data-sk-whole` reveals it in one piece |
| `.sk-stack` (`--gap`), `.sk-row` (`--gap`, `data-between`), `.sk-grid` (`--min`, `--gap`, `data-sk-align`) | vertical stack, wrapping row, auto-fit grid; `data-sk-align` lines up the rows inside its cards (titles, prices, lists) across the grid |
| `.sk-two` (`data-even`, `data-top`) | two columns, stacking on phones |
| `<div class="sk-split" data-phone="side-first"><div>main</div><aside class="sk-side">…</aside></div>` | content with a sticky side panel (`--side`, `data-side="left"`); `data-phone="side-first"` puts the panel first once it stacks |
| `<div class="sk-doc"><nav class="sk-toc"><div class="sk-label">On this page</div><div><a href="#a">…</a></div></nav><div>sections with ids</div></div>` | a document with a table of contents whose clay marker follows your reading; use the wide page; the contents hide below 960px |
| `<div class="sk-dock" data-sk-for="#monthly"><span class="sk-caption">Each month</span><b id="dock">$3,828</b></div>` | phones only: the answer pinned to the bottom of the screen, stepping aside while the number it repeats (`#monthly`) is in the upper part of the screen |
| `<footer class="sk-foot">` | sources and notes at the end; cite with `<sup class="sk-ref"><a href="#s1">1</a></sup>` |
| `<span data-screen-only>Point at a dot for the flat.</span>` | words that only make sense on a screen; they don't print |

### Text

`.sk-label` (mono label above a heading), `.sk-title` (`data-size="xl"` for a launch page), `.sk-lede`, `.sk-h2`, `.sk-h3`, `.sk-statement`, `.sk-prose` (rhythm for long text, clay bullets), `.sk-small`, `.sk-caption`, `ul.sk-list`, `dl.sk-dl` (terms in the heading face, ink values; two columns even on phones, `data-stack` to stack), `.sk-formula`, `.sk-over`, `.sk-measure`, `kbd`, `code`.

### Drawings, notes and props

| Markup | What you get |
| --- | --- |
| `<div class="sk-art" data-tone="sage" data-sk-draw="mountain" aria-label="A mountain"></div>` | a drawing on its ground, 240px (`data-size="s"` 132px, `"l"` 340px); `data-tone` is `oat`, `sage` or `ink`, clay when left off; `data-sk-shape="blob"` for the hero's blob |
| `<article class="sk-card"><div class="sk-art" data-sk-shape="panel" data-tone="oat" data-sk-draw="blossom" aria-hidden="true"></div><h3>…</h3><p class="sk-small">…</p></article>` | a panel: a wide flat ground that heads a card edge to edge, or fills a column above a heading. In a row, mix oat and sage and keep clay for the pick |
| `<span data-sk-under>the phrase</span>` · `<span data-sk-ring>20–50</span>` | a hand mark: a clay brush line under a phrase, which follows it when it wraps, or a loop round a number or short word |
| `<span class="sk-spot" data-sk-draw="calendar"></span>` | a spot drawing (`data-size="s|l"`); it redraws a couple of frames when you point at the link or button it sits in |
| `<div class="sk-flow" data-sk-flow='[["task","Task","given to"],["agent","Agent","leaves a"],["transcript","Transcript"]]' data-sk-loop="What you learn changes the task"><span class="sk-note" data-sk-note-at="3">The part people skip</span></div>` | a flow: cards with a drawing and a name, joined by brush arrows; the third item is the label on the arrow that leaves that step. It is drawn at its real width and stacks when a step would get less than 150px or an arrow's label would not fit between two steps; stacked, its cards fill the column and every label wraps inside its own room. A note with `data-sk-note-at` sits over that step, and is written inside the card once the flow stacks |
| `<div class="sk-tree" aria-label="…" data-sk-tree='{"q":"Is it urgent?","kids":[{"if":"Yes","a":"Do it now","key":true},{"if":"No","a":"Friday’s list","sub":"Once a week"}]}'></div>` | a decision tree: question cards, answer panels, every branch a labelled brush arrow; `"key": true` marks the answer that matters and turns the way to it clay. Across while each answer gets 150px, otherwise an outline stepping in |
| `<div class="sk-map" aria-label="…" data-sk-map='{"nodes":[{"id":"site","a":"Order site","sub":"On your phone","draw":"phone","at":[0,0]},…],"links":[{"from":"site","to":"pay","if":"asks for the money"},…]}'></div>` | a map: the parts of a system as cards on a grid (`at` is column and row), each link a brush arrow with its words beside it; two links between a pair run side by side. `"key": true` turns the part that matters clay-soft. Keep talking parts next to each other so every arrow runs straight. Across while each column gets 200px, otherwise a list: each part, then an arrow for each thing it sends, naming where it goes |
| `<span class="sk-note" data-sk-point="right">The part people skip</span>` | a margin note beside what it means; `data-sk-point` is `left` (the default: arrow on the left pointing down-left), `right`, `up-left` or `up-right`. Keep it out of a heading's line |
| `<span class="sk-note" data-sk-target="#start-n">Not hundreds. Start here.</span>` | a note that draws a brush arrow to the element `#start-n`, wherever the layout puts it |
| `<aside class="sk-sticky"><p>…</p></aside>` | a sticky note, one per page |
| `<figure class="sk-quote"><blockquote>…</blockquote><figcaption>Name, source</figcaption></figure>` | the clay quote mark and source |
| `<aside class="sk-callout" data-tone="clay|warn|good|bad"><span class="sk-spot" data-sk-draw="bulb"></span><div class="sk-label">…</div><h4>…</h4><p>…</p></aside>` | a callout; the spot and label are optional; on phones the spot sits above the text |

### Numbers and data

| Markup | What you get |
| --- | --- |
| `<div class="sk-num" data-sk-count>2,914<small>orders</small></div>` | a big number (`data-size="m|s"`); with `data-sk-count`, a number of 100 or more counts up once, keeping its width |
| `<div class="sk-stats"><div class="sk-stat" data-sk-key><div class="sk-label">Revenue</div><div class="sk-stat-v">$18,240</div><span class="sk-delta" data-dir="up">12% <span>vs Sept</span></span><div data-sk-chart="spark" data-sk-data="[…]"></div></div></div>` | a row of stats, two across on phones; `data-sk-key` gives one a clay rule; delta `data-dir="up|down|flat"`, `data-tone="good|bad"` when down is good; a plain `<p>` under the value for a caption |
| `<div class="sk-meter-head"><span>Endpoints moved</span><b>18 of 30</b></div><div class="sk-meter" style="--v:.6;--goal:.8" data-sk-goal="Plan for today" role="meter" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" aria-label="…"></div>` | a meter that fills on view; `--goal` draws an ink tick and `data-sk-goal` names it; `data-size="thin|thick"`, `data-tone` |
| `<div data-sk-chart="line" data-sk-data='{"x":[…],"series":[{"name":"October","values":[…]},{"name":"September","values":[…]}]}' data-sk-note='{"at":"Oct 10","text":"Pumpkin menu starts"}' aria-label="…"></div>` | a line chart: first series clay with a soft area, others grey, names at the line ends; the x values are evenly spaced labels, not a number scale; pointing anywhere shows a rule and every series' value |
| `data-sk-chart="bars"` with `data-sk-data='[["7 am",1820],…]' data-sk-key="8 am"` | columns; the key ones clay, with their value where it fits; the rest `bar` |
| `data-sk-chart="hbars"` with `[["Espresso",7820],…]` | a ranking, longest first, values at the bar ends; names go above the bars when narrow |
| `data-sk-chart="stack"` with `[["Loan",2927],["Tax",517],…]` | parts of a whole: one rounded bar and its legend; a part of zero is left out; `data-sk-legend="rows"` (automatic when narrow) lists the parts with values at the right |
| `data-sk-chart="spark"` with `[…numbers]` | a sparkline for a stat |
| `data-sk-chart="dots"` with `{"x":"Floor area","y":"Rent a month","points":[["Wharf Lane",71,1520],…]}` | two measures of each thing; the `data-sk-key` points are clay and named, and every point is named when there are ten or fewer; names keep clear of the dots; `data-sk-xformat` formats the across axis as `data-sk-format` does the up one; `"xFrom"` and `"yFrom"` set where an axis starts |
| Chart options | `data-sk-key` takes one name, a comma list (`"36,37,38"`) or a JSON list, and `"none"` keeps every bar putty (for a chart beside one that already has the clay); `data-sk-note` works on line, bar and dot charts and stays inside the chart; `data-sk-format='{"prefix":"$","suffix":"%","decimals":1}'`, `data-sk-h="300"`, `data-sk-axis="none"`, `data-sk-colors="series"`, and on columns `data-sk-ticks="38,50,62"` to name the only labels shown under the bars (always include the one the chart is about). Hover shows each value. `Sketchbook.update(el, data)` redraws it |
| `<div class="sk-table-wrap"><table class="sk-table" data-hover>…<td class="sk-n">…</td><tr data-sk-key>…</table></div>` | a table: `sk-n` right-aligns numbers, `data-sk-key` marks a row, `<caption>` is its source |
| `<table class="sk-table sk-matrix"><colgroup><col><col class="sk-key">…</colgroup>… <td data-sk-mark="yes|no|part"><small>30 days</small></td>` | a comparison matrix: brush marks, a tinted recommended column, option names as headings; `data-align="start"` on a cell for text. Below 560px it turns into one card per option, the recommended one edged in clay |
| `<div class="sk-chain" data-week><i data-on></i><i data-rest></i>…<i data-on data-today></i></div>` and `<div class="sk-chain-days" data-week><span>S</span>…<span data-today>F</span></div>` | streak dots, a gap after every seven with `data-week`; `data-rest` for a day it wasn't due; `data-tone="clay|bad"`, `data-size="l"`; the letters row lines up above |
| `<ol class="sk-timeline" data-dir="row"><li data-state="done|now|next|bad"><time>…</time><h4>…</h4><p>…</p></li></ol>` | a timeline, vertical or in a row; its line draws to "now"; `data-order="desc"` for newest first; `data-live` makes "now" pulse |
| `<ol class="sk-schedule"><li><time>7:00</time><div><h4>Fushimi Inari</h4><p>…</p></div><span class="sk-pill">Free</span></li><li data-kind="travel"><time>6:40</time><div><h4>JR Nara line, 5 minutes</h4></div></li></ol>` | a day as times and stops; `data-kind="travel"` for a quieter getting-there row, `"meal"`, `data-booked` ticks its pill |
| `<div class="sk-week" data-from="9" data-to="18" data-now="Wed 11:20"><section data-day="Wed" data-date="12"><article data-at="10:00-11:00" data-tone="clay">Go or no-go<span>Everyone</span></article></section>…</div>` | a week on an hour grid, events placed by time, overlaps side by side; tones `line` (regular or tentative), `ink` (blocked), `clay` (the one that matters); a list day by day below 620px |
| `<div class="sk-finder"><div class="sk-finder-bar"><input class="sk-input" type="search"><div class="sk-seg" data-sk-filter><button value="*">All</button>…</div></div><p class="sk-finder-count"><b data-sk-shown>16</b> of 16</p><div class="sk-seg" data-sk-sort><button value="walk">Closest</button><button value="-rating">Best</button></div><ul class="sk-finder-list"><li data-tags="veg quick" data-walk="4">…<b data-of="walk">4 min</b></li></ul><div class="sk-finder-empty" hidden>…</div></div>` | a list you can search, filter by tag and sort by any `data-` field; rows slide to their new places, the count rolls, and the value you sort by turns ink, clay in the first row |
| `<ol class="sk-steps" data-row><li><h4>…</h4><p>…</p></li></ol>` | numbered steps in brush rings; `data-row` lays them across |
| `<div class="sk-quad"><p class="sk-quad-y"><span>Small payoff</span><span>Big payoff</span></p><div class="sk-quad-cell"><h4>Plan for later</h4><ul><li>…</li></ul></div>…four cells…<p class="sk-quad-x"><span>Hard to do</span><span>Easy to do</span></p></div>` | a two by two: cells go top left, top right (tinted, the one to aim for), bottom left, bottom right; the y labels run bottom to top. On phones the chips become a short dotted list |
| `<div class="sk-quad" data-kind="table"><p class="sk-quad-corner">What's true ↓<br>What you decide →</p><p class="sk-quad-x"><span>…</span><span>…</span></p><p class="sk-quad-y"><span>…</span><span>…</span></p><div class="sk-quad-cell" data-key>…</div>…</div>` | a two by two whose rows and columns each mean something (truth against decision, risk against reward): headings sit centred over the columns and beside the rows; `data-key` tints a cell |

### Cards and choices

| Markup | What you get |
| --- | --- |
| `<article class="sk-card" data-sk-rec="Our pick"><span class="sk-spot" data-sk-draw="cloud"></span><h3>…</h3><div class="sk-price">$9.99<small>a month</small></div><p>…</p><ul class="sk-pros">…</ul><ul class="sk-cons">…</ul></article>` | an option card; `data-sk-rec` puts a clay badge on its border |
| `<button class="sk-choice" aria-pressed="false"><div class="sk-frame" data-sk-chrome="Page title"><div class="sk-mini" data-sk-scroll data-sk-w="900">…a real page…</div></div><div class="sk-choice-foot"><kbd>A</kbd> Left page</div></button>` | a pickable choice; `.sk-mini` lays real markup out at `data-sk-w` (1120 by default, 400 on phones) and shrinks it to fit; `data-sk-scroll` lets it scroll |
| `<button class="sk-flip"><div><div class="sk-label">Term</div><h4>p-value</h4></div><div><div class="sk-label">Answer</div><p>…</p></div></button>` inside `.sk-flips` | a card that turns over on click or Enter |
| `<div class="sk-frame" data-sk-chrome="title">img or svg</div>` | a window frame for a screenshot or mock |
| `<div class="sk-compare" data-label-a="Before" data-label-b="After"><img …><img …></div>` | a before/after slider |
| `<figure class="sk-figure">… <figcaption>…</figcaption></figure>` | a figure with a caption |
| `<div class="sk-empty"><span class="sk-spot" data-sk-draw="mail"></span><h3>…</h3><p>…</p><button class="sk-btn">…</button></div>` | an empty or closing state |

### Slides

| Markup | What you get |
| --- | --- |
| `<div class="sk-deck"><div class="sk-deck-bar"><span class="sk-caption">Slide <b data-sk-deck-n></b></span><button class="sk-btn" data-sk-ghost data-sk-present>Present</button></div><section class="sk-slide">…</section>…</div>` | slides laid out at 1280 by 720 and scaled to fit; arrow keys step through while you point at the deck. Present fills the screen (or the window, where full screen isn't allowed), crossfades between slides, and a tap on the right two thirds goes on, the left third back; Esc closes. Charts redraw at the slide's own 1280px. On phones each slide reflows at reading size |
| `<section class="sk-slide" data-tone="clay|ink">` | a clay title slide or an ink closing slide; inside, `.sk-title`, `.sk-h2`, `.sk-num`, charts, a two by two and `.sk-slide-split` (two columns; set `--cols` to change their widths) all take slide sizes |

### Controls

| Markup | What you get |
| --- | --- |
| `<button class="sk-btn" data-sk-arrow>Install it</button>` | an ink button; also `a.sk-btn`; `data-sk-ghost` (outline), `data-sk-quiet` (underlined text), `data-tone="clay"`, `data-size="s|l"`, `data-sk-arrow` for a brush arrow |
| `<button class="sk-icon-btn" aria-label="…">‹</button>` | a round icon button |
| `<span class="sk-pill" data-tone="warn" data-dot>At risk</span>` | a status pill; tones `good warn bad clay ink line muted`; `data-live` pulses its dot; in a task list it dims once the task is done |
| `<div class="sk-seg" aria-label="Period"><button value="2w" aria-checked="true">Two weeks</button><button value="q">Quarter</button></div>` | a segmented control with a sliding thumb; fires `sk:change`, which bubbles, with `detail.value` (the button's `value`, else `data-value`, else its text); scrolls sideways if it can't fit |
| `<div class="sk-tabs"><button aria-controls="p1" aria-selected="true">…</button>…</div><div class="sk-panel" id="p1">…</div>` | tabs with a sliding clay bar; arrow keys move |
| `<div class="sk-field"><label for="x">Home price</label><div class="sk-affix"><span>$</span><input class="sk-input" id="x"></div><div class="sk-help">…</div></div>` | a labelled field; also `<div class="sk-select"><select>…</select></div>` and `textarea.sk-input` |
| `<label for="d">Down payment <output for="d">10%</output></label><input class="sk-range" type="range" id="d" data-sk-format='{"suffix":"%"}'><div class="sk-range-ends"><span>3%</span><span>40%</span></div>` | a slider whose fill and output follow it |
| `<label class="sk-check"><input type="checkbox"><span>Walk for 20 minutes<small>Before 9 am</small></span></label>` | a checkbox with a brush tick; `.sk-radio` with `type="radio"` |
| `<ul class="sk-tasks"><li><label class="sk-check">…</label><span class="sk-pill" data-tone="line">Dana</span></li></ul>` | a task list; a done item is struck through by a line that draws across |
| `<label class="sk-switch"><input type="checkbox" class="sk-toggle" role="switch"> Pay extra</label>` | a toggle |
| `<details class="sk-details"><summary>Question</summary><div><p>…</p></div></details>` | a disclosure that opens smoothly |
| `<button data-sk-open="#d">…</button><dialog class="sk-dialog" id="d"><button class="sk-x" data-sk-close aria-label="Close"></button><h3>…</h3>…<footer>buttons with data-sk-close</footer></dialog>` | a dialog; the scrim closes it |
| `Sketchbook.toast('Saved for the driver', { tone: 'good' })` | a toast at the bottom |
| `<span data-sk-tip="Exact value">…</span>` | a tooltip on hover or focus; a line break in the text makes its first line a heading |
| `<button data-sk-copy="text">Copy</button>` | copies and says so |
| `<span class="sk-live">Moving</span>` | a live tag with a pulsing dot |
| `<div class="sk-loader">Loading results</div>` | a brush scribble that draws while something loads |

### Quiz

```html
<form class="sk-quiz">
  <div class="sk-label">Question 2</div>
  <h2 class="sk-h3">How many good nights does it take to be sharp again?</h2>
  <fieldset><legend class="sk-sr">Answers</legend>
    <label class="sk-radio"><input type="radio" name="a"><span>Two nights</span></label>
    <label class="sk-radio" data-right><input type="radio" name="a"><span>More than a week</span></label>
  </fieldset>
  <div class="sk-quiz-foot"><button class="sk-btn" type="button" data-sk-check data-sk-next="Next question">Check answer</button><span class="sk-caption sk-keys">Press 1–2, then Enter</span></div>
  <aside class="sk-callout" data-tone="good" data-sk-if="right" hidden>…</aside>
  <aside class="sk-callout" data-tone="bad" data-sk-if="wrong" hidden>…</aside>
</form>
```
Check marks the right row with a tick and a wrong pick with a cross, shows the matching feedback, and (with `data-sk-next`) becomes the Next button. It fires `sk:answer` with `detail.right`, then `sk:next`. Number keys pick while the question is open; `sk-keys` hides on touch screens. Use checkboxes and several `data-right` rows for "pick all that apply".

### Step by step

| Markup | What you get |
| --- | --- |
| `<div class="sk-player" aria-label="…"><div class="sk-player-stage">…<span data-sk-at="2-">…</span><div data-sk-chart="bars" data-sk-max="63" data-sk-data='[…]'></div></div><ol class="sk-player-steps"><li data-sk-key="Day 2" data-sk-data='[…]'><b>What changed.</b> One more line.</li>…</ol></div>` | a figure that changes step by step, with the words for each step under it. Play, back, forward, a dot for each step and "2 of 6" are built for you; the Play button stays ink, so the step's own clay thing is the only clay. In the stage, `data-sk-at` shows a thing only at those steps (`"2"`, `"2-"`, `"-3"`, `"1,4"`) and `data-step` names the step for CSS; a step's `data-sk-data` and `data-sk-key` move the chart, and `data-sk-max` keeps its scale. Fires `sk:step` with `detail.i` and `detail.step`; `data-sk-every` sets the pace (2800ms) |
| `<form class="sk-wizard" data-sk-send="Send my application" novalidate><fieldset data-step="You"><legend>Who's applying?</legend>…<input class="sk-input" required data-sk-msg="Add your name, so we know who to give the plot to.">…</fieldset>…<fieldset data-step="Check" data-sk-review><legend>Check and send</legend></fieldset><div class="sk-wizard-done" hidden>…<button type="button" class="sk-btn" data-sk-quiet data-sk-again>Change my application</button></div></form>` | a form in steps: a numbered row that ticks off each step, Back and Continue, `required` fields that say what's missing in their own words, a review of every answer with a Change button per step (a step opened from the review says "Back to review" and returns there), then the done state. Fires `sk:step`, and `sk:submit` with `{label: value}`; it sends nothing by itself |
| `<div class="sk-choices" data-cards role="radiogroup" aria-labelledby="sizeL"><span class="sk-field-label" id="sizeL">Size</span><label class="sk-radio"><input type="radio" name="size" required><span>Half plot<small>£20 a year</small></span></label>…</div>` | radios or checks as cards side by side; `data-row` lays short ones in a row, such as days. The `small` text stays out of the answer |

### Code and conversation

| Markup | What you get |
| --- | --- |
| `<pre class="sk-code" data-lang="sql" data-title="top_movies.sql" data-sk-lines="7" data-sk-notes='{"5":"Match each rating to its title"}'><code>…</code></pre>` | a code block with a head, Copy, line numbers, highlighting, marked lines and numbered notes whose pins sit in their own column in the gutter, ink until you point at a note, then clay with their line; `data-lang="diff"` colours added and removed lines; `data-sk-nonum`, `data-sk-wrap`; a line too long to fit scrolls with a fade |
| `<div class="sk-chat"><div class="sk-msg" data-from="user"><div class="sk-who">Task <time>00:00</time></div><div class="sk-body">…</div></div>…</div>` | a conversation: the user's turns on a panel, the assistant's on the paper, `data-from="system"` in mono inside a dashed outline |
| `<figure class="sk-terminal" data-title="~/Downloads"><pre>$ tidybox --dry-run
Would move 192 files
# Changed your mind? tidybox --undo</pre></figure>` | a terminal, ink in both themes: each `$ ` line types itself once the terminal comes into view, then its output prints line by line; `#` lines are notes; Copy copies only the commands, and with `data-sk-copy-n="1"` only the first (a dry run before the real one). For code to read rather than run, use `sk-code` |
| `<details class="sk-tool" data-state="error"><summary><span>Run tests</span><code>bun test</code><span class="sk-pill" data-tone="bad">1 failed</span></summary><pre>…</pre></details>` | a tool call that opens to its output |

### Script

`window.Sketchbook` has `draw(name, {size, fill, seed})`, `flow`, `arrow`, `blob`, `tile`, `quoteMark`, `mark(kind)`, `chart(el)`, `update(el, data)`, `count(el)`, `set(el, text)` (changes a value with a short swap; fast repeats land on the latest), `format(n, {prefix, suffix, decimals})`, `toast(text, {tone, ms})`, `copy(text, message)`, `theme('dark'|'light')`, `mount(root)` for markup added later, `replay(box)` to play the entrance again, and `drawings` (the names). Controls fire `sk:change`, the quiz `sk:answer` and `sk:next`, a player and a form in steps `sk:step`, and a form in steps `sk:submit`; each revealed part fires `sk:reveal`.

### Accessibility

Every drawing that carries meaning gets `aria-label`; decorative spots need nothing. Charts take `aria-label` and keep their numbers in a table or text nearby when they matter. Marks add a hidden word ("Yes", "No", "Partly"). Controls are real buttons and inputs with labels, keyboard support comes with them, and focus always shows. Colour is never the only signal.

## Versions

Version 4 (2026-11-10) carries the drawn feel past the hero. In version 3 the hand-made part of a page was the hero and a few small spots; below that every page was the same quiet ivory. Now a drawing can sit on a printed ground anywhere (Art), a full-width band of oat or sage can set one section apart (Bands), and a brush can mark the phrase or number that matters (Hand marks). Grounds have a fine printed grain. The aim is a page with a pace, without anything shouting. Version 4.1 (the same day) made three corrections: the clay band and the chalkboard band are gone, because a page must stay in one theme from top to bottom; a band is now oat or sage; and an edge on a callout is a straight bar with square corners, never one that bends round a rounded corner. Version 4.2 (the same day) is about motion: everything hand-drawn is now drawn by the pen along its own stroke, so a ring goes round its number and an arrow runs from its tail to its tip, and nothing hand-drawn is wiped or popped in.

Version 3 (2026-11-08) turned the explainer look into a whole system: twenty-five kinds of page, about eighty parts, charts, controls, slides and motion. Version 2's choices (colour, type, brush, props) came from blind picks between candidates and stay as they were.
