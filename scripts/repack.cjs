const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

const jpegPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/92bf2903-5f85-4499-bb43-bed81631a688/.user_uploaded/media_1786695284498.jpg';
const jpegData = fs.readFileSync(jpegPath);
const raw = jpeg.decode(jpegData, { useTArray: true });

const W = raw.width; // 687
const H = raw.height; // 1024
const data = raw.data;

// Measured exact pixel bounds for each of the 11 rows in the original image
const rowRanges = [
  { row: 0,  minY: 0,   maxY: 94 },
  { row: 1,  minY: 95,  maxY: 188 },
  { row: 2,  minY: 189, maxY: 282 },
  { row: 3,  minY: 283, maxY: 375 },
  { row: 4,  minY: 376, maxY: 462 },
  { row: 5,  minY: 463, maxY: 555 },
  { row: 6,  minY: 556, maxY: 650 },
  { row: 7,  minY: 651, maxY: 742 },
  { row: 8,  minY: 743, maxY: 834 },
  { row: 9,  minY: 835, maxY: 928 },
  { row: 10, minY: 929, maxY: 1023 }
];

// Measured exact pixel bounds for each of the 8 columns in the original image
const colRanges = [
  { col: 0, minX: 0,   maxX: 82 },
  { col: 1, minX: 83,  maxX: 174 },
  { col: 2, minX: 175, maxX: 262 },
  { col: 3, minX: 263, maxX: 342 },
  { col: 4, minX: 343, maxX: 428 },
  { col: 5, minX: 429, maxX: 512 },
  { col: 6, minX: 513, maxX: 598 },
  { col: 7, minX: 599, maxX: 686 }
];

// Target standardized cell dimensions
const OUT_FRAME_W = 96;
const OUT_FRAME_H = 100;
const TOTAL_COLS = 8;
const TOTAL_ROWS = 11;

const outW = OUT_FRAME_W * TOTAL_COLS; // 768 px
const outH = OUT_FRAME_H * TOTAL_ROWS; // 1100 px

const png = new PNG({ width: outW, height: outH });

// Initialize all transparent
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 0;
  png.data[i + 1] = 0;
  png.data[i + 2] = 0;
  png.data[i + 3] = 0;
}

// Extract every sprite, align feet to baseline and center horizontally
for (let r = 0; r < TOTAL_ROWS; r++) {
  const rowDef = rowRanges[r];
  for (let c = 0; c < TOTAL_COLS; c++) {
    const colDef = colRanges[c];

    let minX = W, maxX = 0, minY = H, maxY = 0;
    let found = false;

    for (let y = rowDef.minY; y <= rowDef.maxY; y++) {
      for (let x = colDef.minX; x <= colDef.maxX; x++) {
        const idx = (y * W + x) * 4;
        const maxVal = Math.max(data[idx], data[idx + 1], data[idx + 2]);
        if (maxVal > 22) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) continue;

    const spriteW = maxX - minX + 1;
    const spriteH = maxY - minY + 1;

    const cellX = c * OUT_FRAME_W;
    const cellY = r * OUT_FRAME_H;

    // Center horizontally, ground baseline at 8px from bottom
    const destX = cellX + Math.round((OUT_FRAME_W - spriteW) / 2);
    const destY = cellY + (OUT_FRAME_H - 10 - spriteH);

    for (let sy = minY; sy <= maxY; sy++) {
      for (let sx = minX; sx <= maxX; sx++) {
        const srcIdx = (sy * W + sx) * 4;
        const red = data[srcIdx];
        const green = data[srcIdx + 1];
        const blue = data[srcIdx + 2];
        const maxVal = Math.max(red, green, blue);

        const tx = destX + (sx - minX);
        const ty = destY + (sy - minY);

        if (tx >= 0 && tx < outW && ty >= 0 && ty < outH) {
          const outIdx = (ty * outW + tx) * 4;

          if (maxVal < 18) {
            png.data[outIdx + 3] = 0;
          } else {
            png.data[outIdx] = red;
            png.data[outIdx + 1] = green;
            png.data[outIdx + 2] = blue;
            if (maxVal < 36) {
              png.data[outIdx + 3] = Math.round(((maxVal - 18) / 18) * 255);
            } else {
              png.data[outIdx + 3] = 255;
            }
          }
        }
      }
    }
  }
}

// Write standardized PNG
const buffer = PNG.sync.write(png);
fs.writeFileSync('public/pet-toph.png', buffer);
fs.writeFileSync('public/pet-toph.webp', buffer); // PNG buffer is recognized everywhere as image
console.log('SUCCESSFULLY_CREATED_STANDARDIZED_SPRITESHEET:', outW, 'x', outH);
console.log('Frame dimensions: 96 x 100 px (8 cols x 11 rows)');
