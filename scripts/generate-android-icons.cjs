// Generates the Android launcher icon set (legacy square, round, and
// adaptive foreground layers) from the app's own logo, replacing the
// Capacitor placeholder icons that ship by default.
//
// Source: electron/icon.png — despite the .png extension this file is
// actually a JPEG (see the FFD8 magic bytes), so it's decoded with
// jpeg-js like the other sprite-processing scripts in this folder
// (repack.cjs, convert-webp.cjs) and re-encoded with pngjs.
//
// Run with: node scripts/generate-android-icons.cjs
const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

const SOURCE_PATH = path.join(__dirname, '..', 'electron', 'icon.png');
const RES_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Matches the sizes Capacitor's default launcher icons already use.
const DENSITIES = [
  { dir: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 }
];

// Adaptive icons crop roughly the outer ~18% of the foreground layer via
// the launcher's mask shape, so the logo is scaled down to fit inside the
// safe zone instead of being clipped.
const FOREGROUND_LOGO_SCALE = 0.72;

function loadSourceImage() {
  const jpegData = fs.readFileSync(SOURCE_PATH);
  const raw = jpeg.decode(jpegData, { useTArray: true });
  return { data: raw.data, width: raw.width, height: raw.height };
}

// Box-filter downscale: each destination pixel is the average of the
// source pixels falling in its (possibly non-integer-sized) source box.
function resizeImage(src, dstW, dstH) {
  const { data, width: srcW, height: srcH } = src;
  const out = new Uint8Array(dstW * dstH * 4);

  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor((dy * srcH) / dstH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * srcH) / dstH));

    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor((dx * srcW) / dstW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * srcW) / dstW));

      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * srcW + sx) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          count++;
        }
      }

      const o = (dy * dstW + dx) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round(a / count);
    }
  }

  return { data: out, width: dstW, height: dstH };
}

function makeTransparentCanvas(size) {
  return { data: new Uint8Array(size * size * 4), width: size, height: size };
}

function pasteCentered(canvas, image) {
  const offset = Math.round((canvas.width - image.width) / 2);
  for (let y = 0; y < image.height; y++) {
    const cy = y + offset;
    if (cy < 0 || cy >= canvas.height) continue;
    for (let x = 0; x < image.width; x++) {
      const cx = x + offset;
      if (cx < 0 || cx >= canvas.width) continue;
      const si = (y * image.width + x) * 4;
      const di = (cy * canvas.width + cx) * 4;
      canvas.data[di] = image.data[si];
      canvas.data[di + 1] = image.data[si + 1];
      canvas.data[di + 2] = image.data[si + 2];
      canvas.data[di + 3] = image.data[si + 3];
    }
  }
  return canvas;
}

// Zeroes alpha outside the inscribed circle so the square launcher icon
// reads as round on launchers that use ic_launcher_round directly.
function applyCircularMask(image) {
  const { width: w, height: h, data } = image;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (Math.sqrt(dx * dx + dy * dy) > radius) {
        const i = (y * w + x) * 4;
        data[i + 3] = 0;
      }
    }
  }
  return image;
}

function writePng(image, outPath) {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log('wrote', path.relative(process.cwd(), outPath));
}

function main() {
  const source = loadSourceImage();

  for (const { dir, launcher, foreground } of DENSITIES) {
    const outDir = path.join(RES_DIR, dir);
    fs.mkdirSync(outDir, { recursive: true });

    const squareLogo = resizeImage(source, launcher, launcher);
    writePng(squareLogo, path.join(outDir, 'ic_launcher.png'));

    const roundLogo = applyCircularMask(resizeImage(source, launcher, launcher));
    writePng(roundLogo, path.join(outDir, 'ic_launcher_round.png'));

    const scaledLogoSize = Math.round(foreground * FOREGROUND_LOGO_SCALE);
    const scaledLogo = resizeImage(source, scaledLogoSize, scaledLogoSize);
    const fgCanvas = pasteCentered(makeTransparentCanvas(foreground), scaledLogo);
    writePng(fgCanvas, path.join(outDir, 'ic_launcher_foreground.png'));
  }

  console.log('Android launcher icons generated from', path.relative(process.cwd(), SOURCE_PATH));
}

main();
