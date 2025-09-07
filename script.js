const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const mod = (n, m) => ((n % m) + m) % m;

function parseColor(input) {
  const s = String(input || "").trim();

  let m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1]
      .split(/[,/ ]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const [r, g, b] = parts;
    const px = (v) =>
      v.endsWith("%")
        ? Math.round(parseFloat(v) * 2.55)
        : Math.round(parseFloat(v));
    return { r: px(r), g: px(g), b: px(b) };
  }

  m = s.match(/^hsla?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1]
      .split(/[,/ ]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const [h, sPct, lPct] = parts;
    const hN = parseFloat(h);
    const sN = parseFloat(sPct) / (sPct.endsWith("%") ? 100 : 1);
    const lN = parseFloat(lPct) / (lPct.endsWith("%") ? 100 : 1);
    return hslToRgb(hN, sN, lN);
  }

  return { r: 26, g: 164, b: 255 };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => Math.round(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  h = mod(h, 360) / 360;
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function hslToHex(h, s, l) {
  return rgbToHex(hslToRgb(h, s, l));
}

function adjust(h, s, l, { dh = 0, ds = 0, dl = 0 } = {}) {
  return {
    h: mod(h + dh, 360),
    s: clamp(s + ds, 0, 1),
    l: clamp(l + dl, 0, 1)
  };
}

function idealTextColor(hex) {
  const { r, g, b } = parseColor(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#0f172a" : "#FFFFFF";
}

function generateSchemes(baseHex) {
  const baseRgb = parseColor(baseHex);
  const { h, s, l } = rgbToHsl(baseRgb);

  const complementary = [adjust(h, s, l, { dh: 180 })];
  const split = [
    adjust(h, s, l, { dh: 180 - 30 }),
    adjust(h, s, l, { dh: 180 + 30 })
  ];
  const analogous = [-60, -30, 30, 60].map((dh) => adjust(h, s, l, { dh }));
  const triadic = [-120, 120].map((dh) => adjust(h, s, l, { dh }));
  const quadratic = [90, 180, 270].map((dh) => adjust(h, s, l, { dh }));
  const monoSteps = [-0.22, -0.12, 0.12, 0.22];
  const monochrome = monoSteps.map((dl) =>
    adjust(h, s, l, { dl, ds: dl > 0 ? -0.05 : 0.05 })
  );

  const toObj = (obj, i, cat) => {
    const hex = hslToHex(obj.h, obj.s, obj.l);
    return { hex, hsl: obj, category: cat, varName: `--color-${cat}-${i + 1}` };
  };
  const pack = (arr, cat) => arr.map((o, i) => toObj(o, i, cat));

  return {
    base: { hex: hslToHex(h, s, l), h, s, l },
    complementary: pack(complementary, "complementary"),
    split: pack(split, "split"),
    monochrome: pack(monochrome, "monochrome"),
    analogous: pack(analogous, "analogous"),
    triadic: pack(triadic, "triadic"),
    quadratic: pack(quadratic, "quadratic")
  };
}

function uniqueAll(schemes, limit = 12) {
  const all = [
    ...schemes.complementary,
    ...schemes.split,
    ...schemes.analogous,
    ...schemes.triadic,
    ...schemes.quadratic,
    ...schemes.monochrome
  ];
  const seen = new Set();
  const out = [];
  for (const c of all) {
    const key = c.hex.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
    if (out.length >= limit) break;
  }
  return out;
}

function applyCssVars(colors, baseHex) {
  const root = document.documentElement;

  for (let i = 0; i < colors.length; i++) {
    root.style.setProperty(
      `--color-${String(i + 1).padStart(2, "0")}`,
      colors[i]
    );
  }
  root.style.setProperty("--color-base", baseHex);
}

const grid = document.getElementById("backgroundGrid");
const input = document.getElementById("baseColor");
const randomize = document.getElementById("randomize");
const tabs = document.getElementById("tabs");
const toast = document.getElementById("toast");

let currentFilter = "split";
let currentSchemes = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1400);
}

function layoutGrid(n) {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  grid.style.gridTemplateRows = `1fr`;
}

