# Terminal

A command line that types itself once, when it scrolls into view: install steps, a tool's first run, what a script prints.

- `<figure class="sk-terminal" data-title="~/Sites/recipes"><pre>$ command …</pre></figure>`. A line that starts with `$ ` is a command: it types at a steady pace, then the lines under it print one after another. A line that starts with `#` is a note, in muted italic. Everything else is output.
- The head shows `data-title` (the folder, or the tool's name) and a Copy button that copies only the commands, without the `$`.
- When the commands are a look-then-do pair (a dry run, then the real run), add `data-sk-copy-n="1"` so Copy takes only the first: a paste must never run the step the page asks people to check first.
- It stays ink-dark in light and dark mode, so it reads as a terminal at a glance. Long lines scroll sideways. Under reduced motion it shows everything at once.
- Show the output a reader will really see, cut short with `…` when it's long, and commands that run as written. For code to read rather than run, use Code.
