// Everything hand-drawn is drawn by the pen, along its own stroke. Once the page is at rest no
// stroke may be left undrawn and nothing may still be waiting for the pen, and the page's own
// styles may not wipe anything on with a clip-path: only a ground is painted on and only a note's
// words are written that way.
function check() {
  const faults = [];
  const seen = (el) => el.getClientRects().length > 0;
  for (const stroke of document.querySelectorAll(".sk-pen")) {
    const style = getComputedStyle(stroke);
    const box = stroke.closest(".sk-box");
    if (box && !(box.previousElementSibling && box.previousElementSibling.checked)) continue; // an empty checkbox
    const host = stroke.closest("svg");
    if (host && !seen(host)) continue;
    const offset = parseFloat(style.strokeDashoffset);
    const drawn = parseFloat(style.getPropertyValue("--p1")) || 0;
    if (Math.abs(offset - drawn) > 0.01) {
      const part = stroke.closest("[class]:not(mask):not(.sk-pen)") || stroke;
      faults.push(`a pen stroke in .${String(part.getAttribute("class")).split(/\s+/)[0]} is left undrawn once the page is at rest`);
    }
  }
  for (const stroke of document.querySelectorAll(".sk-sm")) {
    if (seen(stroke) && parseFloat(getComputedStyle(stroke).strokeDashoffset) > 0.01) {
      faults.push("a drawing is left half drawn once the page is at rest");
    }
  }
  for (const el of document.querySelectorAll(".sk-pen-wait, .sk-wait")) {
    if (el.matches(".sk-pen-wait") || seen(el)) {
      faults.push(`.${String(el.getAttribute("class")).split(/\s+/)[0]} never arrived: it is still waiting to be drawn or revealed`);
    }
  }
  const PAINTED = ["sk-ground", "sk-ground-swipe", "sk-write"];
  const hint = "anything hand-drawn is revealed along its own stroke, so use the system's drawings, marks and arrows, which draw themselves";
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule instanceof CSSKeyframesRule) {
        const wipes = [...rule.cssRules].some((frame) => frame.style.getPropertyValue("clip-path"));
        if (wipes && !PAINTED.includes(rule.name)) faults.push(`@keyframes ${rule.name} wipes with a clip-path: ${hint}`);
        continue;
      }
      if (rule.style && /clip-path/.test(rule.style.getPropertyValue("transition") + rule.style.getPropertyValue("transition-property"))) {
        faults.push(`${rule.selectorText} transitions a clip-path: ${hint}`);
      }
      if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch {
      // a stylesheet from another origin can't be read
    }
  }
  return [...new Set(faults)].slice(0, 6);
}
