# Flip cards

Cards that turn over to show an answer, for revising: a term and its meaning, a question and its answer.

- `<div class="sk-flips">` holding `<button class="sk-flip"><div>front</div><div>back</div></button>`. Each side takes a `.sk-label`, an `h4` or a `p`.
- They look like index cards: white, a clay rule under the heading line, the term centred, each one sitting a fraction of a degree crooked (from its words, so it never changes). The front says "Turn over" with a small arrow, so nobody has to guess.
- Clicking, Enter or Space turns a card; `aria-pressed` says which side is up. The back is putty, headed by the term in clay, so you know which card you turned.
- Under reduced motion the card swaps sides without turning.
