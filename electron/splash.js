const { BrowserWindow } = require('electron');
const path = require('path');

module.exports = function createSplashWindow(dirname) {
  const splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(dirname, 'client/public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(dirname, 'splash.html'));
  return splashWindow;
};
