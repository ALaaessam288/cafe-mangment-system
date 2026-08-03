// main.js – Electron entry point
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

function createWindow() {
  // Splash screen while backend starts
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    show: true,
  });
  splash.loadFile(path.join(__dirname, 'resources', 'splash.html'));

  // Main application window (hidden until backend is healthy)
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Start Spring Boot backend (uses jar from target directory)
  const javaExe = 'java';
  const jarPath = path.join(__dirname, 'target', 'cafe-mangment-system-0.0.1-SNAPSHOT.jar');
  const spring = spawn(javaExe, ['-jar', jarPath], { detached: true, stdio: 'ignore' });
  // Note: ensure Java is in PATH // Poll backend health endpoint
  const interval = setInterval(() => {
    http.get('http://localhost:8080/actuator/health', res => {
      if (res.statusCode === 200) {
        clearInterval(interval);
        splash.close();
        win.loadURL('http://localhost:8080');
        win.maximize();
        win.show();
      }
    }).on('error', () => {});
  }, 1000);

  // Ensure backend is killed when app quits
  app.on('before-quit', () => {
    spring.kill();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
