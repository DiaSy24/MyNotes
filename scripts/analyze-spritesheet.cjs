const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, webSecurity: false } });
  
  const sourceImg = 'd:/Documents/GitHub/MyNotes/public/pet-toph.jpg';
  const base64Src = fs.readFileSync(sourceImg).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Src}`;

  const html = `<!DOCTYPE html><html><body><canvas id="c"></canvas></body></html>`;
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  const analysis = await win.webContents.executeJavaScript(`
    (async () => {
      const img = new Image();
      img.src = "${dataUrl}";
      await new Promise(r => img.onload = r);
      const c = document.getElementById('c');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0,0,c.width,c.height);
      
      const rowBrightness = [];
      for(let y=0; y<c.height; y++){
        let count = 0;
        for(let x=0; x<c.width; x++){
          const idx = (y*c.width + x)*4;
          const max = Math.max(id.data[idx], id.data[idx+1], id.data[idx+2]);
          if(max > 25) count++;
        }
        rowBrightness.push(count);
      }

      return { w: img.width, h: img.height, rowBrightness };
    })()
  `);

  const rows = [];
  let inSprite = false;
  let spriteStart = 0;
  for (let y = 0; y < analysis.h; y++) {
    if (analysis.rowBrightness[y] > 5 && !inSprite) {
      inSprite = true;
      spriteStart = y;
    } else if (analysis.rowBrightness[y] <= 5 && inSprite) {
      inSprite = false;
      rows.push({ start: spriteStart, end: y - 1, height: y - spriteStart });
    }
  }
  if (inSprite) rows.push({ start: spriteStart, end: analysis.h - 1, height: analysis.h - spriteStart });

  fs.writeFileSync('d:/Documents/GitHub/MyNotes/sprite-analysis.json', JSON.stringify({ w: analysis.w, h: analysis.h, rows }, null, 2));
  app.quit();
});
