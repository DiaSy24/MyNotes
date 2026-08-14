const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      webSecurity: false
    }
  });

  const sourceImg = path.resolve('public/pet-toph.jpg');
  const base64Src = fs.readFileSync(sourceImg).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Src}`;

  const html = `<!DOCTYPE html>
  <html>
    <body>
      <canvas id="c"></canvas>
      <script>
        window.convert = async function(src) {
          const img = new Image();
          img.src = src;
          await new Promise(r => img.onload = r);
          const c = document.getElementById('c');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const id = ctx.getImageData(0, 0, c.width, c.height);
          for(let i=0; i<id.data.length; i+=4){
            const max = Math.max(id.data[i], id.data[i+1], id.data[i+2]);
            if(max < 22) {
              id.data[i+3] = 0;
            } else if(max < 45) {
              id.data[i+3] = Math.round(((max - 22) / 23) * 255);
            }
          }
          ctx.putImageData(id, 0, 0);
          return c.toDataURL('image/webp', 0.95);
        }
      </script>
    </body>
  </html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const webpDataUrl = await win.webContents.executeJavaScript(`window.convert("${dataUrl}")`);
  const base64Data = webpDataUrl.replace(/^data:image\/webp;base64,/, '');
  fs.writeFileSync(path.resolve('public/pet-toph.webp'), Buffer.from(base64Data, 'base64'));
  console.log('SUCCESS_CREATED_PUBLIC_PET_TOPH_WEBP');
  app.quit();
});
