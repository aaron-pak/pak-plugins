// What has to fit at every window width. fits() only measures, so it also runs at the widths
// between the renders: the words of a flow stay inside their step's card, an arrow's label stays
// clear of the steps, and no label of a drawing or a chart runs far out of its sides (an axis
// label may reach a few pixels into the gutter beside its chart).
function fits() {
  const SLACK = 1.5;
  const GUTTER = 12;
  const faults = new Set();
  const words = (el) => (el.children.length ? [...el.children].map((line) => line.textContent) : [el.textContent]).join(" ");
  const quote = (el) => `"${words(el).replace(/\s+/g, " ").trim().slice(0, 48)}"`;
  for (const svg of document.querySelectorAll("svg")) {
    if (svg.ownerSVGElement) continue;
    const box = svg.getBoundingClientRect();
    if (box.width < 40 || box.height === 0) continue;
    const cards = [...svg.querySelectorAll(".sk-flow-card")].map((card) => card.getBoundingClientRect());
    for (const text of svg.querySelectorAll("text")) {
      const at = text.getBoundingClientRect();
      if (at.width === 0 || at.height === 0) continue;
      const step = text.closest(".sk-fc");
      const card = step && step.querySelector(".sk-flow-card");
      if (card) {
        const room = card.getBoundingClientRect();
        if (at.left < room.left - SLACK || at.right > room.right + SLACK) {
          faults.add(`${quote(text)} is wider than its step in the flow: shorten it`);
        }
      } else if (at.left < box.left - GUTTER || at.right > box.right + GUTTER) {
        faults.add(`${quote(text)} runs out of the side of its drawing: shorten it`);
      } else if (
        text.classList.contains("sk-flow-alabel") &&
        cards.some((c) => at.left < c.right - SLACK && at.right > c.left + SLACK && at.top < c.bottom - SLACK && at.bottom > c.top + SLACK)
      ) {
        faults.add(`the arrow label ${quote(text)} runs into a step of the flow: shorten it`);
      }
    }
  }
  return [...faults];
}
function check() {
  return fits();
}
