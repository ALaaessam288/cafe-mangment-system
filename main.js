// main.js – Electron entry point for CafePOS
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let springProcess = null;
let mainWindow = null;

function locateJava() {
  // 1. Check embedded JRE first
  if (app.isPackaged) {
    const embeddedJre = path.join(process.resourcesPath, 'jre', 'bin', 'java.exe');
    if (fs.existsSync(embeddedJre)) return embeddedJre;
  } else {
    const devJre = path.join(__dirname, 'jre', 'bin', 'java.exe');
    if (fs.existsSync(devJre)) return devJre;
  }

  // 2. Check JAVA_HOME environment variable
  if (process.env.JAVA_HOME) {
    const javaHomePath = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    if (fs.existsSync(javaHomePath)) return javaHomePath;
  }

  // 3. Check exact Semeru location (which exists on this user's machine)
  const semeruPath = 'C:\\Program Files\\Semeru\\jdk-17.0.19.10-openj9\\bin\\java.exe';
  if (fs.existsSync(semeruPath)) return semeruPath;

  // 4. Check general common installation paths
  const commonPaths = [
    'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe',
    'C:\\Program Files\\Java\\jre1.8.0_361\\bin\\java.exe',
    'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath\\java.exe'
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  // 5. Fallback to system PATH resolution
  return 'java';
}

function createWindow() {
  // ── Main window ──
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false, // hidden until backend is healthy
    title: 'Cafe POS',
    icon: path.join(__dirname, 'resources', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron', 'preload.js'),
    },
  });

  // ── Resolve java executable & jar path ──
  const javaExe = locateJava();
  let jarPath;

  if (app.isPackaged) {
    jarPath = path.join(process.resourcesPath, 'backend.jar');
  } else {
    jarPath = path.join(__dirname, 'target', 'cafe-mangment-system-0.0.1-SNAPSHOT.jar');
  }

  // ── Log backend output ──
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logFilePath = path.join(logDir, 'backend.log');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  // Write initialization diagnostics to backend.log
  logStream.write(`[LAUNCHER] --- Startup at ${new Date().toISOString()} ---\n`);
  logStream.write(`[LAUNCHER] app.isPackaged: ${app.isPackaged}\n`);
  logStream.write(`[LAUNCHER] Resolved javaExe: ${javaExe}\n`);
  logStream.write(`[LAUNCHER] Resolved jarPath: ${jarPath}\n`);

  if (!fs.existsSync(jarPath)) {
    const errorMsg = `ملف الباكند مش موجود:\n${jarPath}\n\nشغّل build.ps1 الأول.`;
    logStream.write(`[LAUNCHER] ERROR: ${errorMsg}\n`);
    dialog.showErrorBox('خطأ في التشغيل', errorMsg);
    app.quit();
    return;
  }

  // ── Launch Spring Boot ──
  const spawnOptions = {
    detached: false,
    stdio: ['ignore', logStream, logStream]
  };

  // If using plain 'java' command, execute via shell to ensure path expansion works on Windows
  if (javaExe === 'java') {
    spawnOptions.shell = true;
  }

  logStream.write(`[LAUNCHER] Spawning backend process...\n`);
  
  springProcess = spawn(javaExe, [
    '-jar', jarPath,
    '-Dserver.port=8080',
    '-Dspring.profiles.active=prod',
  ], spawnOptions);

  springProcess.on('error', (err) => {
    const errorMsg = `فشل تشغيل الباكند:\n${err.message}\n\nتأكد إن Java مثبتة على الجهاز.`;
    logStream.write(`[LAUNCHER] SPAWN ERROR: ${err.message}\n`);
    dialog.showErrorBox('فشل تشغيل الباكند', errorMsg);
    app.quit();
  });

  springProcess.on('close', (code) => {
    logStream.write(`[LAUNCHER] Backend process closed with code: ${code}\n`);
  });

  // ── Poll health endpoint until backend is ready ──
  let attempts = 0;
  const MAX_WAIT = 120; // 2 minutes
  const interval = setInterval(() => {
    attempts++;
    if (attempts > MAX_WAIT) {
      clearInterval(interval);
      const errorMsg = 'الباكند استغرق وقت طويل جداً للبدء. افتح ملف اللوج:\n' + logFilePath;
      logStream.write(`[LAUNCHER] TIMEOUT: Actuator health did not respond after 120s.\n`);
      dialog.showErrorBox('تأخر التشغيل', errorMsg);
      app.quit();
      return;
    }

    http.get('http://localhost:8080/actuator/health', (res) => {
      if (res.statusCode === 200) {
        clearInterval(interval);
        logStream.write(`[LAUNCHER] Backend is healthy! Loading app UI.\n`);
        mainWindow.loadURL('http://localhost:8080');
        mainWindow.maximize();
        mainWindow.show();
      }
    }).on('error', (err) => {
      // Backend not ready yet
    });
  }, 1000);
}

// ── App lifecycle ──
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (springProcess) {
    try { springProcess.kill('SIGTERM'); } catch (_) {}
  }
});

app.on('will-quit', () => {
  if (springProcess) {
    try { springProcess.kill('SIGTERM'); } catch (_) {}
  }
});