function render() {
  const baseHex = (function () {
    try {
      return String(input.value).trim() || "#5eb0e5";
    } catch (e) {
      return "#5eb0e5";
    }
  })();
  currentSchemes = generateSchemes(baseHex);

  let items = [];
  if (currentFilter === "all") {
    const uniq = uniqueAll(currentSchemes, 12);
    items = [
      {
        hex: currentSchemes.base.hex,
        category: "base",
        varName: "--color-base"
      },
      ...uniq.map((c, i) => ({
        hex: c.hex,
        category: c.category,
        varName: `--color-${String(i + 1).padStart(2, "0")}`
      }))
    ];
  } else {
    const arr = currentSchemes[currentFilter] || [];
    items = [
      {
        hex: currentSchemes.base.hex,
        category: "base",
        varName: "--color-base"
      },
      ...arr.map((c, i) => ({
        hex: c.hex,
        category: c.category,
        varName: `--color-${String(i + 1).padStart(2, "0")}`
      }))
    ];
  }

  if (items.length > 12) items = items.slice(0, 12);

  applyCssVars(
    items.map((i) => i.hex),
    currentSchemes.base.hex
  );

  layoutGrid(items.length);

  grid.innerHTML = "";

  items.forEach((it, idx) => {
    const cell = document.createElement("div");
    cell.className = "bg-cell";
    cell.style.background = it.hex;
    const textColor = idealTextColor(it.hex);
    cell.style.color = textColor;

    const code = document.createElement("div");
    code.className = "code";
    code.textContent = it.hex;
    code.style.color = textColor;

    const varEl = document.createElement("div");
    varEl.className = "var";
    varEl.textContent = it.varName;
    varEl.style.color = textColor;

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => {
      navigator.clipboard
        .writeText(it.hex)
        .then(() => showToast(it.hex + " Copied ✔"));
    };

    copyBtn.style.background =
      textColor === "#FFFFFF" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.4)";
    copyBtn.style.color = textColor === "#FFFFFF" ? "#fff" : "#0f172a";

    cell.appendChild(code);
    cell.appendChild(varEl);
    cell.appendChild(copyBtn);
    grid.appendChild(cell);

    const baseHex = currentSchemes ? currentSchemes.base.hex : "#1aa4ff";
    tabs.querySelectorAll(".tab").forEach((tab) => {
      if (tab.classList.contains("active")) {
        tab.style.background = baseHex;
        tab.style.color = idealTextColor(baseHex);
      } else {
        tab.style.background = "rgba(0, 0, 0, 0.1)";
        tab.style.color = "#191919";
      }
    });
  });

  const strip = document.getElementById("backgroundStrip");
  strip.innerHTML = "";

  if (grid.children.length > 0) {
    const firstColor = grid.firstElementChild.style.background;
    const lastColor = grid.lastElementChild.style.background;

    [firstColor, lastColor].forEach((color) => {
      const cell = document.createElement("div");
      cell.className = "bg-cell";
      cell.style.background = color;
      strip.appendChild(cell);
    });
  }
}

input.addEventListener("input", () => render());
randomize.addEventListener("click", () => {
  const newHex =
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0");
  input.value = newHex;

  if (window.Coloris && Coloris.setInstance) {
    Coloris.setInstance("#baseColor", { value: newHex });
  }

  const clrField = input.closest(".clr-field");
  if (clrField) {
    clrField.style.color = newHex;
  }

  render();
});

tabs.addEventListener("click", (e) => {
  const b = e.target.closest("button.tab");
  if (!b) return;
  tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  b.classList.add("active");
  currentFilter = b.dataset.filter;
  render();
});

document.getElementById("copyCss").addEventListener("click", () => {
  if (!currentSchemes) return;

  let items = [];
  if (currentFilter === "all") {
    const uniq = uniqueAll(currentSchemes, 12);
    items = [currentSchemes.base.hex, ...uniq.map((c) => c.hex)];
  } else {
    const arr = currentSchemes[currentFilter] || [];
    items = [currentSchemes.base.hex, ...arr.map((c) => c.hex)];
  }
  if (items.length > 12) items = items.slice(0, 12);

  const lines = [":root {", `  --color-base: ${items[0]};`];
  items
    .slice(1)
    .forEach((h, i) =>
      lines.push(`  --color-${String(i + 1).padStart(2, "0")}: ${h};`)
    );
  lines.push("}");
  navigator.clipboard
    .writeText(lines.join("\n"))
    .then(() => showToast("CSS Variables Copied ✔"));
});

document.getElementById("copyHexes").addEventListener("click", () => {
  if (!currentSchemes) return;
  let items = [];
  if (currentFilter === "all") {
    const uniq = uniqueAll(currentSchemes, 12);
    items = [currentSchemes.base.hex, ...uniq.map((c) => c.hex)];
  } else {
    const arr = currentSchemes[currentFilter] || [];
    items = [currentSchemes.base.hex, ...arr.map((c) => c.hex)];
  }
  if (items.length > 12) items = items.slice(0, 12);
  navigator.clipboard
    .writeText(items.join(", "))
    .then(() => showToast("HEX Values Copied ✔"));
});

try {
  if (window.Coloris) {
    Coloris({
      el: "#baseColor",
      themeMode: "dark",
      format: "hex",
      formatToggle: true,
      swatches: ["#aee1cd", "#ffe681", "#5eb0e5", "#ee7762", "#ba0c2e"]
    });
  }
} catch (e) {}

render();

let demoInterval = null;
let demoActive = true;

function stopDemo() {
  demoActive = false;
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }

  ["click", "keydown", "touchstart", "pointerdown"].forEach((evt) =>
    window.removeEventListener(evt, stopDemoHandler, { capture: true })
  );
}

function stopDemoHandler(e) {
  if (e && e.isTrusted === false) return;
  stopDemo();
}

function startDemo(intervalMs = 2000, startDelay = 600) {
  if (demoInterval) return;
  const tabButtons = Array.from(tabs.querySelectorAll(".tab"));
  if (tabButtons.length === 1) return;
  let i = 1;

  setTimeout(() => {
    demoInterval = setInterval(() => {
      if (!demoActive) return;

      const b = tabButtons[i % tabButtons.length];

      tabs
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      b.classList.add("active");
      currentFilter = b.dataset.filter;
      render();

      i++;
    }, intervalMs);
  }, startDelay);
}

["click", "keydown", "touchstart", "pointerdown"].forEach((evt) =>
  window.addEventListener(evt, stopDemoHandler, { capture: true })
);

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(() => startDemo(), 80);
} else {
  document.addEventListener("DOMContentLoaded", () =>
    setTimeout(() => startDemo(), 80)
  );
}