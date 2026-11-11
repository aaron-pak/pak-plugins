# Frames, mini pages and compare

Ways to show a picture of something.

- `.sk-figure` with a `figcaption`: any image, svg or frame with a caption under it.
- `.sk-frame`: a window with a hairline border; `data-sk-chrome="title"` adds a title bar with three dots. For screenshots and mocks.
- `.sk-mini` inside a frame: write a real page's markup and it is laid out at full width (`data-sk-w`, default 1120) and shrunk to fit, with a soft fade at the bottom. On a phone it lays out as a phone page. Use it in pickers, galleries and before/after pages instead of grey wireframe boxes.
- `.sk-compare` with two children (images or blocks) and `data-label-a` / `data-label-b`: a before/after slider; drag or use the arrow keys.
