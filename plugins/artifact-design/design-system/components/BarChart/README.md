# Bar charts

- `data-sk-chart="hbars"` ranks things: longest first, the label at the left, the value at the bar's end. The first bar is clay unless `data-sk-key` names others. On a phone the labels sit above the bars.
- `data-sk-chart="bars"` compares a few categories or hours: putty columns with rounded tops; `data-sk-key="8 am"` turns the ones that matter clay and shows their value. `data-sk-axis="none"` drops the axis and labels every bar.
- Data is `[["label", value], …]`. Bars grow from the axis when first seen; hover shows the value.
- `Sketchbook.update(el, data)` moves the bars to new values. `data-sk-max="63"` fixes the top of the scale, so bars that change step by step (see Player) stay comparable.
