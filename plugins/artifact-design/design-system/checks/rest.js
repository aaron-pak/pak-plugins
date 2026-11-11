// A Sketchbook page is at rest when the pen has nothing left to draw: no stroke undrawn, nothing
// still waiting its turn. Some strokes start from a timer, a beat after the words they mark.
function rest() {
  if (document.querySelector(".sk-pen-wait")) return false;
  for (const el of document.querySelectorAll(".sk-wait")) if (el.getClientRects().length) return false;
  for (const stroke of document.querySelectorAll(".sk-pen")) {
    const box = stroke.closest(".sk-box");
    if (box && !(box.previousElementSibling && box.previousElementSibling.checked)) continue;
    const host = stroke.closest("svg");
    if (host && !host.getClientRects().length) continue;
    const style = getComputedStyle(stroke);
    if (Math.abs(parseFloat(style.strokeDashoffset) - (parseFloat(style.getPropertyValue("--p1")) || 0)) > 0.01) return false;
  }
  return true;
}
