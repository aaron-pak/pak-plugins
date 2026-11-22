# Meter

How far along something is. It fills from zero the first time it is seen.

- `<div class="sk-meter-head"><span>What</span><b>18 of 30</b></div>` then `<div class="sk-meter" style="--v:.6" role="meter" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" aria-label="…">`.
- `--goal:.8` adds a tick for where you planned to be; `data-sk-goal="Plan for today"` labels it above the bar, and the label slides to stay inside the bar's ends. `data-size="thin|thick"`; `data-tone="clay|good|warn|bad"` (ink by default).
- Always say the count in words beside it.
