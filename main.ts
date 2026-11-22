// gta6-meme-x-01-entry-v2 — replacement entry for make.fun's "Post a GTA 6 meme on X".
//
// The meme: "13 YEARS OF WAITING. WORTH IT." — a fan who has waited since GTA V is
// finally in Vice City, same old controller in hand, the make.fun ghost celebrating
// beside him, Jason and Lucia driving past in a convertible. Rendered with Node 22
// standard library only: no network, no clock, no files outside the repository.
// Two runs write the same bytes.
//
// The program also copies POST.json to the output directory, where the gate reads the
// X post's address (the starter's contract). The post itself is the entry: the house
// reads it from X and the judge sees its first picture, then its text.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

type RGB = [number, number, number];

const C = {
  skyTop: [26, 11, 46] as RGB,
  skyMid: [123, 30, 91] as RGB,
  skyLow: [232, 67, 95] as RGB,
  horizon: [255, 138, 61] as RGB,
  sunGlow1: [255, 138, 77] as RGB,
  sunGlow2: [255, 179, 71] as RGB,
  sunCore: [255, 215, 106] as RGB,
  skyline: [36, 16, 64] as RGB,
  window: [255, 214, 110] as RGB,
  neonPink: [255, 93, 162] as RGB,
  neonDark: [176, 20, 96] as RGB,
  oceanTop: [18, 58, 92] as RGB,
  oceanBot: [13, 42, 68] as RGB,
  oceanStreak: [46, 111, 142] as RGB,
  sandTop: [232, 176, 106] as RGB,
  sandBot: [217, 154, 82] as RGB,
  palm: [22, 10, 46] as RGB,
  skin: [232, 177, 132] as RGB,
  beard: [43, 29, 22] as RGB,
  cap: [194, 39, 107] as RGB,
  hoodie: [46, 74, 122] as RGB,
  hoodieDark: [34, 54, 90] as RGB,
  controller: [28, 28, 34] as RGB,
  tear: [127, 212, 255] as RGB,
  white: [255, 255, 255] as RGB,
  ink: [16, 16, 42] as RGB,
  ghostShade: [217, 217, 232] as RGB,
  starCoin: [255, 46, 136] as RGB,
  starYellow: [255, 214, 60] as RGB,
  car: [28, 16, 48] as RGB,
  wheel: [12, 12, 18] as RGB,
  hub: [150, 150, 165] as RGB,
  plate: [240, 240, 235] as RGB,
};

function px(x: number, y: number, c: RGB): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const o = (iy * W + ix) * 3;
  buf[o] = c[0];
  buf[o + 1] = c[1];
  buf[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = Math.max(0, Math.floor(y)); j < Math.min(H, Math.ceil(y + h)); j++) {
    for (let i = Math.max(0, Math.floor(x)); i < Math.min(W, Math.ceil(x + w)); i++) {
      px(i, j, c);
    }
  }
}

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function vGrad(y0: number, y1: number, top: RGB, bot: RGB): void {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    const t = (y - y0) / (y1 - y0);
    fillRect(0, y, W, 1, lerp(top, bot, t));
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) px(x, y, c);
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) px(x, y, c);
    }
  }
}

// Scanline polygon fill. pts is a flat [x0,y0,x1,y1,...] list.
function polygon(pts: number[], c: RGB): void {
  const n = pts.length / 2;
  let minY = H;
  let maxY = 0;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pts[i * 2 + 1]);
    maxY = Math.max(maxY, pts[i * 2 + 1]);
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[j * 2];
      const y1 = pts[j * 2 + 1];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) {
        px(x, y, c);
      }
    }
  }
}

// Thick line as a chain of discs.
function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c);
  }
}

// Quadratic curve as a chain of discs.
function curve(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, c: RGB): void {
  const steps = 24;
  let px0 = x0;
  let py0 = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    thickLine(px0, py0, x, y, w, c);
    px0 = x;
    py0 = y;
  }
}

