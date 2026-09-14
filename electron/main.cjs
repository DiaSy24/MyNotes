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

  // Anchor to whichever display the main window is actually on (not always
  // the primary one — e.g. the main window was last used on an external
  // monitor). Using workArea's x/y (not just width/height) matters too:
  // a non-primary display can have a negative or offset origin, and
  // ignoring it is exactly what put the pet off-screen after switching
  // back to the laptop's own display.
  const targetDisplay = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const { x: areaX, y: areaY, width: areaW, height: areaH } = targetDisplay.workArea;

  const petW = 320;
  const petH = 380;
  const margin = 20;
  const petX = Math.round(Math.max(areaX, areaX + areaW - petW - margin));
  const petY = Math.round(Math.max(areaY, areaY + areaH - petH - margin));

  petWindow = new BrowserWindow({
    title: 'Toph Desktop Pet',
    width: petW,
    height: petH,
    x: petX,
    y: petY,
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

  // Enable click-through for transparent background areas by default
  petWindow.setIgnoreMouseEvents(true, { forward: true });

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

// Click-through mouse event toggling (transparent background vs interactive pet elements)
ipcMain.on('set-pet-ignore-mouse-events', (event, ignore, options) => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setIgnoreMouseEvents(ignore, options || { forward: true });
  }
});

// Rock-solid, zero-drift window dragging: the main process polls the cursor
// on its own timer instead of relying on renderer-forwarded mousemove events
// (those stop arriving once the window is tracking the cursor exactly,
// since the pointer's position inside the window stops changing).
let petDragInterval = null;
let petDragOffset = { x: 0, y: 0 };

ipcMain.on('pet-drag-start', () => {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (petDragInterval) clearInterval(petDragInterval);

  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = petWindow.getPosition();
  petDragOffset = { x: cursor.x - winX, y: cursor.y - winY };

  petDragInterval = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) {
      clearInterval(petDragInterval);
      petDragInterval = null;
      return;
    }
    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;
    const [winW, winH] = petWindow.getSize();

    const targetX = point.x - petDragOffset.x;
    const targetY = point.y - petDragOffset.y;

    const clampedX = Math.round(Math.max(areaX, Math.min(targetX, areaX + areaW - winW)));
    const clampedY = Math.round(Math.max(areaY, Math.min(targetY, areaY + areaH - winH)));

    petWindow.setPosition(clampedX, clampedY);
  }, 16);
});

ipcMain.on('pet-drag-end', () => {
  if (petDragInterval) {
    clearInterval(petDragInterval);
    petDragInterval = null;
  }
});

// Resizes the overlay window to fit its content (sprite + speech bubble /
// settings menu), keeping the bottom-center anchor point fixed so the
// sprite doesn't visually jump when the window grows/shrinks.
ipcMain.on('resize-pet-window', (event, { width, height }) => {
  if (!petWindow || petWindow.isDestroyed()) return;

  const [curX, curY] = petWindow.getPosition();
  const [curW, curH] = petWindow.getSize();
  const newW = Math.round(width);
  const newH = Math.round(height);

  let newX = Math.round(curX + (curW - newW) / 2);
  let newY = Math.round(curY + (curH - newH));

  // Clamp to whichever display the window is currently on so it can't grow
  // itself partly or fully off-screen (e.g. anchored near a screen edge).
  const display = screen.getDisplayNearestPoint({ x: newX, y: newY });
  const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;
  newX = Math.round(Math.max(areaX, Math.min(newX, areaX + areaW - newW)));
  newY = Math.round(Math.max(areaY, Math.min(newY, areaY + areaH - newH)));

  petWindow.setBounds({ x: newX, y: newY, width: newW, height: newH });
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
