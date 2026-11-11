/* Sketchbook runtime: the brush-ink engine, the drawings, and the behaviour behind the sk-* components (reveal, count-up, charts, code, tabs, segmented, ticks, dialogs, toasts, tooltips). window.Sketchbook exposes it. No network, no libraries. */
(function () {
// ink.js: tiny brush-ink engine. Strokes are centerlines turned into filled, tapering shapes (the way Anthropic's art is built);
// "mono" mode keeps today's Sketchbook: even stroke + wobble filter.
const INK = (() => {
  const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const f = (n) => Math.round(n * 10) / 10;
  function catmull(pts, seg) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let j = 0; j < seg; j++) {
        const t = j / seg, t2 = t * t, t3 = t2 * t;
        const c = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push([c(0), c(1)]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function densify(pts, step = 12) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let j = 1; j <= n; j++) out.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
    }
    return out;
  }
  const interp = (arr, x) => { const i = Math.min(arr.length - 2, Math.floor(x)); const t = x - i; const s = t * t * (3 - 2 * t); return arr[i] * (1 - s) + arr[i + 1] * s; };
  const smooth = (t) => t * t * (3 - 2 * t);
  // brush: filled outline around a centerline. w = full width; seed changes the hand (boil = new seed).
  function brush(pts0, o) { return pen(pts0, o).parts[0].d; }
  // pen: the same brush stroke with what it takes to draw it on: each part's filled shape (d) and the centreline that uncovers it (c),
  // with where the part starts and ends along the whole stroke (from, to: 0 to 1). cuts split a stroke that closes or crosses over
  // itself, so the part being drawn never uncovers ink that the hand hasn't reached yet.
  function pen(pts0, { sharp = false, w = 6, seed = 1, wobble = 0.8, taper = 0.22, end = 0.42, vary = 0.35 } = {}, cuts) {
    const r = rng(seed);
    const pts = sharp ? densify(pts0, 10) : pts0;
    const P = catmull(pts, sharp ? 4 : 12);
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = L[L.length - 1] || 1;
    const k = Math.max(3, Math.round(total / 40));
    const wc = Array.from({ length: k + 1 }, () => 1 - vary / 2 + r() * vary);
    const ox = Array.from({ length: k + 1 }, () => (r() - 0.5) * 2 * wobble);
    const oy = Array.from({ length: k + 1 }, () => (r() - 0.5) * 2 * wobble);
    const left = [], right = [], mid = [];
    for (let i = 0; i < P.length; i++) {
      const t = L[i] / total;
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      const prof = (end + (1 - end) * smooth(Math.min(1, t / taper))) * (end + (1 - end) * smooth(Math.min(1, (1 - t) / taper)));
      const hw = (w / 2) * Math.sqrt(prof) * interp(wc, t * k);
      const cx = P[i][0] + interp(ox, t * k), cy = P[i][1] + interp(oy, t * k);
      const rough = (r() - 0.5) * 0.35;
      left.push([cx + nx * (hw + rough), cy + ny * (hw + rough)]);
      right.push([cx - nx * (hw - rough), cy - ny * (hw - rough)]);
      mid.push([cx, cy]);
    }
    const n = P.length - 1;
    const half = (i) => Math.hypot(left[i][0] - right[i][0], left[i][1] - right[i][1]) / 2;
    // the outline of the stroke from sample a to sample b: a round end where the stroke really ends, a flat one at a cut
    const shape = (a, b) => {
      let d = `M${f(left[a][0])} ${f(left[a][1])}`;
      for (let i = a + 1; i <= b; i++) d += `L${f(left[i][0])} ${f(left[i][1])}`;
      d += b === n ? `A${f(half(n))} ${f(half(n))} 0 0 0 ${f(right[n][0])} ${f(right[n][1])}` : `L${f(right[b][0])} ${f(right[b][1])}`;
      for (let i = b - 1; i >= a; i--) d += `L${f(right[i][0])} ${f(right[i][1])}`;
      return d + (a === 0 ? `A${f(half(0))} ${f(half(0))} 0 0 0 ${f(left[0][0])} ${f(left[0][1])}Z` : 'Z');
    };
    const at = [0].concat((cuts || []).map((c) => { let i = 1; while (i < n - 1 && L[i] / total < c) i++; return i; }), [n]);
    const parts = [];
    for (let j = 0; j < at.length - 1; j++) {
      const a = at[j], b = at[j + 1]; if (b <= a) continue;
      // each part runs one sample into the next, so no hairline shows at the cut
      const b1 = Math.min(n, b + 1);
      parts.push({ d: shape(a, b1), c: 'M' + mid.slice(a, b1 + 1).map((q) => `${f(q[0])} ${f(q[1])}`).join('L'), from: L[a] / total, to: L[b1] / total });
    }
    const xs = left.concat(right).map((q) => q[0]), ys = left.concat(right).map((q) => q[1]);
    return { parts, w, length: total, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  }
  function line(pts, { seed = 1, wobble = 0.6 } = {}) {
    const r = rng(seed);
    const P = catmull(pts.map(([x, y]) => [x + (r() - 0.5) * wobble, y + (r() - 0.5) * wobble]), 8);
    return 'M' + P.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
  }
  // cut paper: straight scissor segments around a smooth outline
  function cut(pts, { seed = 1, step = 9, jag = 1.4 } = {}) {
    const r = rng(seed);
    const P = catmull(densify([...pts, pts[0]], 8), 4);
    const out = []; let acc = 0;
    for (let i = 0; i < P.length; i++) {
      if (i > 0) acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      if (i === 0 || acc >= step * (0.6 + r() * 0.8)) { out.push([P[i][0] + (r() - 0.5) * jag, P[i][1] + (r() - 0.5) * jag]); acc = 0; }
    }
    return 'M' + out.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
  }
  function soft(pts0, { seed = 1, wobble = 1 } = {}) {
    const r = rng(seed);
    const pts = densify([...pts0, pts0[0]], 14).slice(0, -1);
    // jitter each point once, then run the spline round the loop with real neighbours on both sides of the seam, so it has no kink or sliver
    const J = pts.map(([x, y]) => [x + (r() - 0.5) * wobble, y + (r() - 0.5) * wobble]);
    const P = catmull([J[J.length - 1], ...J, J[0], J[1]], 8).slice(8, -9);
    return 'M' + P.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
  }
  const circle = (cx, cy, rr, n = 14) => Array.from({ length: n }, (_, i) => [cx + rr * Math.cos((i / n) * Math.PI * 2), cy + rr * Math.sin((i / n) * Math.PI * 2)]);
  const wave = (x0, x1, y, amp = 3.5, per = 9) => { const p = []; for (let x = x0; x <= x1; x += per / 4) p.push([x, y + amp * Math.sin(((x - x0) / per) * Math.PI * 2)]); return p; };
  const loops = (x0, x1, y, h = 7, per = 8) => { const p = []; for (let x = x0; x <= x1; x += per) { p.push([x, y], [x + per * 0.55, y - h], [x + per * 0.15, y - h * 0.9], [x + per * 0.45, y]); } return p; };
  return { densify, catmull, brush, pen, line, cut, soft, circle, wave, loops, rng };
})();
// art.js: the drawings, as data. Each drawing returns parts:
//  {s:[[x,y]...], w}            an ink stroke (centerline, width multiplier)
//  {fill:[[x,y]...], role}      a flat shape: role clay | paper | putty | tint
//  {dot:[x,y,r], role}          a node dot
const ART = (() => {
  const { circle, wave, loops } = INK;
  const rect = (x0, y0, x1, y1, r = 4) => [[x0 + r, y0], [x1 - r, y0 + 0.5], [x1, y0 + r], [x1 + 0.5, y1 - r], [x1 - r, y1], [x0 + r, y1 + 0.5], [x0, y1 - r], [x0 - 0.5, y0 + r], [x0 + r, y0]];
  // Hero: a hand holding up a clipboard of checked rows (grading). 240x200
  function clipboard() {
    return [
      { fill: [[70, 42], [172, 40], [174, 182], [72, 184]], role: 'paper' },
      { fill: [[64, 52], [110, 18], [176, 22], [222, 70], [214, 140], [178, 190], [104, 194], [58, 160], [46, 104]], role: 'clay', back: true },
      { s: rect(70, 40, 173, 183, 6), w: 1, sharp: true },
      { fill: [[102, 30], [140, 30], [143, 47], [99, 47]], role: 'ink-soft' },
      { s: [[100, 47], [102, 31], [140, 30], [143, 46]], w: 0.85, sharp: true },
      { s: [[113, 30], [115, 22], [128, 21], [130, 30]], w: 0.7 },
      { s: [[84, 74], [90, 81], [101, 64]], w: 0.85 },
      { s: wave(110, 158, 74, 3.2, 10), w: 0.6 },
      { s: [[84, 106], [90, 113], [101, 96]], w: 0.85 },
      { s: wave(110, 150, 106, 3.2, 10), w: 0.6 },
      { s: circle(92, 138, 7, 10).concat([circle(92, 138, 7, 10)[0]]), w: 0.6 },
      { s: wave(110, 140, 138, 3.2, 10), w: 0.6 },
      // hand from the lower left, fingers curled over the board's left edge
      { s: [[8, 200], [26, 176], [44, 160], [60, 152], [66, 146]], w: 1 },
      { s: [[34, 200], [46, 188], [58, 182], [72, 180]], w: 1 },
      { s: [[66, 146], [78, 141], [84, 146], [78, 152], [70, 153]], w: 0.85 },
      { s: [[70, 153], [82, 151], [87, 157], [80, 163], [70, 163]], w: 0.85 },
      { s: [[70, 163], [81, 162], [85, 168], [78, 173], [70, 172]], w: 0.85 },
      { s: [[52, 160], [56, 140], [62, 128], [70, 124], [74, 130], [70, 140]], w: 0.9 },
    ];
  }
  // Ball-and-stick node: the agent. 100x100
  function agent() {
    const c = [50, 52], ends = [[22, 24], [82, 20], [86, 70], [30, 86], [12, 58]];
    const parts = ends.map(([x, y]) => ({ s: [c, [(c[0] + x) / 2 + 2, (c[1] + y) / 2 - 1], [x, y]], w: 0.75 }));
    ends.forEach(([x, y], i) => parts.push({ dot: [x, y, i % 2 ? 6.5 : 7.5], role: 'ink' }));
    parts.push({ dot: [c[0], c[1], 11], role: 'clay', top: true });
    return parts;
  }
  // A task card with a folded corner. 100x100
  function task() {
    return [
      { fill: [[22, 14], [64, 14], [80, 30], [80, 88], [22, 88]], role: 'putty' },
      { s: [[64, 14], [22, 14], [22, 88], [80, 88], [80, 30], [64, 14], [64, 30], [80, 30]], w: 0.85, sharp: true },
      { s: wave(32, 66, 46, 2.4, 8), w: 0.55 },
      { s: wave(32, 60, 60, 2.4, 8), w: 0.55 },
      { s: wave(32, 52, 74, 2.4, 8), w: 0.55 },
    ];
  }
  // Transcript: a long unrolled scroll. 100x100
  function transcript() {
    return [
      { fill: [[26, 16], [76, 16], [76, 84], [26, 84]], role: 'putty' },
      { s: [[20, 16], [76, 16], [82, 22], [76, 28]], w: 0.8 },
      { s: [[26, 16], [26, 84], [74, 84], [80, 90], [74, 96], [20, 96], [20, 84], [26, 84]], w: 0.85, sharp: true },
      { s: [[76, 28], [76, 84]], w: 0.85, sharp: true },
      { s: loops(34, 66, 40, 6, 8), w: 0.5 },
      { s: loops(34, 58, 56, 6, 8), w: 0.5 },
      { s: loops(34, 62, 72, 6, 8), w: 0.5 },
    ];
  }
  // Grader: a magnifying glass. 100x100
  function grader() {
    const ring = circle(42, 42, 24, 16);
    return [
      { fill: circle(42, 42, 22, 16), role: 'tint' },
      { s: ring.concat([ring[0], ring[1]]), w: 0.95 },
      { s: [[60, 60], [70, 70], [86, 86]], w: 1.6 },
      { s: [[30, 40], [36, 47], [52, 30]], w: 0.7 },
    ];
  }
  // Search: the same glass with nothing found in it yet, for an empty search. 100x100
  function search() {
    const ring = circle(42, 42, 24, 16);
    return [
      { fill: circle(42, 42, 22, 16), role: 'tint' },
      { s: ring.concat([ring[0], ring[1]]), w: 0.95 },
      { s: [[60, 60], [70, 70], [86, 86]], w: 1.6 },
      { s: [[29, 37], [33, 31], [40, 27]], w: 0.55 },
    ];
  }
  // Score: a sprout in a pot (results you can grow). 100x100
  function score() {
    return [
      { fill: [[30, 62], [70, 62], [64, 92], [36, 92]], role: 'clay' },
      { s: [[28, 62], [72, 62], [65, 92], [35, 92], [28, 62]], w: 0.85, sharp: true },
      { s: [[50, 62], [50, 44], [48, 30]], w: 0.8 },
      { s: [[50, 46], [36, 40], [30, 28], [42, 30], [50, 44]], w: 0.7 },
      { s: [[49, 34], [60, 22], [74, 20], [68, 32], [50, 36]], w: 0.7 },
    ];
  }
  // Stack of index cards (20-50 tasks). 140x100
  function cards() {
    return [
      { fill: [[18, 30], [102, 22], [108, 80], [24, 88]], role: 'putty' },
      { s: [[18, 30], [102, 22], [108, 80], [24, 88], [18, 30]], w: 0.8, sharp: true },
      { fill: [[30, 22], [114, 18], [118, 76], [34, 80]], role: 'paper' },
      { s: [[30, 22], [114, 18], [118, 76], [34, 80], [30, 22]], w: 0.8, sharp: true },
      { s: [[30, 34], [114, 30]], w: 0.4, role: 'clay' },
      { s: wave(42, 96, 46, 2.2, 8), w: 0.5 },
      { s: wave(42, 88, 58, 2.2, 8), w: 0.5 },
      { s: wave(42, 76, 68, 2.2, 8), w: 0.5 },
    ];
  }
  // Pointing hand, small (for the caveat). 100x100
  function point() {
    return [
      { s: [[6, 80], [24, 70], [36, 62], [58, 50], [84, 40], [90, 44], [84, 50], [60, 58]], w: 0.9 },
      { s: [[60, 58], [66, 62], [62, 68], [52, 68]], w: 0.8 },
      { s: [[52, 68], [58, 72], [54, 78], [44, 76]], w: 0.8 },
      { s: [[44, 76], [48, 82], [42, 86], [26, 88], [10, 96]], w: 0.9 },
    ];
  }
  // The clipboard without the hand: hands aren't characters here.
  function board() { return clipboard().slice(0, -6).filter((p) => !p.back); }
  function boardBlob() { return clipboard().slice(0, -6); }
  // Added for the system (Nov 8): generic spots in the same hand.
  function bulb() {
    const arc = Array.from({ length: 13 }, (_, i) => { const a = Math.PI * 0.75 + (i * Math.PI * 1.5) / 12; return [50 + 24 * Math.cos(a), 42 + 24 * Math.sin(a)]; });
    return [
      { fill: circle(50, 42, 22, 14), role: 'tint' },
      { s: arc, w: 0.9 },
      { s: [[33, 59], [39, 72], [61, 72], [67, 59]], w: 0.85, sharp: true },
      { s: [[41, 80], [59, 80]], w: 0.7 },
      { s: [[44, 88], [56, 88]], w: 0.7 },
      { s: [[42, 50], [46, 40], [50, 50], [54, 40], [58, 50]], w: 0.45, role: 'clay' },
      { s: [[50, 4], [50, 10]], w: 0.55 }, { s: [[16, 18], [21, 22]], w: 0.55 }, { s: [[84, 18], [79, 22]], w: 0.55 },
    ];
  }
  function chat() {
    return [
      { fill: [[18, 20], [82, 20], [82, 66], [44, 66], [28, 82], [30, 66], [18, 66]], role: 'putty' },
      { s: [[18, 20], [82, 20], [82, 66], [44, 66], [28, 82], [30, 66], [18, 66], [18, 20]], w: 0.85, sharp: true },
      { s: wave(28, 70, 36, 2.2, 8), w: 0.5 },
      { s: wave(28, 58, 50, 2.2, 8), w: 0.5 },
    ];
  }
  function folder() {
    return [
      { fill: [[14, 28], [40, 28], [46, 36], [86, 36], [86, 80], [14, 80]], role: 'putty' },
      { s: [[14, 28], [40, 28], [46, 36], [86, 36], [86, 80], [14, 80], [14, 28]], w: 0.85, sharp: true },
      { s: [[14, 46], [86, 46]], w: 0.6, sharp: true },
    ];
  }
  function check() {
    return [
      { fill: circle(50, 50, 32, 16), role: 'putty' },
      { s: [[32, 52], [45, 66], [70, 34]], w: 1.25 },
    ];
  }
  function cross() {
    return [
      { fill: circle(50, 50, 32, 16), role: 'putty' },
      { s: [[36, 36], [64, 64]], w: 1.15, role: 'clay' },
      { s: [[64, 36], [36, 64]], w: 1.15, role: 'clay' },
    ];
  }

  // v3 (Nov 8): a wider set of spots, same hand: ink plus one putty fill, clay only as a small accent.
  const ell = (cx, cy, rx, ry, n = 16, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
  const closed = (pts) => pts.concat([pts[0], pts[1]]);
  function chart() {
    return [
      { fill: [[30, 56], [42, 56], [42, 82], [30, 82]], role: 'putty' },
      { fill: [[50, 40], [62, 40], [62, 82], [50, 82]], role: 'putty' },
      { fill: [[70, 26], [82, 26], [82, 82], [70, 82]], role: 'clay' },
      { s: [[16, 12], [16, 84], [90, 84]], w: 0.85, sharp: true },
      { s: [[30, 82], [30, 56], [42, 56], [42, 82]], w: 0.6, sharp: true },
      { s: [[50, 82], [50, 40], [62, 40], [62, 82]], w: 0.6, sharp: true },
      { s: [[70, 82], [70, 26], [82, 26], [82, 82]], w: 0.6, sharp: true },
    ];
  }
  function calendar() {
    return [
      { fill: [[16, 22], [84, 22], [84, 86], [16, 86]], role: 'putty' },
      { s: rect(16, 22, 84, 86, 7), w: 0.85, sharp: true },
      { s: [[16, 38], [84, 38]], w: 0.7, sharp: true },
      { s: [[34, 12], [34, 28]], w: 0.75 }, { s: [[66, 12], [66, 28]], w: 0.75 },
      { dot: [30, 52, 2.6], role: 'ink' }, { dot: [44, 52, 2.6], role: 'ink' }, { dot: [58, 52, 2.6], role: 'ink' }, { dot: [72, 52, 2.6], role: 'ink' },
      { dot: [30, 70, 2.6], role: 'ink' }, { dot: [44, 70, 2.6], role: 'ink' }, { dot: [72, 70, 2.6], role: 'ink' },
      { s: closed(ell(58, 70, 8, 7, 12)), w: 0.55, role: 'clay' },
    ];
  }
  function clock() {
    return [
      { fill: circle(50, 50, 33, 16), role: 'putty' },
      { s: closed(circle(50, 50, 35, 16)), w: 0.9 },
      { s: [[50, 50], [50, 28]], w: 0.85 }, { s: [[50, 50], [66, 58]], w: 0.85 },
      { s: [[50, 19], [50, 23]], w: 0.5 }, { s: [[81, 50], [77, 50]], w: 0.5 }, { s: [[50, 81], [50, 77]], w: 0.5 }, { s: [[19, 50], [23, 50]], w: 0.5 },
      { dot: [50, 50, 4], role: 'clay', top: true },
    ];
  }
  function pin() {
    const head = ell(50, 38, 22, 22, 14, Math.PI * 0.8, Math.PI * 2.2);
    const shape = head.concat([[50, 84]]);
    return [
      { s: closed(ell(50, 88, 20, 5, 12)), w: 0.45 },
      { fill: shape, role: 'clay' },
      { s: shape.concat([head[0]]), w: 0.9 },
      { fill: circle(50, 38, 8, 12), role: 'card' },
      { s: closed(circle(50, 38, 8, 12)), w: 0.6 },
    ];
  }
  function lock() {
    return [
      { s: [[32, 46], [32, 32], [36, 20], [50, 14], [64, 20], [68, 32], [68, 46]], w: 0.9 },
      { fill: [[22, 46], [78, 46], [78, 88], [22, 88]], role: 'putty' },
      { s: rect(22, 46, 78, 88, 6), w: 0.9, sharp: true },
      { dot: [50, 62, 5], role: 'ink' },
      { s: [[50, 64], [50, 76]], w: 0.7 },
    ];
  }
  function code() {
    return [
      { fill: [[10, 18], [90, 18], [90, 84], [10, 84]], role: 'putty' },
      { s: rect(10, 18, 90, 84, 7), w: 0.85, sharp: true },
      { s: [[10, 32], [90, 32]], w: 0.6, sharp: true },
      { dot: [19, 25, 2.2], role: 'ink' }, { dot: [27, 25, 2.2], role: 'ink' },
      { s: [[38, 46], [26, 58], [38, 70]], w: 0.85 },
      { s: [[62, 46], [74, 58], [62, 70]], w: 0.85 },
      { s: [[55, 42], [45, 74]], w: 0.7, role: 'clay' },
    ];
  }
  function gear() {
    const pts = []; const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, da = Math.PI / n;
      [[a - da * 0.95, 26], [a - da * 0.45, 34], [a + da * 0.45, 34], [a + da * 0.95, 26]].forEach(([b, r]) => pts.push([50 + r * Math.cos(b), 50 + r * Math.sin(b)]));
    }
    return [
      { fill: pts, role: 'putty' },
      { s: pts.concat([pts[0], pts[1]]), w: 0.75, sharp: true },
      { fill: circle(50, 50, 10, 12), role: 'card' },
      { s: closed(circle(50, 50, 10, 12)), w: 0.75 },
    ];
  }
  function book() {
    return [
      { fill: [[50, 26], [30, 20], [12, 22], [12, 78], [30, 76], [50, 82]], role: 'putty' },
      { fill: [[50, 26], [70, 20], [88, 22], [88, 78], [70, 76], [50, 82]], role: 'card' },
      { s: [[50, 26], [30, 20], [12, 22], [12, 78], [30, 76], [50, 82], [70, 76], [88, 78], [88, 22], [70, 20], [50, 26]], w: 0.85 },
      { s: [[50, 26], [50, 82]], w: 0.7 },
      { s: wave(58, 80, 38, 1.8, 7), w: 0.45 }, { s: wave(58, 76, 50, 1.8, 7), w: 0.45 }, { s: wave(58, 80, 62, 1.8, 7), w: 0.45 },
    ];
  }
  function flag() {
    const top = [[26, 16], [44, 10], [62, 18], [84, 12]], bot = [[84, 52], [62, 58], [44, 50], [26, 56]];
    return [
      { fill: top.concat(bot), role: 'clay' },
      { s: top.concat(bot, [top[0]]), w: 0.75 },
      { s: [[24, 12], [24, 92]], w: 1 },
      { s: [[12, 92], [38, 92]], w: 0.7 },
    ];
  }
  function mail() {
    return [
      { fill: [[12, 24], [88, 24], [88, 78], [12, 78]], role: 'putty' },
      { s: rect(12, 24, 88, 78, 6), w: 0.85, sharp: true },
      { s: [[14, 28], [50, 56], [86, 28]], w: 0.8 },
      { dot: [50, 56, 3.4], role: 'clay', top: true },
    ];
  }
  function laptop() {
    return [
      { fill: [[22, 18], [78, 18], [78, 64], [22, 64]], role: 'putty' },
      { s: rect(22, 18, 78, 64, 5), w: 0.85, sharp: true },
      { s: [[8, 76], [16, 66], [84, 66], [92, 76], [8, 76]], w: 0.85, sharp: true },
      { s: wave(32, 60, 34, 2, 7), w: 0.5 }, { s: wave(32, 52, 46, 2, 7), w: 0.5 },
      { s: [[42, 72], [58, 72]], w: 0.45 },
    ];
  }
  function database() {
    const top = closed(ell(50, 22, 30, 9, 14));
    return [
      { fill: ell(50, 22, 30, 9, 14, Math.PI, Math.PI * 2).concat(ell(50, 78, 30, 9, 14, 0, Math.PI)), role: 'putty' },
      { s: top, w: 0.8 },
      { s: [[20, 22], [20, 78]], w: 0.8 }, { s: [[80, 22], [80, 78]], w: 0.8 },
      { s: ell(50, 50, 30, 9, 12, 0, Math.PI), w: 0.6 },
      { s: ell(50, 78, 30, 9, 12, 0, Math.PI), w: 0.8 },
      { dot: [66, 62, 2.8], role: 'clay', top: true },
    ];
  }
  function cloud() {
    const pts = [[22, 72], [12, 62], [16, 48], [30, 44], [34, 30], [50, 24], [64, 30], [70, 40], [84, 42], [92, 56], [86, 70], [74, 72]];
    return [
      { fill: ell(76, 30, 11, 11, 12), role: 'clay', back: true },
      { fill: pts, role: 'putty' },
      { s: closed(pts), w: 0.85 },
    ];
  }
  function shield() {
    const pts = [[50, 10], [70, 18], [84, 20], [82, 50], [72, 72], [50, 90], [28, 72], [18, 50], [16, 20], [30, 18]];
    return [
      { fill: pts, role: 'putty' },
      { s: closed(pts), w: 0.85 },
      { s: [[36, 50], [46, 60], [66, 38]], w: 0.95, role: 'clay' },
    ];
  }
  function scale() {
    return [
      { s: [[50, 14], [50, 84]], w: 0.9 },
      { s: [[32, 86], [68, 86]], w: 0.85 },
      { s: [[16, 26], [50, 22], [84, 18]], w: 0.85 },
      { s: [[16, 26], [8, 54]], w: 0.4 }, { s: [[16, 26], [26, 54]], w: 0.4 },
      { s: [[84, 18], [76, 46]], w: 0.4 }, { s: [[84, 18], [94, 46]], w: 0.4 },
      { fill: ell(17, 54, 11, 7, 10, 0, Math.PI), role: 'putty' },
      { s: [[5, 54]].concat(ell(17, 54, 12, 8, 10, 0, Math.PI)), w: 0.7 },
      { fill: ell(85, 46, 11, 7, 10, 0, Math.PI), role: 'clay' },
      { s: [[73, 46]].concat(ell(85, 46, 12, 8, 10, 0, Math.PI)), w: 0.7 },
      { dot: [50, 18, 4.5], role: 'ink' },
    ];
  }
  function box() {
    return [
      { fill: [[18, 36], [62, 36], [62, 86], [18, 86]], role: 'putty' },
      { fill: [[62, 36], [82, 22], [82, 72], [62, 86]], role: 'putty' },
      { s: [[18, 36], [38, 22], [82, 22], [62, 36], [18, 36], [18, 86], [62, 86], [82, 72], [82, 22]], w: 0.8, sharp: true },
      { s: [[62, 36], [62, 86]], w: 0.7, sharp: true },
      { s: [[28, 30], [72, 30]], w: 0.55, role: 'clay' },
      { s: [[40, 36], [40, 52]], w: 0.55, role: 'clay' },
    ];
  }
  function target() {
    return [
      { fill: circle(46, 54, 32, 16), role: 'putty' },
      { s: closed(circle(46, 54, 33, 16)), w: 0.8 },
      { s: closed(circle(46, 54, 20, 14)), w: 0.7 },
      { dot: [46, 54, 7.5], role: 'clay', top: true },
      { s: [[50, 50], [70, 30], [88, 12]], w: 0.8 },
      { s: [[80, 10], [88, 12], [90, 20]], w: 0.55 },
    ];
  }
  function pencil() {
    const body = [[22, 70], [66, 26], [80, 40], [36, 84]];
    return [
      { fill: body, role: 'putty' },
      { fill: [[66, 26], [74, 18], [88, 32], [80, 40]], role: 'clay' },
      { s: body.concat([body[0]]), w: 0.8, sharp: true },
      { s: [[66, 26], [74, 18], [88, 32], [80, 40]], w: 0.8, sharp: true },
      { s: [[22, 70], [12, 90], [36, 84]], w: 0.8, sharp: true },
      { dot: [15, 87, 3], role: 'ink' },
    ];
  }
  function photo() {
    return [
      { fill: [[12, 20], [88, 20], [88, 80], [12, 80]], role: 'putty' },
      { s: rect(12, 20, 88, 80, 6), w: 0.85, sharp: true },
      { s: [[16, 74], [38, 48], [52, 62], [62, 54], [84, 76]], w: 0.8 },
      { dot: [66, 36, 7], role: 'clay', top: true },
    ];
  }

  // v3.1 (Nov 8): drawings for trips, food, invitations, work and measures. Same hand: ink, one putty fill, one small clay accent.
  function gauge() {
    const arc = ell(50, 62, 36, 36, 18, Math.PI, Math.PI * 2);
    return [
      { fill: arc.concat([[50, 62]]), role: 'putty' },
      { s: arc, w: 0.9 },
      { s: [[14, 62], [86, 62]], w: 0.7, sharp: true },
      { s: ell(50, 62, 27, 27, 6, Math.PI * 1.62, Math.PI * 1.96), w: 0.75, role: 'clay' },
      { s: [[20, 50], [25, 52]], w: 0.45 }, { s: [[32, 34], [35, 38]], w: 0.45 }, { s: [[50, 27], [50, 32]], w: 0.45 }, { s: [[68, 34], [65, 38]], w: 0.45 },
      { s: [[50, 62], [72, 40]], w: 0.85 },
      { dot: [50, 62, 4.5], role: 'ink' },
    ];
  }
  function blossom() {
    // each flower is one lobed outline (five petals), not five circles, so it stays open at hero size
    const flower = (cx, cy, r, rot) => Array.from({ length: 41 }, (_, i) => { const a = rot + (i / 40) * Math.PI * 2, k = Math.pow(Math.abs(Math.cos(2.5 * a)), 0.7); return [cx + Math.cos(a) * r * (0.45 + 0.55 * k), cy + Math.sin(a) * r * (0.45 + 0.55 * k)]; });
    const parts = [
      { s: [[6, 92], [24, 78], [42, 66], [60, 50], [78, 34], [94, 24]], w: 0.95 },
      { s: [[42, 66], [38, 50], [42, 38]], w: 0.6 },
      { s: [[62, 48], [74, 56], [82, 66]], w: 0.55 },
    ];
    [[42, 26, 15, 'putty', 0.2], [82, 20, 12, 'clay', 0.9], [84, 70, 11, 'putty', 0.5], [22, 66, 9, 'putty', 1.3]].forEach(([x, y, r, role, rot]) => {
      const f = flower(x, y, r, rot);
      parts.push({ fill: f, role });
      parts.push({ s: f, w: 0.42 });
      parts.push({ dot: [x, y, 2.2], role: 'ink', top: true });
    });
    return parts;
  }
  function train() {
    return [
      { fill: [[18, 24], [82, 24], [84, 74], [16, 74]], role: 'putty' },
      { s: [[24, 24], [76, 23], [82, 30], [84, 72], [80, 76], [20, 76], [16, 72], [18, 30], [24, 24]], w: 0.9, sharp: true },
      { fill: [[26, 34], [74, 34], [74, 52], [26, 52]], role: 'card' },
      { s: rect(26, 34, 74, 52, 4), w: 0.65, sharp: true },
      { s: [[50, 34], [50, 52]], w: 0.55 },
      { dot: [30, 64, 4], role: 'clay', top: true }, { dot: [70, 64, 4], role: 'clay', top: true },
      { s: [[28, 78], [20, 90]], w: 0.7 }, { s: [[72, 78], [80, 90]], w: 0.7 },
      { s: [[10, 92], [90, 92]], w: 0.6, sharp: true },
      { s: [[40, 16], [60, 16]], w: 0.6 },
    ];
  }
  function suitcase() {
    return [
      { s: [[38, 26], [38, 16], [62, 16], [62, 26]], w: 0.8, sharp: true },
      { fill: [[14, 26], [86, 26], [86, 82], [14, 82]], role: 'putty' },
      { s: rect(14, 26, 86, 82, 7), w: 0.9, sharp: true },
      { s: [[32, 28], [32, 80]], w: 0.6 }, { s: [[68, 28], [68, 80]], w: 0.6 },
      { fill: [[44, 46], [58, 44], [60, 58], [46, 60]], role: 'clay' },
      { s: [[24, 86], [24, 90]], w: 0.6 }, { s: [[76, 86], [76, 90]], w: 0.6 },
    ];
  }
  function house() {
    return [
      { fill: [[22, 48], [78, 48], [78, 86], [22, 86]], role: 'putty' },
      { s: [[12, 52], [50, 16], [88, 52]], w: 0.95 },
      { s: [[22, 46], [22, 86], [78, 86], [78, 46]], w: 0.85, sharp: true },
      { fill: [[42, 62], [58, 62], [58, 86], [42, 86]], role: 'clay' },
      { s: [[42, 86], [42, 62], [58, 62], [58, 86]], w: 0.65, sharp: true },
      { s: [[66, 28], [66, 16], [74, 16], [74, 36]], w: 0.7, sharp: true },
    ];
  }
  function bowl() {
    const rim = ell(50, 50, 38, 9, 16);
    return [
      { fill: ell(50, 50, 38, 38, 16, 0, Math.PI), role: 'putty' },
      { s: ell(50, 50, 38, 38, 16, 0, Math.PI), w: 0.9 },
      { s: closed(rim), w: 0.7 },
      { s: [[38, 86], [62, 86]], w: 0.7 },
      { s: [[36, 38], [34, 28], [38, 20]], w: 0.5 }, { s: [[50, 36], [48, 24], [52, 14]], w: 0.5 }, { s: [[64, 38], [62, 28], [66, 20]], w: 0.5 },
      { fill: ell(62, 48, 8, 4, 10), role: 'clay', top: true },
      { s: [[72, 30], [94, 8]], w: 0.55 }, { s: [[78, 34], [98, 14]], w: 0.55 },
    ];
  }
  function map() {
    const P = [[10, 22], [36, 14], [64, 22], [90, 14], [90, 78], [64, 86], [36, 78], [10, 86]];
    return [
      { fill: P, role: 'putty' },
      { s: P.concat([P[0]]), w: 0.85, sharp: true },
      { s: [[36, 14], [36, 78]], w: 0.55 }, { s: [[64, 22], [64, 86]], w: 0.55 },
      { s: [[18, 68], [24, 60]], w: 0.5 }, { s: [[30, 55], [38, 57]], w: 0.5 }, { s: [[44, 57], [50, 49]], w: 0.5 }, { s: [[55, 44], [63, 45]], w: 0.5 },
      { fill: ell(76, 38, 7, 7, 10, Math.PI * 0.8, Math.PI * 2.2).concat([[76, 54]]), role: 'clay' },
      { s: ell(76, 38, 7, 7, 10, Math.PI * 0.8, Math.PI * 2.2).concat([[76, 54], [70.4, 42.1]]), w: 0.6 },
    ];
  }
  function ticket() {
    const P = [[10, 30], [90, 30], [90, 44], [86, 50], [90, 56], [90, 70], [10, 70], [10, 56], [14, 50], [10, 44]];
    return [
      { fill: P, role: 'putty' },
      { s: P.concat([P[0]]), w: 0.85, sharp: true },
      { s: [[66, 33], [66, 38]], w: 0.5 }, { s: [[66, 46], [66, 54]], w: 0.5 }, { s: [[66, 62], [66, 67]], w: 0.5 },
      { s: wave(22, 56, 44, 2.4, 7), w: 0.5 }, { s: [[22, 56], [44, 56]], w: 0.55 },
      { dot: [78, 50, 4.5], role: 'clay', top: true },
    ];
  }
  function cup() {
    return [
      { fill: [[20, 40], [72, 40], [67, 84], [25, 84]], role: 'putty' },
      { s: [[20, 40], [72, 40], [67, 84], [25, 84], [20, 40]], w: 0.9, sharp: true },
      { s: [[70, 50], [82, 50], [86, 60], [80, 70], [68, 70]], w: 0.8 },
      { s: [[36, 32], [34, 22], [38, 12]], w: 0.5 }, { s: [[52, 32], [50, 22], [54, 12]], w: 0.5 },
      { s: [[16, 90], [76, 90]], w: 0.6 },
      { s: [[30, 52], [62, 52]], w: 0.55, role: 'clay' },
    ];
  }
  function mountain() {
    return [
      { fill: [[8, 84], [40, 28], [56, 52], [66, 40], [92, 84]], role: 'putty' },
      { s: [[8, 84], [40, 28], [56, 52], [66, 40], [92, 84]], w: 0.9 },
      { s: [[32, 42], [40, 48], [46, 40]], w: 0.55 },
      { s: [[4, 86], [96, 86]], w: 0.6 },
      { dot: [78, 22, 7], role: 'clay', top: true },
    ];
  }
  function gift() {
    return [
      { fill: [[18, 44], [82, 44], [82, 86], [18, 86]], role: 'putty' },
      { s: rect(18, 44, 82, 86, 5), w: 0.85, sharp: true },
      { s: [[12, 32], [88, 32], [88, 44], [12, 44], [12, 32]], w: 0.8, sharp: true },
      { s: [[50, 32], [50, 86]], w: 0.75, role: 'clay' },
      { s: [[50, 32], [38, 18], [28, 22], [34, 30], [50, 32]], w: 0.65 },
      { s: [[50, 32], [62, 18], [72, 22], [66, 30], [50, 32]], w: 0.65 },
    ];
  }
  function briefcase() {
    return [
      { s: [[38, 32], [38, 22], [62, 22], [62, 32]], w: 0.8, sharp: true },
      { fill: [[12, 32], [88, 32], [88, 82], [12, 82]], role: 'putty' },
      { s: rect(12, 32, 88, 82, 7), w: 0.9, sharp: true },
      { s: [[12, 52], [88, 52]], w: 0.6 },
      { fill: [[44, 46], [56, 46], [56, 58], [44, 58]], role: 'clay', top: true },
      { s: [[44, 46], [56, 46], [56, 58], [44, 58], [44, 46]], w: 0.55, sharp: true },
    ];
  }

  // ---- round 2: everyday things ----
  // A skillet seen from the side and a little above: rim, a dark wall, a long handle, three eggs in a row. 100x100
  function pan() {
    const rimLow = ell(40, 46, 36, 14, 12, 0, Math.PI), base = ell(40, 57, 33, 12, 12, Math.PI, 0);
    // a fried egg is a lumpy white with a big yolk off its centre and no outline: a ring with a dot in it reads as an eye
    const egg = (x, y) => {
      const white = [[x - 8, y + 0.5], [x - 6.5, y - 3.2], [x - 2, y - 4.6], [x + 3, y - 4], [x + 7.5, y - 2.6], [x + 8.8, y + 0.8], [x + 6, y + 3.8], [x + 1, y + 4.6], [x - 4.5, y + 4]];
      return [{ fill: white, role: 'paper' }, { dot: [x + 1.5, y - 0.6, 3.4], role: 'yolk' }];
    };
    return [
      { fill: rimLow.concat(base), role: 'ink' },
      { s: [[75, 44], [87, 39], [97, 34.5]], w: 1.05 },
      { fill: ell(40, 46, 33, 11.5, 18), role: 'accent' },
      { s: closed(ell(40, 46, 36, 14, 18)), w: 0.9 },
      ...egg(22, 48), ...egg(41, 42.5), ...egg(59, 48.5),
      { s: [[32, 26], [29, 18], [33, 10]], w: 0.42 }, { s: [[48, 24], [45, 16], [49, 8]], w: 0.42 },
    ];
  }
  function phone() {
    return [
      { fill: [[30, 8], [70, 8], [70, 92], [30, 92]], role: 'putty' },
      { s: rect(30, 8, 70, 92, 9), w: 0.9, sharp: true },
      { fill: [[36, 20], [64, 20], [64, 76], [36, 76]], role: 'paper' },
      { s: [[44, 14], [56, 14]], w: 0.5 },
      { s: [[41, 32], [58, 32]], w: 0.45 }, { s: [[41, 42], [54, 42]], w: 0.45 },
      { fill: [[44, 52], [60, 52], [60, 64], [48, 64], [44, 68]], role: 'clay', top: true },
      { dot: [50, 84, 2.8], role: 'ink' },
    ];
  }
  function plane() {
    const body = [[8, 56], [16, 50], [74, 47], [88, 49], [94, 53], [88, 57], [16, 60]];
    return [
      { fill: [[18, 50], [10, 32], [20, 32], [32, 49]], role: 'clay' },
      { s: [[18, 50], [10, 32], [20, 32], [32, 49]], w: 0.7, sharp: true },
      { fill: body, role: 'putty' },
      { s: closed(body), w: 0.85 },
      { fill: [[42, 56], [58, 56], [46, 80], [36, 80]], role: 'putty' },
      { s: [[42, 57], [36, 80], [46, 80], [58, 57]], w: 0.7, sharp: true },
      { dot: [56, 52, 1.6], role: 'ink' }, { dot: [63, 52, 1.6], role: 'ink' }, { dot: [70, 52, 1.6], role: 'ink' },
      { s: [[80, 50], [86, 51]], w: 0.5 },
    ];
  }
  function car() {
    const body = [[8, 68], [10, 54], [26, 50], [36, 34], [66, 34], [78, 50], [90, 54], [92, 68]];
    return [
      { fill: body, role: 'putty' },
      { s: closed(body), w: 0.85 },
      { fill: [[40, 38], [50, 38], [50, 50], [32, 50]], role: 'paper' }, { fill: [[55, 38], [64, 38], [72, 50], [55, 50]], role: 'paper' },
      { s: [[32, 50], [40, 38], [64, 38], [72, 50]], w: 0.55 }, { s: [[52, 37], [52, 50]], w: 0.5 },
      { fill: ell(28, 69, 9, 9, 12), role: 'paper' }, { s: closed(ell(28, 69, 9, 9, 12)), w: 0.8 },
      { fill: ell(72, 69, 9, 9, 12), role: 'paper' }, { s: closed(ell(72, 69, 9, 9, 12)), w: 0.8 },
      { dot: [88, 59, 2.6], role: 'clay', top: true },
      { s: [[4, 80], [96, 80]], w: 0.55 },
    ];
  }
  function moon() {
    // a crescent: the part of one circle that another, offset circle doesn't cover
    const A = [48, 52, 34], B = [63, 41, 28], inA = (p) => Math.hypot(p[0] - A[0], p[1] - A[1]) <= A[2] + 0.01, inB = (p) => Math.hypot(p[0] - B[0], p[1] - B[1]) < B[2];
    const outer = ell(A[0], A[1], A[2], A[2], 72).filter((p) => !inB(p)), inner = ell(B[0], B[1], B[2], B[2], 72).filter(inA);
    // walk the outer arc from one tip to the other, then back along the inner arc
    let k = 0; for (let i = 1; i < outer.length; i++) if (Math.hypot(outer[i][0] - outer[i - 1][0], outer[i][1] - outer[i - 1][1]) > 6) k = i;
    const arc = outer.slice(k).concat(outer.slice(0, k)), tipA = arc[0], tipB = arc[arc.length - 1];
    let inn = inner.slice(); const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    let j = 0; for (let i = 1; i < inn.length; i++) if (near(inn[i], inn[i - 1]) > 6) j = i; inn = inn.slice(j).concat(inn.slice(0, j));
    if (near(inn[0], tipB) > near(inn[inn.length - 1], tipB)) inn.reverse();
    const shape = arc.filter((_, i) => i % 3 === 0).concat([tipB]).concat(inn.filter((_, i) => i % 3 === 0)).concat([tipA]);
    return [
      { fill: shape, role: 'putty' },
      { s: shape.concat([shape[0]]), w: 0.85 },
      { dot: [80, 70, 3.2], role: 'clay', top: true },
      { s: [[74, 18], [74, 28]], w: 0.45 }, { s: [[69, 23], [79, 23]], w: 0.45 },
    ];
  }
  function heart() {
    const P = [[50, 84], [30, 66], [16, 50], [14, 34], [22, 22], [36, 18], [46, 24], [50, 32], [54, 24], [64, 18], [78, 22], [86, 34], [84, 50], [70, 66]];
    return [
      { fill: P, role: 'clay' },
      { s: closed(P), w: 0.85 },
      { s: [[26, 36], [30, 28], [36, 26]], w: 0.45 },
    ];
  }
  function sun() {
    const rays = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2, c = Math.cos(a), sn = Math.sin(a); rays.push({ s: [[50 + c * 28, 50 + sn * 28], [50 + c * 40, 50 + sn * 40]], w: 0.7 }); }
    return [
      { fill: ell(50, 50, 19, 19, 14), role: 'clay' },
      { s: closed(ell(50, 50, 19, 19, 14)), w: 0.85 },
    ].concat(rays);
  }
  function leaf() {
    const P = [[16, 84], [18, 56], [32, 34], [56, 20], [84, 14], [80, 42], [66, 64], [42, 78]];
    return [
      { fill: P, role: 'putty' },
      { s: closed(P), w: 0.85 },
      { s: [[10, 92], [22, 76], [44, 52], [70, 28]], w: 0.6 },
      { s: [[34, 62], [30, 48]], w: 0.4 }, { s: [[48, 48], [46, 34]], w: 0.4 }, { s: [[36, 60], [52, 62]], w: 0.4 }, { s: [[50, 46], [66, 46]], w: 0.4 },
    ];
  }
  function coin() {
    return [
      { fill: ell(48, 48, 31, 31, 18), role: 'putty' }, { s: closed(ell(48, 48, 31, 31, 18)), w: 0.9 },
      { s: ell(54, 54, 31, 31, 12, -0.1 * Math.PI, 0.6 * Math.PI), w: 0.7 },
      { s: closed(ell(48, 48, 21, 21, 14)), w: 0.45 },
      { dot: [48, 48, 6.5], role: 'clay', top: true },
      { s: [[28, 38], [32, 30], [39, 25]], w: 0.4 },
    ];
  }
  function cake() {
    const parts = [
      { fill: [[18, 50], [82, 50], [82, 82], [18, 82]], role: 'putty' },
      { s: [[18, 50], [18, 82], [82, 82], [82, 50]], w: 0.85, sharp: true },
      { s: closed(ell(50, 50, 32, 6, 16)), w: 0.75 },
      { s: [[18, 56], [24, 62], [30, 57], [38, 64], [46, 57], [54, 63], [62, 57], [70, 63], [76, 57], [82, 60]], w: 0.55 },
      { s: [[8, 88], [92, 88]], w: 0.6 },
    ];
    [36, 50, 64].forEach((x, i) => {
      parts.push({ s: [[x, 46], [x, 30]], w: 0.75 });
      parts.push({ fill: [[x, 15], [x + 3.6, 22], [x, 27], [x - 3.6, 22]], role: 'clay', top: true });
    });
    return parts;
  }
  function glass() {
    return [
      { fill: [[36, 26], [64, 26], [63, 38], [56, 47], [50, 49], [44, 47], [37, 38]], role: 'clay' },
      { s: [[34, 10], [36, 36], [44, 47], [50, 49], [56, 47], [64, 36], [66, 10]], w: 0.85 },
      { s: [[36, 26], [64, 26]], w: 0.5 },
      { s: [[50, 49], [50, 82]], w: 0.8 },
      { s: closed(ell(50, 84, 16, 4, 12)), w: 0.7 },
      { s: [[60, 14], [61, 20]], w: 0.4 },
    ];
  }
  function bed() {
    return [
      { s: [[10, 34], [10, 84]], w: 0.9 }, { s: [[90, 56], [90, 84]], w: 0.9 },
      { fill: [[10, 56], [90, 56], [90, 72], [10, 72]], role: 'putty' },
      { s: [[10, 56], [90, 56], [90, 72], [10, 72]], w: 0.8, sharp: true },
      { fill: [[14, 44], [34, 42], [38, 54], [14, 56]], role: 'paper' }, { s: closed([[14, 44], [34, 42], [38, 54], [14, 56]]), w: 0.6 },
      { fill: [[40, 50], [88, 50], [90, 62], [40, 64]], role: 'clay' }, { s: [[40, 64], [40, 50], [88, 50]], w: 0.6 },
      { s: [[52, 30], [58, 30], [52, 38], [58, 38]], w: 0.45, sharp: true }, { s: [[64, 18], [72, 18], [64, 28], [72, 28]], w: 0.45, sharp: true },
    ];
  }
  function computer() {
    const top = [[12, 46], [58, 34], [88, 46], [42, 60]];
    return [
      { fill: top.concat([[42, 70], [12, 56]]).concat([[12, 46]]), role: 'putty' },
      { fill: [[42, 60], [88, 46], [88, 56], [42, 70]], role: 'paper' },
      { s: closed(top), w: 0.85 },
      { s: [[12, 46], [12, 56], [42, 70], [88, 56], [88, 46]], w: 0.85 },
      { s: [[42, 60], [42, 70]], w: 0.7 },
      { dot: [78, 55, 2.4], role: 'clay', top: true },
      { s: [[8, 76], [46, 86], [94, 72]], w: 0.45 },
    ];
  }

  return { search, pan, phone, plane, car, moon, heart, sun, leaf, coin, cake, glass, bed, computer, gauge, blossom, train, suitcase, house, bowl, map, ticket, cup, mountain, gift, briefcase, chart, calendar, clock, pin, lock, code, gear, book, flag, mail, laptop, database, cloud, shield, scale, box, target, pencil, photo, board, boardBlob, clipboard, agent, task, transcript, grader, score, cards, point, bulb, chat, folder, check, cross };
})();
// render.js: turn ART parts into SVG markup.
// st = {mode:'brush'|'mono'|'thin', base, seed, roles:{clay,paper,putty,tint,ink,clayInk}, reveal:'uid'}
// With st.reveal, each brush stroke is masked by its own centreline so it can draw itself on, in stroke order.
function roundPoly(pts, r) {
  // soften a few-cornered fill so its corners sit inside the rounded strokes drawn over it
  if (pts.length > 6) return pts;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
    const la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ra = Math.min(r, la / 3), rc = Math.min(r, lc / 3);
    out.push([b[0] + ((a[0] - b[0]) * ra) / la, b[1] + ((a[1] - b[1]) * ra) / la], [b[0] + ((c[0] - b[0]) * rc) / lc, b[1] + ((c[1] - b[1]) * rc) / lc]);
  }
  return out;
}
function drawArt(name, st) {
  const parts = ART[name]();
  const seed = st.seed || 1, R = st.roles || {};
  // 'yolk' is clay that stays clay even on the clay ground, for a small thing sitting on a paper fill
  const fillOf = (role) => R[role] || (role === 'yolk' ? 'var(--clay)' : `var(--${role === 'ink-soft' ? 'ink' : role})`);
  const inkCol = R.ink || 'var(--ink)';
  const off = st.off || [0, 0];
  const strokes = parts.filter((p) => p.s && st.mode !== 'mono').length;
  const step = strokes > 1 ? Math.min(150, 720 / (strokes - 1)) : 0;
  let back = '', fills = '', ink = '', masks = '', k = 0, fillN = 0;
  // drawing on, each fill waits for the strokes that outline it: a fill's time is when the last stroke lying along its edge has drawn
  const lines = [];
  if (st.reveal && st.mode !== 'mono') {
    let n = 0, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    parts.forEach((p) => { (p.s || p.fill || []).forEach((q) => { lo = [Math.min(lo[0], q[0]), Math.min(lo[1], q[1])]; hi = [Math.max(hi[0], q[0]), Math.max(hi[1], q[1])]; }); if (p.s) lines.push({ s: p.sharp ? INK.densify(p.s, 10) : p.s, k: n++ }); });
    lines.near = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * 0.045;
  }
  const segD = (q, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L)) : 0; return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy); };
  const fillAt = (poly) => {
    if (!lines.length) return null;
    const vs = poly.length > 24 ? poly.filter((_, j) => j % Math.ceil(poly.length / 24) === 0) : poly;
    let end = -1;
    lines.forEach((l) => {
      const hits = vs.filter((v) => l.s.some((a, j) => j && segD(v, l.s[j - 1], a) <= lines.near)).length;
      if (hits >= Math.max(1, Math.ceil(vs.length * 0.2))) end = Math.max(end, step * l.k + 260);
    });
    return end < 0 ? null : end;
  };
  parts.forEach((p, i) => {
    const sd = seed * 31 + i * 7;
    if (p.fill) {
      if (p.back && !st.blob) return;
      const d = st.cut ? INK.cut(p.fill, { seed: sd, step: 10, jag: 1.6 }) : INK.soft(roundPoly(p.fill, st.base * 0.5), { seed: sd, wobble: st.mode === "mono" ? 0.8 : 0.9 });
      const g = st.grain && (p.role === 'clay') ? ' filter="url(#grain)"' : '';
      const tr = st.mode === 'mono' ? '' : ` transform="translate(${off[0]} ${off[1]})"`;
      const own = st.reveal ? fillAt(p.fill) : null;
      const fi = st.reveal ? (own != null ? ` style="--fd:${Math.round(own)}ms;--fi:${(fillN++ % 3) * 20}ms"` : ` style="--fi:${(fillN++) * 40}ms"`) : '';
      const el = `<path class="sk-fl" d="${d}" fill="${fillOf(p.role)}"${g}${tr}${fi}/>`;
      if (p.back) back += el; else fills += el;
    } else if (p.dot) {
      const [x, y, r] = p.dot;
      const rr = st.mode === 'thin' ? r * 0.8 : r;
      const d = INK.soft(INK.circle(x, y, rr, 12), { seed: sd, wobble: 0.9 });
      const dotFill = p.role === 'clay' && R.clayInk ? R.clayInk : p.role === 'ink' ? inkCol : fillOf(p.role);
      const at = st.reveal ? ` class="sk-dt" style="--sd:${Math.round(step * Math.max(0, k - 1)) + 120}ms"` : '';
      if (st.mode === 'mono') ink += `<path d="${d}" fill="${fillOf(p.role === 'ink' ? 'paper' : p.role)}" stroke="var(--ink)" stroke-width="${st.base * 0.8}"/>`;
      else if (p.role === 'ink' || p.top) ink += `<path${at} d="${d}" fill="${dotFill}"/>`;
      else fills += `<path class="sk-fl" d="${d}" fill="${dotFill}"${st.grain ? ' filter="url(#grain)"' : ''}/>`;
    } else if (p.s) {
      const color = p.role === 'clay' ? (R.clayInk || 'var(--clay)') : inkCol;
      if (st.mode === 'mono') { ink += `<path d="${INK.line(p.sharp ? INK.densify(p.s, 10) : p.s, { seed: sd })}" fill="none" stroke="${color}" stroke-width="${st.base * Math.min(1.2, Math.max(0.6, p.w))}" stroke-linecap="round" stroke-linejoin="round"/>`; return; }
      const w = st.base * p.w;
      const d = INK.brush(p.s, { sharp: !!p.sharp, w, seed: sd, wobble: st.mode === 'thin' ? 0.35 : 0.7, vary: st.mode === 'thin' ? 0.2 : 0.45 });
      if (st.reveal) {
        const id = st.reveal + '-' + i, cl = INK.catmull(p.sharp ? INK.densify(p.s, 10) : p.s, 6);
        masks += `<mask id="${id}" maskUnits="userSpaceOnUse"><path class="sk-sm" pathLength="1" style="--sd:${Math.round(step * k)}ms" d="M${cl.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')}" fill="none" stroke="#fff" stroke-width="${(w * 1.8 + 3).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;
        ink += `<path d="${d}" fill="${color}" mask="url(#${id})"/>`;
        k++;
      } else ink += `<path d="${d}" fill="${color}"/>`;
    }
  });
  const inkFilter = st.mode === 'mono' ? ' filter="url(#wobble)"' : '';
  // drawing on: each fill grows from its own centre once most of the outline is down, never fading in over the clay
  const fd = st.reveal ? ` style="--fd:${Math.round(Math.max(120, step * Math.max(0, strokes - 1) * 0.6))}ms"` : '';
  return (masks ? `<defs>${masks}</defs>` : '') + `<g class="fills"${fd}>${back}</g><g class="fills"${fd}>${fills}</g><g class="ink"${inkFilter}>${ink}</g>`;
}
  // ---- Sketchbook runtime: brush drawings, flows, notes, quote marks, boil and entrance ----
  var VB = { board: '48 14 156 176', boardBlob: '30 10 200 192', clipboard: '0 0 240 200', agent: '0 0 100 100', task: '0 0 100 100', transcript: '0 0 100 106', grader: '0 0 100 100', score: '0 0 100 100', cards: '0 0 140 100', point: '0 0 100 100', bulb: '0 0 100 100', chat: '0 0 100 100', folder: '0 0 100 100', check: '0 0 100 100', cross: '0 0 100 100' };
  // Friendly names: what each drawing is, not what the first page used it for.
  var NAMES = { board: 'board', clipboard: 'board', network: 'agent', agent: 'agent', doc: 'task', task: 'task', scroll: 'transcript', transcript: 'transcript', lens: 'grader', grader: 'grader', sprout: 'score', score: 'score', cards: 'cards', bulb: 'bulb', chat: 'chat', folder: 'folder', check: 'check', cross: 'cross' };
  ['search', 'pan', 'phone', 'plane', 'car', 'moon', 'heart', 'sun', 'leaf', 'coin', 'cake', 'glass', 'bed', 'computer', 'gauge', 'blossom', 'train', 'suitcase', 'house', 'bowl', 'map', 'ticket', 'cup', 'mountain', 'gift', 'briefcase', 'chart', 'calendar', 'clock', 'pin', 'lock', 'code', 'gear', 'book', 'flag', 'mail', 'laptop', 'database', 'cloud', 'shield', 'scale', 'box', 'target', 'pencil', 'photo'].forEach(function (k) { NAMES[k] = k; });
  function vb(k) { return VB[k] || '0 0 100 100'; }
  function vbW(k) { return +vb(k).split(' ')[2]; }
  var d = document, NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  var uidN = 0;

  // fills by context: 'putty' on paper, 'card' inside a white card, 'ground' on a clay blob or tile,
  // 'flow' inside a flow card (no clay, so the flow's one clay thing is its loop)
  function roles(fill) {
    if (fill === 'ground') return { paper: 'var(--fill-on-clay)', card: 'var(--fill-on-clay)', putty: 'var(--fill-on-clay)', tint: 'var(--fill-on-clay)', clay: 'var(--fill-on-clay)', accent: '#a94f2c', ink: 'var(--ink-on-clay)', clayInk: 'var(--ink-on-clay)' };
    if (fill === 'tile') return { paper: 'var(--fill-on-clay)', card: 'var(--fill-on-clay)', putty: 'var(--fill-on-clay)', tint: 'var(--fill-on-clay)', ink: 'var(--ink-on-clay)' };
    if (fill === 'card') return { paper: 'var(--card)', putty: 'var(--card)', tint: 'var(--card)' };
    if (fill === 'clay') return { paper: 'var(--card)', putty: 'var(--clay)', tint: 'var(--clay)' };
    if (fill === 'flow') return { paper: 'var(--card)', putty: 'var(--putty)', tint: 'var(--putty)', clay: 'var(--putty)', clayInk: 'var(--ink)' };
    return { paper: 'var(--card)', putty: 'var(--putty)', tint: 'var(--putty)' };
  }
  // the brush keeps its weight in real pixels: a small drawing gets a relatively fatter brush
  var WEIGHT = { cards: 1.18 };
  function baseFor(key, o) {
    var b = (o.size === 'hero' ? 7 : 5) * (WEIGHT[key] || 1);
    if (o.px) b = Math.max(b, 2.8 / (o.px / vbW(key)));
    return b;
  }
  // draw('lens', {size:'spot'|'hero', fill:'putty'|'card'|'ground', seed, px, reveal}) -> inner SVG markup
  function inner(name, o) {
    o = o || {};
    var key = NAMES[name] || name;
    return drawArt(key, { mode: 'brush', base: baseFor(key, o), seed: o.seed || 1, roles: roles(o.fill), reveal: o.reveal });
  }
  function draw(name, o) {
    var key = NAMES[name] || name;
    if (!ART[key]) return '';
    return '<svg class="sk-ink" viewBox="' + vb(key) + '" role="img" aria-label="' + esc(o && o.label || name) + '">' + inner(name, o) + '</svg>';
  }
  // a heading never breaks a hyphenated word at its hyphen ("opening-/hours"): the word moves to the next line whole
  function keepWords(root) {
    root.querySelectorAll('h1, h2, h3, h4, .sk-title, .sk-h2, .sk-h3, legend, .sk-statement').forEach(function (h) {
      if (h.dataset.skKept) return; h.dataset.skKept = '1';
      var tw = d.createTreeWalker(h, NodeFilter.SHOW_TEXT), t, todo = [];
      while ((t = tw.nextNode())) if (/\S-\S/.test(t.nodeValue)) todo.push(t);
      todo.forEach(function (t) {
        var frag = d.createDocumentFragment();
        t.nodeValue.split(/(\S+-\S+)/).forEach(function (part, i) {
          if (!part) return;
          if (i % 2 && part.length <= 20) { var w = d.createElement('span'); w.className = 'sk-nw'; w.textContent = part; frag.appendChild(w); }
          else frag.appendChild(d.createTextNode(part));
        });
        t.parentNode.replaceChild(frag, t);
      });
    });
  }
  // grounds: a soft clay blob whose shape comes from the page (its title), or a square tile
  function blob(seed, wob) {
    var r = INK.rng(seed || 6), n = 7 + Math.floor(r() * 4), pts = [], a0 = r() * Math.PI * 2;
    for (var i = 0; i < n; i++) { var a = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35, rad = 41 + r() * 8; pts.push([50 + rad * Math.cos(a), 50 + rad * Math.sin(a) * 0.96]); }
    return '<svg class="sk-blob" viewBox="0 0 100 100" aria-hidden="true"><path d="' + INK.soft(pts, { seed: wob || seed || 6, wobble: 2 + r() * 2.5 }) + '"/></svg>';
  }
  function tile(seed, wob) {
    var r = INK.rng(seed || 4), c = 8 + r() * 4, j = function () { return (r() - 0.5) * 1.6; };
    var pts = [[c, 4 + j()], [50, 3 + j()], [100 - c, 4 + j()], [97 + j(), 12], [96 + j(), 50], [97 + j(), 100 - c], [100 - c, 97 + j()], [50, 96 + j()], [c, 97 + j()], [3 + j(), 100 - c], [4 + j(), 50], [3 + j(), c]];
    return '<svg class="sk-blob sk-tile" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + INK.soft(pts, { seed: wob || seed || 4, wobble: 0.8 }) + '"/></svg>';
  }
  // the band hero's ground: one wide brush swipe across the page, its ends tapering out at the sides
  function swipe(seed, wob) {
    var r = INK.rng(seed || 5), pts = [];
    for (var i = 0; i <= 10; i++) pts.push([10 + i * 98, 104 + Math.sin(i * 0.7 + r() * 0.6) * 7 + (r() - 0.5) * 4]);
    return '<svg class="sk-blob sk-swipe" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true"><path d="' + INK.brush(pts, { w: 172, seed: wob || seed || 5, wobble: 1.1, taper: 0.35, end: 0.5, vary: 0.05 }) + '"/></svg>';
  }
  function ground(el, seed, wob) {
    if (el.closest('.sk-hero[data-layout="band"]')) return swipe(seed, wob);
    if (el.classList.contains('sk-art') && el.dataset.skShape !== 'blob') return tile(seed, wob);
    return el.dataset.skShape === 'tile' || el.classList.contains('sk-scene') ? tile(seed, wob) : blob(seed, wob);
  }
  // a tapered brush arrow from (x0,y0) to (x1,y1); bend lifts (negative) or drops (positive) the middle
  function arrow(x0, y0, x1, y1, bend, w, seed, side) { return arrowStrokes(x0, y0, x1, y1, bend, w, seed, side).map(function (s) { return INK.brush(s.pts, s.o); }); }
  // the same arrow as the two strokes a hand makes: the shaft from tail to tip, then the head
  function arrowStrokes(x0, y0, x1, y1, bend, w, seed, side) {
    bend = bend || 0; w = w || 3.2; seed = seed || 3;
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0) || 1;
    // the bend is perpendicular to the arrow, so it works in any direction
    var nx = -(y1 - y0) / len, ny = (x1 - x0) / len, cx = mx + nx * bend * 2 * (side || 1), cy = my + ny * bend * 2 * (side || 1), pts = [];
    if (!side && Math.abs(y1 - y0) < Math.abs(x1 - x0) * 0.2) { cx = mx; cy = my + bend * 2; }
    for (var i = 0; i < 9; i++) { var t = i / 8, u = 1 - t; pts.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); }
    var px = pts[7][0], py = pts[7][1], a = Math.atan2(y1 - py, x1 - px), L = Math.min(11, len * 0.3 + 4);
    var h1 = [x1 - L * Math.cos(a - 0.55), y1 - L * Math.sin(a - 0.55)], h2 = [x1 - L * Math.cos(a + 0.55), y1 - L * Math.sin(a + 0.55)];
    return [{ pts: pts, o: { w: w, seed: seed } }, { pts: [h1, [x1, y1], h2], o: { w: w * 0.9, seed: seed + 1, taper: 0.3 }, head: true }];
  }
  // ---- the pen: a brush stroke that draws itself on. The filled shape is uncovered along its own centreline, from where the hand
  // starts to where it lifts, so a ring goes round, a tick goes down then up, and an arrow runs from its tail to its tip.
  // At rest (no .sk-pen-go above it, reduced motion, print) a pen stroke is simply drawn.
  var penN = 0;
  function penIds(prefix) { var n = 0; prefix = prefix || 'skp' + (++penN); return function () { return prefix + '-' + (n++); }; }
  // how long a stroke takes: a hand moves at about the same speed whatever it draws, so a long line takes longer than a tick
  function penTime(len) { return Math.round(Math.max(150, Math.min(640, 90 + len * 1.7))); }
  // strokes drawn one after another by the same hand: [{ pts, o: brush options, cuts, pd: ms it takes, gap: ms before it, head }]
  // -> { html, end: ms until the last stroke is down }. sd is when the first stroke starts (ms; negative picks up part-way through).
  function penStrokes(strokes, cls, ids, sd) {
    var out = '', at = sd || 0; ids = ids || penIds();
    strokes.forEach(function (s, i) {
      var p = INK.pen(s.pts, s.o, s.cuts), pd = s.pd || (s.head ? 120 : penTime(p.length)), mw = p.w * 2 + 4, pad = mw / 2 + 2, b = p.box;
      if (i) at += s.gap == null ? 40 : s.gap;
      p.parts.forEach(function (q) {
        var id = ids();
        out += '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="' + (b[0] - pad).toFixed(1) + '" y="' + (b[1] - pad).toFixed(1) + '" width="' + (b[2] - b[0] + pad * 2).toFixed(1) + '" height="' + (b[3] - b[1] + pad * 2).toFixed(1) + '">' +
          '<path class="sk-pen" pathLength="' + (q.to - q.from).toFixed(4) + '" style="--p0:' + (1 + q.from).toFixed(4) + ';--p1:' + q.from.toFixed(4) + ';--sd:' + Math.round(at) + 'ms;--pd:' + pd + 'ms" d="' + q.c + '" fill="none" stroke="#fff" stroke-width="' + mw.toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"/></mask>' +
          '<path' + (cls ? ' class="' + cls + '"' : '') + ' d="' + q.d + '" mask="url(#' + id + ')"/>';
      });
      at += pd;
    });
    return { html: out, end: at };
  }
  // let the pen strokes inside el draw now (they hold back while el has .sk-pen-wait), then rest as plain ink
  function penGo(el, total) {
    el.classList.remove('sk-pen-wait', 'sk-pen-go');
    if (still()) return;
    void el.getBoundingClientRect(); el.classList.add('sk-pen-go');
    clearTimeout(el._skPen); el._skPen = setTimeout(function () { el.classList.remove('sk-pen-go'); }, total + 120);
  }
  function noteArrow(dir) {
    var s = arrowStrokes(dir === 'right' ? 6 : 64, 8, dir === 'right' ? 64 : 8, 34, -10, 2.6, 7);
    return '<svg class="sk-note-arrow sk-ink" viewBox="0 0 72 44" aria-hidden="true"><g class="ink">' + penStrokes(s).html + '</g></svg>';
  }
  function quoteMark() {
    var g = '';
    [0, 23].forEach(function (dx, i) {
      var ring = []; for (var k = 0; k < 8; k++) ring.push([11 + dx + 7.6 * Math.cos(k * Math.PI / 4), 26 + 7.6 * Math.sin(k * Math.PI / 4)]);
      g += '<path d="' + INK.soft(ring, { seed: 3 + i, wobble: 0.6 }) + '"/>';
      g += '<path d="' + INK.brush([[5.2 + dx, 24], [6 + dx, 15], [11 + dx, 8], [19 + dx, 4]], { w: 5.4, seed: 7 + i, taper: 0.5, end: 0.3 }) + '"/>';
    });
    return '<svg class="sk-quote-mark sk-ink" viewBox="0 0 46 36" aria-hidden="true"><g class="ink">' + g + '</g></svg>';
  }
  // text measured in the face it will be set in, so labels can wrap instead of spilling out of their card
  var meas;
  function textW(t, font) { meas = meas || d.createElement('canvas').getContext('2d'); meas.font = font; return meas.measureText(t).width; }
  function wrapText(t, max, font) {
    t = String(t); if (textW(t, font) <= max) return [t];
    var w = t.split(' '), best = [t], bestW = 1e9;
    for (var i = 1; i < w.length; i++) { var a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(textW(a, font), textW(b, font)); if (m < bestW) { bestW = m; best = [a, b]; } }
    return best;
  }
  // as many lines as the text needs to stay inside max; two lines are balanced, more are filled in turn
  function wrapLines(t, max, font) {
    var two = wrapText(t, max, font);
    if (two.every(function (l) { return textW(l, font) <= max; })) return two;
    var lines = [], cur = '';
    String(t).split(' ').forEach(function (w) { var next = cur ? cur + ' ' + w : w; if (cur && textW(next, font) > max) { lines.push(cur); cur = w; } else cur = next; });
    if (cur) lines.push(cur);
    return lines;
  }
  var HAND_FONT = '400 17px Kalam, "Comic Sans MS", cursive';
  // every line of text a flow draws goes through here or through esc(), so a label is only ever text
  function tspans(lines, x, y, lh) { return lines.map(function (l, i) { return '<tspan x="' + x + '" y="' + (y + (i - (lines.length - 1)) * lh) + '">' + esc(l) + '</tspan>'; }).join(''); }
  var LABEL_FONT = '600 17px "Bricolage Grotesque", system-ui, sans-serif', ALABEL_FONT = '400 13.5px Literata, Georgia, serif', CAP_FONT = '400 15px Literata, Georgia, serif';
  // flow([[drawing, label, arrow label], ...], {loop:'text', W: px}) -> cards with brush spots, joined by labelled brush arrows.
  // It is drawn at its real width, so its text is always the size it says.
  // a flow drawn across W: how wide its cards are and how each label wraps in its room (a step's name inside its card,
  // an arrow's label in the gap over the arrow). ok is false when a label can't fit, and the flow then stacks.
  function acrossPlan(steps, W) {
    var n = steps.length, cell = W / n, bw = Math.round(Math.min(156, Math.max(104, cell - 70))), gap = cell - bw, ok = true;
    var fit = function (t, room, font, most) { var l = wrapLines(t, room, font); if (l.length > most || l.some(function (x) { return textW(x, font) > room; })) ok = false; return l; };
    var labs = steps.map(function (s) { return fit(s[1], bw - 18, LABEL_FONT, 2); });
    var als = steps.map(function (s, i) { return s[2] && i < n - 1 ? fit(s[2], gap - 8, ALABEL_FONT, 3) : []; });
    return { bw: bw, labs: labs, als: als, ok: ok };
  }
  function flow(steps, o) {
    o = o || {};
    var n = steps.length, W = Math.round(o.W || 1000), cell = W / n, plan = acrossPlan(steps, W), bw = plan.bw, g = '', a = '', X = [], top = o.note ? 40 : 8, ids = penIds(o.id && o.id + 'h');
    for (var i = 0; i < n; i++) X.push(Math.round(cell / 2 + i * cell));
    steps.forEach(function (s, i) {
      var x0 = X[i] - bw / 2, x1 = X[i] + bw / 2, key = NAMES[s[0]] || s[0], lab = plan.labs[i], ly = top + (lab.length > 1 ? 110 : 104);
      g += '<g class="sk-fc" style="--k:' + i + '"><rect class="sk-flow-card" x="' + x0 + '" y="' + top + '" width="' + bw + '" height="' + (lab.length > 1 ? 130 : 124) + '" rx="14"/>';
      g += '<svg x="' + (X[i] - 29) + '" y="' + (top + 14) + '" width="58" height="58" viewBox="' + vb(key) + '">' + drawArt(key, { mode: 'brush', base: 5.5, roles: roles('flow') }) + '</svg>';
      g += '<text text-anchor="middle" class="sk-flow-label">' + tspans(lab, X[i], ly, 19) + '</text></g>';
      if (i < n - 1) {
        var ax0 = x1 + 10, ax1 = X[i + 1] - bw / 2 - 12;
        a += '<g class="sk-fa" style="--k:' + i + '">' + penStrokes(arrowStrokes(ax0, top + 72, ax1, top + 72, 0, 4, i), 'sk-flow-arrow', ids).html + '</g>';
        if (s[2]) g += '<text text-anchor="middle" class="sk-flow-alabel sk-fa" style="--k:' + i + '">' + tspans(plan.als[i], (ax0 + ax1) / 2, top + 58, 16) + '</text>';
      }
    });
    if (o.loop) {
      a += '<g class="sk-fl-loop">' + penStrokes(arrowStrokes(X[n - 1], top + 140, X[0] + 4, top + 146, 66, 4, 21), 'sk-flow-loop', ids).html + '</g>';
      g += '<text x="' + W / 2 + '" y="' + (top + 242) + '" text-anchor="middle" class="sk-flow-cap sk-fl-loop">' + esc(o.loop) + '</text>';
    }
    var h = top + (o.loop ? 256 : 146), label = esc(steps.map(function (s) { return s[1]; }).join(', '));
    return '<svg class="sk-flow-svg sk-flow-h" viewBox="0 0 ' + W + ' ' + h + '" width="' + W + '" role="img" aria-label="' + label + '" data-n="' + n + '" style="--n:' + n + '">' + g + '<g class="ink">' + a + '</g></svg>' + flowV(steps, o, label);
  }
  // a flow picks its layout from its own width: across when every step gets 150px and every label fits its room, stacked otherwise
  function layFlow(el) {
    var w = el.clientWidth; if (!w) return;
    var steps = JSON.parse(el.dataset.skFlow), across = w / steps.length >= 150 && acrossPlan(steps, w).ok;
    if (el._w && Math.abs(el._w - w) < 16 && el.dataset.layout === (across ? 'h' : 'v')) return;
    var nt = el.querySelector(':scope > .sk-note[data-sk-note-at]');
    el._skId = el._skId || 'skf' + (++penN);
    var html = flow(steps, { id: el._skId, loop: el.dataset.skLoop, W: across ? w : 1000, note: nt && { i: +nt.dataset.skNoteAt - 1, text: nt.textContent.trim() } });
    el._w = w; el.dataset.layout = across ? 'h' : 'v';
    // the same drawing as before (fonts loaded, a tiny resize): keep it, so an entrance in progress isn't cut short
    if (html === el._html) return;
    el._html = html;
    var old = el.querySelectorAll(':scope > .sk-flow-svg'), was = old[0] && old[0].classList.contains('sk-in-flow');
    old.forEach(function (x) { x.remove(); });
    el.insertAdjacentHTML('afterbegin', html);
    el.querySelectorAll(':scope > .sk-flow-svg').forEach(function (x) { chalkFor(x); if (was) x.classList.add('sk-in-flow', 'sk-flow-still'); });
    placeFlowNote(el);
  }
  // the same flow stacked top to bottom, for narrow screens; arrow labels sit beside the arrows, the loop runs back up the right.
  // Every text wraps inside its own room (a card grows for its label and its note), so nothing is ever wider than its card or the drawing.
  function flowV(steps, o, label) {
    var n = steps.length, VW = 360, x0 = 8, cw = o.loop ? 250 : VW - 2 * x0, g = '', a = '', ids = penIds(o.id && o.id + 'v'), y = 8, mid = [];
    steps.forEach(function (s, i) {
      var key = NAMES[s[0]] || s[0], inner = cw - 90 - 14, lab = wrapLines(s[1], inner, LABEL_FONT), hand = o.note && o.note.i === i ? wrapLines(o.note.text, inner, HAND_FONT) : [];
      var th = lab.length * 19 + hand.length * 21, ch = Math.max(84, th + 30), ly = y + (ch - th) / 2 + 14 + (lab.length - 1) * 19;
      mid.push(y + ch / 2);
      g += '<g class="sk-fc" style="--k:' + i + '"><rect class="sk-flow-card" x="' + x0 + '" y="' + y + '" width="' + cw + '" height="' + ch + '" rx="14"/>';
      g += '<svg x="' + (x0 + 16) + '" y="' + (y + ch / 2 - 29) + '" width="58" height="58" viewBox="' + vb(key) + '">' + drawArt(key, { mode: 'brush', base: 5.5, roles: roles('flow') }) + '</svg>';
      g += '<text class="sk-flow-label">' + tspans(lab, x0 + 90, ly, 19) + '</text>';
      if (hand.length) g += '<text class="sk-flow-hand">' + tspans(hand, x0 + 90, ly + 2 + hand.length * 21, 21) + '</text>';
      g += '</g>';
      y += ch;
      if (i < n - 1) {
        var al = s[2] ? wrapLines(s[2], VW - (x0 + 78) - 6, ALABEL_FONT) : [], gap = Math.max(54, al.length * 16 + 22);
        a += '<g class="sk-fa" style="--k:' + i + '">' + penStrokes(arrowStrokes(x0 + 60, y + 8, x0 + 60, y + gap - 10, 0, 3.6, i), 'sk-flow-arrow', ids).html + '</g>';
        if (al.length) g += '<text class="sk-flow-alabel sk-fa" style="--k:' + i + '">' + tspans(al, x0 + 78, y + gap / 2 + 5 + (al.length - 1) * 8, 16) + '</text>';
        y += gap;
      }
    });
    var H = y + 8;
    if (o.loop) {
      var yb = mid[n - 1], yt = mid[0], pts = [], c = [x0 + cw + 70, (yb + yt) / 2];
      for (var k = 0; k < 13; k++) { var t = k / 12, u = 1 - t; pts.push([u * u * (x0 + cw + 8) + 2 * u * t * c[0] + t * t * (x0 + cw + 10), u * u * yb + 2 * u * t * c[1] + t * t * yt]); }
      var e = pts[12], p = pts[10], an = Math.atan2(e[1] - p[1], e[0] - p[0]), L = 11;
      a += '<g class="sk-fl-loop">' + penStrokes([{ pts: pts, o: { w: 3.6, seed: 21 } }, { pts: [[e[0] - L * Math.cos(an - 0.55), e[1] - L * Math.sin(an - 0.55)], e, [e[0] - L * Math.cos(an + 0.55), e[1] - L * Math.sin(an + 0.55)]], o: { w: 3.2, seed: 22, taper: 0.3 }, head: true }], 'sk-flow-loop', ids).html + '</g>';
      var cap = wrapLines(o.loop, VW - x0 - 10, CAP_FONT);
      g += '<text class="sk-flow-cap sk-fl-loop">' + tspans(cap, x0 + 4, H + 22 + (cap.length - 1) * 19, 19) + '</text>';
      H += 34 + (cap.length - 1) * 19;
    }
    return '<svg class="sk-flow-svg sk-flow-v" viewBox="0 0 ' + VW + ' ' + H + '" role="img" aria-label="' + label + '" data-n="' + n + '" style="--n:' + n + '">' + g + '<g class="ink">' + a + '</g></svg>';
  }
  // a note in a flow can name its step (data-sk-note-at="3", counting from 1): it sits over that card
  function placeFlowNote(el) {
    var note = el.querySelector(':scope > .sk-note[data-sk-note-at]'); if (!note) return;
    var i = (+note.dataset.skNoteAt || 1) - 1, n = JSON.parse(el.dataset.skFlow).length;
    note.style.setProperty('--at', ((n ? (i + 0.5) / n : 0.5) * 100).toFixed(2) + '%');
  }


  // ---- chalk: a grain about 1.3px across at any size, so the dark theme reads as chalk on a board ----
  var chalkMade = {};
  function chalkFor(svg) {
    var vbw = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width, px = svg.getBoundingClientRect().width;
    if (!vbw || !px) return;
    if (px < 40) { svg.style.setProperty('--chalk', 'none'); return; }
    var f = Math.max(0.12, Math.min(3, (px / vbw) / 1.35)), key = Math.round(f * 40), id = 'sk-chalk-' + key;
    if (!chalkMade[id]) {
      defs(); chalkMade[id] = 1;
      var fe = d.createElementNS(NS, 'filter'); fe.setAttribute('id', id); fe.setAttribute('x', '-5%'); fe.setAttribute('y', '-5%'); fe.setAttribute('width', '110%'); fe.setAttribute('height', '110%');
      fe.innerHTML = '<feTurbulence type="fractalNoise" baseFrequency="' + (key / 40).toFixed(3) + '" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.55" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/>';
      d.getElementById('sk-defs').querySelector('defs').appendChild(fe);
    }
    svg.style.setProperty('--chalk', 'url(#' + id + ')');
  }

  // ---- grain: a ground is printed, so it has a soft tooth: pale flecks where the paper shows, a little mottling. About 1px at any size ----
  var grainMade = {};
  function grainFor(svg, dark) {
    if (!svg) return;
    var vbw = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width, px = svg.getBoundingClientRect().width;
    if (!vbw || !px) return;
    var key = Math.max(2, Math.min(80, Math.round((px / vbw) * 8.7))), id = 'sk-grain-' + (dark ? 'd' : '') + key;
    if (!grainMade[id]) {
      defs(); grainMade[id] = 1;
      var fe = d.createElementNS(NS, 'filter'); fe.setAttribute('id', id); fe.setAttribute('x', '0'); fe.setAttribute('y', '0'); fe.setAttribute('width', '100%'); fe.setAttribute('height', '100%'); fe.setAttribute('color-interpolation-filters', 'sRGB');
      // a dark ground takes only a little pale dust; a colour takes pale flecks and a faint darker mottle
      fe.innerHTML = '<feTurbulence type="fractalNoise" baseFrequency="' + (key / 10).toFixed(2) + '" numOctaves="2" seed="3" result="n"/>' +
        '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.98  0 0 0 0 0.976  0 0 0 0 0.96  0 0 0 -3 1.4"/><feComponentTransfer><feFuncA type="linear" slope="' + (dark ? 0.13 : 0.3) + '"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in" result="l"/>' +
        '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 2.4 -1.2"/><feComponentTransfer><feFuncA type="linear" slope="' + (dark ? 0 : 0.14) + '"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in" result="k"/>' +
        '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="k"/><feMergeNode in="l"/></feMerge>';
      d.getElementById('sk-defs').querySelector('defs').appendChild(fe);
    }
    svg.style.setProperty('--grain', 'url(#' + id + ')');
  }
  // which fills a drawing takes: on a clay ground everything turns paper; on a quiet ground (oat, sage, ink) the clay parts stay clay;
  // on the paper, putty. A spot inside a clay band counts as on clay.
  function fillFor(el, hero, bare) {
    if (el.dataset.skFill) return el.dataset.skFill;
    if (hero && !bare) { var t = el.dataset.tone; return t && t !== 'clay' ? 'tile' : 'ground'; }
    if (el.closest('.sk-section[data-tone="flood"], .sk-slide[data-tone="clay"]')) return 'ground';
    return 'putty';
  }

  // ---- mounting: markup in, drawings out ----
  var boiling = [], drawing = [];
  function inEnter(el) { return !reduce.matches && window.IntersectionObserver && el.closest('.sk-enter'); }
  function mount(root) {
    root = root || d;
    root.querySelectorAll('[data-sk-draw]').forEach(function (el) {
      if (el.dataset.skDone) return;
      // .sk-art is a drawing on its ground anywhere in a page: it is built the way a hero's art is
      if (el.classList.contains('sk-art')) el.classList.add('sk-hero-art');
      var names = el.dataset.skDraw.trim().split(/\s+/), hero = el.classList.contains('sk-hero-art');
      var panel = el.dataset.skShape === 'panel';
      var bare = el.dataset.skShape === 'none' || el.dataset.skBlob === 'off', band = hero && el.closest('.sk-hero[data-layout="band"]');
      var title = hero && el.closest('.sk-hero') && el.closest('.sk-hero').querySelector('h1, .sk-title');
      var seed = hash((title && title.textContent) || names.join(' ')) % 97 + 1;
      var fill = fillFor(el, hero, bare);
      // two or three drawings make a scene: things that belong together, all standing inside the ground
      if (names.length > 1 && hero) { el.classList.add('sk-scene'); if (!el.dataset.skScene) el.dataset.skScene = seed % 2 ? 'still' : 'orbit'; }
      var gr = !hero || bare || panel ? '' : ground(el, seed), html = gr, reveal = inEnter(el);
      names.forEach(function (name, j) {
        var key = NAMES[name] || name; if (!ART[key]) return;
        var o = { size: hero ? 'hero' : 'spot', fill: fill, label: j ? name : el.getAttribute('aria-label') || name, seed: 1 + j * 5 };
        if (reveal) o.reveal = 'skm' + (++uidN);
        html += draw(name, o).replace('<svg class="sk-ink"', '<svg class="sk-ink sk-ink-' + (j + 1) + '"' + (reveal ? ' data-sk-reveal' : ''));
      });
      el.innerHTML = html;
      el.dataset.skDone = '1';
      grainFor(el.querySelector(':scope > svg.sk-blob'), el.dataset.tone === 'ink');
      // now that it has a size, redraw at the right brush weight and pick the chalk grain
      el.querySelectorAll('svg.sk-ink').forEach(function (svg, j) {
        var name = names[j], key = NAMES[name] || name, px = svg.getBoundingClientRect().width;
        var o = { size: hero ? 'hero' : 'spot', fill: fill, seed: 1 + j * 5, px: px };
        if (px && baseFor(key, o) !== baseFor(key, { size: o.size })) svg.innerHTML = inner(name, Object.assign({}, o, { reveal: reveal ? 'skm' + (++uidN) : null }));
        chalkFor(svg);
        var item = { el: svg, name: name, o: o };
        if (hero && el.hasAttribute('data-sk-boil')) { item.lead = j === 0; boiling.push(item); }
        if (reveal) drawing.push(item);
      });
      // on a band the drawing is cropped to what it draws, so a wide flat thing (a pan, a train) can fill the band's height
      if (band) el.querySelectorAll('svg.sk-ink').forEach(function (svg) {
        try { var bb = svg.getBBox(), p = Math.max(bb.width, bb.height) * 0.06; if (bb.width) svg.setAttribute('viewBox', [bb.x - p, bb.y - p, bb.width + 2 * p, bb.height + 2 * p].map(function (v) { return v.toFixed(1); }).join(' ')); } catch (e) {}
      });
      if (hero && gr && names.length === 1) {
        var bleedHero = !!el.closest('.sk-hero[data-layout="bleed"]');
        var oh = function () { if (!band) contain(el); if (bleedHero) overhang(el); };
        requestAnimationFrame(oh);
        if (window.ResizeObserver) new ResizeObserver(function () { requestAnimationFrame(oh); }).observe(el);
        if (d.fonts) d.fonts.ready.then(oh);
      }
      // the ground boils too: the same shape, retraced
      // (a band's swipe holds still: 1,280px of edge redrawn twelve times a second reads as jitter, not a hand)
      if (hero && gr && !band && el.hasAttribute('data-sk-boil')) boiling.push({ el: el.querySelector('svg.sk-blob'), groundOf: el, seed: seed });
    });
    root.querySelectorAll('[data-sk-flow]').forEach(function (el) {
      if (el.dataset.skDone) return;
      try { JSON.parse(el.dataset.skFlow); } catch (e) { return; }
      el.dataset.skDone = '1';
      layFlow(el);
      if (!el.dataset.layout) el.insertAdjacentHTML('afterbegin', flow(JSON.parse(el.dataset.skFlow), { loop: el.dataset.skLoop }));
      var relay = function () { layFlow(el); };
      if (window.ResizeObserver) new ResizeObserver(function () { requestAnimationFrame(relay); }).observe(el);
      if (d.fonts) d.fonts.ready.then(function () { el._w = 0; relay(); });
    });
    root.querySelectorAll('.sk-note').forEach(function (el) {
      // the words sit in their own box, so they can be written and the arrow drawn as two things
      if (!el.classList.contains('sk-chart-note') && !el.querySelector(':scope > .sk-note-t')) { var nt = d.createElement('span'); nt.className = 'sk-note-t'; Array.prototype.slice.call(el.childNodes).forEach(function (c) { if (!(c.nodeType === 1 && c.classList.contains('sk-note-arrow'))) nt.appendChild(c); }); el.appendChild(nt); }
      if (el.querySelector('.sk-note-arrow') || el.dataset.skTarget || el.classList.contains('sk-chart-note')) return;
      el.insertAdjacentHTML('afterbegin', noteArrow(/right/.test(el.dataset.skPoint || '') ? 'right' : 'left'));
      chalkFor(el.querySelector('.sk-note-arrow'));
    });
    root.querySelectorAll('.sk-quote').forEach(function (el) {
      if (el.querySelector('.sk-quote-mark')) return;
      el.insertAdjacentHTML('afterbegin', quoteMark()); // clay is paint, so the mark stays solid in the dark
    });
    keepWords(root);
    defs();
    extras(root);
    more(root);
    more2(root);
    more3(root);
    aimNotes();
    enter(root);
    startBoil();
  }
  // after a drawing has drawn itself on, swap in the plain drawing (no masks), then let the hero boil
  function drawn(item, delay) {
    setTimeout(function () {
      item.done = true;
      if (!item.el.isConnected) return;
      item.el.removeAttribute('data-sk-reveal');
      item.el.innerHTML = inner(item.name, item.o);
      syncOut(item.el);
    }, delay);
  }

  // the drawing stands inside its ground: it shrinks until every stroke sits within the clay with a margin, measured
  // around the box's centre, so a big object never covers its ground or runs off it. Its width is a share of the box,
  // so once it fits it keeps fitting at any size; a later pass only ever shrinks it. On a bleed hero, what runs off
  // the window doesn't count: there the drawing may leave the page, but not the clay.
  function contain(el) {
    var g = el.querySelector(':scope > svg.sk-blob path'), ink = el.querySelector(':scope > svg.sk-ink'); if (!g || !ink || !g.getTotalLength) return;
    var a = el.getBoundingClientRect(); if (!a.width || !a.height) return;
    var cx = a.left + a.width / 2, cy = a.top + a.height / 2, N = 120, R = [], i, s = 1, W = window.innerWidth, bleed = el.closest('.sk-hero[data-layout="bleed"]');
    for (i = 0; i < N; i++) R.push(Infinity);
    var bin = function (x, y) { return Math.floor(((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * N) % N; };
    var walk = function (path, n, f) {
      var m = path.getScreenCTM(), L; if (!m) return; try { L = path.getTotalLength(); } catch (e) { return; }
      for (var j = 0; j < n; j++) { var q = path.getPointAtLength((L * j) / n); f(m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f); }
    };
    walk(g, 480, function (x, y) { var k = bin(x, y); R[k] = Math.min(R[k], Math.hypot(x - cx, y - cy)); });
    for (i = 0; i < N; i++) if (R[i] === Infinity) R[i] = Math.min(R[(i + N - 1) % N], R[(i + 1) % N]);
    ink.querySelectorAll('g.ink path, g.fills path').forEach(function (p) {
      walk(p, 40, function (x, y) {
        if (bleed && x > W) return;
        var r = Math.hypot(x - cx, y - cy); if (r < 2) return;
        var k = bin(x, y), lim = Math.min(R[k], R[(k + 1) % N], R[(k + N - 1) % N]) * 0.88;
        if (lim < r) s = Math.min(s, lim / r);
      });
    });
    if (s < 0.995) ink.style.width = ((ink.getBoundingClientRect().width * Math.max(0.5, s)) / a.width * 100).toFixed(2) + '%';
  }
  // in the dark, a bleed hero's ink that runs off the clay would vanish into the board, so a chalk copy is drawn outside the ground
  function overhang(el) {
    var g = el.querySelector(':scope > svg.sk-blob'), ink = el.querySelector(':scope > svg.sk-ink'); if (!g || !ink || !g.querySelector('path')) return;
    var out = ink._out;
    if (!out) {
      out = d.createElementNS('http://www.w3.org/2000/svg', 'svg'); out.setAttribute('class', 'sk-ink-out'); out.setAttribute('aria-hidden', 'true');
      out.setAttribute('viewBox', ink.getAttribute('viewBox')); el.appendChild(out); ink._out = out;
    }
    out.innerHTML = ink.innerHTML.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/ mask="[^"]*"/g, '');
    var src = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + g.getAttribute('viewBox') + '" preserveAspectRatio="' + (g.getAttribute('preserveAspectRatio') || 'xMidYMid meet') + '"><path d="' + g.querySelector('path').getAttribute('d') + '"/></svg>';
    var a = el.getBoundingClientRect(), gr = g.getBoundingClientRect(), ir = ink.getBoundingClientRect(); if (!ir.width) return;
    out.style.left = (ir.left - a.left) + 'px'; out.style.top = (ir.top - a.top) + 'px'; out.style.width = ir.width + 'px'; out.style.height = ir.height + 'px';
    var m = 'url("data:image/svg+xml,' + encodeURIComponent(src) + '") ' + (gr.left - ir.left) + 'px ' + (gr.top - ir.top) + 'px / ' + gr.width + 'px ' + gr.height + 'px no-repeat, linear-gradient(#000, #000)';
    out.style.webkitMask = m; out.style.mask = m; out.style.webkitMaskComposite = 'xor'; out.style.maskComposite = 'exclude';
    chalkFor(out);
  }
  function syncOut(svg) { if (svg && svg._out) svg._out.innerHTML = svg.innerHTML.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/ mask="[^"]*"/g, ''); }

  // ---- the boil: four hand-drawn versions of the hero, made once, shown in a random order (never the same twice running) at 12fps ----
  var frame = 0, boilIO = null;
  function startBoil() {
    boiling.forEach(function (b) {
      if (b.frames) return;
      if (b.groundOf) b.frames = [0, 11, 23, 37].map(function (k) { return ground(b.groundOf, b.seed, k ? b.seed + k : 0).replace(/^<svg[^>]*>|<\/svg>$/g, ''); });
      else b.frames = [1, 18, 35, 52].map(function (s) { return inner(b.name, Object.assign({}, b.o, { seed: s + (b.lead ? 0 : 3) })); });
      b.visible = true;
      if (window.IntersectionObserver) {
        if (!boilIO) boilIO = new IntersectionObserver(function (es) { es.forEach(function (e) { boiling.forEach(function (x) { if (x.el === e.target) x.visible = e.isIntersecting; }); }); });
        boilIO.observe(b.el);
      }
    });
  }
  setInterval(function () {
    if (reduce.matches || d.hidden) return;
    var nf = Math.floor(Math.random() * 3); frame = nf >= frame ? nf + 1 : nf;
    boiling = boiling.filter(function (b) { return b.el && b.el.isConnected; });
    var lead = {};
    boiling.forEach(function (b) { if (b.lead) lead.done = !(drawing.indexOf(b) >= 0 && !b.done); });
    boiling.forEach(function (b) {
      if (!b.frames || !b.visible || (drawing.indexOf(b) >= 0 && !b.done)) return;
      if (b.groundOf && lead.done === false) return;
      b.el.innerHTML = b.frames[frame];
      syncOut(b.el);
    });
  }, 83);

  // ---- notes that aim: data-sk-target="#id" draws a brush arrow from the note to its target ----
  var aimLayer = null, aimed = [];
  function aimNotes() {
    d.querySelectorAll('.sk-note[data-sk-target]').forEach(function (n) { if (aimed.indexOf(n) < 0) aimed.push(n); });
    if (!aimed.length) return;
    if (!aimLayer) {
      aimLayer = d.createElementNS(NS, 'svg'); aimLayer.setAttribute('class', 'sk-aim sk-pen-go'); aimLayer.setAttribute('aria-hidden', 'true');
      d.body.appendChild(aimLayer);
      var redo = function () { requestAnimationFrame(drawAims); };
      addEventListener('resize', redo); if (d.fonts) d.fonts.ready.then(redo);
      if (window.ResizeObserver) new ResizeObserver(redo).observe(d.body);
    }
    drawAims();
  }
  function drawAims() {
    if (!aimLayer) return;
    var sx = scrollX, sy = scrollY, W = d.documentElement.scrollWidth, H = d.documentElement.scrollHeight, out = '';
    aimLayer.setAttribute('width', W); aimLayer.setAttribute('height', H); aimLayer.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    aimed.forEach(function (n, i) {
      var t = n.dataset.skTarget && d.querySelector(n.dataset.skTarget);
      if (!t || !n.isConnected || !n.offsetParent || !t.getClientRects().length) return;
      var a = n.getBoundingClientRect(), b = t.getBoundingClientRect();
      var A = { l: a.left + sx, r: a.right + sx, t: a.top + sy, b: a.bottom + sy }, B = { l: b.left + sx, r: b.right + sx, t: b.top + sy, b: b.bottom + sy };
      var gap = 8, x0, y0;
      // leave from the side of the note that faces the target
      if (B.l > A.r) { x0 = A.r + gap; y0 = (A.t + A.b) / 2 + 2; }
      else if (B.r < A.l) { x0 = A.l - gap; y0 = (A.t + A.b) / 2 + 2; }
      else if (B.t > A.b) { x0 = Math.min(A.r - 12, Math.max(A.l + 12, (B.l + B.r) / 2)); y0 = A.b + gap; }
      else { x0 = Math.min(A.r - 12, Math.max(A.l + 12, (B.l + B.r) / 2)); y0 = A.t - gap; }
      // arrive at the nearest point of the target's edge
      var x1 = Math.min(B.r, Math.max(B.l, x0)), y1 = Math.min(B.b, Math.max(B.t, y0));
      var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1; x1 -= (dx / L) * gap; y1 -= (dy / L) * gap;
      if (Math.hypot(x1 - x0, y1 - y0) < 10) return;
      var st = arrowStrokes(x0, y0, x1, y1, Math.min(14, L * 0.12), 2.6, 7 + i, dx > 0 ? -1 : 1), now = performance.now();
      // while its note is being written the arrow is a pen stroke on its way (redrawn mid-stroke, it picks up where it was); after that it is plain ink
      var live = n._skAim && now < n._skAim + 900 && !reduce.matches;
      out += '<g class="ink sk-aim-a' + (n.classList.contains('sk-shown-note') || reduce.matches || !n.closest('.sk-enter') ? ' on' : '') + '" data-i="' + i + '">' + (live ? penStrokes(st, '', penIds('ska' + i), Math.round(n._skAim - now)).html : st.map(function (q) { return '<path d="' + INK.brush(q.pts, q.o) + '"/>'; }).join('')) + '</g>';
    });
    aimLayer.innerHTML = out;
  }

  // ---- entrance: inside .sk-enter, each part reveals once as it scrolls into view ----
  // Text rises and fades; drawings draw stroke by stroke after their ground lands; flows lay their cards
  // down then draw their arrows; notes write themselves; numbers, meters and charts fill in as they're seen.
  var io = null, revealQ = [], revealT = 0;
  function reveal(x, i) {
    x.classList.remove('sk-wait');
    var parts = x.hasAttribute('data-sk-stagger') ? Array.prototype.slice.call(x.children) : [x];
    parts.forEach(function (p, k) { p.style.setProperty('--sk-i', Math.min(5, i + k)); p.classList.add('sk-in-rise'); });
    var t0 = Math.min(5, i) * 60;
    x.querySelectorAll('.sk-blob').forEach(function (p) { p.style.setProperty('--sk-d', t0 + 'ms'); p.classList.add('sk-in-ground'); });
    x.querySelectorAll('svg.sk-ink[data-sk-reveal]').forEach(function (s, k) {
      var hero = !!s.closest('.sk-hero-art'), start = t0 + (hero ? 240 : 140) + k * 90;
      s.style.setProperty('--sk-d', start + 'ms'); s.classList.add('sk-drawing');
      var item = drawing.filter(function (it) { return it.el === s; })[0];
      if (item) drawn(item, start + 1100);
    });
    x.querySelectorAll('.sk-flow-svg').forEach(function (s) { s.style.setProperty('--sk-d', (t0 + 120) + 'ms'); s.classList.add('sk-in-flow'); });
    x.querySelectorAll('.sk-sticky').forEach(function (p) { p.style.setProperty('--sk-d', (t0 + 380) + 'ms'); p.classList.add('sk-in-stick'); });
    var aims = false;
    x.querySelectorAll('.sk-note').forEach(function (p) { if (writeNote(p, t0 + 520, x)) aims = true; });
    if (aims && aimLayer) drawAims();
    x.classList.add('sk-shown');
    x.dispatchEvent(new CustomEvent('sk:reveal', { bubbles: false }));
    x.querySelectorAll('[data-sk-count], [data-sk-chart], .sk-meter, .sk-timeline, .sk-steps').forEach(function (p) { p.dispatchEvent(new CustomEvent('sk:reveal')); });
  }
  // a note is written, not wiped: its words appear in order at a writing pace, and only then is its arrow drawn, from the words towards the thing.
  // A note that points at a ringed or underlined thing waits for that mark, since one hand does both.
  function writeNote(p, delay, part) {
    var t = p.querySelector(':scope > .sk-note-t'), took = 420, tgt = p.dataset.skTarget && d.querySelector(p.dataset.skTarget);
    var mark = tgt && (tgt.matches('[data-sk-ring], [data-sk-under]') ? tgt : tgt.querySelector('[data-sk-ring], [data-sk-under]'));
    // ... and so does a note that arrives in the same part as a mark
    if (!mark && part) mark = part.querySelector('[data-sk-ring], [data-sk-under]');
    if (mark && !mark._skDrawn) delay = Math.max(delay, 1500);
    // a note on a flow is the last thing the hand does there: after the cards, the arrows and the loop
    var fl = p.closest('.sk-flow'), fs = fl && fl.querySelector(':scope > .sk-flow-svg');
    if (fs) delay = Math.max(delay, delay - 400 + (+fs.dataset.n || 4) * 120 + 320 + (fl.dataset.skLoop ? 800 : 0));
    if (t && (!t.children.length || t.querySelector(':scope > .sk-w'))) {
      var text = t.textContent.trim(), words = text.split(/\s+/), per = Math.min(24, 840 / Math.max(1, text.length)), at = 0;
      t.textContent = '';
      words.forEach(function (w, i) {
        var s = d.createElement('span'); s.className = 'sk-w'; s.textContent = w;
        s.style.setProperty('--wd', Math.round(at) + 'ms'); s.style.setProperty('--wt', Math.round(Math.max(80, w.length * per)) + 'ms');
        t.appendChild(s); if (i < words.length - 1) t.appendChild(d.createTextNode(' '));
        at += Math.max(80, w.length * per) + per;
      });
      took = at;
    }
    p.style.setProperty('--sk-d', delay + 'ms'); p.style.setProperty('--sk-nd', Math.round(delay + took + 40) + 'ms');
    p.classList.remove('sk-in-note'); void p.offsetWidth; p.classList.add('sk-in-note', 'sk-shown-note');
    clearTimeout(p._skNote); p._skNote = setTimeout(function () { p.classList.remove('sk-in-note'); }, delay + took + 700);
    if (p.dataset.skTarget) { p._skAim = performance.now() + delay + took + 40; return true; }
    return false;
  }
  function flushReveal() {
    revealT = 0;
    revealQ.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
    revealQ.forEach(function (x, i) { reveal(x, i); });
    revealQ = [];
  }
  function enter(root) {
    (root.querySelectorAll ? root : d).querySelectorAll('.sk-enter').forEach(function (box) {
      if (box.dataset.skEntered) return; box.dataset.skEntered = '1';
      // a section's parts are watched one by one, so a long section never animates off screen
      var kids = [];
      Array.prototype.slice.call(box.children).forEach(function (x) {
        if (x.classList.contains('sk-section') && !x.hasAttribute('data-sk-whole')) { x.classList.add('sk-shown', 'sk-split-reveal'); kids = kids.concat(Array.prototype.slice.call(x.children)); }
        else kids.push(x);
      });
      if (reduce.matches || !window.IntersectionObserver) { kids.forEach(function (x) { x.classList.add('sk-shown'); x.dispatchEvent(new CustomEvent('sk:reveal')); x.querySelectorAll('[data-sk-count], [data-sk-chart], .sk-meter, .sk-timeline, .sk-steps').forEach(function (p) { p.dispatchEvent(new CustomEvent('sk:reveal')); }); }); return; }
      if (!io) io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); revealQ.push(e.target); } });
        if (revealQ.length && !revealT) revealT = setTimeout(flushReveal, 30);
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
      // anything that sticks or floats (the phone dock, a bar) is never held back: it has no place in the reading order to wait for
      kids = kids.filter(function (x) { var ps = getComputedStyle(x).position; return !(x.matches('.sk-dock, .sk-bar, dialog') || ps === 'fixed' || ps === 'sticky'); });
      kids.forEach(function (x) { x.classList.add('sk-wait'); io.observe(x); });
    });
    if (io && !endWatch) { endWatch = true; addEventListener('scroll', atEnd, { passive: true }); addEventListener('resize', atEnd); setTimeout(atEnd, 400); }
  }
  // The last lines of a page can lie below the line a part crosses to be seen (a short part above a
  // small foot, on a tall screen). At the end of the page there is no further to scroll, so whatever
  // is on screen there arrives.
  var endWatch = false;
  function atEnd() {
    if (!io || innerHeight + (window.scrollY || 0) < d.documentElement.scrollHeight - 2) return;
    d.querySelectorAll('.sk-wait').forEach(function (x) {
      var r = x.getBoundingClientRect();
      if ((r.width || r.height) && r.top < innerHeight) { io.unobserve(x); if (revealQ.indexOf(x) < 0) revealQ.push(x); }
    });
    if (revealQ.length && !revealT) revealT = setTimeout(flushReveal, 30);
  }
  // printing: every part in its end state at once, drawings finished, notes' arrows on
  function showAll() {
    if (revealT) { clearTimeout(revealT); flushReveal(); }
    d.querySelectorAll('.sk-wait').forEach(function (x) { if (io) io.unobserve(x); reveal(x, 0); });
    drawing.forEach(function (it) { if (it.done) return; it.done = true; if (it.el.isConnected) { it.el.removeAttribute('data-sk-reveal'); it.el.innerHTML = inner(it.name, it.o); } });
    if (aimLayer) { aimNotes(); aimLayer.querySelectorAll('.sk-aim-a').forEach(function (g) { g.classList.add('on'); }); }
  }
  function replay(box) {
    if (!box) return;
    delete box.dataset.skEntered;
    box.querySelectorAll('.sk-in-rise, .sk-in-ground, .sk-drawing, .sk-in-flow, .sk-in-stick, .sk-in-note, .sk-shown').forEach(function (x) { x.classList.remove('sk-in-rise', 'sk-in-ground', 'sk-drawing', 'sk-in-flow', 'sk-in-stick', 'sk-in-note', 'sk-shown'); void x.offsetWidth; });
    box.querySelectorAll('[data-sk-counted]').forEach(function (x) { delete x.dataset.skCounted; });
    box.querySelectorAll('[data-sk-on-grow]').forEach(function (x) { delete x.dataset.skGrown; arm(x); });
    box.querySelectorAll('.sk-hero-art svg.sk-ink, .sk-spot svg.sk-ink').forEach(function (svg) {
      var host = svg.closest('[data-sk-draw]'), names = host.dataset.skDraw.trim().split(/\s+/), j = Array.prototype.indexOf.call(host.querySelectorAll('svg.sk-ink'), svg);
      var hero = host.classList.contains('sk-hero-art'), fill = fillFor(host, hero, host.dataset.skShape === 'none' || host.dataset.skBlob === 'off');
      var item = { el: svg, name: names[j], o: { size: hero ? 'hero' : 'spot', fill: fill, seed: 1 + j * 5, px: svg.getBoundingClientRect().width } };
      svg.innerHTML = inner(item.name, Object.assign({}, item.o, { reveal: 'skm' + (++uidN) })); svg.setAttribute('data-sk-reveal', '');
      boiling.forEach(function (b) { if (b.el === svg) { b.done = false; item = b; } });
      if (drawing.indexOf(item) < 0) drawing.push(item);
    });
    enter(box.parentNode || d);
    remark(box);
  }
  // a drawing on something you can press redraws two frames when you point at it, then rests
  d.addEventListener('pointerover', function (ev) {
    if (reduce.matches || !ev.target.closest) return;
    var host = ev.target.closest('a, button, .sk-choice, [data-sk-hover]'); if (!host) return;
    var spot = host.matches('.sk-spot') ? host : host.querySelector('.sk-spot'); if (!spot || spot.dataset.skWiggling) return;
    var svg = spot.querySelector('svg.sk-ink'); if (!svg || svg.hasAttribute('data-sk-reveal')) return;
    var name = spot.dataset.skDraw.split(/\s+/)[0], f = 0, px = svg.getBoundingClientRect().width; spot.dataset.skWiggling = '1';
    (function step() {
      f++; svg.innerHTML = inner(name, { size: 'spot', fill: fillFor(spot, false, false), px: px, seed: f < 3 ? 1 + f * 17 : 1 });
      if (f < 3) setTimeout(step, 83); else setTimeout(function () { delete spot.dataset.skWiggling; }, 400);
    })();
  });
  function defs() {
    if (d.getElementById('sk-defs')) return;
    var s = d.createElementNS(NS, 'svg');
    s.setAttribute('id', 'sk-defs'); s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.setAttribute('aria-hidden', 'true');
    s.style.position = 'absolute';
    s.innerHTML = '<defs></defs>';
    // first in the body, so nothing sits after a printed deck's last slide
    var host = d.body || d.documentElement; host.insertBefore(s, host.firstChild);
  }
  // ---- v3: behaviour for the interactive parts. Each wires itself once (data-sk-on). ----
  function once(el, key) { if (el.dataset['skOn' + key]) return false; el.dataset['skOn' + key] = '1'; return true; }
  var printNow = false;
  function still() { return reduce.matches || printNow; }
  function each(root, sel, fn) { root.querySelectorAll(sel).forEach(fn); }
  function svgEl(markup) { var t = d.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstChild; }
  // run fn the first time el is mostly on screen
  var seenIO = null, seenFns = new Map();
  function whenSeen(el, fn) {
    if (still() || !window.IntersectionObserver) { fn(); return; }
    if (!seenIO) seenIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { seenIO.unobserve(e.target); var f = seenFns.get(e.target); seenFns.delete(e.target); if (f) f(); } });
    }, { threshold: 0.15 });
    seenFns.set(el, fn); seenIO.observe(el);
  }
  // everything not yet seen, at once, in its end state (for printing)
  function seeAll() {
    if (seenIO) seenFns.forEach(function (f, el) { seenIO.unobserve(el); if (el.isConnected) f(); });
    seenFns.clear();
    d.querySelectorAll('[data-sk-count]').forEach(function (el) { if (el._skFinal != null) { el.textContent = el._skFinal; el.style.minWidth = ''; } });
  }
  // numbers: "1,284" "$2,140.50" "60%" keep their shape while counting
  function format(n, o) {
    o = o || {};
    var dec = o.decimals == null ? 0 : o.decimals;
    var s = Math.abs(n).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, o.comma === false ? '' : ',');
    return (n < 0 ? '−' : '') + (o.prefix || '') + s + (o.suffix || '');
  }
  function countUp(el) {
    var txt = el.textContent, all = txt.match(/\d[\d,]*(\.\d+)?/g);
    if (!all || all.length !== 1 || el.dataset.skCounted) return;
    var raw = all[0], at = txt.indexOf(raw), dec = (raw.split('.')[1] || '').length, target = parseFloat(raw.replace(/,/g, ''));
    // only a big headline number counts up; a stat on a report shows its true value at once
    if (!el.classList.contains('sk-num') || target < 100) return;
    el.dataset.skCounted = '1'; el._skFinal = txt;
    var pre = txt.slice(0, at), post = txt.slice(at + raw.length), comma = raw.indexOf(',') >= 0 || target >= 10000;
    if (still()) return;
    var w = el.getBoundingClientRect().width; if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
    el.style.minWidth = w + 'px';
    var dur = +el.dataset.skCount || 700, t0 = 0;
    function frame(t) {
      if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + format(target * e, { decimals: dec, comma: comma }) + post;
      if (p < 1) requestAnimationFrame(frame); else { el.textContent = txt; el.style.minWidth = ''; }
    }
    el.textContent = pre + format(0, { decimals: dec }) + post;
    requestAnimationFrame(frame);
  }
  // brush marks: a tick, a cross, a half, drawn small for tables and lists
  function markSVG(kind, seed) {
    var p = '';
    // a tick is one stroke, down then up; a cross is two, each from the top. Where a mark is put down in answer to you, the pen draws it.
    if (kind === 'yes') p = penStrokes([{ pts: [[4, 13], [9, 18], [20, 5]], o: { w: 3.4, seed: seed || 3, taper: 0.3 }, pd: 230 }], 'sk-mk-ink').html;
    else if (kind === 'no') p = penStrokes([{ pts: [[5, 5], [18, 18]], o: { w: 3, seed: seed || 4 }, pd: 130 }, { pts: [[18, 5], [5, 18]], o: { w: 3, seed: (seed || 4) + 1 }, pd: 130, gap: 70 }], 'sk-mk-no').html;
    else if (kind === 'part') { var ring0 = INK.circle(11.5, 11.5, 7.2, 14), half = []; for (var q = 0; q <= 8; q++) { var a = Math.PI / 2 + (q / 8) * Math.PI; half.push([11.5 + 7.2 * Math.cos(a), 11.5 + 7.2 * Math.sin(a)]); }
      p = '<path class="sk-mk-part" d="' + INK.soft(half, { seed: seed || 5, wobble: 0.3 }) + '"/><path class="sk-mk-part" d="' + INK.brush(ring0.concat([ring0[0], ring0[1]]), { w: 1.9, seed: (seed || 5) + 2, taper: 0.1, end: 0.8, vary: 0.15 }) + '"/>'; }
    else p = '<path class="sk-mk-part" d="' + INK.soft(INK.circle(11.5, 11.5, 3.6, 10), { seed: seed || 6, wobble: 0.4 }) + '"/>';
    return '<svg class="sk-mk" viewBox="0 0 23 23" aria-hidden="true">' + p + '</svg>';
  }
  // meters, timelines and steps grow the first time they are seen. Inside a part that is still waiting to arrive, they wait for it.
  function arm(el) {
    if (el.classList.contains('sk-steps') && !still()) el.classList.add('sk-pen-wait');
    whenSeen(el, function grow() {
      var w = el.closest('.sk-wait');
      if (w && !still()) { w.addEventListener('sk:reveal', grow, { once: true }); return; }
      el.dataset.skGrown = '1';
      if (el.classList.contains('sk-steps')) penGo(el, el.children.length * 150 + 1200);
    });
  }
  var MARK_WORDS = { yes: 'Yes', no: 'No', part: 'Partly', dot: '' };
  function ring(seed) {
    // one stroke, the way a hand rings a number: it starts near the top (a little differently each time, so the joins never line up
    // down a list), goes round against the clock, and closes just past its own start. It is cut in two so that, drawn on, the end
    // of the stroke doesn't show under its beginning.
    var n = 14, a0 = -Math.PI / 2 + (((seed * 5) % 7) - 2.5) * 0.17, c = [];
    for (var i = 0; i < n + 2; i++) { var a = a0 - (i / n) * Math.PI * 2, k = i < n ? 1 : 1.03 + (i - n) * 0.03; c.push([20 + 16.5 * k * Math.cos(a), 20.5 + 16.5 * k * Math.sin(a)]); }
    return '<svg class="sk-ring" viewBox="0 0 40 40" aria-hidden="true"><path class="sk-ring-fill" d="' + INK.soft(INK.circle(20, 20, 15.5, 12), { seed: seed, wobble: 1.1 }) + '"/>' + penStrokes([{ pts: c, o: { w: 2.6, seed: seed + 3, taper: 0.15, end: 0.5, vary: 0.4 }, cuts: [0.5], pd: 480 }], 'sk-ring-ink').html + '</svg>';
  }
  // the one floating tooltip, for [data-sk-tip] on any element, HTML or SVG
  var tipEl = null;
  function tip(show, host) {
    if (!tipEl) { tipEl = d.createElement('div'); tipEl.className = 'sk-tipbox'; tipEl.setAttribute('role', 'tooltip'); d.body.appendChild(tipEl); }
    if (!show) { tipEl.classList.remove('on'); return; }
    var lines = host.getAttribute('data-sk-tip').split('\n');
    tipEl.textContent = '';
    if (lines.length > 1) { var hd = d.createElement('span'); hd.className = 't-h'; hd.textContent = lines.shift(); tipEl.appendChild(hd); }
    tipEl.appendChild(d.createTextNode(lines.join('\n')));
    var r = host.getBoundingClientRect(); tipEl.classList.add('on');
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)), y = r.top - th - 10;
    if (y < 8) y = r.bottom + 10;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  d.addEventListener('pointerover', function (e) { var h = e.target.closest && e.target.closest('[data-sk-tip]'); if (h) tip(true, h); });
  d.addEventListener('pointerout', function (e) { var h = e.target.closest && e.target.closest('[data-sk-tip]'); if (h && !h.contains(e.relatedTarget)) tip(false); });
  d.addEventListener('focusin', function (e) { var h = e.target.closest && e.target.closest('[data-sk-tip]'); if (h) tip(true, h); });
  d.addEventListener('focusout', function () { tip(false); });
  d.addEventListener('scroll', function () { tip(false); }, { passive: true, capture: true });
  // toast: Sketchbook.toast('Copied'), one at a time, bottom centre
  var toastBox = null;
  // the clipboard, with the old way as a fallback for frames that block the new one
  function copyText(text, msg) {
    function old() {
      var t = d.createElement('textarea'), ok = false; t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      d.body.appendChild(t); t.select(); try { ok = d.execCommand('copy'); } catch (e) { ok = false; } t.remove();
      if (ok) toast(msg); else toast('Copy is blocked here', { tone: 'warn' });
    }
    try { navigator.clipboard.writeText(text).then(function () { toast(msg); }, old); } catch (e) { old(); }
  }
  function toast(text, o) {
    o = o || {};
    if (!toastBox) { toastBox = d.createElement('div'); toastBox.className = 'sk-toasts'; toastBox.setAttribute('aria-live', 'polite'); d.body.appendChild(toastBox); }
    var t = d.createElement('div'); t.className = 'sk-toast'; if (o.tone) t.dataset.tone = o.tone;
    t.innerHTML = (o.tone === 'good' || o.tone == null ? markSVG('yes', 9) : '') + '<span></span>'; t.querySelector('span').textContent = text;
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, o.ms || 2400);
  }
  // a sliding marker under the selected item of a group (tabs, segmented)
  function slide(group, item) {
    if (!item) return;
    group.style.setProperty('--sk-x', item.offsetLeft + 'px');
    group.style.setProperty('--sk-w', item.offsetWidth + 'px');
    if (!group.dataset.skSlid) requestAnimationFrame(function () { group.dataset.skSlid = '1'; });
  }
  function theme(next) {
    var h = d.documentElement, cur = h.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    next = next || (cur === 'dark' ? 'light' : 'dark');
    if (!still()) { h.classList.add('sk-theming'); setTimeout(function () { h.classList.remove('sk-theming'); }, 420); }
    h.setAttribute('data-theme', next); h.setAttribute('data-sk-pinned', ''); // a theme someone picked stops following the system
    d.querySelectorAll('[data-sk-theme]').forEach(function (b) { b.setAttribute('aria-pressed', next === 'dark'); });
  }

  // Sketchbook.set(el, text): a value that changes slides its old digits out and the new ones in
  // set a value with a short swap (old text lifts out, new text settles in); fast repeats land on the latest value
  function swap(el, text) {
    text = String(text);
    if (el._to != null ? el._to === text : el.textContent === text) return;
    el._to = text;
    if (still()) { el.textContent = text; el._to = null; return; }
    if (el._swapT) return;
    var o = d.createElement('span'); o.className = 'sk-swap-out'; o.textContent = el.textContent;
    el.textContent = ''; el.appendChild(o);
    el._swapT = setTimeout(function () { el._swapT = 0; var n = d.createElement('span'); n.className = 'sk-swap-in'; n.textContent = el._to; el._to = null; el.textContent = ''; el.appendChild(n); }, 150);
  }
  function scrolls(pre) { if (pre.scrollWidth > pre.clientWidth + 2) pre.setAttribute('data-scrolls', ''); else pre.removeAttribute('data-scrolls'); }
  function extras(root) {
    // mini pages: real markup laid out at a full page width, then zoomed down to fit its frame
    each(root, '.sk-mini', function (el) {
      if (!once(el, 'Mini')) return;
      var page = d.createElement('div'); page.className = 'sk-mini-page';
      while (el.firstChild) page.appendChild(el.firstChild);
      el.appendChild(page);
      // data-sk-scroll: the frame scrolls through the whole page; otherwise it shows the top of it
      if (el.hasAttribute('data-sk-scroll')) page.setAttribute('inert', ''); else el.setAttribute('inert', '');
      // the page's own layout follows the screen, so on a phone the mini page is a phone-width page
      function fit() { var w = el.clientWidth, full = innerWidth < 760 ? 400 : +el.dataset.skW || 1120; page.style.width = full + 'px'; if (w) page.style.zoom = (w / full).toFixed(4); }
      fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(el);
    });
    // a dock (phones) repeats a number and steps aside while that number is in the upper part of the screen: data-sk-for="#monthly".
    // Watching the number, not its whole panel, means there is never a stretch where neither is on screen.
    each(root, '.sk-dock[data-sk-for]', function (dock) {
      if (!once(dock, 'Dock') || !window.IntersectionObserver) return;
      var t = d.querySelector(dock.dataset.skFor); if (!t) return;
      new IntersectionObserver(function (es) { dock.toggleAttribute('data-away', es[0].isIntersecting); }, { rootMargin: '0px 0px -40% 0px' }).observe(t);
    });
    each(root, '.sk-meter[data-sk-goal]', function (m) { if (!once(m, 'Goal')) return; var g = d.createElement('span'); g.className = 'sk-meter-goal'; g.setAttribute('aria-hidden', 'true'); g.textContent = m.dataset.skGoal; m.appendChild(g); });
    // flip cards
    // a sticky note's tilt comes from its words, so two on a page never lean the same way
    each(root, '.sk-sticky', function (st) {
      if (!once(st, 'Tilt') || st.style.getPropertyValue('--tilt')) return;
      var h = 0, t = st.textContent; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      var deg = 0.7 + (h % 13) / 10; st.style.setProperty('--tilt', (h & 16 ? -deg : deg).toFixed(1) + 'deg');
    });
    // curly quotes and apostrophes in the words people read (never inside code)
    if (once(d.documentElement, 'Quotes')) {
      var tw = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return /['"]/.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest('code, pre, kbd, script, style, textarea, input, [data-sk-raw]')) ? 1 : 3; } }), tn, all = [];
      while ((tn = tw.nextNode())) all.push(tn);
      var prev = ' ';
      all.forEach(function (n) {
        var v = n.nodeValue, out = '';
        for (var i = 0; i < v.length; i++) {
          var ch = v[i], before = i ? v[i - 1] : prev, opens = /[\s(\[—–‘“-]/.test(before);
          out += ch === "'" ? (opens && /\w/.test(v[i + 1] || '') ? '‘' : '’') : ch === '"' ? (opens ? '“' : '”') : ch;
        }
        n.nodeValue = out; prev = v[v.length - 1] || prev;
      });
    }
    // a bare table gets a scrolling wrap; a comparison matrix also gets one card per option for phones
    each(root, 'table.sk-table', function (t) {
      if (!once(t, 'Wrap')) return;
      if (!t.parentElement.classList.contains('sk-table-wrap')) { var w = d.createElement('div'); w.className = 'sk-table-wrap'; t.parentNode.insertBefore(w, t); w.appendChild(t); }
      if (!t.classList.contains('sk-matrix') || !t.tHead) return;
      var heads = Array.prototype.slice.call(t.tHead.rows[0].cells).slice(1), keyCol = -1;
      Array.prototype.slice.call(t.querySelectorAll('colgroup > col')).forEach(function (c, i) { if (c.classList.contains('sk-key')) keyCol = i - 1; });
      var html = '<div class="sk-matrix-cards">';
      heads.forEach(function (th, j) {
        html += '<section class="sk-mcard"' + (j === keyCol ? ' data-key' : '') + '><h4>' + th.innerHTML + '</h4><dl>';
        Array.prototype.slice.call(t.tBodies[0].rows).forEach(function (tr) {
          var c = tr.cells[j + 1]; if (!c) return;
          html += '<div><dt>' + tr.cells[0].innerHTML + '</dt><dd' + (c.dataset.skMark ? ' data-sk-mark="' + c.dataset.skMark + '"' : '') + '>' + c.innerHTML + '</dd></div>';
        });
        html += '</dl></section>';
      });
      t.parentElement.insertAdjacentHTML('afterend', html + '</div>');
    });
    each(root, '.sk-flip', function (f) {
      if (!once(f, 'Flip')) return;
      if (!f.hasAttribute('aria-pressed')) f.setAttribute('aria-pressed', 'false');
      // the back says which card it is: its label is the term on the front
      var term = f.firstElementChild && f.firstElementChild.querySelector('h4'), bl = f.lastElementChild && f.lastElementChild.querySelector('.sk-label');
      if (term && bl && /^(answer|back)$/i.test(bl.textContent.trim())) bl.textContent = term.textContent;
      // an index card: it sits a little crooked, and the front says it turns over, with a small arrow curling round
      var h = hash((term && term.textContent) || f.textContent); f.style.setProperty('--tilt', (((h % 7) - 3) * 0.35).toFixed(2) + 'deg');
      if (f.firstElementChild && !f.firstElementChild.querySelector('.sk-flip-turn')) {
        var a = arrow(4, 6, 30, 16, 7, 1.9, 3 + (h % 5));
        f.firstElementChild.insertAdjacentHTML('beforeend', '<span class="sk-flip-turn" aria-hidden="true">Turn over<svg class="sk-ink" viewBox="0 0 36 22"><g class="ink"><path d="' + a[0] + '"/><path d="' + a[1] + '"/></g></svg></span>');
      }
      f.addEventListener('click', function () { f.setAttribute('aria-pressed', f.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });
    });
    // decks: each slide is laid out at 1280x720 and scaled; arrows step, Present goes full screen
    each(root, '.sk-deck', function (deck) {
      if (!once(deck, 'Deck')) return;
      var slides = Array.prototype.slice.call(deck.querySelectorAll(':scope > .sk-slide')), cur = 0, counter = deck.querySelector('[data-sk-deck-n]');
      slides.forEach(function (sl, i) {
        var inn = d.createElement('div'); inn.className = 'sk-slide-in';
        while (sl.firstChild) inn.appendChild(sl.firstChild);
        // the slide number lives inside the scaled slide, in the margin outside its content, so it scales with it and never lands on it
        sl.appendChild(inn); inn.insertAdjacentHTML('beforeend', '<span class="sk-slide-n" aria-hidden="true">' + (i + 1) + ' / ' + slides.length + '</span>');
        function fit() { var w = sl.clientWidth; if (w) inn.style.transform = 'scale(' + (w / 1280).toFixed(4) + ')'; }
        fit(); if (window.ResizeObserver) new ResizeObserver(fit).observe(sl);
      });
      function show(i) {
        cur = Math.max(0, Math.min(slides.length - 1, i));
        slides.forEach(function (sl, k) { sl.toggleAttribute('data-current', k === cur); });
        if (counter) counter.textContent = (cur + 1) + ' of ' + slides.length;
        if (!deck.hasAttribute('data-presenting')) slides[cur].scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' });
      }
      slides.forEach(function (sl, k) { sl.addEventListener('click', function (e) {
        if (deck.hasAttribute('data-presenting')) { var r = sl.getBoundingClientRect(); show(e.clientX - r.left < r.width / 3 ? cur - 1 : cur + 1); return; }
        cur = k; slides.forEach(function (x, j) { x.toggleAttribute('data-current', j === k); }); if (counter) counter.textContent = (k + 1) + ' of ' + slides.length;
      }); });
      deck.insertAdjacentHTML('beforeend', '<button class="sk-deck-exit" type="button" aria-label="Close" title="Close (Esc)"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8"/></svg></button>');
      function present(on) {
        if (on === deck.hasAttribute('data-presenting')) return;
        // the switch itself doesn't animate, so the other slides never flash on the way in or out
        deck.classList.add('sk-deck-switch');
        // a phone held upright can't show a 16:9 slide at a size anyone can read, so it presents the reflowed phone slides, one a screen
        deck.toggleAttribute('data-reflow', on && matchMedia('(max-width: 640px) and (orientation: portrait)').matches);
        deck.toggleAttribute('data-presenting', on); d.documentElement.classList.toggle('sk-presenting', on);
        requestAnimationFrame(function () { requestAnimationFrame(function () { deck.classList.remove('sk-deck-switch'); }); });
        if (on) { if (deck.requestFullscreen) deck.requestFullscreen().catch(function () {}); show(cur); }
        else {
          if (d.fullscreenElement === deck && d.exitFullscreen) d.exitFullscreen().catch(function () {});
          // closing lands you on the slide you were on, with focus back on Present
          var back = function () { slides[cur].scrollIntoView({ block: 'center' }); var p = deck.querySelector('[data-sk-present]'); if (p) p.focus({ preventScroll: true }); };
          back(); setTimeout(back, 120);
        }
      }
      deck.querySelector('.sk-deck-exit').addEventListener('click', function (e) { e.stopPropagation(); present(false); });
      d.addEventListener('fullscreenchange', function () { if (d.fullscreenElement !== deck && deck.hasAttribute('data-presenting')) present(false); });
      slides[0] && slides[0].setAttribute('data-current', '');
      d.addEventListener('keydown', function (e) {
        if (e.target.closest('input, textarea, select, [contenteditable]')) return;
        var full = deck.hasAttribute('data-presenting');
        if (full && e.key === 'Escape') { present(false); return; }
        if (!full && !deck.matches(':hover') && !deck.contains(d.activeElement)) return;
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || (full && e.key === ' ')) { e.preventDefault(); show(cur + 1); }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(cur - 1); }
      });
      var go = deck.querySelector('[data-sk-present]');
      if (go) go.addEventListener('click', function () { present(true); });
      if (counter) counter.textContent = '1 of ' + slides.length;
    });
    // quiz: one question with a right answer; Check marks the rows, shows the matching feedback, then becomes Next
    each(root, '.sk-quiz', function (q) {
      if (!once(q, 'Quiz')) return;
      var btn = q.querySelector('[data-sk-check]'); if (!btn) return;
      var label0 = btn.textContent, rows = q.querySelectorAll('.sk-radio, .sk-check');
      q.addEventListener('submit', function (e) { e.preventDefault(); });
      btn.addEventListener('click', function () {
        if (q.hasAttribute('data-done')) { q.dispatchEvent(new CustomEvent('sk:next', { bubbles: true })); return; }
        var picked = q.querySelectorAll('input:checked'); if (!picked.length) { toast(q.dataset.skEmpty || 'Pick an answer first', { tone: 'warn' }); return; }
        var ok = true, mk = 0;
        rows.forEach(function (r, i) {
          var input = r.querySelector('input'), right = r.hasAttribute('data-right'), on = input && input.checked;
          if (right !== !!on) ok = false;
          if (right || on) { r.insertAdjacentHTML('beforeend', '<span class="sk-quiz-mark" style="--i:' + (mk++) + '">' + markSVG(right ? 'yes' : 'no', 3 + i) + '<span class="sk-sr">' + (right ? 'Right answer' : 'Your answer, not right') + '</span></span>'); }
          if (input) input.disabled = true;
        });
        q.setAttribute('data-done', ok ? 'right' : 'wrong');
        q.querySelectorAll('[data-sk-if]').forEach(function (f) { f.hidden = f.dataset.skIf !== (ok ? 'right' : 'wrong'); });
        // the way on takes focus, so the next Enter moves on whether the answer was picked by click, key or tap
        if (btn.dataset.skNext !== undefined) { swap(btn, btn.dataset.skNext || 'Next question'); btn.setAttribute('data-sk-arrow', ''); btn.focus({ preventScroll: true }); }
        q.dispatchEvent(new CustomEvent('sk:answer', { bubbles: true, detail: { right: ok } }));
      });
      // number keys choose while the question is open (first open quiz on the page)
      d.addEventListener('keydown', function (e) {
        if (q.hasAttribute('data-done') || e.target.closest('input[type=text], textarea, [contenteditable]') || d.querySelector('.sk-quiz:not([data-done])') !== q) return;
        var i = +e.key; if (i >= 1 && i <= rows.length) { var inp = rows[i - 1].querySelector('input'); if (inp) inp.click(); }
        if (e.key === 'Enter' && q.querySelector('input:checked') && !e.target.closest('button, a')) { e.preventDefault(); btn.click(); }
      });
    });
    // wide tables: a fade at the right edge says there is more to scroll to
    each(root, '.sk-table-wrap', function (w) { if (!once(w, 'Wrap')) return; scrolls(w); if (window.ResizeObserver) new ResizeObserver(function () { scrolls(w); }).observe(w); w.addEventListener('scroll', function () { if (w.scrollLeft + w.clientWidth >= w.scrollWidth - 4) w.removeAttribute('data-scrolls'); else scrolls(w); }, { passive: true }); });
    // code blocks
    each(root, 'pre.sk-code', function (pre) { if (!once(pre, 'Code')) return; codeBlock(pre); scrolls(pre); if (window.ResizeObserver) new ResizeObserver(function () { scrolls(pre); }).observe(pre); pre.addEventListener('scroll', function () { if (pre.scrollLeft + pre.clientWidth >= pre.scrollWidth - 4) pre.removeAttribute('data-scrolls'); else scrolls(pre); }, { passive: true }); });
    // charts drawn from data
    each(root, '[data-sk-chart]', function (el) { if (once(el, 'Chart')) chart(el); });
    // marks in tables and lists
    each(root, '[data-sk-mark]', function (el) {
      if (!once(el, 'Mark')) return;
      var k = el.dataset.skMark, label = el.textContent.trim();
      el.insertAdjacentHTML('afterbegin', markSVG(k, (el.cellIndex || 0) + 3));
      if (!label && MARK_WORDS[k]) el.insertAdjacentHTML('beforeend', '<span class="sk-sr">' + MARK_WORDS[k] + '</span>');
    });
    // checkboxes and radios: a brush tick that draws itself when checked
    each(root, '.sk-check, .sk-radio', function (el, i) {
      if (!once(el, 'Check')) return;
      var input = el.querySelector('input'); if (!input) return;
      var box = d.createElement('span'); box.className = 'sk-box'; box.setAttribute('aria-hidden', 'true');
      box.innerHTML = el.classList.contains('sk-check') ? '<svg viewBox="0 0 23 23">' + penStrokes([{ pts: [[4.5, 12.5], [9.5, 17.5], [19, 5.5]], o: { w: 3.2, seed: 11 + i, taper: 0.3 }, pd: 210 }]).html + '</svg>' : '';
      input.insertAdjacentElement('afterend', box);
      // in a task list the words sit in an inline wrapper, so the strike-through is drawn on each line of a wrapped task
      var words = el.closest('.sk-tasks') && el.querySelector(':scope > span:not(.sk-box)');
      if (words && !words.querySelector('.sk-strike')) {
        var st = d.createElement('span'); st.className = 'sk-strike';
        while (words.firstChild && !(words.firstChild.nodeType === 1 && words.firstChild.tagName === 'SMALL')) st.appendChild(words.firstChild);
        words.insertBefore(st, words.firstChild);
      }
    });
    // steps: numbers in hand-drawn rings
    each(root, '.sk-steps > li', function (li, i) {
      if (!once(li, 'Step')) return;
      var n = li.parentNode.start ? li.parentNode.start + Array.prototype.indexOf.call(li.parentNode.children, li) : Array.prototype.indexOf.call(li.parentNode.children, li) + 1;
      li.insertAdjacentHTML('afterbegin', '<span class="sk-step-n" aria-hidden="true">' + ring(5 + i * 3) + '<b>' + n + '</b></span>');
      chalkFor(li.querySelector('.sk-ring'));
    });
    // meters and timelines grow when seen
    each(root, '.sk-timeline > li, .sk-steps > li', function (li) { li.style.setProperty('--i', Array.prototype.indexOf.call(li.parentNode.children, li)); });
    each(root, '.sk-meter, .sk-timeline, .sk-steps, .sk-stack-bar', function (el) { if (once(el, 'Grow')) arm(el); });
    each(root, '[data-sk-count]', function (el) { if (once(el, 'Count')) whenSeen(el, function () { countUp(el); }); });
    // segmented controls and tabs
    each(root, '.sk-seg', function (g) {
      if (!once(g, 'Seg')) return;
      var items = g.querySelectorAll('button'); g.setAttribute('role', 'radiogroup');
      items.forEach(function (b) {
        b.setAttribute('role', 'radio'); b.type = 'button';
        b.addEventListener('click', function () {
          items.forEach(function (x) { x.setAttribute('aria-checked', x === b); });
          slide(g, b); g.dispatchEvent(new CustomEvent('sk:change', { bubbles: true, detail: { value: b.value || b.dataset.value || b.textContent.trim() } }));
        });
      });
      var cur = g.querySelector('[aria-checked="true"]') || items[0]; if (cur) cur.setAttribute('aria-checked', 'true');
      requestAnimationFrame(function () { slide(g, cur); });
    });
    each(root, '.sk-tabs', function (g) {
      if (!once(g, 'Tabs')) return;
      var tabs = Array.prototype.slice.call(g.querySelectorAll(':scope > button')); g.setAttribute('role', 'tablist');
      function pick(b, focus) {
        tabs.forEach(function (x) {
          var on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
          var p = x.getAttribute('aria-controls') && d.getElementById(x.getAttribute('aria-controls'));
          if (p) { p.hidden = !on; if (on) { p.classList.remove('sk-panel-in'); void p.offsetWidth; p.classList.add('sk-panel-in'); } }
        });
        slide(g, b); if (focus) b.focus();
        g.dispatchEvent(new CustomEvent('sk:change', { bubbles: true, detail: { value: b.value || b.dataset.value || b.textContent.trim() } }));
      }
      tabs.forEach(function (b, i) {
        b.setAttribute('role', 'tab'); b.type = 'button';
        var p = b.getAttribute('aria-controls') && d.getElementById(b.getAttribute('aria-controls')); if (p) { p.setAttribute('role', 'tabpanel'); p.classList.add('sk-panel'); }
        b.addEventListener('click', function () { pick(b); });
        b.addEventListener('keydown', function (e) {
          var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (k) { e.preventDefault(); pick(tabs[(i + k + tabs.length) % tabs.length], true); }
        });
      });
      var cur = g.querySelector('[aria-selected="true"]') || tabs[0];
      tabs.forEach(function (x) { var p = x.getAttribute('aria-controls') && d.getElementById(x.getAttribute('aria-controls')); if (p) p.hidden = x !== cur; x.setAttribute('aria-selected', x === cur); x.tabIndex = x === cur ? 0 : -1; });
      requestAnimationFrame(function () { slide(g, cur); });
    });
    // range: clay fill up to the thumb, and an optional live readout
    each(root, 'input.sk-range', function (r) {
      if (!once(r, 'Range')) return;
      function upd() {
        var p = (r.value - (r.min || 0)) / ((r.max || 100) - (r.min || 0));
        r.style.setProperty('--p', (p * 100) + '%');
        var out = r.id && root.querySelector('output[for~="' + r.id + '"]');
        if (out && r.dataset.skFormat) out.textContent = format(+r.value, JSON.parse(r.dataset.skFormat));
      }
      r.addEventListener('input', upd); upd();
    });
    // accordion: the answer slides open
    each(root, 'details.sk-details', function (el) {
      if (!once(el, 'Det')) return;
      el.addEventListener('toggle', function () { if (el.open && !still()) { var c = el.querySelector(':scope > :not(summary)'); if (c) c.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.9,.3,1)' }); } });
    });
    // dialogs: [data-sk-open="#id"] opens, [data-sk-close] closes, a click on the scrim closes
    each(root, '[data-sk-open]', function (b) {
      if (!once(b, 'Open')) return;
      b.addEventListener('click', function () { var dl = d.querySelector(b.dataset.skOpen); if (dl && dl.showModal) dl.showModal(); });
    });
    each(root, 'dialog.sk-dialog', function (dl) {
      if (!once(dl, 'Dlg')) return;
      dl.addEventListener('click', function (e) { if (e.target === dl || e.target.closest('[data-sk-close]')) dl.close(); });
    });
    // before/after: drag the handle
    each(root, '.sk-compare', function (c) {
      if (!once(c, 'Cmp')) return;
      var r = d.createElement('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = c.dataset.skAt || 50; r.className = 'sk-compare-range'; r.setAttribute('aria-label', c.dataset.skLabel || 'Compare before and after');
      c.appendChild(r); c.insertAdjacentHTML('beforeend', '<span class="sk-compare-handle" aria-hidden="true"></span>');
      function upd() { c.style.setProperty('--at', r.value + '%'); }
      r.addEventListener('input', upd); upd();
    });
    // copy buttons: data-sk-copy copies the code block it sits in, or the element its selector names;
    // data-sk-copy-text copies those words. data-sk-copied is what the toast says afterwards.
    each(root, '[data-sk-copy], [data-sk-copy-text]', function (b) {
      if (!once(b, 'Copy')) return;
      b.addEventListener('click', function () {
        var text = b.dataset.skCopyText;
        if (text == null) { var src = b.dataset.skCopy ? d.querySelector(b.dataset.skCopy) : b.closest('.sk-code-wrap'); var box = src && (src.querySelector('code') || src), pins = box ? box.querySelectorAll('.sk-lpin') : []; pins.forEach(function (x) { x.style.display = 'none'; }); text = box ? box.innerText : ''; pins.forEach(function (x) { x.style.display = ''; }); }
        copyText(text, b.dataset.skCopied || 'Copied');
      });
    });
    // theme toggle
    each(root, '[data-sk-theme]', function (b) {
      if (!once(b, 'Theme')) return;
      b.addEventListener('click', function () { theme(); });
      b.setAttribute('aria-pressed', (d.documentElement.getAttribute('data-theme') || '') === 'dark');
    });
    // the top bar gets its hairline once the page scrolls under it
    each(root, '.sk-bar', function (bar) {
      if (!once(bar, 'Bar')) return;
      function upd() { bar.toggleAttribute('data-scrolled', scrollY > 8); }
      addEventListener('scroll', upd, { passive: true }); upd();
    });
    // table of contents: marks the section you're reading
    each(root, '.sk-toc', function (toc) {
      if (!once(toc, 'Toc')) return;
      var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
      var secs = links.map(function (a) { return d.getElementById(a.getAttribute('href').slice(1)); }), held = null, holdT, queued = 0, last;
      // the current part is the last one whose top has passed a line a third of the way down; a click holds its own link until the scroll settles
      function mark(a) { if (!a || a === last) return; last = a; links.forEach(function (x) { if (x === a) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); }); slideV(toc, a); }
      function pick() {
        queued = 0; if (held) return mark(held);
        var line = Math.min(innerHeight * 0.33, 220), cur = 0;
        secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= line) cur = i; });
        if (innerHeight + scrollY >= d.documentElement.scrollHeight - 4) for (var i = secs.length - 1; i >= 0; i--) { if (secs[i] && secs[i].getBoundingClientRect().top < innerHeight) { cur = Math.max(cur, i); break; } }
        mark(links[cur]);
      }
      addEventListener('scroll', function () { if (held) { clearTimeout(holdT); holdT = setTimeout(function () { held = null; pick(); }, 160); } if (!queued) queued = requestAnimationFrame(pick); }, { passive: true });
      links.forEach(function (a) { a.addEventListener('click', function () { held = a; mark(a); clearTimeout(holdT); holdT = setTimeout(function () { held = null; }, 900); }); });
      addEventListener('resize', pick);
      requestAnimationFrame(pick);
    });
    // loaders: a brush scribble that draws and undraws
    each(root, '.sk-loader', function (el) {
      if (!once(el, 'Load')) return;
      var pts = []; for (var i = 0; i <= 24; i++) { var t = i / 24; pts.push([8 + t * 84, 30 + Math.sin(t * Math.PI * 3) * 12 * (0.5 + t * 0.5)]); }
      el.innerHTML = '<svg viewBox="0 0 100 60" aria-hidden="true"><path pathLength="1" d="' + INK.line(pts, { seed: 3, wobble: 0.4 }) + '"/></svg>' + el.innerHTML;
    });
  }
  function slideV(group, item) {
    if (!item) return;
    group.style.setProperty('--sk-y', item.offsetTop + 'px');
    group.style.setProperty('--sk-h', item.offsetHeight + 'px');
  }
  // ---- charts drawn from data: clean vector marks, the key one in clay, text at true size ----
  // <div data-sk-chart="bars|hbars|line|spark|stack|dots" data-sk-data='…' data-sk-key="Fri" data-sk-format='{"prefix":"$"}' data-sk-note='{"at":"Fri","text":"Payday"}'>
  function niceTicks(max, n, whole) {
    if (!(max > 0)) return [0, 1];
    var raw = max / (n || 4), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag, out = [];
    if (whole) step = Math.max(1, Math.round(step));
    for (var v = 0; v <= max + step * 0.001; v += step) out.push(+v.toFixed(10));
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
    return out;
  }
  // ticks for a range that needn't start at zero (ratings 3 to 5, prices 400 to 900)
  function niceRange(lo, hi, n) {
    if (!(hi > lo)) return [lo, lo + 1];
    var raw = (hi - lo) / (n || 4), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag, out = [];
    for (var v = Math.floor(lo / step) * step; v < hi + step * 0.999; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function chartNote(el, x, y, text, side, flipped) {
    var n = d.createElement('span'); n.className = 'sk-note sk-chart-note'; n.textContent = text;
    if (side === 'right') n.dataset.skPoint = 'right';
    n.insertAdjacentHTML('afterbegin', noteArrow(side === 'right' ? 'right' : 'left'));
    n.style.left = x + 'px'; n.style.top = y + 'px';
    el.appendChild(n);
    // keep the note inside the chart: take the side with more room, and let the words wrap to fit it
    var W = el.clientWidth, room = side === 'right' ? x : W - x;
    if (n.offsetWidth > room) {
      var other = side === 'right' ? W - x : x;
      if (other > room && !flipped) { n.remove(); return chartNote(el, x + (side === 'right' ? 12 : -12), y, text, side === 'right' ? 'left' : 'right', true); }
      n.style.whiteSpace = 'normal'; n.style.width = Math.max(120, room - 6) + 'px'; n.style.lineHeight = '1.1';
    }
  }
  function chart(el) {
    var kind = el.dataset.skChart, data, pal = el.dataset.skColors === 'series' ? 's' : 't';
    try { data = JSON.parse(el.dataset.skData); } catch (e) { return; }
    var fmtO = el.dataset.skFormat ? JSON.parse(el.dataset.skFormat) : {};
    var fmt = function (v) { return format(v, { prefix: fmtO.prefix, suffix: fmtO.suffix, decimals: fmtO.decimals == null ? (Math.abs(v) < 10 && v % 1 ? 1 : 0) : fmtO.decimals }); };
    // axis ticks shorten big numbers (600k, 1.2M); the left margin fits the widest one
    var tick = function (t, top) {
      var u = top >= 1e6 ? [1e6, 'M'] : top >= 1e4 ? [1e3, 'k'] : null; if (!u || !t) return fmt(t);
      var v = t / u[0]; return format(v, { prefix: fmtO.prefix, decimals: v % 1 ? 1 : 0 }) + u[1] + (fmtO.suffix || '');
    };
    var gutter = function (ts, top) { return Math.max(34, Math.round(Math.max.apply(null, ts.map(function (t) { return tick(t, top).length; })) * 7.4 + 14)); };
    // keys: "Fri", "Fri, Sat" or a JSON list
    // read on every render, so a step or a script can move the key by changing data-sk-key
    var keys = [];
    function readKeys() {
      var kraw = el.dataset.skKey || '';
      if (/^\s*\[/.test(kraw)) { try { return JSON.parse(kraw).map(String); } catch (e) { return []; } }
      return kraw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    var note = el.dataset.skNote ? JSON.parse(el.dataset.skNote) : null;
    el.classList.add('sk-chart-box', 'sk-chart-' + kind);
    function render(animate) {
      keys = readKeys();
      var W = Math.max(200, Math.round(el.clientWidth || 600)), out = '', H; el._skW = el.clientWidth ? W : 0;
      // a note on a dot chart always sits in a band above the plot, where it can't land on the dots or their names; on lines and columns it does when narrow
      var topNote = !!note && (kind === 'dots' || (W < 560 && (kind === 'line' || kind === 'bars'))), NB = topNote ? 46 : 0;
      el.querySelectorAll('.sk-chart, .sk-chart-note, .sk-legend').forEach(function (x) { x.remove(); });
      if (kind === 'bars') {
        var n = data.length, max = Math.max(+el.dataset.skMax || 0, Math.max.apply(null, data.map(function (r) { return r[1]; }))), axis = el.dataset.skAxis !== 'none';
        var ticks = niceTicks(max, 4, data.every(function (r) { return r[1] % 1 === 0; })), top = ticks[ticks.length - 1];
        H = (+el.dataset.skH || 240) + NB; var L = axis ? gutter(ticks, top) : 4, R = 4, T = 24 + NB, B = 30, iw = W - L - R, ih = H - T - B, band = iw / n, bw = Math.min(56, band * 0.64);
        if (axis) ticks.forEach(function (t) { var y = T + ih - (t / top) * ih; out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text class="tick" x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(tick(t, top)) + '</text>'; });
        // x labels keep one even rhythm, measured in their real face, anchored on the key bar
        var XFONT = '400 12.5px Literata, Georgia, serif', widest = Math.max.apply(null, data.map(function (r) { return textW(String(r[0]), XFONT); })) + 12;
        var every = Math.max(1, Math.ceil(widest / band)), k0 = 0, xl = [];
        // the rhythm starts where it lands on the most key bars; with one or two keys, a key off the rhythm still gets its label
        var kIdx = []; data.forEach(function (r, q) { if (keys.indexOf(String(r[0])) >= 0) kIdx.push(q); });
        if (kIdx.length) { k0 = kIdx[0] % every; var hits = -1; for (var o = 0; o < every; o++) { var hh = kIdx.filter(function (q) { return q % every === o; }).length; if (hh > hits || (hh === hits && o === kIdx[0] % every)) { hits = hh; k0 = o; } } }
        var forceKeys = kIdx.length <= 2;
        // data-sk-ticks="38,50,62" names the only labels to show under the bars, so the value the chart is about is always one of them
        var ticksAt = el.dataset.skTicks ? el.dataset.skTicks.split(',').map(function (t) { return t.trim(); }) : null;
        data.forEach(function (r, i) {
          var h = (r[1] / top) * ih, x = L + band * i + (band - bw) / 2, y = T + ih - h, key = keys.length ? keys.indexOf(String(r[0])) >= 0 : true, rr = Math.min(4, bw / 2, h);
          out += '<path class="bar' + (key ? ' key' : '') + '" style="--i:' + i + '" data-sk-tip="' + esc(r[0] + ': ' + fmt(r[1])) + '" d="M' + x + ' ' + (T + ih) + 'V' + (y + rr) + 'Q' + x + ' ' + y + ' ' + (x + rr) + ' ' + y + 'H' + (x + bw - rr) + 'Q' + (x + bw) + ' ' + y + ' ' + (x + bw) + ' ' + (y + rr) + 'V' + (T + ih) + 'Z"/>';
          // a value label only where it has room above its own bar; the tooltip carries the rest
          if (((keys.length && key) || (!axis && n <= 12)) && band >= String(fmt(r[1])).length * 7.2 + 4) out += '<text class="val" x="' + (x + bw / 2) + '" y="' + (y - 8) + '" text-anchor="middle" style="--i:' + i + '">' + esc(fmt(r[1])) + '</text>';
          if (ticksAt ? ticksAt.indexOf(String(r[0])) >= 0 : (i - k0) % every === 0 || (key && keys.length && forceKeys)) xl.push({ x: x + bw / 2, t: String(r[0]), key: key && keys.length });
          if (note && String(note.at) === String(r[0])) note.xy = [x + bw / 2, y];
        });
        // x labels: the key ones first, then any other that keeps clear of them
        var placed = [];
        xl.filter(function (l) { return l.key; }).concat(xl.filter(function (l) { return !l.key; })).forEach(function (l) {
          var half = textW(l.t, l.key ? '500 12.5px Literata, Georgia, serif' : XFONT) / 2 + 5;
          if (placed.some(function (q) { return Math.abs(q.x - l.x) < half + q.half; })) return;
          l.half = half; placed.push(l);
          out += '<text class="xl' + (l.key ? ' key' : '') + '" x="' + l.x + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(l.t) + '</text>';
        });
        out += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '"/>';
      } else if (kind === 'hbars') {
        // wide: label | bar value. Narrow: the label sits on its own line above the bar
        // on a presented slide the rows are slide-sized: thick bars, 24px words
        var max2 = Math.max(+el.dataset.skMax || 0, Math.max.apply(null, data.map(function (r) { return r[1]; }))), over = W < 520, big = !over && !!el.closest('.sk-slide'), rowH = big ? 112 : over ? 50 : 34, lw = over || big ? 0 : Math.min(200, Math.round(W * 0.32)), vw = big ? 104 : 72, bh = big ? 44 : over ? 16 : rowH - 14;
        if (big) over = true;
        el.classList.toggle('sk-chart-big', big);
        H = data.length * rowH + 4; var bw2 = W - lw - vw;
        data.forEach(function (r, i) {
          var y = i * rowH, by = big ? y + 44 : over ? y + 24 : y + (rowH - bh) / 2, w = Math.max(2, (r[1] / max2) * bw2), key = keys.length ? keys.indexOf(String(r[0])) >= 0 : i === 0, mid = by + bh / 2;
          out += '<text class="hl' + (key ? ' key' : '') + '" x="0" y="' + (big ? y + 28 : over ? y + 16 : mid) + '"' + (over ? '' : ' dominant-baseline="central"') + '>' + esc(r[0]) + '</text>';
          out += '<rect class="bar' + (key ? ' key' : '') + '" style="--i:' + i + '" data-sk-tip="' + esc(r[0] + ': ' + fmt(r[1])) + '" x="' + lw + '" y="' + by + '" width="' + w + '" height="' + bh + '" rx="' + (big ? 6 : 3) + '"/>';
          out += '<text class="val' + (key ? '' : ' dim') + '" style="--i:' + i + '" x="' + (lw + w + (big ? 14 : 8)) + '" y="' + mid + '" dominant-baseline="central">' + esc(fmt(r[1])) + '</text>';
          if (note && String(note.at) === String(r[0])) note.xy = [lw + w + 50, by + 1];
        });
      } else if (kind === 'line' || kind === 'spark') {
        var spark = kind === 'spark', series = spark ? [{ values: data }] : data.series, xs = spark ? data.map(function (_, i) { return i; }) : data.x;
        var all = []; series.forEach(function (s) { all = all.concat(s.values); });
        // data-sk-from starts the scale above zero, for a line whose story is in a narrow band (sales of $900 to $1,500)
        var from = el.dataset.skFrom != null ? +el.dataset.skFrom : 0;
        var hi = Math.max(+el.dataset.skMax || 0, Math.max.apply(null, all)), lo = spark ? Math.min.apply(null, all) : from, ticks2 = spark ? [lo, hi] : from ? niceRange(from, hi, 4) : niceTicks(hi, 4, all.every(function (v) { return v % 1 === 0; })), top2 = spark ? hi : ticks2[ticks2.length - 1];
        H = (+el.dataset.skH || (spark ? 40 : 260)) + NB;
        var L2 = spark ? 3 : gutter(ticks2, top2), R2 = spark ? 6 : (series.length > 1 || series[0].name ? 92 : 16), T2 = spark ? 5 : 16 + NB, B2 = spark ? 5 : 30, iw2 = W - L2 - R2, ih2 = H - T2 - B2;
        var X = function (i) { return L2 + (xs.length < 2 ? iw2 / 2 : (i / (xs.length - 1)) * iw2); }, Y = function (v) { return T2 + ih2 - ((v - lo) / ((top2 - lo) || 1)) * ih2; };
        if (!spark) {
          ticks2.forEach(function (t) { var y = Y(t); out += '<line class="grid" x1="' + L2 + '" x2="' + (W - R2) + '" y1="' + y + '" y2="' + y + '"/><text class="tick" x="' + (L2 - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(tick(t, top2)) + '</text>'; });
          // labels at an even step (1, 2, 5, 10…) and always the last; a step label too close to the last one gives way
          var need = Math.ceil(xs.length / Math.max(1, Math.floor(iw2 / 64))), every2 = [1, 2, 5, 10, 15, 20, 25, 50, 100].filter(function (k) { return k >= need; })[0] || need, lastR = (xs.length - 1) % every2;
          xs.forEach(function (x, i) { if (i === xs.length - 1 || i % every2 === 0 && !(lastR && lastR < every2 * 0.5 && i === xs.length - 1 - lastR)) out += '<text class="xl" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(x) + '</text>'; });
        }
        series.slice().reverse().forEach(function (s, ri) {
          var si = series.length - 1 - ri, main = si === 0, pts = s.values.map(function (v, i) { return [X(i), Y(v)]; });
          var dd = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
          if (main && series.length > 1) { var o2 = series[1].values.map(function (v, i) { return [X(i), Y(v)]; }).reverse(); out += '<path class="area gap" d="' + dd + 'L' + o2.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z"/>'; }
          else if (main) out += '<path class="area" d="' + dd + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (T2 + ih2) + 'L' + pts[0][0].toFixed(1) + ' ' + (T2 + ih2) + 'Z"/>';
          out += '<path class="ln' + (main ? ' key' : '') + '" pathLength="1" d="' + dd + '"/>';
          var e = pts[pts.length - 1];
          if (main) out += '<circle class="end" cx="' + e[0] + '" cy="' + e[1] + '" r="' + (spark ? 3 : 4.5) + '"/>';
          if (!spark && s.name) out += '<text class="sname' + (main ? ' key' : '') + '" x="' + (e[0] + 10) + '" y="' + (e[1] + 4) + '">' + esc(s.name) + '</text>';
        });
        if (!spark) xs.forEach(function (x, i) {
          var w = iw2 / Math.max(1, xs.length - 1), t = x + ' · ' + series.map(function (s) { return (s.name ? s.name + ' ' : '') + fmt(s.values[i]); }).join(' · ');
          out += '<rect class="hit" x="' + (X(i) - w / 2) + '" y="' + T2 + '" width="' + w + '" height="' + ih2 + '" data-sk-tip="' + esc(t) + '"/>';
          out += '<g class="hov"><line x1="' + X(i) + '" x2="' + X(i) + '" y1="' + T2 + '" y2="' + (T2 + ih2) + '"/>' + series.map(function (s2, si) { return '<circle' + (si ? ' class="o"' : '') + ' cx="' + X(i) + '" cy="' + Y(s2.values[i]) + '" r="4.5"/>'; }).reverse().join('') + '</g>';
          if (note && String(note.at) === String(x)) note.xy = [X(i), Y(series[0].values[i])];
        });
      } else if (kind === 'dots') {
        // two measures of each thing: {"x":"Size","y":"Rent","points":[["Elm Road",54,1450],…]}. The key ones are clay and named
        var P = data.points || [], xfO = el.dataset.skXformat ? JSON.parse(el.dataset.skXformat) : {};
        var xfmt = function (v) { return format(v, { prefix: xfO.prefix, suffix: xfO.suffix, decimals: xfO.decimals == null ? (Math.abs(v) < 10 && v % 1 ? 1 : 0) : xfO.decimals }); };
        var span = function (k) { var vs = P.map(function (p) { return p[k]; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); return niceRange(lo >= 0 && lo <= hi * 0.35 ? 0 : lo - (hi - lo) * 0.06, hi + (hi - lo) * 0.04, k === 1 ? 5 : 4); };
        var xt = data.xFrom != null ? niceRange(data.xFrom, Math.max.apply(null, P.map(function (p) { return p[1]; })), 4) : span(1), yt = data.yFrom != null ? niceRange(data.yFrom, Math.max.apply(null, P.map(function (p) { return p[2]; })), 4) : span(2);
        var x0 = xt[0], x1 = xt[xt.length - 1], y0 = yt[0], y1 = yt[yt.length - 1];
        H = (+el.dataset.skH || 340) + NB; var L3 = gutter(yt, y1), R3 = 18, T3 = 30 + NB, B3 = 50, iw3 = W - L3 - R3, ih3 = H - T3 - B3;
        var PX = function (v) { return L3 + ((v - x0) / ((x1 - x0) || 1)) * iw3; }, PY = function (v) { return T3 + ih3 - ((v - y0) / ((y1 - y0) || 1)) * ih3; };
        yt.forEach(function (t) { var y = PY(t); out += '<line class="grid" x1="' + L3 + '" x2="' + (W - R3) + '" y1="' + y + '" y2="' + y + '"/><text class="tick" x="' + (L3 - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(tick(t, y1)) + '</text>'; });
        var xw = Math.max.apply(null, xt.map(function (t) { return xfmt(t).length; })) * 7.2 + 14, xstep = Math.ceil(xw / (iw3 / Math.max(1, xt.length - 1)));
        xt.forEach(function (t, i) {
          var x = PX(t), last = i === xt.length - 1; out += '<line class="grid" x1="' + x + '" x2="' + x + '" y1="' + T3 + '" y2="' + (T3 + ih3) + '"/>';
          if (i % xstep === 0 && (last || (xt.length - 1 - i) >= xstep || xstep === 1) || (last && (xt.length - 1) % xstep === 0)) out += '<text class="tick" x="' + x + '" y="' + (T3 + ih3 + 20) + '" text-anchor="' + (i === 0 ? 'start' : last ? 'end' : 'middle') + '">' + esc(xfmt(t)) + '</text>';
        });
        out += '<line class="axis" x1="' + L3 + '" x2="' + (W - R3) + '" y1="' + (T3 + ih3) + '" y2="' + (T3 + ih3) + '"/>';
        if (data.y) out += '<text class="aname" x="' + L3 + '" y="' + (12 + NB) + '">' + esc(data.y) + ' ↑</text>';
        if (data.x) out += '<text class="aname" x="' + (W - R3) + '" y="' + (H - 4) + '" text-anchor="end">' + esc(data.x) + ' →</text>';
        // the other dots first, so the key ones sit on top; then names, the key ones first, each kept clear of the rest
        var isKey = function (p) { return keys.indexOf(String(p[0])) >= 0; }, order = P.filter(function (p) { return !isKey(p); }).concat(P.filter(isKey));
        var boxes = order.map(function (p) { return [PX(p[1]) - 7, PY(p[2]) - 7, PX(p[1]) + 7, PY(p[2]) + 7]; }), names = '';
        order.forEach(function (p, i) {
          var cx = PX(p[1]), cy = PY(p[2]), key = isKey(p);
          out += '<circle class="dot' + (key ? ' key' : '') + '" style="--i:' + i + '" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (key ? 6.5 : 5) + '" data-sk-tip="' + esc(p[0] + '\n' + (data.x ? data.x + ' ' : '') + xfmt(p[1]) + ' · ' + (data.y ? data.y + ' ' : '') + fmt(p[2])) + '"/>';
          if (note && String(note.at) === String(p[0])) note.xy = [cx, cy - 6];
        });
        if (note && note.xy && !topNote) {
          var nw2 = textW(note.text, '400 19px Kalam, cursive') + 36, ny2 = note.xy[1] - 10, keyPts = P.filter(isKey);
          var nbox = { left: [note.xy[0] + 4, ny2 - 34, note.xy[0] + 4 + nw2, ny2], right: [note.xy[0] - 4 - nw2, ny2 - 34, note.xy[0] - 4, ny2] };
          var cost = function (b) { if (b[0] < 0 || b[2] > W || b[1] < 0) return 99; return keyPts.filter(function (p) { var x = PX(p[1]), y = PY(p[2]); return x > b[0] - 70 && x < b[2] + 8 && y > b[1] - 10 && y < b[3] + 16; }).length; };
          var cl = cost(nbox.left), cr = cost(nbox.right); note.side = cr < cl ? 'right' : 'left'; note.fixed = true; boxes.push(nbox[note.side]);
        }
        var named = P.filter(isKey).concat(P.length <= 10 ? P.filter(function (p) { return !isKey(p); }) : []);
        // a note above the plot sends its arrow straight down to its point: keep names out of that column
        if (note && topNote) P.forEach(function (p) { if (String(note.at) === String(p[0])) boxes.push([PX(p[1]) - 22, 0, PX(p[1]) + 22, PY(p[2]) - 8]); });
        named.forEach(function (p, i) {
          var cx = PX(p[1]), cy = PY(p[2]), key = isKey(p), w = String(p[0]).length * (key ? 7.4 : 6.8) + 4;
          var tries = [[cx + 11, cy + 4, 'start'], [cx - 11, cy + 4, 'end'], [cx, cy - 13, 'middle'], [cx, cy + 21, 'middle'], [cx + 8, cy - 10, 'start'], [cx + 8, cy + 18, 'start'], [cx - 8, cy - 10, 'end'], [cx - 8, cy + 18, 'end']];
          if (note && String(note.at) === String(p[0])) tries = [tries[1], tries[3], tries[7], tries[0]];
          var hit = function (b, set) { return set.some(function (q) { return b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]; }); };
          var keyBoxes = boxes.filter(function (q, j) { return j >= P.length - P.filter(isKey).length; });
          var placed = false, put = function (t, b) { boxes.push(b); keyBoxes.push(b); placed = true; names += '<text class="dl' + (key ? ' key' : '') + '" style="--i:' + i + '" x="' + t[0].toFixed(1) + '" y="' + t[1].toFixed(1) + '" text-anchor="' + t[2] + '">' + esc(p[0]) + '</text>'; };
          var boxOf = function (t) { var bx = t[2] === 'start' ? t[0] : t[2] === 'end' ? t[0] - w : t[0] - w / 2; return [bx, t[1] - 11, bx + w, t[1] + 3]; };
          var inside = function (b) { return !(b[0] < 0 || b[2] > W || b[1] < T3 - 14 || b[3] > T3 + ih3); };
          for (var pass = 0; pass < (key ? 2 : 1) && !placed; pass++) for (var k = 0; k < tries.length; k++) {
            var t = tries[k], b = boxOf(t);
            if (!inside(b) || hit(b, pass ? keyBoxes : boxes)) continue;
            put(t, b); break;
          }
          // a key point is the reason for the chart, so its name is never dropped: it takes the spot that covers the fewest other names
          if (key && !placed) {
            var best = null, bestN = 1e9;
            tries.forEach(function (t) { var b = boxOf(t); if (!inside(b)) return; var nHit = keyBoxes.filter(function (q) { return b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]; }).length; if (nHit < bestN) { bestN = nHit; best = t; } });
            if (best) put(best, boxOf(best));
          }
        });
        out += names;
      } else if (kind === 'stack') {
        // a part that is zero has no segment and no legend row; each part keeps its colour by position
        var parts = data.map(function (r, i) { return { r: r, c: pal + Math.min(i + 1, 5) }; }).filter(function (p) { return p.r[1] > 0; });
        var tot = parts.reduce(function (a, p) { return a + p.r[1]; }, 0) || 1, x0 = 0; H = 16;
        parts.forEach(function (p, i) {
          var r = p.r, w = (r[1] / tot) * W, cls = 'seg ' + p.c;
          out += '<rect class="' + cls + '" style="--i:' + i + '" data-sk-tip="' + esc(r[0] + ': ' + fmt(r[1]) + ' (' + Math.round((r[1] / tot) * 100) + '%)') + '" x="' + (x0 + (i ? 1.5 : 0)) + '" y="0" width="' + Math.max(1, w - (i ? 1.5 : 0) - (i < parts.length - 1 ? 1.5 : 0)) + '" height="' + H + '"/>';
          x0 += w;
        });
        out = '<clipPath id="skc' + (++chartN) + '"><rect width="' + W + '" height="' + H + '" rx="' + H / 2 + '"/></clipPath><g clip-path="url(#skc' + chartN + ')">' + out + '</g>';
      }
      var svg = '<svg class="sk-chart" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(el.getAttribute('aria-label') || '') + '">' + out + '</svg>';
      el.insertAdjacentHTML('afterbegin', svg);
      if (kind === 'stack') {
        // narrow: one part a row with its value at the right, like a receipt
        var lg = '<ul class="sk-legend"' + (W < 520 || el.dataset.skLegend === 'rows' ? ' data-rows' : '') + '>' + parts.map(function (p) { return '<li><i class="' + p.c + '"></i><span>' + esc(p.r[0]) + '</span> <b>' + esc(fmt(p.r[1])) + '</b></li>'; }).join('') + '</ul>';
        el.insertAdjacentHTML('beforeend', lg);
      }
      // a note that would run off the right edge points from the other side
      if (note && note.xy && topNote) {
        // the note sits in its own band above the plot, centred over its point where it fits, with an arrow down to it
        var nn = d.createElement('span'); nn.className = 'sk-note sk-chart-note sk-chart-topnote'; nn.textContent = note.text; el.appendChild(nn);
        var nw = nn.offsetWidth, nx = Math.max(0, Math.min(W - nw, note.xy[0] - nw * 0.7)); nn.style.left = nx + 'px'; nn.style.top = '2px';
        var ax = Math.max(nx + 12, Math.min(nx + nw - 12, note.xy[0] + (note.xy[0] > nx + nw / 2 ? -14 : 14))), ar = arrowStrokes(ax, 30, note.xy[0], note.xy[1] - 9, 4, 2.4, 9, ax < note.xy[0] ? -1 : 1);
        el.querySelector('svg.sk-chart').insertAdjacentHTML('beforeend', '<g class="sk-chart-aim">' + penStrokes(ar).html + '</g>');
      } else if (note && note.xy) { var side = note.fixed ? note.side : note.side === 'right' || note.xy[0] + note.text.length * 9.5 + 70 > W ? 'right' : 'left'; chartNote(el, note.xy[0] + (side === 'right' ? -6 : 6), note.xy[1] - 10, note.text, side); }
      if (!animate) el.dataset.skGrown = '1';
    }
    el._skRender = function () { try { data = JSON.parse(el.dataset.skData); } catch (e) { return; } note = el.dataset.skNote ? JSON.parse(el.dataset.skNote) : null; render(false); };
    render(true);
    whenSeen(el, function () { el.dataset.skGrown = '1'; });
    // redraw when the width really changes, including the first time a hidden chart gets one
    if (window.ResizeObserver) new ResizeObserver(function () { var w = Math.round(el.clientWidth); if (w > 0 && Math.abs(w - (el._skW || 0)) > 2) render(false); }).observe(el);
  }
  var chartN = 0;
  // Sketchbook.update(el, data): redraw a chart with new data, no entrance
  // new data redraws the chart; bars glide from where they were to where they now are
  function update(el, data) {
    var before = Array.prototype.map.call(el.querySelectorAll('rect.bar'), function (r) { return ['x', 'y', 'width', 'height'].map(function (a) { return +r.getAttribute(a); }); });
    var cols = Array.prototype.map.call(el.querySelectorAll('path.bar'), function (r) { try { return r.getBBox().height; } catch (e) { return 0; } });
    el.dataset.skData = JSON.stringify(data); if (el._skRender) el._skRender(); else chart(el);
    if (still()) return;
    el.querySelectorAll('path.bar').forEach(function (r, i) {
      var h0 = cols[i], h1; try { h1 = r.getBBox().height; } catch (e) { return; }
      if (h0 == null || !r.animate || !(h1 > 0.5) || Math.abs(h0 - h1) < 0.5) return;
      r.animate([{ transform: 'scale(1, ' + Math.max(0, h0 / h1) + ')' }, { transform: 'scale(1, 1)' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    });
    if (!before.length && !cols.length) return;
    el.querySelectorAll('rect.bar').forEach(function (r, i) {
      var b = before[i], now = ['x', 'y', 'width', 'height'].map(function (a) { return +r.getAttribute(a); });
      if (!b || !r.animate || b.every(function (v, k) { return Math.abs(v - now[k]) < 0.5; })) return;
      try { r.animate([{ x: b[0] + 'px', y: b[1] + 'px', width: b[2] + 'px', height: b[3] + 'px' }, { x: now[0] + 'px', y: now[1] + 'px', width: now[2] + 'px', height: now[3] + 'px' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }); } catch (e) { /* a browser that can't animate geometry just shows the new bars */ }
    });
    el.querySelectorAll('.val').forEach(function (t) { if (t.animate) t.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: 480 }); });
  }
  // printing: the page goes on paper light, and each chart and flow is redrawn at the width it will have there,
  // so its text prints at its true size. The class lays the page out at A4's text width for a moment, before print layout.
  var printing = null;
  function toPrint(on) {
    var h = d.documentElement;
    if (on === !!printing) return;
    if (on) { printing = { theme: h.getAttribute('data-theme') }; if (printing.theme === 'dark') h.setAttribute('data-theme', 'light'); h.classList.add('sk-printing'); printNow = true; showAll(); seeAll(); }
    else { h.classList.remove('sk-printing'); if (printing.theme) h.setAttribute('data-theme', printing.theme); printing = null; printNow = false; if (aimLayer) aimNotes(); }
    d.querySelectorAll('.sk-chart-box').forEach(function (el) { if (el._skRender) { el._skRender(); el.dataset.skGrown = '1'; } });
    d.querySelectorAll('[data-sk-flow]').forEach(function (el) { el._w = 0; if (el.dataset.skDone) layFlow(el); });
    d.querySelectorAll('[data-sk-tree]').forEach(function (el) { el._w = 0; if (el.dataset.skDone) layTree(el); });
    d.querySelectorAll('[data-sk-map]').forEach(function (el) { el._w = 0; if (el.dataset.skDone) try { layMap(el); } catch (e) {} });
    // closed answers print open, and close again after
    if (on) d.querySelectorAll('details:not([open])').forEach(function (x) { x.setAttribute('data-sk-was-shut', ''); x.open = true; });
    else d.querySelectorAll('details[data-sk-was-shut]').forEach(function (x) { x.removeAttribute('data-sk-was-shut'); x.open = false; });
  }
  window.addEventListener('beforeprint', function () { toPrint(true); });
  window.addEventListener('afterprint', function () { toPrint(false); });
  // ---- code: a small highlighter, line numbers, marked lines, numbered notes, diffs, copy ----
  var KW = {
    js: 'const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of null undefined true false this yield type interface enum as',
    py: 'def return if elif else for while in not and or is None True False class import from as with try except finally raise lambda yield pass break continue async await self print',
    sql: 'select from where join left right inner outer full cross on group by order having limit offset as and or not null is in between like ilike distinct count sum avg min max case when then else end insert into values update set delete create table index view with union all desc asc over partition round cast coalesce exists',
    sh: 'if then else elif fi for in do done case esac function return export local echo cd ls cat grep sed awk npm npx bun git sudo curl claude cp mv rm mkdir',
    css: '',
    json: 'true false null'
  };
  KW.ts = KW.js; KW.tsx = KW.js; KW.jsx = KW.js; KW.bash = KW.sh; KW.shell = KW.sh; KW.python = KW.py;
  var LANG_NAME = { js: 'JavaScript', ts: 'TypeScript', tsx: 'TSX', jsx: 'JSX', py: 'Python', python: 'Python', sql: 'SQL', sh: 'Shell', bash: 'Shell', shell: 'Shell', json: 'JSON', html: 'HTML', css: 'CSS', diff: 'Diff', text: 'Text' };
  function tokens(src, lang) {
    if (lang === 'diff' || lang === 'text' || !lang) return [{ c: '', t: src }];
    var cm = lang === 'py' || lang === 'python' || lang === 'sh' || lang === 'bash' || lang === 'shell' ? '#[^\\n]*' : lang === 'sql' ? '--[^\\n]*' : lang === 'html' ? '<!--[\\s\\S]*?-->' : lang === 'json' ? '(?!)' : '//[^\\n]*|/\\*[\\s\\S]*?\\*/';
    var re = new RegExp('(' + cm + ')|("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`[^`]*`)|(\\b\\d[\\d_.]*\\b)|(</?[A-Za-z][\\w-]*|[A-Za-z_$][\\w$]*)', 'g');
    var kw = {}; (KW[lang] || '').split(' ').forEach(function (k) { kw[k] = 1; });
    var out = [], last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) out.push({ c: '', t: src.slice(last, m.index) });
      var c = m[1] ? 'c' : m[2] ? (lang === 'json' && /^\s*:/.test(src.slice(re.lastIndex)) ? 'p' : 's') : m[3] ? 'n' : '';
      if (m[4]) {
        if (lang === 'html' && m[4][0] === '<') c = 'k';
        else if (kw[m[4]] || (lang === 'sql' && kw[m[4].toLowerCase()])) c = 'k';
        else if (src[re.lastIndex] === '(') c = 'f';
      }
      out.push({ c: c, t: m[0] }); last = re.lastIndex;
    }
    if (last < src.length) out.push({ c: '', t: src.slice(last) });
    return out;
  }
  function ranges(spec) {
    var set = {}; (spec || '').split(',').forEach(function (p) { var a = p.split('-').map(Number); if (!a[0]) return; for (var i = a[0]; i <= (a[1] || a[0]); i++) set[i] = 1; });
    return set;
  }
  function codeBlock(pre) {
    var codeEl = pre.querySelector('code') || pre, lang = (pre.dataset.lang || '').toLowerCase(), src = codeEl.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    var marks = ranges(pre.dataset.skLines), notes = {}, lines = [[]];
    try { notes = pre.dataset.skNotes ? JSON.parse(pre.dataset.skNotes) : {}; } catch (e) { notes = {}; }
    tokens(src, lang).forEach(function (tk) {
      tk.t.split('\n').forEach(function (part, i) { if (i) lines.push([]); if (part) lines[lines.length - 1].push(tk.c ? '<span class="t-' + tk.c + '">' + esc(part) + '</span>' : esc(part)); });
    });
    var noteKeys = Object.keys(notes).map(Number).sort(function (a, b) { return a - b; }), noteN = {};
    noteKeys.forEach(function (k, i) { noteN[k] = i + 1; });
    var html = lines.map(function (parts, i) {
      var n = i + 1, raw = src.split('\n')[i] || '', cls = 'ln';
      if (marks[n]) cls += ' mark';
      if (lang === 'diff') cls += raw[0] === '+' ? ' add' : raw[0] === '-' ? ' del' : raw.slice(0, 2) === '@@' ? ' hunk' : '';
      var ind = (raw.match(/^[ \t]*/)[0] || '').replace(/\t/g, '  ').length;
      return '<span class="' + cls + '" data-n="' + n + '"' + (ind ? ' style="--ind:' + ind + 'ch"' : '') + (noteN[n] ? ' data-pin="' + noteN[n] + '" data-line="' + n + '"' : '') + '>' + (noteN[n] ? '<span class="sk-lpin" aria-hidden="true">' + noteN[n] + '</span>' : '') + (parts.join('') || ' ') + '</span>';
    }).join('');
    codeEl.innerHTML = html;
    if (pre.tagName === 'PRE' && codeEl === pre) { pre.innerHTML = '<code>' + html + '</code>'; codeEl = pre.querySelector('code'); }
    // when code wraps, it wraps at spaces: a word with a hyphen or a slash in it (aaron-pak/agent-plugins, --dry-run) stays whole
    var tw = d.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT), tn, todo = [];
    while ((tn = tw.nextNode())) if (/[-/]|<[^<>\n]+>/.test(tn.nodeValue) && !(tn.parentNode.classList && tn.parentNode.classList.contains('sk-lpin'))) todo.push(tn);
    todo.forEach(function (t) {
      var frag = d.createDocumentFragment();
      // a placeholder such as <merge sha> stays whole too
      t.nodeValue.split(/(<[^<>\n]+>|\s+)/).forEach(function (part) {
        if (!part) return;
        if (/\S/.test(part) && (/[-/]/.test(part) || /^<.+>$/.test(part))) { var nb = d.createElement('span'); nb.className = 'sk-nb'; nb.textContent = part; frag.appendChild(nb); }
        else frag.appendChild(d.createTextNode(part));
      });
      t.parentNode.replaceChild(frag, t);
    });
    var wrap = d.createElement('figure'); wrap.className = 'sk-code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    var title = pre.dataset.title, head = '<figcaption class="sk-code-head">' + (title ? '<span class="sk-code-title">' + esc(title) + '</span>' : '<span class="sk-code-title sk-dim">' + (LANG_NAME[lang] || '') + '</span>') + (title && LANG_NAME[lang] ? '<span class="sk-code-lang">' + LANG_NAME[lang] + '</span>' : '') + '<button class="sk-code-copy" type="button" data-sk-copy>Copy</button></figcaption>';
    wrap.innerHTML = head; wrap.appendChild(pre);
    if (noteKeys.length) {
      var ol = '<ol class="sk-code-notes">' + noteKeys.map(function (k) { return '<li data-line="' + k + '"><b>' + noteN[k] + '</b><span>' + notes[k] + '</span></li>'; }).join('') + '</ol>';
      wrap.insertAdjacentHTML('beforeend', ol);
      wrap.querySelectorAll('[data-line]').forEach(function (x) {
        function hot(on) { wrap.querySelectorAll('[data-line="' + x.dataset.line + '"]').forEach(function (y) { y.classList.toggle('hot', on); }); }
        x.addEventListener('pointerenter', function () { hot(true); }); x.addEventListener('pointerleave', function () { hot(false); });
      });
    }
    if (pre.hasAttribute('data-sk-nonum')) wrap.classList.add('sk-nonum');
  }
  // ================= more: trees, a week planner, a list you can search, filter and sort =================

  // ---- a tree: a question that branches; every branch is a labelled arrow to the next question or an answer ----
  // data-sk-tree='{"q":"Is it urgent?","kids":[{"if":"Yes","a":"Do it now","key":true},{"if":"No","a":"Friday"}]}'
  // Across when every answer gets 150px; otherwise an outline, top to bottom, branches stepping in.
  var TQ_FONT = '600 16.5px "Bricolage Grotesque", system-ui, sans-serif', TS_FONT = '400 13.5px Literata, Georgia, serif';
  function wrapN(t, max, font) {
    var words = String(t).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var c = cur ? cur + ' ' + w : w; if (cur && textW(c, font) > max) { lines.push(cur); cur = w; } else cur = c; });
    if (cur) lines.push(cur);
    return lines;
  }
  function treeWalk(n, depth, parent, out) {
    n.depth = depth; n.parent = parent; out.push(n);
    (n.kids || []).forEach(function (k) { treeWalk(k, depth + 1, n, out); });
    n.leaves = n.kids && n.kids.length ? n.kids.reduce(function (s, k) { return s + k.leaves; }, 0) : 1;
    var hot = (n.kids || []).map(function (k) { return k.hot; }).some(Boolean);
    n.hot = !!n.key || hot;
    return out;
  }
  function treeOrder(root) {
    // cards are laid down level by level, so the tree grows downwards
    var q = [root], out = [];
    while (q.length) { var n = q.shift(); out.push(n); (n.kids || []).forEach(function (k) { q.push(k); }); }
    out.forEach(function (n, i) { n.k = i; });
  }
  function treeSize(n, w, spot) {
    var pad = 16, sp = n.draw ? 52 : 0, tw = w - pad * 2 - sp;
    n.lines = wrapBal(n.q || n.a || '', tw, TQ_FONT); n.subs = n.sub ? wrapBal(n.sub, tw, TS_FONT) : [];
    n.th = n.lines.length * 21 + (n.subs.length ? 5 + n.subs.length * 19 : 0) - 4;
    n.h = Math.max(sp ? 72 : 0, pad * 2 + n.th); n.w = w; n.sp = sp;
  }
  function treeCard(n, x0, y0, center) {
    var leaf = !n.card && !(n.kids && n.kids.length), cls = 'sk-fc sk-tn' + (leaf ? ' sk-tleaf' : '') + (n.key ? ' sk-tkey' : '');
    var g = '<g class="' + cls + '" style="--k:' + n.k + '"><rect class="sk-tcard" x="' + x0 + '" y="' + y0 + '" width="' + n.w + '" height="' + n.h + '" rx="14"/>';
    if (n.draw) { var key = NAMES[n.draw] || n.draw; g += '<svg x="' + (x0 + 14) + '" y="' + (y0 + (n.h - 44) / 2) + '" width="44" height="44" viewBox="' + vb(key) + '">' + drawArt(key, { mode: 'brush', base: 5.5, roles: roles('flow') }) + '</svg>'; }
    var mid = !n.sp && center, tx = mid ? x0 + n.w / 2 : x0 + 16 + n.sp, top = y0 + (n.h - n.th) / 2 + 15, anchor = mid ? ' text-anchor="middle"' : '';
    g += '<text class="sk-tlabel"' + anchor + '>' + n.lines.map(function (l, i) { return '<tspan x="' + tx + '" y="' + (top + i * 21) + '">' + esc(l) + '</tspan>'; }).join('') + '</text>';
    if (n.subs.length) { var sy = top + n.lines.length * 21 + 4; g += '<text class="sk-tsub"' + anchor + '>' + n.subs.map(function (l, i) { return '<tspan x="' + tx + '" y="' + (sy + i * 19) + '">' + esc(l) + '</tspan>'; }).join('') + '</text>'; }
    return g + '</g>';
  }
  // an arrow is two pen strokes, the shaft then the head, so it draws from where it leaves to where it lands whichever way it runs
  var treeIds = null;
  function treeArrow(strokes, hot, k) {
    return '<g class="sk-fa' + (hot ? ' sk-thot' : '') + '" style="--k:' + k + '">' + penStrokes(strokes, 'sk-tarrow', treeIds).html + '</g>';
  }
  function treeAcross(root, W) {
    var all = treeWalk(root, 0, null, []); treeOrder(root);
    var slot = W / root.leaves, bw = Math.round(Math.min(236, slot - 26)), li = 0, GAP = 80, g = '', a = '', labs = '';
    (function place(n) { if (!n.kids || !n.kids.length) n.x = slot * (li++ + 0.5); else { n.kids.forEach(place); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; } })(root);
    all.forEach(function (n) { treeSize(n, bw); });
    var deep = Math.max.apply(null, all.map(function (n) { return n.depth; })), y = 6, rowY = [];
    for (var r = 0; r <= deep; r++) { rowY[r] = y; y += Math.max.apply(null, all.filter(function (n) { return n.depth === r; }).map(function (n) { return n.h; })) + GAP; }
    all.forEach(function (n) {
      n.y = rowY[n.depth]; g += treeCard(n, n.x - bw / 2, n.y, true);
      if (!n.parent) return;
      var p = n.parent, dx = n.x - p.x, x0 = p.x + Math.max(-bw * 0.3, Math.min(bw * 0.3, dx * 0.25)), y0 = p.y + p.h + 8, x1 = n.x, y1 = n.y - 9;
      var side = dx < 0 ? 1 : -1, bend = Math.abs(dx) < 2 ? 0 : 7;
      a += treeArrow(arrowStrokes(x0, y0, x1, y1, bend, 3.6, 30 + n.k, side), n.hot, n.k - 1);
      if (n.if) {
        // the label sits off the outside of the curve, clear of the stroke
        var L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (-(y1 - y0) / L) * side, ny = ((x1 - x0) / L) * side, off = bend + 13;
        var lx = (x0 + x1) / 2 + nx * off, ly = (y0 + y1) / 2 + ny * off + 4;
        labs += '<text class="sk-flow-alabel sk-fa sk-tif' + (n.hot ? ' sk-thot' : '') + '" style="--k:' + (n.k - 1) + '" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + (nx < -0.05 ? 'end' : nx > 0.05 ? 'start' : 'middle') + '">' + esc(n.if) + '</text>';
      }
    });
    return { svg: g + labs, ink: a, W: W, H: y - GAP + 10 };
  }
  // the outline: each answer steps in under its question; the arrow runs down the left and turns in to it
  function treeDown(root) {
    var all = treeWalk(root, 0, null, []); treeOrder(root);
    var W = 360, IND = 40, y = 4, g = '', a = '', labs = '', last = {};
    all.forEach(function (n) {
      var ind = Math.min(n.depth, 4) * IND, x0 = 4 + ind;
      treeSize(n, W - 8 - ind);
      if (n.parent) y += n.if ? 30 : 14;
      n.x0 = x0; n.y = y; g += treeCard(n, x0, y, false);
      if (n.parent) {
        var p = n.parent, tx = p.x0 + 14, ey = y + Math.min(26, n.h / 2), ex = x0 - 7, r = 9, prev = last[p.k];
        var y0 = prev != null ? prev - r : p.y + p.h + 7, pts = [];
        for (var s = 0; s <= 4; s++) pts.push([tx, y0 + (ey - r - y0) * s / 4]);
        for (var t = 1; t <= 4; t++) { var an = Math.PI - (Math.PI / 2) * (t / 4); pts.push([tx + r + r * Math.cos(an), ey - r + r * Math.sin(an)]); }
        pts.push([ex, ey]);
        var L = 10, h1 = [ex - L * 0.85, ey + L * 0.52], h2 = [ex - L * 0.85, ey - L * 0.52];
        a += treeArrow([{ pts: pts, o: { w: 3.4, seed: 40 + n.k } }, { pts: [h1, [ex, ey], h2], o: { w: 3.1, seed: 41 + n.k, taper: 0.3 }, head: true }], n.hot, n.k - 1);
        last[p.k] = ey;
        if (n.if) labs += '<text class="sk-flow-alabel sk-fa sk-tif' + (n.hot ? ' sk-thot' : '') + '" style="--k:' + (n.k - 1) + '" x="' + (x0 + 2) + '" y="' + (y - 9) + '">' + esc(n.if) + '</text>';
      }
      y += n.h;
    });
    return { svg: g + labs, ink: a, W: W, H: y + 6 };
  }
  function treeOutline(n) {
    var t = (n.if ? n.if + ': ' : '') + (n.q || n.a || '') + (n.sub ? ' (' + n.sub + ')' : '');
    return '<li>' + esc(t) + (n.kids && n.kids.length ? '<ul>' + n.kids.map(treeOutline).join('') + '</ul>' : '') + '</li>';
  }
  function layTree(el) {
    var w = el.clientWidth; if (!w) return;
    var data; try { data = JSON.parse(el.dataset.skTree); } catch (e) { return; }
    var leaves = treeWalk(JSON.parse(el.dataset.skTree), 0, null, []).filter(function (n) { return !(n.kids && n.kids.length); }).length;
    var across = w / leaves >= 150, mode = across ? 'h' : 'v';
    if (el._w && Math.abs(el._w - w) < 16 && el.dataset.layout === mode) return;
    el._skId = el._skId || 'skt' + (++penN); treeIds = penIds(el._skId);
    var t = across ? treeAcross(data, w) : treeDown(data), label = el.getAttribute('aria-label') || 'A decision tree';
    var html = '<svg class="sk-flow-svg sk-tree-svg sk-tree-' + mode + '" viewBox="0 0 ' + t.W + ' ' + t.H + '"' + (across ? ' width="' + t.W + '"' : '') + ' role="img" aria-label="' + esc(label) + '">' + t.svg + '<g class="ink">' + t.ink + '</g></svg>';
    el._w = w; el.dataset.layout = mode;
    if (html === el._html) return;
    el._html = html;
    var old = el.querySelector(':scope > .sk-tree-svg'), was = old && old.classList.contains('sk-in-flow');
    if (old) old.remove();
    el.insertAdjacentHTML('afterbegin', html);
    var svg = el.querySelector(':scope > .sk-tree-svg'); chalkFor(svg); if (was) svg.classList.add('sk-in-flow', 'sk-flow-still');
    if (!el.querySelector(':scope > .sk-sr')) el.insertAdjacentHTML('beforeend', '<ul class="sk-sr">' + treeOutline(data) + '</ul>');
  }

  // ---- a map: the parts of a system placed on a grid, joined by labelled arrows ----
  // data-sk-map='{"nodes":[{"id":"site","a":"Order site","sub":"on the customer's phone","at":[0,0]}],"links":[{"from":"site","to":"pay","if":"asks for the money"}]}'
  // Across when every column gets 200px; otherwise a list: each part, then an arrow for each thing it sends, naming where it goes.
  var ML_FONT = '400 13.5px Literata, Georgia, serif';
  function mapPrep(m) {
    var byId = {};
    m.nodes.forEach(function (n, i) { n.k = i; n.card = true; byId[n.id] = n; });
    m.links = (m.links || []).filter(function (l) { l.a = byId[l.from]; l.b = byId[l.to]; return l.a && l.b; });
    m.links.forEach(function (l) { l.two = m.links.some(function (o) { return o.a === l.b && o.b === l.a; }); l.k = Math.max(l.a.k, l.b.k); });
    return m;
  }
  function mapEdge(n, ux, uy, pad) {
    var hw = n.w / 2 + pad, hh = n.h / 2 + pad, t = Math.min(ux ? hw / Math.abs(ux) : 1e9, uy ? hh / Math.abs(uy) : 1e9);
    return [n.cx + ux * t, n.cy + uy * t];
  }
  // wrap to the fewest lines, then make the lines as even as they can be, so no word sits alone
  function wrapBal(t, max, font) {
    var lines = wrapN(t, max, font); if (lines.length < 2) return lines;
    var lo = max / lines.length, hi = max;
    while (hi - lo > 2) { var mid = (lo + hi) / 2; if (wrapN(t, mid, font).length > lines.length) lo = mid; else hi = mid; }
    return wrapN(t, hi, font);
  }
  function mapLabel(lines, x, y, anchor, hot, k) {
    return '<text class="sk-flow-alabel sk-fa sk-tif sk-mlab' + (hot ? ' sk-thot' : '') + '" style="--k:' + k + '" text-anchor="' + anchor + '">' + lines.map(function (t, i) { return '<tspan x="' + x.toFixed(1) + '" y="' + (y + i * 17).toFixed(1) + '">' + esc(t) + '</tspan>'; }).join('') + '</text>';
  }
  function mapAcross(m, W) {
    var cols = 0, rows = 0;
    m.nodes.forEach(function (n) { cols = Math.max(cols, n.at[0] + 1); rows = Math.max(rows, n.at[1] + 1); });
    var slot = W / cols, bw = Math.round(Math.min(230, slot * 0.6)), GAP = 108, g = '', a = '', labs = '', y = 6, rowY = [], rowH = [];
    m.nodes.forEach(function (n) { treeSize(n, bw); });
    for (var r = 0; r < rows; r++) {
      rowY[r] = y; rowH[r] = Math.max.apply(null, [56].concat(m.nodes.filter(function (n) { return n.at[1] === r; }).map(function (n) { return n.h; })));
      y += rowH[r] + GAP;
    }
    m.nodes.forEach(function (n) { n.h = rowH[n.at[1]]; n.cx = slot * (n.at[0] + 0.5); n.cy = rowY[n.at[1]] + rowH[n.at[1]] / 2; g += treeCard(n, n.cx - bw / 2, n.cy - n.h / 2, true); });
    m.links.forEach(function (l) {
      var A = l.a, B = l.b, dx = B.cx - A.cx, dy = B.cy - A.cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, off = l.two ? 9 : 0;
      var p0 = mapEdge(A, ux, uy, 8), p1 = mapEdge(B, -ux, -uy, 10);
      p0 = [p0[0] + nx * off, p0[1] + ny * off]; p1 = [p1[0] + nx * off, p1[1] + ny * off];
      var flat = Math.abs(dy) < 1, upright = Math.abs(dx) < 1, bend = flat || upright ? 0 : 6;
      a += treeArrow(arrowStrokes(p0[0], p0[1], p1[0], p1[1], bend, 3.4, 60 + l.k * 3 + (l.two ? 1 : 0), 1), l.hot, l.k);
      if (!l.if) return;
      var mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, lines;
      if (flat) {
        lines = wrapBal(l.if, Math.max(80, Math.abs(p1[0] - p0[0]) - 14), ML_FONT);
        var below = l.two && ny > 0;
        labs += mapLabel(lines, mx, below ? my + 21 : my - 10 - (lines.length - 1) * 17, 'middle', l.hot, l.k);
      } else if (upright) {
        lines = wrapBal(l.if, Math.max(90, slot / 2 - 22), ML_FONT);
        var left = l.two && nx < 0, ty = my + 5 - (lines.length - 1) * 8.5;
        labs += mapLabel(lines, left ? mx - 12 : mx + 12, ty, left ? 'end' : 'start', l.hot, l.k);
      } else {
        lines = wrapBal(l.if, 150, ML_FONT);
        var side = nx > 0 ? 1 : -1, lx = mx + nx * side * (bend + 16), ly = my + ny * side * (bend + 16) + 5 - (lines.length - 1) * 8.5;
        labs += mapLabel(lines, lx, ly, side * nx > 0.2 ? 'start' : side * nx < -0.2 ? 'end' : 'middle', l.hot, l.k);
      }
    });
    return { svg: g + labs, ink: a, W: W, H: y - GAP + 10 };
  }
  // the list: each part, then under it one arrow for each thing it sends, with what it sends and where
  function mapDown(m) {
    var W = 360, y = 4, g = '', a = '', labs = '';
    m.nodes.forEach(function (n) {
      treeSize(n, W - 8); n.cx = 4 + n.w / 2; g += treeCard(n, 4, y, false);
      var top = y + n.h + 7, prev = null, r = 9, tx = 18;
      y += n.h;
      m.links.filter(function (l) { return l.a === n; }).forEach(function (l) {
        var lines = wrapN(l.if || '', W - 60, ML_FONT), name = wrapN(l.b.a, W - 60, TQ_FONT.replace('16.5px', '15px'));
        var rowTop = y + 10, rh = lines.length * 17 + name.length * 19 + 4, ey = rowTop + Math.min(rh / 2, 16), ex = 42, pts = [];
        var y0 = prev != null ? prev - r : top;
        for (var s = 0; s <= 4; s++) pts.push([tx, y0 + (ey - r - y0) * s / 4]);
        for (var t = 1; t <= 4; t++) { var an = Math.PI - (Math.PI / 2) * (t / 4); pts.push([tx + r + r * Math.cos(an), ey - r + r * Math.sin(an)]); }
        pts.push([ex, ey]);
        var hl = 10, h1 = [ex - hl * 0.85, ey + hl * 0.52], h2 = [ex - hl * 0.85, ey - hl * 0.52];
        a += treeArrow([{ pts: pts, o: { w: 3.3, seed: 70 + l.k } }, { pts: [h1, [ex, ey], h2], o: { w: 3, seed: 71 + l.k, taper: 0.3 }, head: true }], l.hot, n.k);
        labs += mapLabel(lines, 52, rowTop + 12, 'start', l.hot, n.k);
        labs += '<text class="sk-tlabel sk-mto sk-fa" style="--k:' + n.k + '">' + name.map(function (t, i) { return '<tspan x="52" y="' + (rowTop + 12 + lines.length * 17 + 2 + i * 19) + '">' + esc(t) + '</tspan>'; }).join('') + '</text>';
        prev = ey; y = rowTop + rh;
      });
      y += 26;
    });
    return { svg: g + labs, ink: a, W: W, H: y - 20 };
  }
  function layMap(el) {
    var w = el.clientWidth; if (!w) return;
    var m = mapPrep(JSON.parse(el.dataset.skMap)), cols = 0;
    m.nodes.forEach(function (n) { cols = Math.max(cols, n.at[0] + 1); });
    var across = w / cols >= 200, mode = across ? 'h' : 'v';
    if (el._w && Math.abs(el._w - w) < 16 && el.dataset.layout === mode) return;
    el._skId = el._skId || 'skt' + (++penN); treeIds = penIds(el._skId);
    var t = across ? mapAcross(m, w) : mapDown(m), label = el.getAttribute('aria-label') || 'A map of how the parts connect';
    var html = '<svg class="sk-flow-svg sk-tree-svg sk-map-svg sk-tree-' + mode + '" viewBox="0 0 ' + t.W + ' ' + t.H + '"' + (across ? ' width="' + t.W + '"' : '') + ' role="img" aria-label="' + esc(label) + '">' + t.svg + '<g class="ink">' + t.ink + '</g></svg>';
    el._w = w; el.dataset.layout = mode;
    if (html === el._html) return;
    el._html = html;
    var old = el.querySelector(':scope > .sk-map-svg'), was = old && old.classList.contains('sk-in-flow');
    if (old) old.remove();
    el.insertAdjacentHTML('afterbegin', html);
    var svg = el.querySelector(':scope > .sk-map-svg'); chalkFor(svg); if (was) svg.classList.add('sk-in-flow', 'sk-flow-still');
    if (!el.querySelector(':scope > .sk-sr')) el.insertAdjacentHTML('beforeend', '<ul class="sk-sr">' + m.links.map(function (l) { return '<li>From ' + esc(l.a.a) + ' to ' + esc(l.b.a) + (l.if ? ': ' + esc(l.if) : '') + '</li>'; }).join('') + '</ul>');
  }

  // ---- a week: days side by side on an hour grid; on a narrow screen, a list day by day ----
  function parseHour(s) {
    var m = String(s || '').trim().match(/^(\d{1,2})(?:[:.](\d\d))?\s*(am|pm)?$/i); if (!m) return NaN;
    var h = +m[1]; if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
    return h + (+m[2] || 0) / 60;
  }
  function hourText(h, ampm) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60), m2 = mm ? ':' + (mm < 10 ? '0' : '') + mm : '';
    if (!ampm) return hh + ':' + (mm < 10 ? '0' : '') + mm;
    return ((hh + 11) % 12 + 1) + m2 + (hh < 12 ? ' am' : ' pm');
  }
  // "9–9:30 am", "11 am–12:30 pm": the half of the day is said once, unless the span crosses noon
  function spanText(s, e, ampm) {
    if (!ampm) return hourText(s) + '–' + hourText(e);
    var a = hourText(s, true), b = hourText(e, true);
    return (s < 12) === (e < 12) ? a.replace(/ [ap]m$/, '') + '–' + b : a + '–' + b;
  }
  function week(el) {
    if (el.querySelector(':scope > .sk-week-in')) return;
    var from = +el.dataset.from || 8, to = +el.dataset.to || 20, span = to - from, ampm = el.dataset.clock !== '24';
    var days = Array.prototype.slice.call(el.querySelectorAll(':scope > section'));
    var inn = d.createElement('div'); inn.className = 'sk-week-in'; inn.style.setProperty('--days', days.length); inn.style.setProperty('--span', span);
    var gut = '<div class="sk-week-hours" aria-hidden="true">';
    for (var h = from; h <= to; h++) gut += '<span style="--at:' + (h - from) + '">' + hourText(h, ampm).replace(':00', '') + '</span>';
    inn.insertAdjacentHTML('beforeend', gut + '</div>');
    var now = (el.dataset.now || '').split(/\s+/), nowH = parseHour(now[1]);
    days.forEach(function (day, di) {
      var body = d.createElement('div'); body.className = 'sk-week-body';
      var evs = Array.prototype.slice.call(day.querySelectorAll(':scope > article'));
      evs.forEach(function (ev) {
        var p = (ev.dataset.at || '').split(/\s*[-–]\s*/), s = parseHour(p[0]), e = parseHour(p[1]);
        if (isNaN(s)) return; if (isNaN(e) || e <= s) e = s + 1;
        ev._s = s; ev._e = e;
        ev.style.setProperty('--a', Math.max(0, s - from)); ev.style.setProperty('--len', Math.min(to, e) - Math.max(from, s));
        if (e - s < 0.76) ev.classList.add('sk-ev-short');
        if (!ev.querySelector('time')) ev.insertAdjacentHTML('afterbegin', '<time>' + spanText(s, e, ampm) + '</time>');
        body.appendChild(ev);
      });
      // events that overlap share the column side by side
      evs.sort(function (a, b) { return a._s - b._s || b._e - a._e; });
      var cluster = [], ends = [], cEnd = -1;
      function close() { cluster.forEach(function (x) { x.style.setProperty('--cols', ends.length); }); cluster = []; ends = []; }
      evs.forEach(function (ev) {
        if (ev._s == null) return;
        if (ev._s >= cEnd) close();
        var c = 0; while (c < ends.length && ends[c] > ev._s) c++;
        ends[c] = ev._e; ev.style.setProperty('--col', c); cluster.push(ev); cEnd = Math.max(cEnd, ev._e);
      });
      close();
      var name = day.dataset.day || '', head = '<header><span>' + esc(name) + '</span>' + (day.dataset.date ? '<b>' + esc(day.dataset.date) + '</b>' : '') + '</header>';
      day.insertAdjacentHTML('afterbegin', head);
      if (!evs.length) body.insertAdjacentHTML('beforeend', '<p class="sk-week-free">Nothing booked</p>');
      if (now[0] && now[0] === name && !isNaN(nowH) && nowH >= from && nowH <= to) { body.insertAdjacentHTML('beforeend', '<i class="sk-week-now" style="--a:' + (nowH - from) + '" aria-label="Now"></i>'); day.setAttribute('data-today', ''); }
      day.appendChild(body); day.style.setProperty('--di', di);
      inn.appendChild(day);
    });
    el.appendChild(inn);
    // an event too short for all its words drops its second line, then its times
    var fit = function () {
      el.querySelectorAll('.sk-week-body > article').forEach(function (ev) {
        ev.classList.remove('sk-ev-tight', 'sk-ev-tighter');
        if (ev.scrollHeight > ev.clientHeight + 1) ev.classList.add('sk-ev-tight');
        if (ev.scrollHeight > ev.clientHeight + 1) ev.classList.add('sk-ev-tighter');
      });
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(function () { requestAnimationFrame(fit); }).observe(el);
    if (d.fonts) d.fonts.ready.then(fit);
  }

  // ---- a list you can search, filter and sort; rows slide to their new places ----
  function finder(el) {
    if (!once(el, 'Finder')) return;
    var list = el.querySelector('.sk-finder-list'); if (!list) return;
    var items = Array.prototype.slice.call(list.children), q = el.querySelector('input[type="search"]');
    var filt = el.querySelector('[data-sk-filter]'), sorter = el.querySelector('[data-sk-sort]'), count = el.querySelector('[data-sk-shown]'), empty = el.querySelector('.sk-finder-empty');
    var tag = '', key = '';
    if (filt) { var on = filt.querySelector('[aria-checked="true"]'); tag = on && on.value !== '*' ? on.value || '' : ''; }
    if (sorter) { var so = sorter.querySelector('[aria-checked="true"]') || sorter.querySelector('button'); key = so ? so.value || '' : ''; }
    items.forEach(function (li, i) { li._i = i; li._t = li.textContent.toLowerCase().replace(/\s+/g, ' '); });
    function run(animate) {
      var t = q ? q.value.trim().toLowerCase() : '', before = items.map(function (li) { return li.hidden ? null : li.getBoundingClientRect().top; });
      var shown = items.filter(function (li) {
        return (!tag || (' ' + (li.dataset.tags || '') + ' ').indexOf(' ' + tag + ' ') >= 0) && (!t || t.split(/\s+/).every(function (w) { return li._t.indexOf(w) >= 0; }));
      });
      var order = items.slice();
      if (key) {
        var desc = key.charAt(0) === '-', k = key.replace(/^-/, '');
        order.sort(function (a, b) {
          var x = a.dataset[k], y = b.dataset[k], nx = parseFloat(x), ny = parseFloat(y);
          var c = !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x || '').localeCompare(String(y || ''));
          return (desc ? -c : c) || a._i - b._i;
        });
      }
      order.forEach(function (li) { list.appendChild(li); li.hidden = shown.indexOf(li) < 0; });
      if (animate && !still() && list.animate) items.forEach(function (li) {
        if (li.hidden) return;
        var was = before[li._i], now = li.getBoundingClientRect().top;
        if (was == null) li.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
        else if (Math.abs(was - now) > 1) li.animate([{ transform: 'translateY(' + (was - now) + 'px)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      });
      // the value you sort by stands out in ink in every row, and in clay only in the first row shown: one clay thing per list
      var kk = key.replace(/^-/, ''), top = order.filter(function (li) { return !li.hidden; })[0];
      el.querySelectorAll('[data-of]').forEach(function (x) { var on = x.dataset.of === kk; x.classList.toggle('sk-sorted', on); x.classList.toggle('sk-sorted-top', on && !!top && top.contains(x)); });
      if (count) swap(count, String(shown.length));
      if (empty) empty.hidden = shown.length > 0;
      list.hidden = !shown.length;
    }
    if (q) q.addEventListener('input', function () { run(true); });
    if (filt) filt.addEventListener('sk:change', function (e) { tag = e.detail.value === '*' ? '' : e.detail.value; run(true); });
    if (sorter) sorter.addEventListener('sk:change', function (e) { key = e.detail.value; run(true); });
    // data-sk-reset (in the empty state): clear the words and the filter, and show everything again
    el.querySelectorAll('[data-sk-reset]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (q) q.value = '';
        var all = filt && (filt.querySelector('button[value="*"]') || filt.querySelector('button'));
        if (all && all.getAttribute('aria-checked') !== 'true') all.click();
        tag = ''; run(true); if (q) q.focus({ preventScroll: true });
      });
    });
    run(false);
  }

  function more(root) {
    root.querySelectorAll('[data-sk-tree]').forEach(function (el) {
      if (el.dataset.skDone) return; el.dataset.skDone = '1';
      layTree(el);
      var relay = function () { layTree(el); };
      if (window.ResizeObserver) new ResizeObserver(function () { requestAnimationFrame(relay); }).observe(el);
      if (d.fonts) d.fonts.ready.then(function () { el._w = 0; relay(); });
    });
    root.querySelectorAll('[data-sk-map]').forEach(function (el) {
      if (el.dataset.skDone) return; el.dataset.skDone = '1';
      try { layMap(el); } catch (e) { if (window.console) console.warn('Sketchbook: data-sk-map is not valid JSON', e); return; }
      var relay = function () { layMap(el); };
      if (window.ResizeObserver) new ResizeObserver(function () { requestAnimationFrame(relay); }).observe(el);
      if (d.fonts) d.fonts.ready.then(function () { el._w = 0; relay(); });
    });
    root.querySelectorAll('.sk-week').forEach(week);
    root.querySelectorAll('.sk-finder').forEach(finder);
  }
  // ================= more2: a process you can play and step through, a form in steps, a terminal =================

  // ---- player: a figure that changes step by step, with the words for each step under it ----
  // <div class="sk-player"><div class="sk-player-stage">…</div><ol class="sk-player-steps"><li>…</li>…</ol></div>
  // In the stage, data-sk-at="2" shows a thing only at step 2, "2-" from step 2 on, "-3" up to step 3, "1,4" at those.
  // A step's data-sk-data updates the chart in the stage. Each change fires sk:step { i, n, step }.
  var PLAY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 2.6c0-.8.9-1.3 1.6-.9l7.4 4.9c.6.4.6 1.4 0 1.8l-7.4 4.9c-.7.4-1.6 0-1.6-.9z"/></svg>';
  var PAUSE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="2.2" width="3.4" height="11.6" rx="1.2"/><rect x="9.4" y="2.2" width="3.4" height="11.6" rx="1.2"/></svg>';
  function atMatch(spec, n) {
    return String(spec).split(',').some(function (p) {
      p = p.trim(); if (!p) return false;
      var m = p.match(/^(\d*)\s*-\s*(\d*)$/);
      if (m) return (m[1] === '' || n >= +m[1]) && (m[2] === '' || n <= +m[2]);
      return +p === n;
    });
  }
  function player(el) {
    if (!once(el, 'Player')) return;
    var stage = el.querySelector('.sk-player-stage'), list = el.querySelector('.sk-player-steps'); if (!list) return;
    var steps = Array.prototype.slice.call(list.children), n = steps.length, at = 0, timer = 0, every = +el.dataset.skEvery || 2800;
    var bar = d.createElement('div'); bar.className = 'sk-player-bar';
    var track = steps.map(function (s, i) { return '<button type="button" class="sk-player-dot" data-i="' + i + '" aria-label="Step ' + (i + 1) + '"><i></i></button>'; }).join('');
    bar.innerHTML = '<button type="button" class="sk-player-play" aria-label="Play">' + PLAY_SVG + '<span>Play</span></button>'
      + '<button type="button" class="sk-icon-btn" data-act="prev" aria-label="Previous step"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg></button>'
      + '<div class="sk-player-track">' + track + '</div>'
      + '<button type="button" class="sk-icon-btn" data-act="next" aria-label="Next step"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>'
      + '<span class="sk-player-n" aria-live="polite"></span>';
    list.parentNode.insertBefore(bar, list);
    var play = bar.querySelector('.sk-player-play'), prev = bar.querySelector('[data-act="prev"]'), next = bar.querySelector('[data-act="next"]'), num = bar.querySelector('.sk-player-n');
    var dots = Array.prototype.slice.call(bar.querySelectorAll('.sk-player-dot'));
    var chartEl = stage && stage.querySelector('[data-sk-chart]');
    el.tabIndex = el.tabIndex < 0 ? 0 : el.tabIndex;
    function setPlay(on) {
      var end = !on && at === n - 1;
      play.innerHTML = (on ? PAUSE_SVG : PLAY_SVG) + '<span>' + (on ? 'Pause' : end ? 'Play again' : 'Play') + '</span>';
      play.setAttribute('aria-label', on ? 'Pause' : end ? 'Play again' : 'Play');
      play.toggleAttribute('data-again', !on && !!end);
      el.toggleAttribute('data-playing', on);
    }
    function stop() { if (timer) { clearInterval(timer); timer = 0; } setPlay(false); }
    function go(i, fromPlay) {
      i = Math.max(0, Math.min(n - 1, i));
      var dir = i >= at ? 1 : -1; at = i;
      steps.forEach(function (s, k) { s.toggleAttribute('data-on', k === at); });
      var cur = steps[at];
      if (!still()) { cur.style.setProperty('--sk-dir', dir); cur.classList.remove('sk-step-in'); void cur.offsetWidth; cur.classList.add('sk-step-in'); }
      dots.forEach(function (b, k) { b.toggleAttribute('data-done', k < at); b.toggleAttribute('data-on', k === at); b.setAttribute('aria-current', k === at ? 'step' : 'false'); });
      el.style.setProperty('--sk-p', n > 1 ? at / (n - 1) : 1);
      if (stage) {
        stage.setAttribute('data-step', at + 1);
        stage.querySelectorAll('[data-sk-at]').forEach(function (x) { x.toggleAttribute('data-off', !atMatch(x.dataset.skAt, at + 1)); });
      }
      if (chartEl && cur.dataset.skKey != null) chartEl.dataset.skKey = cur.dataset.skKey;
      if (chartEl && cur.dataset.skData) { try { update(chartEl, JSON.parse(cur.dataset.skData)); } catch (e) { /* a step without good data leaves the chart as it is */ } }
      swap(num, (at + 1) + ' of ' + n);
      prev.disabled = at === 0; next.disabled = at === n - 1;
      el.dispatchEvent(new CustomEvent('sk:step', { bubbles: true, detail: { i: at, n: n, step: cur } }));
      if (!fromPlay && timer) stop();
      else if (fromPlay && at === n - 1) stop();
      else if (!timer) setPlay(false);
    }
    // on paper the figure shows how it ends, with every step's words listed under it
    window.addEventListener('beforeprint', function () { el._skAt = at; stop(); go(n - 1); });
    window.addEventListener('afterprint', function () { if (el._skAt != null) { go(el._skAt); el._skAt = null; } });
    play.addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (at === n - 1) go(0, true);
      setPlay(true);
      timer = setInterval(function () { if (at < n - 1) go(at + 1, true); else stop(); }, still() ? Math.max(every, 3400) : every);
    });
    prev.addEventListener('click', function () { go(at - 1); });
    next.addEventListener('click', function () { go(at + 1); });
    dots.forEach(function (b) { b.addEventListener('click', function () { go(+b.dataset.i); }); });
    el.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
      else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); play.click(); }
    });
    // a player that scrolls away stops, so it never runs on where nobody is watching
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { es.forEach(function (x) { if (!x.isIntersecting && timer) stop(); }); }).observe(el);
    go(0); setPlay(false);
  }

  // ---- a form in steps: one fieldset at a time, a row of numbered steps on top, a check-and-send step at the end ----
  // <form class="sk-wizard" data-sk-send="Send it"><fieldset data-step="You">…</fieldset>…<fieldset data-step="Check" data-sk-review></fieldset>
  // <div class="sk-wizard-done" hidden>…</div></form>. Required fields stop Continue with a note under them.
  function fieldValue(f) {
    var ins = f.querySelectorAll('input, select, textarea'), out = [];
    ins.forEach(function (i) {
      if ((i.type === 'radio' || i.type === 'checkbox')) {
        if (!i.checked) return;
        // the choice's name, without its small print
        var l = i.closest('label'), c = l ? l.cloneNode(true) : null;
        if (c) c.querySelectorAll('small, .sk-box, svg').forEach(function (x) { x.remove(); });
        out.push(c ? c.textContent.trim() : i.value);
      }
      else if (i.tagName === 'SELECT') { if (i.value) out.push(i.options[i.selectedIndex].text); }
      else if (i.value.trim()) out.push(i.value.trim());
    });
    var seg = f.querySelector('.sk-seg [aria-checked="true"]'); if (seg) out.push(seg.textContent.trim());
    return out.join(', ');
  }
  function fieldName(f) {
    var l = f.querySelector(':scope > label, :scope > .sk-field-label, :scope > legend, :scope > .sk-label');
    return l ? l.childNodes[0] && l.childNodes[0].nodeType === 3 ? l.childNodes[0].textContent.trim() : l.textContent.trim() : '';
  }
  function wizard(form) {
    if (!once(form, 'Wizard')) return;
    var pages = Array.prototype.slice.call(form.querySelectorAll(':scope > fieldset')), n = pages.length, at = 0, ret = -1, done = form.querySelector('.sk-wizard-done');
    if (!n) return;
    // buttons inside the steps (a segmented control, a Change link) must never send the form
    form.querySelectorAll('button:not([type])').forEach(function (b) { b.type = 'button'; });
    var nav = d.createElement('ol'); nav.className = 'sk-wizard-nav';
    nav.innerHTML = pages.map(function (p, i) { return '<li><span class="sk-wizard-num"><b>' + (i + 1) + '</b>' + markSVG('yes', 4 + i) + '</span><span class="sk-wizard-name">' + esc(p.dataset.step || 'Step ' + (i + 1)) + '</span></li>'; }).join('');
    nav.style.setProperty('--n', n);
    form.insertBefore(nav, pages[0]);
    var body = d.createElement('div'); body.className = 'sk-wizard-body'; form.insertBefore(body, pages[0]);
    pages.forEach(function (p) { body.appendChild(p); });
    var foot = d.createElement('div'); foot.className = 'sk-wizard-foot';
    foot.innerHTML = '<button type="button" class="sk-btn" data-sk-ghost data-act="back">Back</button><span class="sk-caption sk-wizard-n"></span><button type="submit" class="sk-btn" data-sk-arrow data-act="go">Continue</button>';
    body.after(foot);
    var back = foot.querySelector('[data-act="back"]'), goBtn = foot.querySelector('[data-act="go"]'), cap = foot.querySelector('.sk-wizard-n');
    var navItems = Array.prototype.slice.call(nav.children);
    function review(p) {
      var h = '';
      pages.slice(0, pages.indexOf(p)).forEach(function (pg, i) {
        var rows = '';
        pg.querySelectorAll('.sk-field, .sk-choices, fieldset.sk-group').forEach(function (f) {
          var hid = f.closest('[hidden]'); if (hid && hid !== pg && pg.contains(hid)) return;
          var name = fieldName(f), v = fieldValue(f); if (!name) return;
          rows += '<div><dt>' + esc(name) + '</dt><dd' + (v ? '' : ' data-empty') + '>' + esc(v || 'Not given') + '</dd></div>';
        });
        h += '<section><header><h4>' + esc(pg.dataset.step || 'Step ' + (i + 1)) + '</h4><button type="button" class="sk-btn" data-sk-quiet data-size="s" data-edit="' + i + '">Change</button></header><dl>' + rows + '</dl></section>';
      });
      var box = p.querySelector('.sk-review'); if (!box) { box = d.createElement('div'); box.className = 'sk-review'; p.appendChild(box); }
      box.innerHTML = h;
      // a step opened from the review comes straight back to it
      box.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { ret = pages.indexOf(p); show(+b.dataset.edit); }); });
    }
    function show(i, first) {
      var from = pages[at], to = pages[i], dir = i >= at ? 1 : -1, h0 = body.offsetHeight;
      if (to.hasAttribute('data-sk-review')) review(to);
      pages.forEach(function (p, k) { p.hidden = k !== i; });
      at = i;
      navItems.forEach(function (li, k) { li.toggleAttribute('data-done', k < at); li.toggleAttribute('data-on', k === at); if (k === at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      nav.style.setProperty('--sk-p', n > 1 ? at / (n - 1) : 1);
      back.hidden = at === 0;
      if (at >= ret) ret = -1;
      goBtn.textContent = at === n - 1 ? (form.dataset.skSend || 'Send') : ret > at ? 'Back to review' : 'Continue';
      if (!first && !still() && body.animate) {
        var h1 = body.offsetHeight;
        if (Math.abs(h1 - h0) > 2) body.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
        to.animate([{ opacity: 0, transform: 'translateX(' + (24 * dir) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }
      if (!first) { var f = to.querySelector('input:not([type=hidden]), select, textarea, button'); if (f) f.focus({ preventScroll: true }); var top = form.getBoundingClientRect().top; if (top < 0) form.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' }); }
      if (from !== to) form.dispatchEvent(new CustomEvent('sk:step', { bubbles: true, detail: { i: at, n: n } }));
    }
    function check(p) {
      var bad = null;
      p.querySelectorAll('[required]').forEach(function (inp) {
        var ok = inp.type === 'radio' ? !!p.querySelector('input[name="' + inp.name + '"]:checked') : inp.type === 'checkbox' ? inp.checked : inp.checkValidity();
        var f = inp.closest('.sk-field, .sk-choices, fieldset.sk-group') || inp.parentNode, msg = f.querySelector('.sk-field-msg');
        if (inp.type !== 'radio' && inp.type !== 'checkbox') inp.setAttribute('aria-invalid', ok ? 'false' : 'true');
        if (!ok) {
          if (!msg) {
            msg = d.createElement('p'); msg.className = 'sk-field-msg'; msg.id = 'skm' + (++uidN);
            // the note sits right under the box it's about; in a group of choices, at the end
            if (f.classList.contains('sk-field')) inp.after(msg); else f.appendChild(msg);
            inp.setAttribute('aria-describedby', msg.id);
          }
          msg.textContent = inp.dataset.skMsg || (inp.type === 'email' && inp.value ? 'That doesn’t look like an email address.' : 'This one is needed.');
          if (!bad) bad = inp;
        } else if (msg) msg.remove();
      });
      if (bad) { bad.focus(); return false; }
      return true;
    }
    // a fixed field clears its note as soon as it's right
    form.addEventListener('input', function (e) { var inp = e.target; if (inp.getAttribute && inp.getAttribute('aria-invalid') === 'true' && inp.checkValidity()) { inp.setAttribute('aria-invalid', 'false'); var f = inp.closest('.sk-field'); var m = f && f.querySelector('.sk-field-msg'); if (m) m.remove(); } });
    form.addEventListener('change', function (e) { var f = e.target.closest && e.target.closest('.sk-choices, fieldset.sk-group'); var m = f && f.querySelector('.sk-field-msg'); if (m) m.remove(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!check(pages[at])) return;
      if (ret > at) { show(ret); return; }
      if (at < n - 1) { show(at + 1); return; }
      var data = {};
      pages.forEach(function (p) { p.querySelectorAll('.sk-field, .sk-choices, fieldset.sk-group').forEach(function (f) { var k = fieldName(f); if (k) data[k] = fieldValue(f); }); });
      form.dispatchEvent(new CustomEvent('sk:submit', { bubbles: true, detail: data }));
      if (done) {
        var h0 = form.offsetHeight;
        nav.hidden = true; body.hidden = true; foot.hidden = true; done.hidden = false;
        mount(done);
        if (!still() && done.animate) { done.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }); form.animate([{ height: h0 + 'px' }, { height: form.offsetHeight + 'px' }], { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }); }
        var again = done.querySelector('[data-sk-again]');
        if (again && !again.dataset.skBound) { again.dataset.skBound = '1'; again.addEventListener('click', function () { done.hidden = true; nav.hidden = false; body.hidden = false; foot.hidden = false; show(0); }); }
      }
    });
    back.addEventListener('click', function () { if (at > 0) show(at - 1); });
    show(0, true);
  }

  // ---- terminal: a command line that types itself once, when you reach it ----
  // <figure class="sk-terminal" data-title="~/Downloads"><pre>$ tidy --dry-run
  // Would move 214 files</pre></figure>. Lines that start with "$ " are typed; the rest print after. Copy copies the commands; data-sk-copy-n="1" only the first.
  function terminal(fig) {
    if (!once(fig, 'Term')) return;
    var pre = fig.querySelector('pre'); if (!pre) return;
    var lines = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
    var html = lines.map(function (l, i) {
      var cmd = /^\$ /.test(l);
      return '<span class="sk-tl' + (cmd ? ' sk-tl-cmd' : '') + (/^#/.test(l) ? ' sk-tl-note' : '') + '" data-i="' + i + '">' + (cmd ? '<span class="sk-tl-ps">$</span> <span class="sk-tl-t">' + esc(l.slice(2)) + '</span>' : esc(l) || ' ') + '</span>';
    }).join('');
    pre.innerHTML = '<code>' + html + '</code>';
    var head = d.createElement('figcaption'); head.className = 'sk-terminal-head';
    // data-sk-copy-n="1" copies only the first command (a dry run, say), so a paste never runs the step after it
    var cmds = lines.filter(function (l) { return /^\$ /.test(l); }).map(function (l) { return l.slice(2); }), nc = Math.min(cmds.length, +fig.dataset.skCopyN || cmds.length);
    var what = nc === 1 ? 'the command' : nc < cmds.length ? 'the first ' + nc + ' commands' : 'the commands';
    head.innerHTML = '<span class="sk-terminal-title">' + esc(fig.dataset.title || 'Terminal') + '</span><button type="button" class="sk-terminal-copy" aria-label="Copy ' + what + (nc === 1 ? ': ' + esc(cmds[0]) : '') + '">Copy</button>';
    fig.insertBefore(head, pre);
    head.querySelector('button').addEventListener('click', function () {
      copyText(cmds.slice(0, nc).join('\n'), nc === 1 ? 'Copied ' + cmds[0] : 'Copied ' + what);
    });
    var ls = Array.prototype.slice.call(pre.querySelectorAll('.sk-tl'));
    if (still() || !inEnter(fig)) return;
    // hide everything, then type each command and print what follows it
    ls.forEach(function (l) { l.classList.add('sk-tl-wait'); });
    var played = false;
    function playIt() {
      if (played) return; played = true;
      var t = 250;
      ls.forEach(function (l) {
        if (l.classList.contains('sk-tl-cmd')) {
          var tx = l.querySelector('.sk-tl-t'), full = tx.textContent;
          setTimeout(function () { tx.textContent = ''; l.classList.remove('sk-tl-wait'); l.classList.add('sk-tl-typing'); }, t);
          t += 260;
          for (var k = 1; k <= full.length; k++) (function (k, at) { setTimeout(function () { tx.textContent = full.slice(0, k); }, at); })(k, t + k * 34);
          t += full.length * 34 + 320;
          (function (at) { setTimeout(function () { l.classList.remove('sk-tl-typing'); }, at); })(t);
        } else {
          (function (at) { setTimeout(function () { l.classList.remove('sk-tl-wait'); l.classList.add('sk-tl-in'); }, at); })(t);
          t += 70;
        }
      });
    }
    var host = fig.closest('.sk-wait') || fig;
    if (window.IntersectionObserver) {
      var o = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { o.disconnect(); setTimeout(playIt, 300); } }); }, { threshold: 0.4 });
      o.observe(fig);
    } else playIt();
    void host;
  }

  function more2(root) {
    root.querySelectorAll('.sk-player').forEach(player);
    root.querySelectorAll('form.sk-wizard').forEach(wizard);
    root.querySelectorAll('figure.sk-terminal').forEach(terminal);
  }
  // ---- v4: the hand past the hero. Hand marks (a brush ring round a number, a brush line under a phrase). ----
  // One theme a page. A page that names no theme follows the viewer's, and the runtime writes that theme on <html>,
  // so every [data-theme] rule applies the same way however the theme was chosen. Nothing inside a page sets a theme of its own.
  (function () {
    var h = d.documentElement; if (h.hasAttribute('data-theme') || !window.matchMedia) return;
    var mq = matchMedia('(prefers-color-scheme: dark)'), last = null;
    function follow() { if (h.hasAttribute('data-sk-pinned') || (last !== null && h.getAttribute('data-theme') !== last)) return; last = mq.matches ? 'dark' : 'light'; h.setAttribute('data-theme', last); }
    follow(); if (mq.addEventListener) mq.addEventListener('change', follow);
  })();

  // Hand marks live on one layer over the page, like aimed notes, so they can follow text wherever it wraps.
  var markLayer = null, marked = [];
  function ringPath(r, seed, fs) {
    var rnd = INK.rng(seed), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2 + fs * 0.05, w = r.right - r.left;
    // sized from the type, not the line box, so the loop hugs the figures and stays clear of the label above and the line below
    var rx = w / 2 + Math.max(12, fs * 0.36), ry = fs * 0.5 + Math.max(4, fs * 0.09), pts = [], n = 22, a0 = -2.5 + (rnd() - 0.5) * 0.3, turn = Math.PI * 2 * 1.09;
    // one loop that starts a little wide, closes past its own start, and never quite meets it: the way a hand rings a thing
    for (var i = 0; i <= n; i++) { var t = i / n, a = a0 + t * turn, k = 1.06 - 0.1 * t + (rnd() - 0.5) * 0.03; pts.push([cx + rx * k * Math.cos(a) + t * 3, cy + ry * k * Math.sin(a) * (1 + 0.04 * Math.sin(a * 2))]); }
    return pts;
  }
  function underPath(r, seed, fs) {
    // just under the baseline, where a pen would go, so a phrase that wraps in a tight heading doesn't run into the line below
    var rnd = INK.rng(seed), h = r.bottom - r.top, base = r.top + (h - fs) / 2 + fs * 0.8, y = Math.min(r.bottom + 2, base + Math.max(4, fs * 0.17)), x0 = r.left - 2, x1 = r.right + 3, w = x1 - x0, n = Math.max(3, Math.round(w / 60)), pts = [];
    for (var i = 0; i <= n; i++) { var t = i / n; pts.push([x0 + w * t, y + Math.sin(t * Math.PI) * -1.6 + (rnd() - 0.5) * 1.4 + t * -1]); }
    return pts;
  }
  function drawMarks() {
    if (!markLayer) return;
    var sx = scrollX, sy = scrollY, out = '';
    marked = marked.filter(function (el) { return el.isConnected; });
    marked.forEach(function (el, i) {
      if (!el._skSeen || el.closest('.sk-wait')) return;
      var ring = el.hasAttribute('data-sk-ring'), rects = Array.prototype.slice.call(el.getClientRects()).filter(function (r) { return r.width > 4 && r.height > 4; });
      if (!rects.length) return;
      if (ring) { var b = el.getBoundingClientRect(); rects = [b]; }
      var fs = parseFloat(getComputedStyle(el).fontSize) || 17, w = Math.max(2.4, Math.min(5, fs * 0.075 + 1.6)), go = !el._skDrawn && !still(), total = 0;
      if (go && !el._skT0) el._skT0 = performance.now();
      var gone = go ? Math.round(performance.now() - el._skT0) : 0;
      var at = -gone;
      rects.forEach(function (r, j) {
        var R = { left: r.left + sx, right: r.right + sx, top: r.top + sy, bottom: r.bottom + sy }, seed = 11 + i * 7 + j;
        var pts = ring ? ringPath(R, seed, fs) : underPath(R, seed, fs), bo = { w: ring ? w : w * 1.15, seed: seed, wobble: 0.5, taper: ring ? 0.12 : 0.3, end: 0.35, vary: 0.4 };
        if (go) {
          // the pen follows the stroke: round the loop from where the hand starts, or along the line from its left end. A phrase on two
          // lines gets one stroke a line, the second after the first. Redrawn part-way (a resize), each stroke picks up where it was.
          var pd = ring ? 620 : Math.round(Math.max(260, Math.min(600, r.width * 1.6)));
          out += penStrokes([{ pts: pts, o: bo, cuts: ring ? [0.5] : null, pd: pd }], '', penIds('skhm' + i + '-' + j), at).html;
          at += pd + 90; total = Math.max(total, at + gone);
        } else out += '<path d="' + INK.brush(pts, bo) + '"/>';
      });
      if (go && !el._skTimer) el._skTimer = setTimeout(function () { el._skDrawn = true; }, total + 200);
    });
    markLayer.innerHTML = '<g class="sk-hm-g sk-pen-go">' + out + '</g>';
  }
  function handMarks(root) {
    var found = false;
    each(root, '[data-sk-ring], [data-sk-under]', function (el) {
      if (marked.indexOf(el) >= 0 || el.closest('.sk-mini, .sk-deck, dialog')) return;
      marked.push(el); found = true;
      // a mark is made after the thing it marks has arrived and been read for a beat
      whenSeen(el, function () { setTimeout(function () { el._skSeen = true; requestAnimationFrame(drawMarks); }, still() ? 0 : 700); });
    });
    if (!found && !markLayer) return;
    if (!markLayer) {
      markLayer = d.createElementNS(NS, 'svg'); markLayer.setAttribute('class', 'sk-hm-layer'); markLayer.setAttribute('aria-hidden', 'true');
      d.body.appendChild(markLayer);
      var redo = function () { requestAnimationFrame(drawMarks); };
      addEventListener('resize', redo); if (d.fonts) d.fonts.ready.then(redo);
      if (window.ResizeObserver) new ResizeObserver(redo).observe(d.body);
      window.addEventListener('beforeprint', function () { marked.forEach(function (el) { el._skSeen = true; el._skDrawn = true; }); drawMarks(); });
      d.addEventListener('transitionend', redo); d.addEventListener('sk:step', redo); d.addEventListener('sk:change', redo);
    }
    drawMarks();
  }
  // playing a box again: its marks are drawn again, a beat after their words
  function remark(box) {
    marked.forEach(function (el) {
      if (!box.contains(el)) return;
      clearTimeout(el._skTimer); el._skSeen = el._skDrawn = false; el._skT0 = 0; el._skTimer = null;
      whenSeen(el, function () { setTimeout(function () { el._skSeen = true; requestAnimationFrame(drawMarks); }, still() ? 0 : 900); });
    });
    drawMarks();
  }
  function more3(root) {
    handMarks(root);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { mount(d); }); else mount(d);
  window.Sketchbook = { drawings: Object.keys(NAMES), draw: draw, blob: blob, tile: tile, arrow: arrow, quoteMark: quoteMark, flow: flow, mount: mount, replay: replay, toast: toast, theme: theme, format: format, chart: chart, update: update, count: countUp, mark: markSVG, set: swap, copy: copyText, ink: INK };
})();