// ---- 5x7 bitmap font (rows of 5 bits, '1' = on) ----
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00001', '00001', '01110', '00001', '00001', '11111'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01000', '01000', '11110', '01000', '01000', '01000'],
  k: ['00000', '10000', '10010', '10100', '11000', '10100', '10010'],
  m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  n: ['00000', '00000', '10110', '11001', '10001', '10001', '10001'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawGlyph(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === '1') {
        fillRect(x + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

function drawText(s: string, x: number, y: number, scale: number, fill: RGB, outline: RGB, outlineW: number): void {
  // Outline: draw the text shifted in 8 directions.
  const shifts: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  for (const [dx, dy] of shifts) {
    let cx = x + dx * outlineW;
    for (const ch of s) {
      drawGlyph(ch, cx, y + dy * outlineW, scale, outline);
      cx += 6 * scale;
    }
  }
  let cx = x;
  for (const ch of s) {
    drawGlyph(ch, cx, y, scale, fill);
    cx += 6 * scale;
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, fill: RGB, outline: RGB, outlineW: number): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, fill, outline, outlineW);
}

// Four-point sparkle star.
function sparkle(cx: number, cy: number, r: number, c: RGB): void {
  polygon([cx, cy - r, cx + r * 0.28, cy - r * 0.28, cx + r, cy, cx + r * 0.28, cy + r * 0.28, cx, cy + r, cx - r * 0.28, cy + r * 0.28, cx - r, cy, cx - r * 0.28, cy - r * 0.28], c);
}

// Five-point star.
function star5(cx: number, cy: number, r: number, c: RGB): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
  }
  polygon(pts, c);
}

// ---- scene ----
function drawSky(): void {
  vGrad(0, 340, C.skyTop, C.skyMid);
  vGrad(340, 640, C.skyMid, C.horizon);
  // Low sun with glow, sinking behind the skyline.
  fillCircle(330, 600, 150, C.sunGlow1);
  fillCircle(330, 600, 120, C.sunGlow2);
  fillCircle(330, 600, 95, C.sunCore);
}

function drawSkyline(): void {
  // Dark building silhouettes along the horizon, with lit windows.
  const buildings: [number, number, number, number][] = [
    [0, 520, 90, 120], [80, 470, 80, 170], [150, 540, 110, 100], [250, 490, 70, 150],
    [420, 540, 90, 100], [500, 500, 80, 140], [575, 560, 70, 80], [640, 520, 90, 120],
    [720, 560, 80, 80], [800, 500, 70, 140], [860, 550, 80, 90], [930, 520, 94, 120],
  ];
  for (const [x, y, w, h] of buildings) {
    fillRect(x, y, w, h, C.skyline);
    // Lit windows: fixed deterministic pattern.
    for (let wy = y + 14; wy < y + h - 10; wy += 22) {
      for (let wx = x + 12; wx < x + w - 10; wx += 20) {
        if (((wx * 7 + wy * 13) % 5) < 2) fillRect(wx, wy, 6, 8, C.window);
      }
    }
  }
  // Neon VICE CITY sign on the tall building, left of the sun.
  drawText('VICE CITY', 122, 505, 4, C.neonPink, C.neonDark, 2);
  fillRect(122, 537, textWidth('VICE CITY', 4), 4, C.neonPink);
}

function drawOcean(): void {
  vGrad(640, 770, C.oceanTop, C.oceanBot);
  // Sunlight streaks on the water.
  const streaks: [number, number, number][] = [
    [240, 668, 190], [300, 692, 130], [270, 716, 170], [330, 740, 110],
    [120, 700, 90], [430, 676, 80], [60, 736, 120],
  ];
  for (const [x, y, w] of streaks) fillRect(x, y, w, 4, C.oceanStreak);
}

function drawSand(): void {
  vGrad(770, 1024, C.sandTop, C.sandBot);
}

