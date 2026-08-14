const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging for auto-updater
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow = null;
let petWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'MyNotes',
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.show();
    petWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  petWindow = new BrowserWindow({
    title: 'Toph Desktop Pet',
    width: 250,
    height: 260,
    x: screenW - 270,
    y: screenH - 280,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Keep window always on top of all applications (Chrome, VSCode, games, etc.)
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const isDev = !app.isPackaged;
  if (isDev) {
    petWindow.loadURL('http://127.0.0.1:5173/?mode=pet');
  } else {
    petWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { mode: 'pet' } });
  }

  petWindow.on('closed', () => {
    petWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop-pet-status', false);
    }
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop-pet-status', true);
  }
}

// IPC Handlers for Always-on-top Desktop Pet
ipcMain.on('open-desktop-pet', () => {
  createPetWindow();
});

ipcMain.on('close-desktop-pet', () => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.close();
    petWindow = null;
  }
});

ipcMain.on('move-pet-window', (event, { deltaX, deltaY }) => {
  if (petWindow && !petWindow.isDestroyed()) {
    const [x, y] = petWindow.getPosition();
    petWindow.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
  }
});

ipcMain.on('resize-pet-window', (event, { width, height }) => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setSize(Math.round(width), Math.round(height));
  }
});

app.whenReady().then(() => {
  createWindow();

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
  log.info('Update downloaded. Installing automatically...');
  autoUpdater.quitAndInstall();
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
