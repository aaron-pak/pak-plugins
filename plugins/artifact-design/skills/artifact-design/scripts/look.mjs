// The look in words: what a render of the page looks like, said as text. preview.mjs runs these on
// each render after its capture. They find what a capture shows and no other check measures, and
// with --no-images they describe the render for a model that can't see images.
//
// - describeProbe (in the page): every text colour against the background it sits on, text that
//   overlaps other text or lies under another element, labels a drawn line runs through or that
//   spill out of their shape, ids used twice, declared fonts that did not load and 2D canvases
//   with nothing on them; and, to describe the render, its fonts, the boxes that scroll sideways,
//   its empty stretches, the page's own colour variables and a block map of the page as text.
// - interactStart, interactPress and interactFill (in the page, the first render only): press each
//   control and say which the page has set no handler for and the browser does nothing with, and
//   which threw.
// - colorStats (in a blank page): the colours of the capture by area, named after the page's variables.
// - lookFindings and lookWords: the faults as report lines, and the description.

/** In the page: everything the look says about one render. Self-contained (it is serialized). */
export async function describeProbe({ COLS, ROW_PX, MAX_ROWS, MAX_LIST, VH, ACCEPT, FONTS_DOWN }) {
  const de = document.documentElement;
  const body = document.body;
  // A page may scroll smoothly, and a measurement taken on the way would be of the wrong place.
  const jump = (y) => scrollTo({ top: y, left: 0, behavior: "instant" });
  const vw = de.clientWidth;
  const vh = innerHeight;
  const sh = Math.max(de.scrollHeight, body ? body.scrollHeight : 0);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const cx = canvas.getContext("2d", { willReadFrequently: true });
  const memo = new Map();
  // Any CSS color as [r, g, b, a] (0-255, a 0-1), through a canvas, so oklch(), color-mix() and
  // color(srgb …) all resolve.
  const rgba = (c) => {
    if (memo.has(c)) return memo.get(c);
    let v = [0, 0, 0, 0];
    // A fill by reference (a gradient, a pattern) is no one colour, and counts as none here.
    if (c && c !== "transparent" && c !== "none" && !/^url\(/i.test(c)) {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = "#000";
      cx.fillStyle = c;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      v = [d[0], d[1], d[2], d[3] / 255];
    }
    memo.set(c, v);
    return v;
  };
  const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => Math.round(top[i] * a + under[i] * (1 - a))).concat(1);
  };
  const hex = (c) => "#" + c.slice(0, 3).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  const lum = (c) => {
    const ch = c.slice(0, 3).map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const shown = (el) => {
    // text inside a closed <details> (or any content-visibility: hidden box) isn't painted
    if (el.checkVisibility && !el.checkVisibility()) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) < 0.05) return false;
      // text kept for screen readers only (a 1px box that clips it away), such as a stacked table's head
      if (s.position === "absolute" && (s.overflow === "hidden" || s.clipPath !== "none" || (s.clip && s.clip !== "auto"))) {
        const r = n.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) return false;
      }
      // the far side of a card that turns over: a face that hides its back and is turned away
      if (s.backfaceVisibility === "hidden") {
        try {
          let m = new DOMMatrix(s.transform === "none" ? undefined : s.transform);
          for (let p = n.parentElement; p && getComputedStyle(p).transformStyle === "preserve-3d"; p = p.parentElement) {
            const t = getComputedStyle(p).transform;
            if (t !== "none") m = new DOMMatrix(t).multiply(m);
          }
          if (m.m33 < 0) return false;
        } catch (e) {}
      }
    }
    return true;
  };
  // The part of a rectangle (in page coordinates) that the boxes round `el` leave in view: each
  // ancestor that hides or scrolls its overflow cuts it. Null when nothing is left.
  const inView = (el, q) => {
    let x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1;
    for (let n = el; n && n.nodeType === 1 && n !== body && n !== de; n = n.parentElement) {
      if (n instanceof SVGElement && !(n instanceof SVGSVGElement)) continue;
      const s = getComputedStyle(n);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const r = n.getBoundingClientRect();
      if (s.overflowX !== "visible") { x0 = Math.max(x0, r.left + scrollX); x1 = Math.min(x1, r.right + scrollX); }
      if (s.overflowY !== "visible") { y0 = Math.max(y0, r.top + scrollY); y1 = Math.min(y1, r.bottom + scrollY); }
      if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    }
    return { x0, y0, x1, y1 };
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    return o;
  };
  const moving = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.getAnimations && n.getAnimations().some((a) => a.playState === "running" && !(a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations === Infinity))) return true;
    }
    return false;
  };
  // A diagram the runtime drew from text (Mermaid): its layout, ids and palette are not the page's to fix.
  const drawnForIt = (el) => !!el.closest(".mermaid-diagram");
  // Turned or slanted, so the upright rectangle round it says little about where its ink is.
  const turned = (el) => {
    if (el instanceof SVGGraphicsElement) {
      const m = el.getScreenCTM();
      return !!m && (Math.abs(m.b) > 0.02 || Math.abs(m.c) > 0.02);
    }
    for (let n = el; n && n.nodeType === 1 && n !== body; n = n.parentElement) {
      const t = getComputedStyle(n).transform;
      const m = t && t !== "none" ? /^matrix\(([^)]+)\)/.exec(t) : null;
      if (t && t !== "none" && (!m || Math.abs(parseFloat(m[1].split(",")[1])) > 0.02)) return true;
    }
    return false;
  };
  // Held in place while the page scrolls under it, so where it meets other text depends on the scroll.
  const pinned = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p === "fixed" || p === "sticky") return true;
    }
    return false;
  };
  const snippet = (t, n = 48) => {
    const s = t.replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };
  const sel = (el) => {
    const s = el.tagName.toLowerCase();
    if (el.id) return `${s}#${el.id}`;
    const cl = el.classList ? Array.prototype.slice.call(el.classList, 0, 2) : [];
    return cl.length ? `${s}.${cl.join(".")}` : s;
  };
  // The background a point of this element shows: its own and its ancestors' colors, composited
  // from the page's ground up. `image` says a gradient or image is somewhere behind it.
  const rootBg = (() => {
    const b = rgba(getComputedStyle(body).backgroundColor);
    const h = rgba(getComputedStyle(de).backgroundColor);
    const white = [255, 255, 255, 1];
    return b[3] > 0 ? over(b, h[3] > 0 ? over(h, white) : white) : h[3] > 0 ? over(h, white) : white;
  })();
  const pictured = (s) => !!s.backgroundImage && s.backgroundImage !== "none";
  // The colours a gradient runs between, where it is one gradient laid over the whole box. null
  // for a picture, for several layers, for a gradient sized down to a line or a patch (an
  // underline, an accent bar), for one that fills the letters, and for anything not read with
  // confidence: no colour stands for those.
  const colourFn = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)/gi;
  const gradientWords = /(?:repeating-)?(?:linear|radial|conic)-gradient|\b(?:to|at|from|in|top|bottom|left|right|center|circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|srgb|srgb-linear|display-p3|oklab|oklch|lab|lch|hsl|hwb|shorter|longer|increasing|decreasing|hue)\b|-?[\d.]+(?:e-?\d+)?(?:deg|grad|rad|turn|px|em|rem|vw|vh|%)?/gi;
  const stopsOf = (s) => {
    const image = s.backgroundImage;
    const found = image.match(colourFn);
    if (!found || /[a-z]/i.test(image.replace(colourFn, "").replace(gradientWords, ""))) return null;
    if (image.split("-gradient(").length > 2 || /,/.test(s.backgroundSize + s.backgroundRepeat)) return null;
    const whole = /^(auto|cover|contain|100%)( (auto|100%))?$/.test(s.backgroundSize) || s.backgroundRepeat === "repeat";
    if (!whole || /text/.test(s.backgroundClip + (s.webkitBackgroundClip || ""))) return null;
    return found.map(rgba);
  };
  // The page itself may be a gradient, read as the colours it runs between, or a picture, which no
  // colour stands for.
  let rootStops = null;
  let rootImage = false;
  for (const s of [getComputedStyle(body), getComputedStyle(de)]) {
    if (!pictured(s)) continue;
    const stops = rootStops || rootImage ? null : stopsOf(s);
    if (stops) rootStops = stops.map((c) => over(c, rootBg));
    else rootImage = true;
  }
  // `cs` are the colours the text may sit on: one, or a gradient's several. `stop` is the ancestor
  // whose solid fill hides everything behind it, when there is one.
  const bgOf = (el) => {
    const layers = [];
    let image = false;
    let stop = null;
    let base = null;
    for (let n = el; n && n.nodeType === 1 && n !== body && n !== de; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (pictured(s)) {
        const stops = stopsOf(s);
        // A gradient of solid colours hides what is behind it, as a solid fill does.
        if (stops && stops.every((c) => c[3] >= 1)) {
          base = stops;
          stop = n;
          break;
        }
        image = true;
      }
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) {
          stop = n;
          break;
        }
      }
    }
    if (!stop && rootImage) image = true;
    if (!base) base = !stop && rootStops && !rootImage ? rootStops : [rootBg];
    const cs = base.map((b) => {
      let c = b;
      for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i], c);
      return c;
    });
    return { c: cs[0], cs, image, stop };
  };

  // Text: every element that directly holds visible text (for colors and fonts), and the same text
  // grouped by the block it flows in (a paragraph with its bold and code, an SVG <text> with its
  // tspans), measured from the rectangles of its lines, for overlaps and the map.
  const texts = [];
  const seen = new Set();
  const units = new Map();
  const blockOf = (el) => {
    for (let n = el; n && n !== body; n = n.parentElement) {
      if (n instanceof SVGElement) {
        if (n.tagName.toLowerCase() === "text") return n;
        continue;
      }
      const d = getComputedStyle(n).display;
      if (d !== "inline" && d !== "contents") return n;
    }
    return body;
  };
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  // Past 600 pieces of text the rest is not measured, but it still counts as something drawn.
  const unmeasured = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (texts.length >= 600) {
      if (unmeasured.length >= 20000 || !n.data.trim() || !n.parentElement) continue;
      const r = n.parentElement.getBoundingClientRect();
      if (r.width >= 1 && r.height >= 1) unmeasured.push([r.top + scrollY, r.bottom + scrollY]);
      continue;
    }
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("script, style, noscript, template, title")) continue;
    if (el.closest("svg") && !(el instanceof SVGElement)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !shown(el)) continue;
    if (!inView(el.parentElement, { x0: r.left + scrollX, y0: r.top + scrollY, x1: r.right + scrollX, y1: r.bottom + scrollY })) continue;
    const s = getComputedStyle(el);
    const svgText = el instanceof SVGElement;
    const color = rgba(svgText ? s.fill : s.color);
    if (color[3] === 0) continue;
    if (!seen.has(el)) {
      seen.add(el);
      texts.push({ el, r, s, svgText, color, text: el.textContent || "", y: r.top + scrollY, x: r.left + scrollX });
    }
    const b = blockOf(el);
    if (!units.has(b)) units.set(b, { el: b, nodes: [], size: parseFloat(s.fontSize) || 16, svgText });
    units.get(b).nodes.push(n);
  }
  const range = document.createRange();
  const blocks = [];
  for (const u of units.values()) {
    const rects = [];
    for (const n of u.nodes) {
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        if (q.width < 1 || q.height < 1 || rects.length >= 40) continue;
        // only what a box round it leaves in view: text scrolled or clipped away overlaps nothing
        const seen = inView(n.parentElement, { x0: q.left + scrollX, y0: q.top + scrollY, x1: q.right + scrollX, y1: q.bottom + scrollY });
        if (seen) rects.push(seen);
      }
    }
    if (!rects.length) continue;
    const box = rects.reduce((a, q) => ({ x0: Math.min(a.x0, q.x0), y0: Math.min(a.y0, q.y0), x1: Math.max(a.x1, q.x1), y1: Math.max(a.y1, q.y1) }));
    blocks.push({ ...u, rects, box, text: u.nodes.map((n, i) => (i && n.parentElement instanceof SVGElement && n.parentElement !== u.nodes[i - 1].parentElement ? " " : "") + n.data).join("").replace(/\s+/g, " ").trim() });
  }

  // What an SVG label sits on: the first filled shape under its middle, else the page behind the
  // drawing. Scrolls the label into view to ask.
  const svgBg = (t) => {
    const rr = t.el.getBoundingClientRect();
    if (rr.top < 0 || rr.bottom > vh) {
      jump(Math.max(0, t.y - vh / 2));
    }
    const r = t.el.getBoundingClientRect();
    const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    for (const e of document.elementsFromPoint(x, y)) {
      if (e === t.el || e.contains(t.el) && !(e instanceof SVGSVGElement) && e instanceof SVGGElement) continue;
      if (e === t.el || t.el.contains(e)) continue;
      if (e instanceof SVGGeometryElement) {
        // a line has no inside to fill, whatever its fill says
        if (e instanceof SVGLineElement) continue;
        const fs = getComputedStyle(e);
        if (/^url\(/i.test(fs.fill)) return { c: rootBg, image: true };
        const f = rgba(fs.fill);
        if (f[3] > 0 && parseFloat(fs.fillOpacity) > 0.3) return { c: over([...f.slice(0, 3), f[3] * parseFloat(fs.fillOpacity) * opacityOf(e)], bgOf(e.ownerSVGElement || e).c), image: false };
        continue;
      }
      if (e instanceof SVGElement && !(e instanceof SVGSVGElement)) continue;
      return bgOf(e);
    }
    return { c: rootBg, image: false };
  };
  // What is painted behind a piece of HTML text that its ancestors' colours say is hard to read,
  // asked of the page itself: a picture or a block of another colour laid under the text without
  // being its ancestor (a hero image behind its heading) changes the answer.
  const behind = (t, first) => {
    const rr = t.el.getBoundingClientRect();
    if (rr.top < 0 || rr.bottom > vh) jump(Math.max(0, t.y - vh / 2));
    const q = t.el.getClientRects()[0] || t.el.getBoundingClientRect();
    const x = Math.min(vw - 1, Math.max(0, q.left + q.width / 2));
    const y = Math.min(vh - 1, Math.max(0, q.top + q.height / 2));
    const unknown = { c: first.c, cs: first.cs, image: true };
    // A fill an ancestor paints with ::before or ::after is behind the text too, and can't be asked
    // for by point. It counts where it is laid out to cover the text (not a bullet or a stripe).
    for (let n = t.el; n && n.nodeType === 1 && n !== de; n = n.parentElement) {
      for (const pseudo of ["::before", "::after"]) {
        const s = getComputedStyle(n, pseudo);
        if (!s.content || s.content === "none" || s.content === "normal" || !(pictured(s) || rgba(s.backgroundColor)[3] > 0)) continue;
        if ((s.position === "absolute" || s.position === "fixed") && parseFloat(s.width) >= 0.8 * q.width && parseFloat(s.height) >= 0.8 * q.height) return unknown;
      }
      if (n === first.stop) break;
    }
    const stack = document.elementsFromPoint(x, y);
    const at = stack.indexOf(t.el);
    // Text that takes no clicks (a caption laid over a picture) is not in the list; all of it is under the text.
    if (at < 0 && t.s.pointerEvents !== "none") return first;
    // See-through layers that are no ancestor (a scrim over a picture) tint whatever is found under them.
    const veils = [];
    const veiled = (b) => {
      if (!veils.length) return b;
      const cs = (b.cs || [b.c]).map((c) => {
        for (let i = veils.length - 1; i >= 0; i--) c = over(veils[i], c);
        return c;
      });
      return { ...b, c: cs[0], cs };
    };
    for (const e of stack.slice(at + 1)) {
      if (t.el.contains(e)) continue;
      if (e === first.stop) return veiled(first);
      if (e.contains(t.el)) continue;
      const s = getComputedStyle(e);
      if (e instanceof HTMLImageElement || e instanceof HTMLVideoElement || e instanceof HTMLCanvasElement || e instanceof SVGElement) return unknown;
      if (pictured(s)) {
        const under = bgOf(e);
        return under.image ? unknown : veiled(under);
      }
      const c = rgba(s.backgroundColor);
      if (c[3] >= 1) return veiled(bgOf(e));
      if (c[3] > 0) veils.push(c);
    }
    return veiled(first);
  };
  const startScroll = scrollY;

  // Contrast in this theme.
  const lowContrast = [];
  let overImage = 0;
  for (const t of texts) {
    // a control that is switched off is meant to be faint
    if (t.el.closest("[disabled], [aria-disabled='true'], [inert]")) continue;
    // text that is fading in or out has no settled colour yet
    if (moving(t.el)) continue;
    // a diagram the runtime drew, and text kept from readers (a decoration), are not for this check
    if (drawnForIt(t.el) || t.el.closest("[aria-hidden='true']")) continue;
    const size = parseFloat(t.s.fontSize) || 16;
    const bold = parseInt(t.s.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    let need = large ? 3 : 4.5;
    // A design system may set some text fainter on purpose and say how faint (its checks/accept.json).
    for (const rule of ACCEPT || []) {
      try { if (t.el.matches(rule.on)) need = Math.min(need, rule.least); } catch (e) {}
    }
    const mix = (b) => over([...t.color.slice(0, 3), t.color[3] * opacityOf(t.el)], b);
    // On a gradient, the colour of it the text reads best against: faint there is faint everywhere.
    const best = (b) => (b.cs || [b.c]).reduce((a, c) => (ratio(mix(c), c) > ratio(mix(a), a) ? c : a));
    let on = t.svgText ? svgBg(t) : bgOf(t.el);
    // Only text that looks faint is worth asking the page about.
    if (!t.svgText && !on.image && ratio(mix(best(on)), best(on)) < need) on = behind(t, on);
    const image = on.image;
    const bg = best(on);
    const fg = mix(bg);
    const r = ratio(fg, bg);
    if (image) overImage++;
    if (r < need && !image) lowContrast.push({ r, need, fg: hex(fg), bg: hex(bg), size, where: sel(t.el), text: snippet(t.text, 36) });
  }
  lowContrast.sort((a, b) => a.r - b.r);
  jump(startScroll);

  // Text that overlaps other text (the lines of two blocks crossing), or that something else covers.
  const boxes = blocks.slice(0, 400).filter((b) => !drawnForIt(b.el) && !turned(b.el) && !pinned(b.el) && !b.el.closest("[aria-hidden='true']"));
  const overlaps = [];
  // A line's rectangle is as tall as its font's ascent and descent, with air above and below the
  // letters: about the middle three fifths holds the ink. Big type set tight would otherwise seem
  // to run into the small lines beside it.
  const inkOf = (p) => ({ x0: p.x0, x1: p.x1, y0: p.y0 + 0.22 * (p.y1 - p.y0), y1: p.y1 - 0.2 * (p.y1 - p.y0) });
  const cross = (a, b) => {
    const p = inkOf(a), q = inkOf(b);
    const w = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0);
    const h = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
    if (w <= 2 || h <= 2) return false;
    const small = Math.min((p.x1 - p.x0) * (p.y1 - p.y0), (q.x1 - q.x0) * (q.y1 - q.y0));
    // A big share of the smaller line, or two labels on one line running into each other.
    return (w * h) / small >= 0.3 || (w >= 3 && h >= 0.55 * Math.min(p.y1 - p.y0, q.y1 - q.y0));
  };
  for (let i = 0; i < boxes.length && overlaps.length < MAX_LIST * 2; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.box.x1, b.box.x1) - Math.max(a.box.x0, b.box.x0);
      const h = Math.min(a.box.y1, b.box.y1) - Math.max(a.box.y0, b.box.y0);
      if (w <= 2 || h <= 2) continue;
      if (!a.rects.some((p) => b.rects.some((q) => cross(p, q)))) continue;
      overlaps.push(`"${snippet(a.text, 28)}" (${sel(a.el)}) and "${snippet(b.text, 28)}" (${sel(b.el)})`);
      if (overlaps.length >= MAX_LIST * 2) break;
    }
  }
  const covered = [];
  const fixedish = pinned;
  const startY = scrollY;
  const byY = boxes.filter((t) => !t.svgText).sort((a, b) => a.box.y0 - b.box.y0);
  let windowTop = -1;
  for (const t of byY) {
    if (covered.length >= MAX_LIST) break;
    const first = t.rects[0];
    const cyPage = first.y0 + Math.min(first.y1 - first.y0, 40) / 2;
    if (windowTop < 0 || cyPage < windowTop + 20 || cyPage > windowTop + vh - 20) {
      windowTop = Math.max(0, cyPage - vh / 3);
      jump(windowTop);
      windowTop = scrollY;
    }
    const px = Math.min(vw - 1, Math.max(0, first.x0 - scrollX + Math.min(first.x1 - first.x0, 60) / 2));
    const py = first.y0 - scrollY + Math.min(first.y1 - first.y0, 40) / 2;
    if (py < 0 || py >= vh) continue;
    // A hit test passes over text that takes no pointer events, so it can't say what covers it.
    if (getComputedStyle(t.el).pointerEvents === "none") continue;
    const top = document.elementFromPoint(px, py);
    if (!top || top === t.el || t.el.contains(top) || top.contains(t.el)) continue;
    if (fixedish(top) && !fixedish(t.el)) continue;
    // something see-through on top, such as a slider laid over a picture, covers nothing
    if (opacityOf(top) < 0.2) continue;
    const tb = getComputedStyle(top);
    if (rgba(tb.backgroundColor)[3] < 0.2 && (!tb.backgroundImage || tb.backgroundImage === "none") && !(top instanceof HTMLImageElement || top instanceof HTMLCanvasElement || top instanceof SVGElement)) continue;
    covered.push(`"${snippet(t.text, 32)}" (${sel(t.el)}) is under ${sel(top)}`);
  }
  jump(startY);

  // Boxes whose content scrolls sideways: fine for a wide table on a phone, a squeezed layout on a desktop.
  const sideways = [];
  for (const el of Array.prototype.slice.call(body.querySelectorAll("*"), 0, 3000)) {
    if (sideways.length >= MAX_LIST || !(el instanceof HTMLElement) || el === body) continue;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0 && shown(el)) {
      const inner = el.querySelector("table, pre, svg, canvas, img") || el.firstElementChild;
      sideways.push(`${inner ? sel(inner) + " in " : ""}${sel(el)} (${el.scrollWidth}px of content in ${el.clientWidth}px)`);
    }
  }

  // SVG labels a drawn line runs through (an arrow, an outline, a connector).
  const crossed = [];
  // The stroked shapes of a drawing as points along their outlines, in client coordinates.
  const strokeMemo = new Map();
  const strokesOf = (svg) => {
    if (strokeMemo.has(svg)) return strokeMemo.get(svg);
    const list = [];
    for (const g of Array.prototype.slice.call(svg.querySelectorAll("path, line, polyline, polygon, rect, circle, ellipse"), 0, 160)) {
      if (!(g instanceof SVGGeometryElement) || g.closest("text, defs, clipPath, mask, marker, pattern, symbol")) continue;
      const st = getComputedStyle(g);
      if (st.stroke === "none" || !(parseFloat(st.strokeWidth) > 0) || parseFloat(st.strokeOpacity) < 0.3 || !shown(g)) continue;
      // A hairline that barely shows, such as a chart's grid, is meant to pass behind labels.
      const ink = rgba(st.stroke);
      const ground = bgOf(svg).c;
      if (ink[3] === 0 || ratio(over([ink[0], ink[1], ink[2], ink[3] * parseFloat(st.strokeOpacity) * opacityOf(g)], ground), ground) < 1.6) continue;
      const m = g.getScreenCTM();
      let total = 0;
      try { total = g.getTotalLength(); } catch (e) {}
      if (!m || !(total > 0)) continue;
      const step = Math.max(1.5, total / 500);
      const pts = [];
      for (let l = 0; l <= total; l += step) {
        const at = g.getPointAtLength(l);
        const q = new DOMPoint(at.x, at.y).matrixTransform(m);
        pts.push([q.x + scrollX, q.y + scrollY]);
      }
      const bb = g.getBoundingClientRect();
      list.push({ g, pts, box: { left: bb.left + scrollX, right: bb.right + scrollX, top: bb.top + scrollY, bottom: bb.bottom + scrollY } });
    }
    strokeMemo.set(svg, list);
    return list;
  };
  let labelsTried = 0;
  for (const b of blocks) {
    if (!b.svgText || labelsTried >= 80 || drawnForIt(b.el) || turned(b.el)) continue;
    let svg = b.el.ownerSVGElement;
    while (svg && svg.ownerSVGElement) svg = svg.ownerSVGElement;
    if (!svg) continue;
    labelsTried++;
    if (crossed.length >= MAX_LIST) continue;
    const r = b.el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    // The label's core: its ink, less a margin, so a line that only grazes it or underlines it passes.
    const core = { x0: r.left + scrollX + 2, x1: r.right + scrollX - 2, y0: r.top + scrollY + r.height * 0.25, y1: r.bottom + scrollY - r.height * 0.25 };
    for (const sh of strokesOf(svg)) {
      if (sh.box.right < core.x0 || sh.box.left > core.x1 || sh.box.bottom < core.y0 || sh.box.top > core.y1) continue;
      // Count only points where the line is the top thing under the label (a filled shape drawn
      // over it hides it).
      let inside = 0;
      for (const [x, y] of sh.pts) {
        if (!(x > core.x0 && x < core.x1 && y > core.y0 && y < core.y1)) continue;
        if (y - scrollY < 0 || y - scrollY >= vh) jump(Math.max(0, y - vh / 2));
        const top = document.elementsFromPoint(x - scrollX, y - scrollY).find((e) => !(e instanceof SVGTextContentElement));
        if (top === sh.g && ++inside >= 2) break;
      }
      if (inside >= 2) {
        crossed.push(`"${snippet(b.text, 30)}" has a drawn ${sh.g.tagName.toLowerCase()} (${sel(sh.g)}) running through it`);
        break;
      }
    }
  }
  jump(startY);

  // Labelled shapes in a drawing: the filled shape each label sits in (its box, pill or circle).
  // Two such boxes that overlap without one holding the other have collided, and a label wider or
  // taller than its box spills out of it.
  const boxClash = [];
  const spills = [];
  const labelled = new Map();
  for (const b of blocks) {
    if (!b.svgText || labelled.size >= 120 || drawnForIt(b.el) || turned(b.el)) continue;
    let svg = b.el.ownerSVGElement;
    while (svg && svg.ownerSVGElement) svg = svg.ownerSVGElement;
    if (!svg) continue;
    const r = b.el.getBoundingClientRect();
    const cx0 = r.left + r.width / 2, cy0 = r.top + r.height / 2;
    let best = null;
    for (const g of Array.prototype.slice.call(svg.querySelectorAll("rect, circle, ellipse, polygon, path"), 0, 300)) {
      if (!(g instanceof SVGGeometryElement) || g.closest("text, defs, clipPath, mask, marker, pattern, symbol") || !shown(g)) continue;
      const st = getComputedStyle(g);
      const fill = rgba(st.fill);
      if (fill[3] * (parseFloat(st.fillOpacity) || 0) < 0.3) continue;
      const gr = g.getBoundingClientRect();
      if (gr.width < 8 || gr.height < 8 || gr.width * gr.height > 0.5 * svg.getBoundingClientRect().width * svg.getBoundingClientRect().height) continue;
      if (cx0 < gr.left || cx0 > gr.right || cy0 < gr.top || cy0 > gr.bottom) continue;
      // the label must mostly sit on it, so a dot or bar beside a label doesn't count as its box
      if (gr.width < r.width * 0.6 || gr.height < r.height * 0.8) continue;
      if (!best || gr.width * gr.height < best.r.width * best.r.height) best = { g, r: gr };
    }
    if (!best) continue;
    const k = best.g;
    if (!labelled.has(k)) labelled.set(k, { g: k, svg, r: best.r, text: b.text });
    const past = Math.max(best.r.left - r.left, r.right - best.r.right);
    if (spills.length < MAX_LIST && past > 3 && k.tagName.toLowerCase() !== "path") spills.push(`"${snippet(b.text, 28)}" runs ${Math.round(past)}px out of its ${k.tagName.toLowerCase()} (${sel(k)})`);
  }
  const boxes2 = [...labelled.values()];
  for (let i = 0; i < boxes2.length && boxClash.length < MAX_LIST; i++) {
    for (let j = i + 1; j < boxes2.length; j++) {
      const a = boxes2[i], b = boxes2[j];
      if (a.svg !== b.svg) continue;
      // Only two plain boxes: the upright rectangle round a slice, a circle or a path is not its shape.
      if (a.g.tagName.toLowerCase() !== "rect" || b.g.tagName.toLowerCase() !== "rect" || turned(a.g) || turned(b.g)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w <= 3 || h <= 3) continue;
      const inside = (p, q) => p.left >= q.left - 1 && p.right <= q.right + 1 && p.top >= q.top - 1 && p.bottom <= q.bottom + 1;
      if (inside(a.r, b.r) || inside(b.r, a.r)) continue;
      boxClash.push(`the shape around "${snippet(a.text, 20)}" and the one around "${snippet(b.text, 20)}" overlap by ${Math.round(w)}×${Math.round(h)}px (${sel(a.svg)})`);
      if (boxClash.length >= MAX_LIST) break;
    }
  }
  // Ids used more than once: a script that looks one up gets the first, which breaks controls.
  const idCount = {};
  for (const el of Array.prototype.slice.call(document.querySelectorAll("[id]"), 0, 5000)) if (!drawnForIt(el)) idCount[el.id] = (idCount[el.id] || 0) + 1;
  const dupIds = Object.entries(idCount).filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n}×)`).slice(0, MAX_LIST);

  // Fonts: which faces the text asks for, how much text each sets, and which fell back.
  const fonts = new Map();
  const missing = new Set();
  const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|emoji|math)$/i;
  for (const t of texts) {
    const family = (t.s.fontFamily || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    const chars = t.text.trim().length;
    const f = fonts.get(family) || { chars: 0, sizes: new Set() };
    f.chars += chars;
    f.sizes.add(Math.round(parseFloat(t.s.fontSize)));
    fonts.set(family, f);
    if (!generic.test(family) && document.fonts && !missing.has(family)) {
      // Only a face the page itself declares can be said not to have loaded. A family no
      // @font-face names is the reader's own font, there or not on their machine, not this one's.
      const faces = Array.from(document.fonts).filter((ff) => ff.family.replace(/["']/g, "") === family);
      if (faces.length && !faces.some((ff) => ff.status === "loaded")) missing.add(family);
    }
  }
  // Web fonts this machine could not fetch (the preview saw the requests fail): it is offline, not the page wrong.
  const fontsOffline = !!FONTS_DOWN;
  const totalChars = [...fonts.values()].reduce((a, f) => a + f.chars, 0) || 1;
  const fontList = [...fonts.entries()]
    .sort((a, b) => b[1].chars - a[1].chars)
    .slice(0, 6)
    .map(([fam, f]) => `${fam} ${Math.round((100 * f.chars) / totalChars)}% (${[...f.sizes].sort((a, b) => a - b).slice(0, 6).join("/")}px)${missing.has(fam) && !fontsOffline ? ", which did not load, so a fallback shows" : ""}`);

  // Canvases that drew nothing.
  const blankCanvases = [];
  for (const c of Array.prototype.slice.call(document.querySelectorAll("canvas"), 0, 12)) {
    const r = c.getBoundingClientRect();
    if (r.width < 20 || r.height < 20 || !shown(c) || c.__artifactContext !== "2d") continue;
    try {
      if (!c.width || !c.height) continue;
      // Read through a canvas of our own, a row at a time, so the page's canvas is left as it is.
      const w = Math.min(c.width, 8192);
      const row = document.createElement("canvas");
      row.width = w;
      row.height = 1;
      const g = row.getContext("2d", { willReadFrequently: true });
      const step = Math.max(1, Math.floor(c.height / 300));
      let ink = false;
      for (let y = 0; y < c.height && !ink; y += step) {
        g.clearRect(0, 0, w, 1);
        g.drawImage(c, 0, y, w, 1, 0, 0, w, 1);
        const d = g.getImageData(0, 0, w, 1).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { ink = true; break; }
      }
      // A 3D canvas hands back nothing once it has been shown, drawn on or not, so only one that took
      // a 2D context (noted by the preview as it was taken) is named. Asking here would take it.
      if (!ink && c.__artifactContext === "2d") blankCanvases.push(`${sel(c)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    } catch (e) {}
  }

  // Stretches of the page with nothing in them.
  const filled = texts.map((t) => [t.y, t.y + t.r.height]).concat(unmeasured);
  for (const m of Array.prototype.slice.call(document.querySelectorAll("img, svg, canvas, video, table, pre, button, input, select, textarea"), 0, 400)) {
    if (m.ownerSVGElement) continue;
    const r = m.getBoundingClientRect();
    if (r.width > 4 && r.height > 4 && shown(m)) filled.push([r.top + scrollY, r.bottom + scrollY]);
  }
  filled.sort((a, b) => a[0] - b[0]);
  // Measured against the reader's screen, not the window, which the capture may have stretched.
  // A page shorter than a screen just ends, which is no gap.
  const screenH = VH || vh;
  const gaps = [];
  let reach = 0;
  for (const [a, b] of filled) {
    if (a - reach > Math.max(0.6 * screenH, 360)) gaps.push(`${Math.round(reach)}–${Math.round(a)}px`);
    reach = Math.max(reach, b);
  }
  // The end of the page counts only where the page's own content reaches into it (a section that
  // never showed), not where the page is just kept a screen tall or padded.
  let contentEnd = 0;
  for (const child of Array.prototype.slice.call(body.children, 0, 400)) {
    const r = child.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) contentEnd = Math.max(contentEnd, r.bottom + scrollY);
  }
  const end = Math.min(sh, contentEnd);
  if (sh > 1.25 * screenH && end - reach > Math.max(0.6 * screenH, 360)) gaps.push(`${Math.round(reach)}–${Math.round(end)}px (the end of the page)`);

  // The block map: boxes (a fill or border of their own), media and controls as frames, text as
  // its words, laid on a grid of COLS columns and ROW_PX-pixel rows.
  const colPx = vw / COLS;
  const rows = Math.min(MAX_ROWS, Math.ceil(sh / ROW_PX));
  const grid = Array.from({ length: rows }, () => Array(COLS).fill(" "));
  const put = (r, c, ch) => {
    if (r >= 0 && r < rows && c >= 0 && c < COLS) grid[r][c] = ch;
  };
  const frame = (x0, y0, x1, y1, label) => {
    const c0 = Math.max(0, Math.round(x0 / colPx)), c1 = Math.min(COLS - 1, Math.round(x1 / colPx) - 1);
    const r0 = Math.round(y0 / ROW_PX), r1 = Math.round(y1 / ROW_PX) - 1;
    if (c1 - c0 < 2 || r0 >= rows) return;
    if (r1 <= r0) {
      for (let c = c0; c <= c1; c++) put(r0, c, "─");
    } else {
      for (let c = c0 + 1; c < c1; c++) { put(r0, c, "─"); put(r1, c, "─"); }
      for (let r = r0 + 1; r < r1; r++) { put(r, c0, "│"); put(r, c1, "│"); }
      put(r0, c0, "┌"); put(r0, c1, "┐"); put(r1, c0, "└"); put(r1, c1, "┘");
    }
    if (label) {
      const l = label.slice(0, Math.max(0, c1 - c0 - 3));
      for (let i = 0; i < l.length; i++) put(r0, c0 + 2 + i, l[i]);
    }
  };
  const write = (x0, y0, x1, text) => {
    const c0 = Math.max(0, Math.round(x0 / colPx));
    const c1 = Math.min(COLS - 1, Math.max(c0 + 1, Math.round(x1 / colPx) - 1));
    const r = Math.round(y0 / ROW_PX);
    const s = text.replace(/\s+/g, " ").trim();
    const lines = "─│┌┐└┘ ";
    const free = (row, a, b) => {
      for (let c = a; c <= b && c < COLS; c++) if (grid[row] && !lines.includes(grid[row][c])) return false;
      return true;
    };
    // Other text already on this row: the row below, when that is free.
    let row = r;
    if (row + 1 < rows && !free(row, c0, c1) && free(row + 1, c0, c1)) row = r + 1;
    // A short text (a figure, a name) is written whole where nothing is in its way.
    let room = c1 - c0 + 1;
    const whole = Math.min(s.length, 18);
    if (room < whole && c0 + whole <= COLS && free(row, c0 + room, c0 + whole - 1)) room = whole;
    const out = s.length > room ? s.slice(0, Math.max(1, room - 1)) + "…" : s;
    for (let i = 0; i < out.length; i++) put(row, c0 + i, out[i]);
  };
  const pageRect = (el) => {
    const r = el.getBoundingClientRect();
    return { x0: r.left + scrollX, y0: r.top + scrollY, x1: r.right + scrollX, y1: r.bottom + scrollY, w: r.width, h: r.height };
  };
  const boxEls = [];
  for (const el of Array.prototype.slice.call(body.querySelectorAll("*"), 0, 3000)) {
    if (!(el instanceof HTMLElement) || el.closest("svg")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 3 * colPx || r.height < ROW_PX * 1.2) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    const own = rgba(s.backgroundColor);
    const parentBg = el.parentElement ? bgOf(el.parentElement).c : rootBg;
    const differs = own[3] > 0.3 && ratio(over(own, parentBg), parentBg) > 1.04;
    const borders = ["Top", "Right", "Bottom", "Left"].filter((side) => parseFloat(s[`border${side}Width`]) >= 1 && rgba(s[`border${side}Color`])[3] > 0.2).length;
    if (differs || borders >= 3 || (s.backgroundImage && s.backgroundImage !== "none" && r.width * r.height > 0.02 * vw * vh)) boxEls.push(el);
  }
  for (const el of boxEls.slice(0, 200)) {
    const p = pageRect(el);
    frame(p.x0, p.y0, p.x1, p.y1, "");
  }
  for (const m of Array.prototype.slice.call(body.querySelectorAll("img, svg, canvas, video, table, pre, textarea, select, input, button, [role=tab]"), 0, 200)) {
    if (m.ownerSVGElement || !shown(m)) continue;
    const p = pageRect(m);
    if (p.w < 4 || p.h < 4) continue;
    const tag = m.tagName.toLowerCase();
    if (tag === "button" || tag === "input" || tag === "select" || m.getAttribute("role") === "tab") {
      const label = tag === "input" ? `[${m.type}${m.value && m.type !== "range" ? ": " + m.value : ""}]` : `[${snippet(m.textContent || m.getAttribute("aria-label") || tag, 18)}]`;
      write(p.x0, p.y0 + p.h / 2 - ROW_PX / 2, p.x1 + 6 * colPx, label);
    } else {
      let what = `${tag} ${Math.round(p.w)}×${Math.round(p.h)}`;
      if (tag === "svg") {
        const labels = m.querySelectorAll("text").length;
        const shapes = m.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon").length;
        what += ` · ${shapes} shapes, ${labels} labels`;
      }
      frame(p.x0, p.y0, p.x1, p.y1, what);
    }
  }
  for (const t of blocks) {
    if (t.el.closest("button, select, [role=tab]")) continue;
    const big = t.size >= 22;
    const words = (big ? "# " : "") + t.text;
    const first = t.rects[0];
    write(first.x0, first.y0 + Math.min(first.y1 - first.y0, ROW_PX) / 2 - ROW_PX / 2, t.box.x1 + 2 * colPx, words);
  }
  const map = grid.map((row) => row.join("").replace(/\s+$/, ""));
  while (map.length && !map[map.length - 1]) map.pop();

  // The page's own colour variables, for naming colours by what the page calls them.
  const named = [];
  {
    const names = new Set();
    const collect = (rules, depth) => {
      for (const rule of Array.prototype.slice.call(rules || [], 0, 4000)) {
        if (rule.cssRules && depth < 3) collect(rule.cssRules, depth + 1);
        if (!rule.style || !/(^|,)\s*(:root|html)\b/.test(rule.selectorText || "")) continue;
        for (let i = 0; i < rule.style.length; i++) if (rule.style[i].startsWith("--")) names.add(rule.style[i]);
      }
    };
    for (const sheet of Array.prototype.slice.call(document.styleSheets, 0, 40)) {
      try { collect(sheet.cssRules, 0); } catch (e) {}
    }
    const rootStyle = getComputedStyle(de);
    for (const name of names) {
      if (named.length >= 80) break;
      const value = rootStyle.getPropertyValue(name).trim();
      if (!value || value.length > 80 || !CSS.supports("color", value)) continue;
      const c = rgba(value);
      if (c[3] >= 1) named.push([name, c.slice(0, 3)]);
    }
  }

  return {
    vw, vh, sh, screen: VH || vh,
    words: (body.innerText.match(/\S+/g) || []).length,
    lowContrast: lowContrast.slice(0, MAX_LIST), lowContrastCount: lowContrast.length,
    overlaps: overlaps.slice(0, MAX_LIST), overlapCount: overlaps.length,
    covered, crossed, boxClash, spills, dupIds, sideways, fontList, missing: [...missing], fontsOffline, blankCanvases, gaps: gaps.slice(0, 4),
    named, map, mapCut: Math.ceil(sh / ROW_PX) > rows, cols: COLS, rowPx: ROW_PX,
  };
}