function drawPalm(x: number, topY: number, s: number): void {
  // Curved trunk.
  curve(x, 780, x + 18 * s, 640, x + 30 * s, topY + 40 * s, 16 * s, C.palm);
  // Fronds: thick, drooping arcs so the tree reads as a palm, not a star.
  const tx = x + 30 * s;
  const ty = topY + 40 * s;
  curve(tx, ty, tx - 60 * s, ty - 45 * s, tx - 130 * s, ty + 30 * s, 13 * s, C.palm);
  curve(tx, ty, tx - 40 * s, ty - 60 * s, tx - 90 * s, ty - 55 * s, 13 * s, C.palm);
  curve(tx, ty, tx + 5 * s, ty - 65 * s, tx + 25 * s, ty - 80 * s, 13 * s, C.palm);
  curve(tx, ty, tx + 60 * s, ty - 45 * s, tx + 120 * s, ty - 40 * s, 13 * s, C.palm);
  curve(tx, ty, tx + 75 * s, ty - 5 * s, tx + 130 * s, ty + 45 * s, 13 * s, C.palm);
  fillCircle(tx, ty, 12 * s, C.palm);
  fillCircle(tx - 10 * s, ty + 14 * s, 8 * s, C.palm);
  fillCircle(tx + 10 * s, ty + 14 * s, 8 * s, C.palm);
}

function drawGhost(cx: number, cy: number, s: number): void {
  // Body: dome + straight sides + three-wave hem.
  const w = 62 * s;
  const top = cy - 78 * s;
  const bot = cy + 78 * s;
  const pts: number[] = [];
  for (let a = 180; a >= 0; a -= 6) {
    const rad = (a * Math.PI) / 180;
    pts.push(cx + Math.cos(rad) * w, cy - 16 * s + Math.sin(rad) * -w * 0.95);
  }
  // Right side down, then waves across the hem, left side up.
  pts.push(cx + w, bot - 12 * s);
  const waves = 3;
  for (let i = 0; i < waves; i++) {
    const x0 = cx + w - (i * 2 * w) / waves;
    const x1 = cx + w - ((i + 1) * 2 * w) / waves;
    const mid = (x0 + x1) / 2;
    pts.push(mid + (w / waves) * 0.32, bot - 12 * s);
    pts.push(mid, bot);
    pts.push(mid - (w / waves) * 0.32, bot - 12 * s);
    pts.push(x1, bot - 12 * s);
  }
  pts.push(cx - w, top);
  polygon(pts, C.white);
  // Soft shade under the hem.
  fillEllipse(cx, bot - 4 * s, w * 0.9, 6 * s, C.ghostShade);
  // Sparkle eyes.
  sparkle(cx - 24 * s, cy - 34 * s, 13 * s, C.ink);
  sparkle(cx + 24 * s, cy - 34 * s, 13 * s, C.ink);
  // Happy open smile.
  curve(cx - 14 * s, cy - 2 * s, cx, cy + 10 * s, cx + 14 * s, cy - 2 * s, 5 * s, C.ink);
  // Blush.
  fillEllipse(cx - 42 * s, cy - 8 * s, 9 * s, 6 * s, [255, 170, 200]);
  fillEllipse(cx + 42 * s, cy - 8 * s, 9 * s, 6 * s, [255, 170, 200]);
  // Right arm holding the magenta star coin.
  fillEllipse(cx + 66 * s, cy + 8 * s, 16 * s, 10 * s, C.white);
  fillCircle(cx + 82 * s, cy + 22 * s, 26 * s, C.starCoin);
  fillCircle(cx + 82 * s, cy + 22 * s, 20 * s, [255, 70, 150]);
  star5(cx + 82 * s, cy + 22 * s, 14 * s, C.starYellow);
}

function drawCar(): void {
  // Low convertible with Jason and Lucia, cruising the beach road.
  const x0 = 690;
  const y0 = 792;
  // Bodies of the two passengers, big enough to read at 480px.
  fillCircle(742, 778, 16, C.skin); // Jason
  fillRect(724, 756, 38, 14, C.cap); // Jason's cap, attached to his head
  fillCircle(826, 778, 16, C.skin); // Lucia
  fillEllipse(826, 768, 19, 15, [30, 16, 10]); // Lucia's hair
  // Car body.
  polygon([x0, y0 + 34, x0 + 8, y0 + 12, x0 + 60, y0 + 6, x0 + 150, y0 + 6, x0 + 210, y0 + 14, x0 + 222, y0 + 34], C.car);
  fillRect(x0 + 6, y0 + 30, 210, 10, C.car);
  // Windshield.
  polygon([x0 + 66, y0 + 8, x0 + 96, y0 + 8, x0 + 92, y0 - 12, x0 + 70, y0 - 12], [120, 180, 210]);
  // Wheels.
  fillCircle(x0 + 46, y0 + 42, 16, C.wheel);
  fillCircle(x0 + 46, y0 + 42, 7, C.hub);
  fillCircle(x0 + 176, y0 + 42, 16, C.wheel);
  fillCircle(x0 + 176, y0 + 42, 7, C.hub);
  // License plate: GTA VI.
  fillRect(x0 + 96, y0 + 32, 78, 20, C.plate);
  drawText('GTA VI', x0 + 101, y0 + 36, 2, C.ink, C.plate, 1);
}

