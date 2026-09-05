const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'DiaSy24',
  repo: 'MyNotes'
});

Object.defineProperty(app, 'isPackaged', { get: () => true });
app.getVersion = () => '1.0.4';

app.whenReady().then(async () => {
  console.log('--- Checking for update from version 1.0.4 ---');
  try {
    const result = await autoUpdater.checkForUpdates();
    console.log('RESULT FOUND VERSION:', result.updateInfo.version);
    console.log('RESULT FILES:', result.updateInfo.files);
  } catch (err) {
    console.error('ERROR CHECKING UPDATE:', err);
  }
  app.quit();
});
