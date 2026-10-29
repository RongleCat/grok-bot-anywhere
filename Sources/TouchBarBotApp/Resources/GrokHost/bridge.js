import {r as React} from "./common.js";
import {__ReactDOM} from "./vendor.js";
import {a5 as toBody, a7 as still, af as Mark, ah as appearance} from "./platform.js";

const stripMode = /strip\.html(?:$|[?#])/.test(`${location.pathname}${location.href}`);

const host = document.getElementById("avatar");
const liveHost = document.getElementById("live");
const root = __ReactDOM.createRoot(host);
const liveRoot = __ReactDOM.createRoot(liveHost);

let stripQueued = new Map();
let stripSpoof = "off";

function spoofVisibility() {
  const hidden = { configurable: true, get: () => false };
  const shown = { configurable: true, get: () => "visible" };
  const targets = [document, Document.prototype, window.HTMLDocument?.prototype].filter(Boolean);
  const notes = [];
  for (const target of targets) {
    for (const [key, descriptor] of [["hidden", hidden], ["visibilityState", shown]]) {
      try {
        Object.defineProperty(target, key, descriptor);
        notes.push(`${target === document ? "doc" : "proto"}:${key}:ok`);
      } catch (error) {
        notes.push(`${key}:${error?.name || "fail"}`);
      }
    }
  }
  try {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  } catch {}
  stripSpoof = notes.join(",");
  document.dispatchEvent(new Event("visibilitychange"));
}

function installClock() {
  if (window.__stripClock) return;
  window.__stripClock = true;
  stripQueued = new Map();
  let nextId = 1;
  let clock = performance.now();
  window.requestAnimationFrame = (callback) => {
    const id = nextId++;
    stripQueued.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => { stripQueued.delete(id); };
  window.__stepAnimations = (ms) => {
    const step = Number(ms) > 0 ? Number(ms) : 16;
    clock += step;
    const batch = [...stripQueued.entries()];
    stripQueued.clear();
    for (const [, callback] of batch) {
      try { callback(clock); } catch {}
    }
    const stage = document.getElementById("stage");
    freezeBreath(stage);
    if (stage) {
      for (const glyph of stage.querySelectorAll(".glyph:not([data-fit='1'])")) {
        const cell = glyph.closest(".cell");
        const mark = cell && cell.clientWidth > 20 ? cell.clientWidth - 16 : 40;
        lockStripGlyph(glyph, mark);
      }
    }
    return batch.length;
  };
  spoofVisibility();
  const NativeObserver = window.IntersectionObserver;
  if (NativeObserver && !NativeObserver.__stripForced) {
    const Forced = class extends NativeObserver {
      constructor(callback, options) {
        super((entries, observer) => {
          callback(entries.map((entry) => ({
            isIntersecting: true,
            intersectionRatio: 1,
            target: entry.target,
            boundingClientRect: entry.boundingClientRect,
            intersectionRect: entry.boundingClientRect,
            rootBounds: entry.rootBounds,
            time: entry.time
          })), observer);
        }, options);
      }
    };
    Forced.__stripForced = true;
    window.IntersectionObserver = Forced;
  }
}

function enableStrip() {
  document.body.classList.add("strip");
  installClock();
}
window.__enableStrip = enableStrip;
if (stripMode) enableStrip();
if (!stripMode) {
  const nativeFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => nativeFrame((time) => {
    callback(time);
    freezeBreath(host);
    fitGlyph(host.querySelector(".glyph"), host.dataset.shape);
    if (host.classList.contains("main")) applyNotch(host);
  });
}
const known = new Set(["idle", "listening", "thinking", "streaming", "searching", "working", "waiting", "blocked", "finished", "failed", "sleeping", "happy"]);
let liveSignature = "";

function mapState(state) {
  if (state === "wide") return "listening";
  if (state === "comet") return "streaming";
  return known.has(state) ? state : "idle";
}

function markProps(config, size) {
  const reduced = config.reducedMotion === true;
  const visible = config.visible !== false;
  return {
    body: toBody(config.shape || "blob"),
    appearance: appearance("var(--grok-bot-ink)"),
    state: mapState(config.state),
    size,
    isPlaying: visible && !reduced,
    isStatic: reduced || !visible,
    isFollowingPointer: visible && !reduced && config.follow !== false,
    seed: config.seed || config.shape || "bot"
  };
}

function paint(node, color) {
  node.style.setProperty("--grok-bot-ink", typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1084FE");
}

function starPath(cx, cy, outer, inner) {
  let path = "";
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const x = (cx + Math.cos(angle) * radius).toFixed(2);
    const y = (cy + Math.sin(angle) * radius).toFixed(2);
    path += `${index === 0 ? "M" : "L"}${x} ${y}`;
  }
  return `${path}Z`;
}

function MainBadge() {
  return React.createElement("svg", {className: "main-badge", viewBox: "0 0 16 16", "aria-hidden": "true"},
    React.createElement("circle", {cx: "8", cy: "8", r: "7.75", fill: "#f59312", stroke: "#1c1c1c", "stroke-opacity": "0.06", "stroke-width": "0.5"}),
    React.createElement("path", {d: starPath(8, 8, 3.55, 1.42), fill: "#ffffff"})
  );
}

// Scale a full-square live glyph (composer, detail) from the center so the
// furthest point of the silhouette stays inside the square, including a later
// pose that reaches farther. The cached value is that reach as a fraction of
// the mark's viewBox, measured with getBBox so the square's overflow clip
// cannot lock a shrunken box and push the scale back up.
// The Touch Bar locks one scale per shape from the painted width and height,
// so a small bean and a wide cloud occupy the same cell. The value is taken
// once; later poses do not resize the glyph. Until that measurement exists,
// every cell uses the cloud's extent. The star stays on the unscaled square:
// disc 16/60, flush bottom-right, hole expanded by 2.7/60.
const fitInset = 0.88;
const stripFit = 0.84;
const stripFallback = 0.75;
const fittedFraction = new Map();

function stripScaleFor(mark, extent) {
  const safe = extent > 0.45 && extent < 1.05 ? extent : stripFallback;
  const next = (mark + 16) * stripFit / (safe * mark);
  return Math.min(2.15, Math.max(1.15, next));
}

function appliedScale(glyph) {
  const match = /scale\(([-\d.]+)\)/.exec(glyph?.style?.transform || "");
  const value = match ? Number(match[1]) : 1;
  return value > 0 ? value : 1;
}

function readMatrix(raw) {
  const matrix = /matrix\(\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*\)/.exec(raw || "");
  if (matrix) return {a: +matrix[1], b: +matrix[2], c: +matrix[3], d: +matrix[4], e: +matrix[5], f: +matrix[6]};
  const nested = /translate\(([-\d.eE]+) ([-\d.eE]+)\) scale\(([-\d.eE]+)\) translate\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(raw || "");
  if (nested) {
    const scale = +nested[3];
    return {a: scale, b: 0, c: 0, d: scale, e: +nested[1] + scale * +nested[4], f: +nested[2] + scale * +nested[5]};
  }
  return {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};
}

// Reach of the painted silhouette as a fraction of the viewBox half-side.
// Direct children only: a group's bbox already includes its descendants.
function geometryFraction(svg) {
  const box = svg.viewBox?.baseVal;
  if (!box || !(box.width > 1) || !(box.height > 1)) return 0;
  const half = Math.max(box.width, box.height) / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  let reach = 0;
  let counted = 0;
  for (const node of svg.children) {
    const tag = node.tagName;
    if (tag !== "g" && tag !== "path" && tag !== "use" && tag !== "circle" && tag !== "ellipse" && tag !== "polygon") continue;
    let bounds;
    try { bounds = node.getBBox(); } catch { continue; }
    if (!(bounds.width > 0 || bounds.height > 0)) continue;
    const matrix = readMatrix(node.getAttribute("transform"));
    const corners = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.width, bounds.y],
      [bounds.x, bounds.y + bounds.height],
      [bounds.x + bounds.width, bounds.y + bounds.height]
    ];
    for (const [x, y] of corners) {
      const px = matrix.a * x + matrix.c * y + matrix.e;
      const py = matrix.b * x + matrix.d * y + matrix.f;
      reach = Math.max(reach, Math.abs(px - cx), Math.abs(py - cy));
    }
    counted += 1;
  }
  return counted ? reach / half : 0;
}

// Painted width or height, whichever is longer, as a fraction of the viewBox.
// This is the size the Touch Bar equalizes. Reach-from-center would shrink a
// shape that sits off center.
function paintExtent(svg) {
  const box = svg.viewBox?.baseVal;
  if (!box || !(box.width > 1) || !(box.height > 1)) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let counted = 0;
  for (const node of svg.children) {
    const tag = node.tagName;
    if (tag !== "g" && tag !== "path" && tag !== "use" && tag !== "circle" && tag !== "ellipse" && tag !== "polygon") continue;
    let bounds;
    try { bounds = node.getBBox(); } catch { continue; }
    if (!(bounds.width > 0 || bounds.height > 0)) continue;
    const matrix = readMatrix(node.getAttribute("transform"));
    const corners = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.width, bounds.y],
      [bounds.x, bounds.y + bounds.height],
      [bounds.x + bounds.width, bounds.y + bounds.height]
    ];
    for (const [x, y] of corners) {
      const px = matrix.a * x + matrix.c * y + matrix.e;
      const py = matrix.b * x + matrix.d * y + matrix.f;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    counted += 1;
  }
  if (!counted) return 0;
  return Math.max((maxX - minX) / box.width, (maxY - minY) / box.height);
}

