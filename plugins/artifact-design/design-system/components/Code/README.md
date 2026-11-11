# Code

A code block with a head (title, language, Copy), line numbers, quiet highlighting (keywords clay, strings green, comments muted italic) and notes.

- `<pre class="sk-code" data-lang="sql|js|ts|py|sh|json|diff" data-title="file.sql"><code>…</code></pre>`.
- `data-sk-lines="7,9-10"` marks lines in clay-soft. `data-sk-notes='{"5":"…"}'` puts a numbered ink pin beside line 5's number and the note in a list under the code; pointing at either turns both clay, so only the pair you're on is clay.
- On a phone code wraps rather than scrolls: a wrapped line continues 2ch past its own indent, and words with a hyphen or slash, and placeholders such as `<merge sha>`, never split.
- `data-lang="diff"` tints `+` and `-` lines. `data-sk-nonum` hides numbers (for one-line commands); `data-sk-wrap` wraps long lines.
- Inline `code` sits on the panel. Never use code style for labels or numbers.
