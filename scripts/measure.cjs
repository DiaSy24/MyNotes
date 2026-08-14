const fs = require('fs');
const jpeg = require('jpeg-js');

const jpegPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/92bf2903-5f85-4499-bb43-bed81631a688/.user_uploaded/media_1786695284498.jpg';
const jpegData = fs.readFileSync(jpegPath);
const rawImageData = jpeg.decode(jpegData, { useTArray: true });

console.log('Image dimensions:', rawImageData.width, 'x', rawImageData.height);

const width = rawImageData.width;
const height = rawImageData.height;
const data = rawImageData.data;

// Find row brightness
const rowCounts = [];
for (let y = 0; y < height; y++) {
  let count = 0;
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    const max = Math.max(data[idx], data[idx + 1], data[idx + 2]);
    if (max > 25) count++;
  }
  rowCounts.push(count);
}

// Find rows
const rows = [];
let inRow = false;
let rowStart = 0;
for (let y = 0; y < height; y++) {
  if (rowCounts[y] > 5 && !inRow) {
    inRow = true;
    rowStart = y;
  } else if (rowCounts[y] <= 5 && inRow) {
    inRow = false;
    rows.push({
      start: rowStart,
      end: y - 1,
      height: y - rowStart,
      center: ((rowStart + y - 1) / 2).toFixed(1)
    });
  }
}
if (inRow) {
  rows.push({
    start: rowStart,
    end: height - 1,
    height: height - rowStart,
    center: ((rowStart + height - 1) / 2).toFixed(1)
  });
}

console.log('Detected', rows.length, 'rows:');
rows.forEach((r, idx) => {
  console.log(`Row ${idx}: start=${r.start}, end=${r.end}, height=${r.height}, center=${r.center}`);
});

// Find column brightness
const colCounts = [];
for (let x = 0; x < width; x++) {
  let count = 0;
  for (let y = 0; y < height; y++) {
    const idx = (y * width + x) * 4;
    const max = Math.max(data[idx], data[idx + 1], data[idx + 2]);
    if (max > 25) count++;
  }
  colCounts.push(count);
}

// Find columns
const cols = [];
let inCol = false;
let colStart = 0;
for (let x = 0; x < width; x++) {
  if (colCounts[x] > 5 && !inCol) {
    inCol = true;
    colStart = x;
  } else if (colCounts[x] <= 5 && inCol) {
    inCol = false;
    cols.push({
      start: colStart,
      end: x - 1,
      width: x - colStart,
      center: ((colStart + x - 1) / 2).toFixed(1)
    });
  }
}
if (inCol) {
  cols.push({
    start: colStart,
    end: width - 1,
    width: width - colStart,
    center: ((colStart + width - 1) / 2).toFixed(1)
  });
}

console.log('Detected', cols.length, 'columns:');
cols.forEach((c, idx) => {
  console.log(`Col ${idx}: start=${c.start}, end=${c.end}, width=${c.width}, center=${c.center}`);
});