function lockStripGlyph(glyph, mark) {
  if (!glyph || glyph.dataset.fit === "1") return;
  const svg = glyph.querySelector("svg");
  if (!svg) return;
  svg.style.overflow = "visible";
  const extent = paintExtent(svg);
  if (!(extent > 0.45 && extent < 1.05)) return;
  glyph.style.transform = `scale(${stripScaleFor(mark, extent)})`;
  glyph.dataset.fit = "1";
}

function fitGlyph(glyph, shape) {
  if (!glyph) return false;
  const svg = glyph.querySelector("svg");
  const frame = glyph.parentElement;
  if (!svg || !frame) return false;
  svg.style.overflow = "visible";
  const key = shape || glyph.dataset.shape || "blob";
  const sample = geometryFraction(svg);
  if (sample > 0.35 && sample < 1.6) {
    const previous = fittedFraction.get(key) || 0;
    if (sample > previous + 0.008) fittedFraction.set(key, sample);
  }
  const fraction = fittedFraction.get(key);
  if (!fraction) return false;
  const current = appliedScale(glyph);
  const svgBox = svg.getBoundingClientRect();
  const frameBox = frame.getBoundingClientRect();
  const svgUnscaled = svgBox.width / current;
  if (!(frameBox.width > 2) || !(svgUnscaled > 2)) return false;
  const next = frameBox.width * fitInset / (fraction * svgUnscaled);
  if (!(next > 0.4 && next < 2.2)) return false;
  if (Math.abs(current - next) > 0.012) glyph.style.transform = `scale(${next})`;
  return true;
}
function notchMask(size) {
  const disc = size * 16 / 60;
  const gap = size * 2.7 / 60;
  const radius = disc / 2 + gap;
  const cx = size - disc / 2;
  const n = (value) => Number(value).toFixed(3);
  const outer = `M0 0H${n(size)}V${n(size)}H0Z`;
  const hole = `M${n(cx - radius)} ${n(cx)}a${n(radius)} ${n(radius)} 0 1 0 ${n(radius * 2)} 0a${n(radius)} ${n(radius)} 0 1 0 ${n(-radius * 2)} 0Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(size)}" height="${n(size)}" viewBox="0 0 ${n(size)} ${n(size)}"><path fill="#fff" fill-rule="evenodd" d="${outer}${hole}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function applyNotch(container) {
  if (!container?.classList.contains("main")) return false;
  const box = container.querySelector(":scope > .clip, :scope .avatar-clip");
  if (!box) return false;
  const size = container.getBoundingClientRect().width;
  if (!(size > 2)) return false;
  const key = size.toFixed(2);
  if (box.dataset.notch === key && box.style.webkitMaskImage) return true;
  box.dataset.notch = key;
  const mask = notchMask(size);
  box.style.webkitMaskImage = mask;
  box.style.maskImage = mask;
  box.style.webkitMaskSize = `${size}px ${size}px`;
  box.style.maskSize = `${size}px ${size}px`;
  box.style.webkitMaskRepeat = "no-repeat";
  box.style.maskRepeat = "no-repeat";
  box.style.webkitMaskPosition = "center";
  box.style.maskPosition = "center";
  box.style.webkitMaskSourceType = "alpha";
  box.style.maskMode = "alpha";
  return true;
}

function watchNotch(container) {
  let tries = 0;
  const tick = () => {
    if (!container.classList.contains("main")) return;
    if (applyNotch(container) || tries > 30) return;
    tries += 1;
    requestAnimationFrame(tick);
  };
  tick();
  if (container._notchObserver || typeof ResizeObserver !== "function") return;
  container._notchObserver = new ResizeObserver(() => { tries = 0; tick(); });
  container._notchObserver.observe(container);
}

// Idle clips breathe zoom from 0.6 to 0.64. Hold that wrapper at 0.6 so the
// glyph keeps one size. Working clips dip to about 0.42 and are left alone.
function freezeBreath(root) {
  if (!root) return;
  for (const node of root.querySelectorAll("g[transform]")) {
    const value = node.getAttribute("transform");
    if (!value) continue;
    const match = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\) translate\(([-\d.]+) ([-\d.]+)\)/.exec(value);
    if (!match) continue;
    const x = Number(match[1]);
    const y = Number(match[2]);
    const scale = Number(match[3]);
    const nx = Number(match[4]);
    const ny = Number(match[5]);
    if (Math.abs(x - y) > 0.01 || Math.abs(nx - ny) > 0.01 || Math.abs(x + nx) > 0.05) continue;
    if (scale < 0.57 || scale > 0.7 || Math.abs(scale - 0.6) < 0.0005) continue;
    node.setAttribute("transform", value.replace(match[0], `translate(${match[1]} ${match[2]}) scale(0.6) translate(${match[4]} ${match[5]})`));
  }
}

window.setAvatar = (config = {}) => {
  paint(host, config.color);
  const main = config.main === true;
  const shape = config.shape || "blob";
  host.dataset.shape = shape;
  host.classList.toggle("main", main);
  const known = fittedFraction.get(shape);
  const scale = known ? fitInset / known : 1;
  root.render(React.createElement("div", {className: "avatar-frame"},
    React.createElement("div", {className: "avatar-clip"},
      React.createElement("div", {className: "glyph", style: {transform: `scale(${scale})`}},
        React.createElement(Mark, markProps(config, "100%")))),
    main ? React.createElement(MainBadge) : null
  ));
  window.__avatarReady = true;
  if (main) watchNotch(host);
};

const stripRefs = new Map();
let stripRoot = null;
let stripSignature = "";
let glance = null;
let nod = null;

function StripMark({id, shape, color, state, mark, main}) {
  const ref = React.useRef(null);
  const cellRef = React.useRef(null);
  React.useEffect(() => {
    stripRefs.set(id, ref);
    return () => { if (stripRefs.get(id) === ref) stripRefs.delete(id); };
  }, [id]);
  React.useLayoutEffect(() => {
    const cell = cellRef.current;
    const glyph = cell?.querySelector(".glyph");
    if (glyph) delete glyph.dataset.fit;
    if (main) applyNotch(cell);
    lockStripGlyph(glyph, mark);
  }, [main, shape, color, state, mark]);
  return React.createElement("div", {
    ref: cellRef,
    className: main ? "cell main" : "cell",
    style: {width: `${mark + 16}px`, height: `${mark + 16}px`, flex: `0 0 ${mark + 16}px`, "--grok-bot-ink": color}
  }, React.createElement("div", {className: "clip"},
    React.createElement("div", {className: "glyph", "data-shape": shape, style: {transform: `scale(${stripScaleFor(mark, stripFallback)})`}}, React.createElement(Mark, {
      ref,
      body: toBody(shape || "blob"),
      appearance: appearance("var(--grok-bot-ink)"),
      state: mapState(state || "idle"),
      size: mark,
      seed: id,
      isPlaying: true,
      isStatic: false,
      isFollowingPointer: false
    }))
  ), main ? React.createElement(MainBadge) : null);
}

window.__stripProbe = () => {
  const handles = [...stripRefs.values()].filter((ref) => ref.current?.look).length;
  return [
    `hidden=${document.hidden}`,
    `visibility=${document.visibilityState}`,
    `spoof=${stripSpoof}`,
    `refs=${stripRefs.size}`,
    `handles=${handles}`,
    `queued=${stripQueued.size}`,
    `glance=${glance ? 1 : 0}`,
    `href=${location.href}`
  ].join(" ");
};

window.renderStrip = (config = {}) => {
  enableStrip();
  const bots = Array.isArray(config.bots) ? config.bots : [];
  const mark = Number(config.mark) > 0 ? Number(config.mark) : 40;
  const signature = `${mark}|${bots.map((bot) => [bot.id, bot.shape, bot.color, bot.state, bot.main ? 1 : 0].join(":")).join(",")}`;
  if (signature === stripSignature) return "same";
  stripSignature = signature;
  const stage = document.getElementById("stage");
  stripRoot ??= __ReactDOM.createRoot(stage);
  stripRoot.render(React.createElement("div", {
    id: "row",
    style: {display: "flex", height: `${mark + 16}px`, width: `${bots.length * (mark + 16)}px`}
  }, bots.map((bot) => React.createElement(StripMark, {key: bot.id, id: bot.id, shape: bot.shape, color: bot.color, state: bot.state, mark, main: bot.main === true}))));
  return "ok";
};

function markHandle(id) {
  return stripRefs.get(id)?.current;
}

window.stepStrip = (ms) => {
  if (window.__stepAnimations) window.__stepAnimations(ms);
  const step = Number(ms) > 0 ? Number(ms) : 16;
  if (glance) {
    glance.t += step;
    if (glance.phase === 0 && glance.t >= 1400) {
      glance.a.look("down");
      glance.b.look("down");
      glance.a.gaze?.([0, -0.8]);
      glance.b.gaze?.([0, -0.8]);
      glance.a.blink?.();
      glance.b.blink?.();
      glance.phase = 1;
    } else if (glance.phase === 1 && glance.t >= 2300) {
      glance.a.look("center");
      glance.b.look("center");
      glance.a.gaze?.(null);
      glance.b.gaze?.(null);
      glance = null;
    }
  }
  if (nod) {
    nod.t += step;
    if (nod.t >= 700) {
      nod.mark.look("center");
      nod.mark.gaze?.(null);
      nod = null;
    }
  }
  for (const cell of document.querySelectorAll(".cell.main")) applyNotch(cell);
};

window.nodNeighbors = () => {
  if (glance) return "";
  const ids = [...stripRefs.keys()];
  if (ids.length < 2) return "";
  const index = Math.floor(Math.random() * (ids.length - 1));
  const a = markHandle(ids[index]);
  const b = markHandle(ids[index + 1]);
  if (!a?.look || !b?.look) return "";
  a.look("right");
  b.look("left");
  a.gaze?.([0.9, 0]);
  b.gaze?.([-0.9, 0]);
  glance = {a, b, t: 0, phase: 0};
  return `${ids[index]}|${ids[index + 1]}`;
};

window.acknowledge = (id) => {
  const mark = markHandle(id);
  if (!mark?.look) return "";
  mark.blink?.();
  mark.look("down");
  mark.gaze?.([0, -0.85]);
  nod = {mark, t: 0};
  return id;
};

window.prepareLive = (config = {}) => {
  const signature = [config.shape, config.color, config.state, config.seed, config.reducedMotion].join("|");
  paint(liveHost, config.color);
  if (signature === liveSignature) return;
  liveSignature = signature;
  liveRoot.render(React.createElement(Mark, markProps({...config, follow: false}, 128)));
};

function rasterize(svgText, size) {
  const blob = new Blob([svgText], {type: "image/svg+xml"});
  const url = URL.createObjectURL(blob);
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG_RASTER_FAILED"));
    };
    image.src = url;
  });
}

window.renderStill = ({shape, color, size}) => rasterize(still({body: toBody(shape || "blob"), ink: color || "#1084FE", size: size || 128}), size || 128);

function looksBlack(value) {
  if (!value) return false;
  if (value === "black" || value === "#000" || value === "#000000") return true;
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return false;
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
  const max = Math.max(...channels);
  const scale = max > 1 ? 255 : 1;
  return max / scale < 0.12;
}

function bakePaint(live, clone) {
  const style = getComputedStyle(live);
  for (const prop of ["fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "color", "stop-color"]) {
    const value = style.getPropertyValue(prop);
    if (!value) continue;
    // Unresolved ink serializes as black and would replace the real color. Leave the original paint.
    if ((prop === "fill" || prop === "stroke" || prop === "color" || prop === "stop-color") && looksBlack(value)) continue;
    clone.style.setProperty(prop, value);
  }
  const liveKids = live.children;
  const cloneKids = clone.children;
  for (let i = 0; i < liveKids.length && i < cloneKids.length; i += 1) bakePaint(liveKids[i], cloneKids[i]);
}

window.captureLive = async (size = 128) => {
  const svg = liveHost.querySelector("svg");
  if (!svg) return "";
  const bounds = svg.getBoundingClientRect();
  if (bounds.width < 8 || bounds.height < 8) return "";
  const ink = getComputedStyle(liveHost).getPropertyValue("--grok-bot-ink").trim() || "#1084FE";
  const clone = svg.cloneNode(true);
  bakePaint(svg, clone);
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone)
    .replace(/var\(--grok-bot-ink\)/g, ink)
    .replace(/currentColor/g, ink);
  return rasterize(xml, size);
};

if (location.hash === "#preview") window.setAvatar({shape: "pebble", color: "#916DBB", state: "idle", visible: true, seed: "preview"});