/** In the page, the first render only: get ready to press its controls one at a time
 * (interactPress), and name the ones that will be pressed.
 *
 * A control is called dead only when two things hold. First, nothing of the page's listens for it:
 * no handler on it or on anything around it, for a press, a key, a hover or its form (the preview
 * notes every listener as the page adds it, in `__artifactWired`). A control the page has wired is
 * never called dead, since what its handler does may be nothing a look can see: a flag set for a
 * loop to read, a note stopped, a value kept. Second, pressing it sets off nothing the browser
 * does by itself: a part opened, a jump to a place on the page, a form put back or sent.
 *
 * What would leave the page or needs a person's own click (a dialog, a new window, a download, the
 * clipboard, full screen, a file picker) is counted and not carried out. A form the press sends is
 * held back too, and one with no address to go to, which would reload the page, is reported as that. */
export function interactStart({ MAX }) {
  // phase: "press" while a press runs, "after" in the moment that follows it, "idle" otherwise.
  const S = { phase: "idle", sync: 0, later: 0, noHash: false, errors: [], els: [] };
  window.__artifactPress = S;
  // The listeners added here are the preview's, not the page's.
  const heard = window.__artifactWired;
  if (heard) heard.quiet(true);
  // In the moment after a press, only what the browser does by itself is the press's doing (a
  // scroll to a place, a part that opens): a change to the page's elements then may be the page
  // moving by itself, and a control the page has wired is not judged by what follows anyway.
  const follows = new Set(["scroll", "toggle", "hashchange", "focusin", "selectionchange", "submit", "reset"]);
  const hit = (kind) => {
    if (S.phase === "press") S.sync++;
    else if (S.phase === "after" && follows.has(kind) && !(kind === "hashchange" && S.noHash)) S.later++;
  };
  S.changes = (records) => {
    if (S.phase === "press") S.sync += records.length;
  };
  S.watch = new MutationObserver(S.changes);
  S.watch.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  addEventListener("error", (e) => S.errors.push(String(e.message || e)));
  addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    S.errors.push(r && r.message ? `${r.name ? r.name + ": " : ""}${r.message}` : String(r));
  });
  // `instead` stands in for the real thing; without it the real thing still runs.
  const count = (obj, name, instead) => {
    try {
      const real = obj && obj[name];
      if (typeof real !== "function") return;
      obj[name] = function (...args) {
        hit(name);
        return instead ? instead.apply(this, args) : real.apply(this, args);
      };
    } catch (e) {}
  };
  const done = () => Promise.resolve();
  const refuse = () => Promise.reject(new DOMException("Not allowed in the preview", "NotAllowedError"));
  for (const name of ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback"]) count(window, name);
  count(window, "open", () => null);
  count(window, "alert", () => undefined);
  count(window, "confirm", () => false);
  count(window, "prompt", () => null);
  count(window, "print", () => undefined);
  count(Element.prototype, "requestFullscreen", done);
  count(Document.prototype, "exitFullscreen", done);
  count(Document.prototype, "execCommand", () => true);
  count(Element.prototype, "animate");
  count(Element.prototype, "setPointerCapture");
  if (window.Clipboard) {
    count(Clipboard.prototype, "writeText", done);
    count(Clipboard.prototype, "write", done);
    count(Clipboard.prototype, "readText", () => Promise.resolve(""));
  }
  count(Navigator.prototype, "share", done);
  count(Navigator.prototype, "vibrate", () => true);
  if (window.Notification) count(Notification, "requestPermission", () => Promise.resolve("denied"));
  if (window.Geolocation) {
    count(Geolocation.prototype, "getCurrentPosition", () => undefined);
    count(Geolocation.prototype, "watchPosition", () => 0);
  }
  if (window.MediaDevices) {
    count(MediaDevices.prototype, "getUserMedia", refuse);
    count(MediaDevices.prototype, "getDisplayMedia", refuse);
  }
  count(HTMLFormElement.prototype, "submit", () => undefined);
  count(URL, "createObjectURL");
  count(Storage.prototype, "setItem");
  count(Storage.prototype, "removeItem");
  count(Storage.prototype, "clear");
  count(History.prototype, "pushState");
  count(History.prototype, "replaceState");
  count(HTMLMediaElement.prototype, "play", done);
  count(HTMLMediaElement.prototype, "pause");
  // A sound: a context made or woken, a source started.
  for (const name of ["AudioContext", "webkitAudioContext", "Audio"]) {
    try {
      const Real = window[name];
      if (typeof Real === "function") window[name] = new Proxy(Real, { construct: (target, args) => (hit(name), new target(...args)) });
    } catch (e) {}
  }
  if (window.AudioContext) count(AudioContext.prototype, "resume", done);
  if (window.AudioScheduledSourceNode) count(AudioScheduledSourceNode.prototype, "start");
  if (window.speechSynthesis) count(window.speechSynthesis, "speak", () => undefined);
  // Asking to scroll or to move the focus is doing something, even from where there is nowhere to go.
  for (const name of ["scrollTo", "scroll", "scrollBy"]) {
    count(window, name);
    count(Element.prototype, name);
  }
  count(Element.prototype, "scrollIntoView");
  count(HTMLElement.prototype, "focus");
  count(window, "fetch");
  count(XMLHttpRequest.prototype, "send");
  for (const name of ["fillRect", "clearRect", "strokeRect", "fill", "stroke", "fillText", "strokeText", "drawImage", "putImageData"]) count(CanvasRenderingContext2D.prototype, name);
  for (const gl of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (gl) for (const name of ["drawArrays", "drawElements", "clear"]) count(gl.prototype, name);
  }
  // A file handed to the reader, from a link in the page or one made for the purpose.
  const saves = (a) => a.hasAttribute("download") || /^(blob|data):/.test(a.getAttribute("href") || "");
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!saves(this)) return anchorClick.call(this);
    hit("download");
  };
  // A file asked of the reader: the picker is counted, and not opened.
  const inputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type !== "file") return inputClick.call(this);
    hit("picker");
  };
  count(HTMLInputElement.prototype, "showPicker", () => undefined);
  for (const name of ["showOpenFilePicker", "showSaveFilePicker", "showDirectoryPicker"]) count(window, name, refuse);
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      if (a && saves(a)) {
        hit("download");
        e.preventDefault();
      }
      // a label or a button around a file field opens its picker
      const field = e.target instanceof HTMLInputElement ? e.target : null;
      if (field && field.type === "file") {
        hit("picker");
        e.preventDefault();
      }
    },
    true,
  );
  // A form a press sends. One with nowhere to go reloads the page, which is rarely meant; one with
  // an address is the page's business. Either is held back, so the page is there for the next press.
  addEventListener("submit", (e) => {
    const form = e.target;
    if (e.defaultPrevented || !(form instanceof HTMLFormElement)) return;
    const by = e.submitter;
    const method = ((by && by.getAttribute("formmethod")) || form.getAttribute("method") || "").toLowerCase();
    if (method === "dialog") return;
    const action = (by && by.getAttribute("formaction")) ?? form.getAttribute("action");
    // an address that is itself a script is the page's handler for the form
    if (action !== null && /^\s*javascript:/i.test(action)) return hit("submit");
    e.preventDefault();
    if (action === null || /^\s*#?\s*$/.test(action)) S.sent = true;
    else hit("submit");
  });
  document.addEventListener("scroll", () => hit("scroll"), true);
  document.addEventListener("selectionchange", () => hit("selectionchange"));
  document.addEventListener("focusin", () => hit("focusin"));
  document.addEventListener("toggle", () => hit("toggle"), true);
  addEventListener("hashchange", () => hit("hashchange"));
  // a form the browser puts back to its defaults (a button of type reset)
  document.addEventListener("reset", () => hit("reset"), true);

  const name = (el) => {
    const s = el.tagName === "A" ? "link" : el.tagName.toLowerCase();
    const label = (el.getAttribute("aria-label") || el.textContent || el.value || "").replace(/\s+/g, " ").trim().slice(0, 28);
    return label ? `${s} "${label}"` : el.id ? `${s}#${el.id}` : s;
  };
  const controls = Array.prototype.slice
    .call(document.querySelectorAll("button, [role=tab], [role=button], summary, select, input[type=range], input[type=checkbox], input[type=radio], a[href^='#']:not([href='#'])"))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && !el.disabled && !el.closest("[aria-disabled='true'], [inert]");
    });
  const kinds = new Map();
  for (const el of controls) {
    const key = el.tagName + "|" + (el.getAttribute("role") || "") + "|" + (el.className || "");
    const n = kinds.get(key) || 0;
    if (n >= 3) continue; // a few of each kind of control
    kinds.set(key, n + 1);
    S.els.push(el);
    if (S.els.length >= MAX) break;
  }
  if (heard) heard.quiet(false);
  return { total: controls.length, names: S.els.map(name) };
}

