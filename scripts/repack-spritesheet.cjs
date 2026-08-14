const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');
const { app, BrowserWindow } = require('electron');

const jpegPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/92bf2903-5f85-4499-bb43-bed81631a688/.user_uploaded/media_1786695284498.jpg';
const jpegData = fs.readFileSync(jpegPath);
const raw = jpeg.decode(jpegData, { useTArray: true });

const W = raw.width;
const H = raw.height;
const data = raw.data;

// Row boundary definitions based on actual pixel content
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

// Column boundary definitions (8 columns across ~687 width)
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

// Standardized output frame dimensions
const OUT_FRAME_W = 96;
const OUT_FRAME_H = 104;
const TOTAL_COLS = 8;
const TOTAL_ROWS = 11;

const outW = OUT_FRAME_W * TOTAL_COLS; // 768
const outH = OUT_FRAME_H * TOTAL_ROWS; // 1144

const outData = new Uint8ClampedArray(outW * outH * 4);

// For each cell [r, c], find bounding box of character
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
        if (maxVal > 22) { // Non-black pixel
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) continue;

    // Sprite dimensions in original
    const spriteW = maxX - minX + 1;
    const spriteH = maxY - minY + 1;

    // Target position in standardized grid cell:
    // Place horizontally centered in cell, and align feet at baseline (e.g. 10px from bottom)
    const cellOriginX = c * OUT_FRAME_W;
    const cellOriginY = r * OUT_FRAME_H;

    const destX = cellOriginX + Math.round((OUT_FRAME_W - spriteW) / 2);
    const destY = cellOriginY + (OUT_FRAME_H - 12 - spriteH); // Baseline alignment

    // Copy pixels with transparency chroma key
    for (let sy = minY; sy <= maxY; sy++) {
      for (let sx = minX; sx <= maxX; sx++) {
        const srcIdx = (sy * W + sx) * 4;
        const red = data[srcIdx];
        const green = data[srcIdx + 1];
        const blue = data[srcIdx + 2];
        const maxVal = Math.max(red, green, blue);

        const targetX = destX + (sx - minX);
        const targetY = destY + (sy - minY);

        if (targetX >= 0 && targetX < outW && targetY >= 0 && targetY < outH) {
          const outIdx = (targetY * outW + targetX) * 4;

          if (maxVal < 18) {
            // fully transparent
            outData[outIdx + 3] = 0;
          } else {
            outData[outIdx] = red;
            outData[outIdx + 1] = green;
            outData[outIdx + 2] = blue;
            if (maxVal < 36) {
              outData[outIdx + 3] = Math.round(((maxVal - 18) / 18) * 255);
            } else {
              outData[outIdx + 3] = 255;
            }
          }
        }
      }
    }
  }
}

// Convert outData to WebP via Electron
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, webSecurity: false } });
  await win.loadURL('data:text/html,<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>');

  const base64Raw = Buffer.from(outData.buffer).toString('base64');

  const webpDataUrl = await win.webContents.executeJavaScript(`
    (async () => {
      const c = document.getElementById('c');
      c.width = ${outW};
      c.height = ${outH};
      const ctx = c.getContext('2d');
      const bin = atob("${base64Raw}");
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      const imgData = new ImageData(new Uint8ClampedArray(bytes.buffer), ${outW}, ${outH});
      ctx.putImageData(imgData, 0, 0);
      return c.toDataURL('image/webp', 0.98);
    })()
  `);

  const base64 = webpDataUrl.replace(/^data:image\/webp;base64,/, '');
  fs.writeFileSync('d:/Documents/GitHub/MyNotes/public/pet-toph.webp', Buffer.from(base64, 'base64'));
  console.log('PERFECT_STANDARDIZED_WEBP_CREATED: size = ' + outW + 'x' + outH);
  app.quit();
});
