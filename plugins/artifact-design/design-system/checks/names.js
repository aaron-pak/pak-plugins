// A page is written in the system's own words. Every sk- class and data-sk- attribute in the page
// must be one the stylesheet or the runtime knows, and every drawing must be one of the set: a
// name that is nearly right does nothing, without any error.
function check() {
  const faults = [];
  let source = "";
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) source += rule.cssText + "\n";
    } catch {
      // a stylesheet from another origin can't be read
    }
  }
  for (const script of document.scripts) if (!script.src) source += script.textContent + "\n";
  const classes = new Set(source.match(/sk-[a-z0-9-]*[a-z0-9]/g) || []);
  const attributes = new Set(source.match(/data-sk-[a-z0-9-]*[a-z0-9]/g) || []);
  // The runtime reads most attributes as dataset.skCopyN, which is data-sk-copy-n.
  for (const name of source.match(/\bsk[A-Z][A-Za-z0-9]*/g) || []) {
    attributes.add("data-" + name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase()));
  }
  // Names the runtime builds from a stem: 'sk-chart-' + kind, dataset['skOn' + part].
  const stems = source.match(/sk-[a-z0-9-]*-(?=["'`]\s*\+)/g) || [];
  for (const name of source.match(/\bsk[A-Z][A-Za-z0-9]*(?=["'`]\s*\+)/g) || []) {
    stems.push("data-" + name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase()) + "-");
  }
  const known = (name, names) => names.has(name) || stems.some((stem) => name.startsWith(stem));
  const unknown = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    for (const name of el.classList) if (name.startsWith("sk-") && !known(name, classes)) unknown.add("class " + name);
    for (const { name } of el.attributes) if (name.startsWith("data-sk-") && !known(name, attributes)) unknown.add(name);
  }
  if (unknown.size) {
    faults.push(
      `Sketchbook has no ${[...unknown].slice(0, 8).join(", ")}${unknown.size > 8 ? ` (and ${unknown.size - 8} more)` : ""}: ` +
        "these do nothing. Use the markup from the guide's tables or a component's example as written.",
    );
  }
  const drawings = window.Sketchbook && Array.isArray(window.Sketchbook.drawings) ? window.Sketchbook.drawings : null;
  if (drawings) {
    const missing = new Set();
    for (const el of document.querySelectorAll("[data-sk-draw]")) {
      for (const name of el.getAttribute("data-sk-draw").trim().split(/\s+/)) {
        if (name && !drawings.includes(name)) missing.add(name);
      }
    }
    if (missing.size) {
      faults.push(
        `no drawing is called ${[...missing].slice(0, 6).join(", ")}, so nothing is drawn there. The set is: ${drawings.join(", ")}.`,
      );
    }
  }
  return faults;
}
