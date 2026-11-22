# Form in steps

A form cut into a few short steps, with a look over everything before it is sent: applications, bookings, sign-ups, anything that would be a long wall as one page.

- `<form class="sk-wizard" data-sk-send="Book the repair" novalidate>` holds one `<fieldset data-step="Bike">` per step, each with a `legend` that asks the step's question. The step names make the numbered row at the top. Back, "Step 2 of 3" and Continue are built at the bottom, and on the last step Continue reads as `data-sk-send`.
- A `required` field stops Continue until it is filled and shows its `data-sk-msg` under it. Say what to do and why ("Add a phone number. We text you when it's ready."), never just "Required".
- A last `fieldset` with `data-sk-review` lists every answer under its step, each step with a Change button that goes back to it.
- `.sk-choices[data-cards]` lays radios or checks out as cards side by side; `.sk-choices[data-row]` as a row of short options, such as days of the week. A `small` in a choice is the detail on the card and stays out of the answer.
- Sending fires `sk:submit` with `detail` as `{"Your name": "Sam Okafor", …}`, keyed by each field's label, and shows `.sk-wizard-done`. A `data-sk-again` button there goes back to the first step with the answers kept. The form sends nothing anywhere by itself: listen for `sk:submit` to use the answers.
- Steps slide sideways, the form eases to each step's height, and the row at the top ticks off each finished step.
- Three to five steps, a few fields each. Put the ask that people find hardest in the middle, never first.
