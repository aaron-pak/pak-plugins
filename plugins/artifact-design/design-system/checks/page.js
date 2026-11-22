// The few rules of a Sketchbook page that can be counted: one theme from top to bottom, the page
// wrapper, a band or a hand mark as an exception and not a habit, one hero that moves, no emoji.
function check() {
  const faults = [];
  const nested = [...document.querySelectorAll("[data-theme]")].filter((el) => el !== document.documentElement);
  if (nested.length) {
    const first = nested[0];
    faults.push(
      `data-theme is set inside the page, on <${first.tagName.toLowerCase()}${first.className ? ` class="${first.className}"` : ""}>: ` +
        "a page stays in one theme from top to bottom, so remove it and let the tokens turn everything together",
    );
  }
  if (!document.querySelector(".sk-page, .sk-deck")) {
    faults.push('the page has no <main class="sk-page sk-enter">: wrap the page in it, with each section a direct child');
  }
  const bands = [...document.querySelectorAll('[data-mode="band"]')].filter((el) => /^(oat|sage)$/.test(el.dataset.tone || ""));
  const tones = bands.map((band) => band.dataset.tone);
  if (bands.length > 2 || new Set(tones).size < tones.length) {
    faults.push(`${bands.length} oat and sage bands (${tones.join(", ")}): two at most on a page, one of each colour`);
  }
  if (bands.some((band, index) => index > 0 && band.previousElementSibling === bands[index - 1])) {
    faults.push("two bands sit back to back: put a section on paper between them");
  }
  const marks = document.querySelectorAll("[data-sk-under], [data-sk-ring]").length;
  if (marks > 3) faults.push(`${marks} hand marks: keep to two or three on a page, for the claim or the number that matters`);
  const boiling = document.querySelectorAll("[data-sk-boil]").length;
  if (boiling > 1) faults.push(`${boiling} drawings boil: only the hero does`);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const emoji = new Set();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement && node.parentElement.closest("script, style, pre, code, textarea")) continue;
    for (const found of node.nodeValue.match(/\p{Emoji_Presentation}/gu) || []) emoji.add(found);
  }
  if (emoji.size) faults.push(`emoji in the text (${[...emoji].slice(0, 6).join(" ")}): the drawings and brush marks are the icons`);
  return faults;
}
