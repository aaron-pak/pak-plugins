# Fields and slider

- `.sk-field` holds a `label`, the control and an optional `.sk-help`. Labels are Bricolage, above the control.
- `.sk-input` (also on `textarea`) and `<div class="sk-select"><select>…</select></div>`: white, hairline border; focus turns it clay with a soft halo.
- `.sk-affix` puts a unit inside the field (`<span>$</span>` before or `<span>%</span>` after).
- `input.sk-range`: an ink fill up to the thumb (clay stays free for the answer the slider changes). An `output for` in its label shows the value, formatted by `data-sk-format`; `.sk-range-ends` labels the ends.
