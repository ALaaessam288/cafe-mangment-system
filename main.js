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

  // Start Spring Boot backend (uses jar from target directory in dev, or resources/backend.jar in prod)
  const fs = require('fs');
  let javaExe = 'java';
  let jarPath = '';

  if (app.isPackaged) {
    jarPath = path.join(process.resourcesPath, 'backend.jar');
    const embeddedJre = path.join(process.resourcesPath, 'jre', 'bin', 'java.exe');
    if (fs.existsSync(embeddedJre)) {
      javaExe = embeddedJre;
    }
  } else {
    jarPath = path.join(__dirname, 'target', 'cafe-mangment-system-0.0.1-SNAPSHOT.jar');
    const devJre = path.join(__dirname, 'jre', 'bin', 'java.exe');
    if (fs.existsSync(devJre)) {
      javaExe = devJre;
    }
  }

  // Create log stream to capture backend stdout/stderr in user data folder
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'backend.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  const spring = spawn(javaExe, ['-jar', jarPath], { 
    detached: true, 
    stdio: ['ignore', logStream, logStream] 
  });

  // Poll backend health endpoint
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