function drawFan(): void {
  const cx = 512;
  // Seated body: hoodie.
  fillEllipse(cx, 872, 96, 62, C.hoodie);
  fillRect(cx - 96, 830, 192, 60, C.hoodie);
  fillEllipse(cx, 836, 96, 34, C.hoodieDark);
  // Arms reaching to the controller.
  thickLine(cx - 78, 852, cx - 34, 884, 22, C.hoodie);
  thickLine(cx + 78, 852, cx + 34, 884, 22, C.hoodie);
  // Head.
  fillCircle(cx, 745, 58, C.skin);
  // Beard: lower half of the face.
  polygon([cx - 56, 748, cx - 50, 782, cx - 30, 800, cx, 804, cx + 30, 800, cx + 50, 782, cx + 56, 748, cx + 40, 742, cx, 740, cx - 40, 742], C.beard);
  // Backwards cap: magenta dome + brim attached to the back of the dome.
  polygon([cx - 58, 736, cx - 56, 706, cx - 30, 690, cx, 686, cx + 30, 690, cx + 56, 706, cx + 58, 736, cx + 40, 726, cx, 722, cx - 40, 726], C.cap);
  fillRect(cx - 86, 706, 32, 12, C.cap);
  // Happy closed eyes.
  curve(cx - 34, 736, cx - 26, 728, cx - 18, 736, 5, C.ink);
  curve(cx + 18, 736, cx + 26, 728, cx + 34, 736, 5, C.ink);
  // Eyebrows.
  thickLine(cx - 36, 720, cx - 16, 716, 5, C.beard);
  thickLine(cx + 16, 716, cx + 36, 720, 5, C.beard);
  // Tears of joy.
  fillCircle(cx - 44, 758, 7, C.tear);
  polygon([cx - 50, 758, cx - 38, 758, cx - 44, 772], C.tear);
  fillCircle(cx + 44, 758, 7, C.tear);
  polygon([cx + 38, 758, cx + 50, 758, cx + 44, 772], C.tear);
  // Big smile on the beard.
  curve(cx - 20, 772, cx, 786, cx + 20, 772, 6, C.white);
  // Old controller in his hands, with hands gripping it.
  fillRect(cx - 56, 862, 112, 46, C.controller);
  fillCircle(cx - 30, 885, 10, [70, 70, 84]);
  fillCircle(cx + 30, 885, 10, [70, 70, 84]);
  fillCircle(cx - 34, 886, 12, C.skin);
  fillCircle(cx + 34, 886, 12, C.skin);
  fillCircle(cx + 40, 872, 4, [255, 90, 90]);
  fillCircle(cx + 48, 880, 4, [90, 220, 120]);
  fillCircle(cx - 40, 872, 4, [255, 210, 80]);
}

function render(): void {
  drawSky();
  drawSkyline();
  drawOcean();
  drawSand();
  drawPalm(50, 320, 1.0);
  drawPalm(950, 380, 0.8);
  drawGhost(810, 300, 1.0);
  drawTextCentered('make.fun', 810, 428, 5, C.white, C.ink, 2);
  drawCar();
  drawFan();
  drawTextCentered('13 YEARS OF WAITING', 512, 48, 8, C.white, C.ink, 3);
  drawTextCentered('WORTH IT.', 512, 930, 12, C.white, C.ink, 4);
}

// ---- minimal PNG encoder (CRC32, IHDR/IDAT/IEND, deflate) ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePng(): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const idat = deflateSync(raw, { level: 9 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

render();
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(join(OUTPUT_DIR, 'meme.png'), encodePng());
try {
  copyFileSync(join(BOT_DIR, 'POST.json'), join(OUTPUT_DIR, 'POST.json'));
} catch (err) {
  console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}
