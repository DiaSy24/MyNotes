const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging for auto-updater
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';


function createWindow() {
  const win = new BrowserWindow({
    title: 'MyNotes',
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.png'), // Will add icon later if needed
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Hide menu bar for a clean Notion-like app feel
  win.setMenuBarVisibility(false);

  // In production, load the built index.html
  // In development, you can load http://localhost:5173
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Check for updates shortly after startup
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
  dialog.showMessageBox({
    type: 'info',
    title: 'Güncelleme Bulundu',
    message: 'Uygulamanın yeni bir sürümü bulundu. Arka planda indiriliyor...'
  });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded.');
  dialog.showMessageBox({
    type: 'question',
    buttons: ['Şimdi Yeniden Başlat ve Kur', 'Daha Sonra'],
    defaultId: 0,
    title: 'Güncelleme İndirildi',
    message: 'Yeni sürüm başarıyla indirildi. Güncellemeyi yüklemek için uygulamayı şimdi yeniden başlatmak ister misiniz?'
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