/** In the page, after a first press of every control and before a second of those that did nothing:
 * put something in each empty field, since a button may rightly wait for one. */
export function interactFill() {
  for (const el of Array.prototype.slice.call(document.querySelectorAll("input, textarea"), 0, 40)) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (el.disabled || el.readOnly || el.value || !el.getClientRects().length) continue;
    const value = el.tagName === "TEXTAREA" || ["text", "search"].includes(type) ? "Sample" : type === "number" ? "1" : type === "email" ? "sample@example.com" : type === "url" ? "https://example.com" : type === "tel" ? "5550100" : null;
    if (value === null) continue;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    // through the element's own setter, so a page that wraps `value` still hears of it
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

/** In the page, after interactStart: press control `i` once. `skip` when it is no longer there;
 * `why` says more where a control that did nothing has a plain cause. */
export async function interactPress(i) {
  const S = window.__artifactPress;
  const el = S && S.els[i];
  if (!el || !el.isConnected) return { skip: true };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // The choice already made in a set (the open tab, the current page) has nothing left to do.
  const chosen =
    el.getAttribute("aria-selected") === "true" ||
    (el.hasAttribute("aria-current") && el.getAttribute("aria-current") !== "false") ||
    (el.getAttribute("aria-checked") === "true" && el.getAttribute("role") === "radio") ||
    /(^|[\s_-])(active|selected|current|on)(\s|$)/i.test(typeof el.className === "string" ? el.className : "");
  // A link to a place on the page that isn't there goes nowhere, whatever the address bar says.
  let lost = false;
  if (el.matches("a[href^='#']")) {
    let id = el.getAttribute("href").slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (e) {}
    // "#top" is the top of the page whether or not anything is named so
    lost = id.toLowerCase() !== "top" && !document.getElementById(id) && !document.getElementsByName(id).length;
  }
  el.scrollIntoView({ block: "center", behavior: "instant" });
  // Let the scroll that brought it into view pass, so it isn't taken for the press's doing.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  S.changes(S.watch.takeRecords());
  // Is anything of the page's listening for this control? On the control itself any listener
  // counts; around it, one for a press, a key, a hover or a form; on the page as a whole (the
  // body, the document, the window), one for a press, since a page that hears keys everywhere
  // says nothing about this control. A part with a shadow tree keeps its listeners out of sight.
  const press = ["click", "dblclick", "auxclick", "contextmenu", "pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend"];
  const near = press.concat(["keydown", "keyup", "keypress", "dragstart", "pointerenter", "pointerover", "pointermove", "pointerleave", "mouseenter", "mouseover", "mousemove", "mouseleave", "mouseout", "focus", "focusin", "blur", "focusout", "toggle", "command", "submit", "reset", "change", "input"]);
  const heard = window.__artifactWired;
  const listens = (n, types, any) => {
    const set = heard ? heard(n) : null;
    if (set && (any ? set.size > 0 : types.some((t) => set.has(t)))) return true;
    return types.some((t) => typeof n["on" + t] === "function");
  };
  // (A control inside a link goes where the link goes in most browsers, wrong as the nesting is.)
  let wired = !!el.shadowRoot || listens(el, near, true) || (el.form ? listens(el.form, near) : false) || (!el.matches("a") && !!el.closest("a[href]"));
  for (let n = el.parentNode || el.host; n && !wired; n = n.parentNode || n.host) {
    const whole = n === document || n === document.documentElement || n === document.body;
    // a part with a shadow tree around the control may listen from inside it (a slotted button)
    wired = listens(n, whole ? press : near) || !!n.shadowRoot;
  }
  wired = wired || listens(window, press);
  // A press where the control is lands on whatever its own box lays over it (a file field over a
  // button, a cover over a card): the control is then not the thing that is pressed, and is not
  // judged. What covers the whole page (an open dialog, a shade) says nothing about the control.
  const box = el.getBoundingClientRect();
  const over = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  const group = el.parentElement && el.parentElement !== document.body ? el.parentElement : null;
  if (over && group && over !== el && over !== group && !el.contains(over) && group.contains(over)) wired = true;
  // A link to a place the page has goes there, whether or not the address or the scroll changes.
  if (el.matches("a[href^='#']") && !lost) wired = true;
  // a link within the page is also heard by a page that watches the address (a router)
  if (el.matches("a[href^='#']")) wired = wired || listens(window, ["hashchange", "popstate"]);
  // What the fields hold, read before and after: a form the browser puts back changes no element.
  const held = () => Array.prototype.slice.call(document.querySelectorAll("input, select, textarea"), 0, 300).map((f) => (f.type === "checkbox" || f.type === "radio" ? String(f.checked) : String(f.value))).join("\u0001");
  const fields = held();
  S.sync = 0;
  S.later = 0;
  S.noHash = lost;
  S.sent = false;
  const errs = S.errors.length;
  const mouse = (type) => new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
  const pointer = (type) => (window.PointerEvent ? new PointerEvent(type, { bubbles: true, cancelable: true, view: window, pointerId: 1, isPrimary: true, pointerType: "mouse" }) : mouse(type));
  S.phase = "press";
  try {
    if (el.matches("input[type=range]")) {
      const max = el.max !== "" ? Number(el.max) : 100;
      const min = el.min !== "" ? Number(el.min) : 0;
      el.value = String(Number(el.value) === max ? min : max);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el.matches("select")) {
      if (el.options.length > 1) {
        el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else {
      // as a finger or a mouse would: down, up, then the click, for a page that listens to any of them
      el.dispatchEvent(pointer("pointerdown"));
      el.dispatchEvent(mouse("mousedown"));
      el.dispatchEvent(pointer("pointerup"));
      el.dispatchEvent(mouse("mouseup"));
      if (typeof el.click === "function") el.click();
      else el.dispatchEvent(mouse("click"));
    }
  } catch (e) {
    S.errors.push(e && e.message ? `${e.name ? e.name + ": " : ""}${e.message}` : String(e));
  }
  // what the press changed while it ran
  S.changes(S.watch.takeRecords());
  S.phase = "after";
  await sleep(250);
  // A press may take a moment to show (a short wait, a transition's end).
  if (!S.sync && !S.later && S.errors.length === errs) await sleep(350);
  S.changes(S.watch.takeRecords());
  S.phase = "idle";
  // What a browser allows only after a person's own click is the preview's limit, not the page's fault.
  const said = S.errors.slice(errs);
  const thrown = said.filter((m) => !/NotAllowedError|SecurityError|user (activation|gesture)|permission/i.test(m));
  // A checkbox, a radio, a select and a slider show their own new state, which is a change, and a
  // handle that says it is for dragging (by its cursor) is not judged by a press.
  const own = el.matches("input, select") || /^(move|grab|grabbing|all-scroll|[a-z]+-resize)$/.test(getComputedStyle(el).cursor);
  let changed = wired || own || chosen || said.length > thrown.length || S.sync > 0 || S.later > 0 || held() !== fields;
  // A press also puts the focus on the control, and a page may answer that in its style sheet
  // alone (a menu shown by :focus-within, a tip by :focus). Seen by trying it: what shows around
  // the control, with the focus on it and without.
  if (!changed && !thrown.length && typeof el.focus === "function") {
    const scope = (el.parentElement && el.parentElement.parentElement) || el.parentElement || el;
    const shows = () =>
      Array.prototype.slice.call(scope.querySelectorAll("*"), 0, 300).map((n) => { const st = getComputedStyle(n); return st.display + st.visibility + st.opacity + n.getClientRects().length; }).join("|") +
      ["::before", "::after"].map((pseudo) => { const st = getComputedStyle(el, pseudo); return st.display + st.content + st.visibility + st.opacity; }).join("|");
    const without = shows();
    el.focus({ preventScroll: true });
    await sleep(60);
    if (shows() !== without) changed = true;
    el.blur();
  }
  return { changed, error: thrown.length ? thrown.join(" | ").slice(0, 160) : null, why: !changed && lost ? "nothing on the page has the id it points to" : null, sent: S.sent };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The capture's colours by area, in a blank page of the same browser, each named after the page's
 * own colour variable when one is that colour (`named`, from describeProbe). */
export async function colorStats(browser, png, named) {
  const ctx = await browser.newContext({ viewport: { width: 64, height: 64 } });
  try {
    const p = await ctx.newPage();
    const counts = await p.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const w = Math.min(img.width, 640), h = Math.round((img.height * w) / img.width);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const bins = {};
      for (let i = 0; i < d.length; i += 4) {
        const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
        bins[k] = (bins[k] || 0) + 1;
      }
      return { bins, total: w * h };
    }, png.toString("base64"));
    // Merge bins whose colours are close, then name each by the nearest variable.
    const list = Object.entries(counts.bins)
      .map(([k, n]) => ({ c: [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4], n }))
      .sort((a, b) => b.n - a.n);
    const groups = [];
    for (const b of list) {
      const g = groups.find((x) => dist(x.c, b.c) < 22);
      if (g) g.n += b.n;
      else groups.push({ c: b.c, n: b.n });
    }
    const hexOf = (c) => "#" + c.map((x) => Math.min(255, Math.round(x)).toString(16).padStart(2, "0")).join("").toUpperCase();
    return groups
      .sort((a, b) => b.n - a.n)
      .filter((g) => g.n / counts.total >= 0.01)
      .slice(0, 7)
      .map((g) => {
        let best = null;
        for (const [name, value] of named || []) {
          const d = dist(value, g.c);
          if (!best || d < best.d) best = { name, d, value };
        }
        // A bin is 8 levels wide, so an unnamed colour is given to the nearest bin and said to be about that.
        const share = `${Math.round((100 * g.n) / counts.total)}%`;
        return best && best.d < 8 ? `${share} ${best.name} ${hexOf(best.value)}` : `${share} about ${hexOf(g.c)}`;
      });
  } finally {
    await ctx.close().catch(() => {});
  }
}

// A ratio that falls just short is never printed as the figure it falls short of.
const shown = (r, need) => (Number(r.toFixed(1)) >= need ? (Math.floor(r * 100) / 100).toFixed(2) : r.toFixed(1));

/** The faults one render's look found, as [kind, line] pairs for the report. */
export function lookFindings(d) {
  const out = [];
  if (d.lowContrastCount) {
    const more = d.lowContrastCount - d.lowContrast.length;
    out.push(["contrast", `${d.lowContrastCount} ${d.lowContrastCount === 1 ? "text is" : "texts are"} too faint to read against the background: ` +
      d.lowContrast.map((c) => `"${c.text}" ${c.fg} on ${c.bg}, ${shown(c.r, c.need)}:1 where ${Math.round(c.size)}px text needs ${c.need}:1 (${c.where})`).join("; ") + (more > 0 ? `; and ${more} more` : "")]);
  }
  for (const line of d.overlaps) out.push(["text_overlap", `text overlaps text: ${line}`]);
  if (d.overlapCount > d.overlaps.length) out.push(["text_overlap", `${d.overlapCount - d.overlaps.length} more texts overlap`]);
  for (const line of d.covered) out.push(["text_covered", `text lies under another element: ${line}`]);
  for (const line of d.crossed) out.push(["drawing", `${line} (fine where meant, as a strike-through)`]);
  for (const line of d.boxClash) out.push(["drawing", `${line} (fine where meant, as in a Venn diagram)`]);
  for (const line of d.spills) out.push(["drawing", line]);
  if (d.dupIds.length) out.push(["ids", `ids used more than once, where getElementById and a label's \`for\` find only the first: ${d.dupIds.join(", ")}`]);
  if (!d.fontsOffline && d.missing.length) out.push(["fonts", `fonts that did not load, so a fallback face shows: ${d.missing.join(", ")}`]);
  if (d.blankCanvases.length) out.push(["canvas", `canvases with nothing drawn on them: ${d.blankCanvases.join(", ")} (fine for one the reader draws on or starts; a chart should show by now)`]);
  return out;
}

/** What pressing the controls found, as [kind, line] pairs. */
export function controlFindings(interact) {
  if (!interact) return [];
  const out = [];
  const sent = interact.tried.filter((t) => t.sent && !t.error);
  const dead = interact.tried.filter((t) => !t.changed && !t.error && !t.sent);
  const broke = interact.tried.filter((t) => t.error);
  if (dead.length) out.push(["controls", `pressed, these controls did nothing a reader would notice, and nothing on the page listens for them: ${dead.map((t) => (t.why ? `${t.what} (${t.why})` : t.what)).join(", ")} (fine for one with nothing to do yet; otherwise wire it up or take it out)`]);
  if (sent.length) out.push(["controls", `pressed, ${sent.map((t) => t.what).join(", ")} ${sent.length === 1 ? "sends" : "send"} a form that has nowhere to go, which reloads the page and loses what was typed (handle the form's submit and call preventDefault() there; a button in a form that only acts on the page needs type="button")`]);
  if (broke.length) out.push(["controls", `pressed once, these controls threw: ${broke.map((t) => `${t.what} (${t.error})`).join(", ")}`]);
  return out;
}

/** One render described in words, for a reader with no capture to look at; `full` adds the fonts,
 * the controls and the block map. */
export function lookWords(label, d, colors, interact, full) {
  const out = [];
  const screens = (d.sh / (d.screen || d.vh)).toFixed(1);
  out.push(`--- ${label}: ${d.vw}px wide, page ${d.sh}px tall (${screens} screens), ${d.words} words${colors && colors.length ? `; colours by area: ${colors.join(", ")}` : ""}`);
  if (d.fontsOffline) out.push("  web fonts couldn't be fetched on this machine, so this render shows fallback faces; the published page loads them for a viewer who is online, so don't change the fonts for this");
  if (!full) return out;
  out.push(`  fonts by share of text: ${d.fontList.join("; ")}`);
  if (d.sideways.length) out.push(`  boxes that scroll sideways: ${d.sideways.join("; ")}`);
  if (d.gaps.length) out.push(`  no text, picture or control for most of a screen at: ${d.gaps.join(", ")}`);
  if (interact) out.push(interact.total ? `  controls: ${interact.total} found, ${interact.tried.length} pressed once` : "  controls: none");
  if (d.map.length) {
    out.push(`  block map (1 column is about ${Math.round(d.vw / (d.cols || 1))}px, 1 row ${d.rowPx}px; ┌┐ a box with a fill or border of its own, [ ] a control, # large text, … a label shortened to fit the map, not on the page${d.mapCut ? "; it stops before the end of the page" : ""}):`);
    for (const row of d.map) out.push(`  |${row}`);
  }
  return out;
}
