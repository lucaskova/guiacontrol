/* eslint-disable */
/**
 * Gera os ícones PWA (192x192, 512x512, maskable, apple-touch, favicon) em frontend/public/.
 * Ícone: escudo com gradiente verde (teal -> emerald) + checkmark branco.
 * Pure JS (pngjs) — não precisa instalar nada extra.
 *
 * Uso:  node scripts/generate-pwa-icons.js
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const TEAL = { r: 0x0f, g: 0x76, b: 0x6e };
const MID = { r: 0x0e, g: 0x9f, b: 0x6e };
const EMERALD = { r: 0x10, g: 0xb9, b: 0x81 };
const DARK = { r: 0x0a, g: 0x1f, b: 0x1a };
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

function setPx(png, x, y, c, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = c.r;
  png.data[idx + 1] = c.g;
  png.data[idx + 2] = c.b;
  png.data[idx + 3] = a;
}

function blend2(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function gradient3(t) {
  if (t < 0.5) return blend2(TEAL, MID, t / 0.5);
  return blend2(MID, EMERALD, (t - 0.5) / 0.5);
}

/** point in rounded rect */
function inRoundedRect(x, y, size, r) {
  if (x < 0 || x >= size || y < 0 || y >= size) return false;
  if (x >= r && x <= size - r) return true;
  if (y >= r && y <= size - r) return true;
  const cx = x < r ? r : size - r;
  const cy = y < r ? r : size - r;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Shield silhouette (normalized 0..1):
 *   top: 0.16 -> 0.84 (flat)
 *   sides: vertical to y=0.50
 *   bottom: arc that meets at center bottom (0.50, 0.92)
 */
function inShield(nx, ny) {
  // top rect part
  if (nx >= 0.16 && nx <= 0.84 && ny >= 0.13 && ny <= 0.50) return true;
  // round the top corners
  const r = 0.05;
  if (ny < 0.13 + r) {
    const cx = nx < 0.16 + r ? 0.16 + r : nx > 0.84 - r ? 0.84 - r : nx;
    const cy = 0.13 + r;
    const dx = nx - cx;
    const dy = ny - cy;
    if (dx * dx + dy * dy > r * r && nx < 0.16 + r) return false;
    if (dx * dx + dy * dy > r * r && nx > 0.84 - r) return false;
  }
  // bottom: ellipse-ish curve from (0.16, 0.50) curving down to (0.50, 0.92) and back to (0.84, 0.50)
  if (ny >= 0.50) {
    const cx = 0.50;
    const cy = 0.50;
    const rx = 0.34;
    const ry = 0.42;
    const dx = (nx - cx) / rx;
    const dy = (ny - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return false;
}

/** Distance from point to line segment (for thick stroke check). */
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby || 1e-9;
  let t = (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Polyline with rounded caps; pts in normalized coords. */
function inThickPolyline(nx, ny, pts, halfWidth) {
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(nx, ny, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d <= halfWidth) return true;
  }
  return false;
}

function generateIcon(size, outFile, { maskable = false, transparentBg = false } = {}) {
  const png = new PNG({ width: size, height: size });

  // background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (maskable) {
        // maskable: fundo escuro circular total (safe area garantida)
        const dx = x - size / 2;
        const dy = y - size / 2;
        if (dx * dx + dy * dy <= (size / 2) * (size / 2)) {
          setPx(png, x, y, DARK, 255);
        } else {
          setPx(png, x, y, WHITE, 0);
        }
      } else {
        if (transparentBg) {
          setPx(png, x, y, WHITE, 0);
        } else {
          // rounded square escuro
          if (inRoundedRect(x, y, size, size * 0.22)) {
            setPx(png, x, y, DARK, 255);
          } else {
            setPx(png, x, y, WHITE, 0);
          }
        }
      }
    }
  }

  // shield + check (centralizados na safe-area)
  const inset = maskable ? size * 0.16 : size * 0.10;
  const sx = inset;
  const sy = inset;
  const sz = size - inset * 2;

  // checkmark normalized points (relative to shield 0..1 box)
  const checkPts = [
    [0.27, 0.50],
    [0.43, 0.66],
    [0.73, 0.36],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const localX = x - sx;
      const localY = y - sy;
      if (localX < 0 || localX > sz || localY < 0 || localY > sz) continue;
      const nx = localX / sz;
      const ny = localY / sz;
      if (inShield(nx, ny)) {
        // gradient diagonal: t = (nx + ny) / 2
        const t = Math.max(0, Math.min(1, (nx * 0.4 + ny * 0.6)));
        setPx(png, x, y, gradient3(t), 255);
      }
      if (inThickPolyline(nx, ny, checkPts, 0.07)) {
        setPx(png, x, y, WHITE, 255);
      }
    }
  }

  png.pack().pipe(fs.createWriteStream(outFile)).on('finish', () => {
    console.log('  ✓', path.relative(process.cwd(), outFile));
  });
}

console.log('Gerando ícones PWA em frontend/public/...');
generateIcon(192, path.join(PUBLIC_DIR, 'icon-192.png'));
generateIcon(512, path.join(PUBLIC_DIR, 'icon-512.png'));
generateIcon(512, path.join(PUBLIC_DIR, 'icon-maskable-512.png'), { maskable: true });
generateIcon(180, path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
generateIcon(32, path.join(PUBLIC_DIR, 'favicon-32.png'));
