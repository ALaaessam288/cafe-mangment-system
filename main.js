// main.js – Electron entry point for CafePOS
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

let springProcess = null;
let mainWindow = null;

// ── Logging ──
// Set up at module scope, before any window or webContents handler can fire. Previously both the
// log file descriptor and writeLog lived inside createWindow, but the 'console-message' and
// 'did-fail-load' handlers were registered *above* the point where the descriptor was created -
// an early renderer message would hit `logFd` while it was still in the temporal dead zone and
// throw a ReferenceError instead of being logged.
let logFd = null;
let logFilePath = null;

function initLogging() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  logFilePath = path.join(logDir, 'backend.log');

  // Roll the log if it has grown past ~10 MB. Spring's SQL logging used to make this file
  // unbounded; it is quieter now, but a POS terminal that runs for a year still needs a cap.
  try {
    if (fs.existsSync(logFilePath) && fs.statSync(logFilePath).size > 10 * 1024 * 1024) {
      fs.renameSync(logFilePath, `${logFilePath}.1`);
    }
  } catch (_) {}

  logFd = fs.openSync(logFilePath, 'a');
}

function writeLog(msg) {
  if (logFd === null) return;
  try {
    fs.writeSync(logFd, msg);
  } catch (e) {
    console.error('Failed to write log:', e);
  }
}

// Only one instance may run at a time: each instance spawns its own backend on the fixed
// port 8080, so a second instance would fail to bind and either fight the first for the
// port or leave its window stuck on a crashed backend's 404 whitelabel page.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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

// Is something already listening on the port, and if so, is it one of ours?
// Distinguishing the two matters: the old code force-killed whatever held 8080, which on a
// developer's or power user's machine could be their own dev server, a database console, or an
// unrelated vendor app. We only ever kill a process that answers as a Caffio backend.
function probePort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/actuator/health`, { timeout: 1500 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ inUse: true, ours: res.statusCode === 200 && /"status"/.test(body) }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ inUse: true, ours: false }); });
    req.on('error', (err) => {
      // ECONNREFUSED means nothing is listening at all - the port is genuinely free.
      resolve({ inUse: err.code !== 'ECONNREFUSED', ours: false });
    });
  });
}

function killPortOwner(port) {
  if (process.platform === 'win32') {
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore', windowsHide: true });
    } catch (_) {
      try {
        execSync(`cmd /c "for /f \\"tokens=5\\" %a in ('netstat -aon ^| findstr :${port}') do taskkill /f /pid %a"`, { stdio: 'ignore', windowsHide: true });
      } catch (__) {}
    }
  } else {
    try {
      execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'ignore' });
    } catch (_) {}
  }
}

/**
 * Frees the port only when it is safe to do so. A stale Caffio backend (ours) gets killed;
 * anything else stops the launch with an explanation instead of silently terminating a process
 * the user cares about. Returns true if the port is now usable.
 */
async function ensurePortFree(port) {
  const { inUse, ours } = await probePort(port);
  if (!inUse) return true;

  if (ours) {
    killPortOwner(port);
    await new Promise((r) => setTimeout(r, 800));
    return true;
  }

  dialog.showErrorBox(
    'المنفذ مشغول',
    `المنفذ ${port} مستخدم بواسطة برنامج آخر على هذا الجهاز.\n\n` +
    'أغلق البرنامج الذي يستخدم هذا المنفذ ثم شغّل Caffio مرة أخرى.'
  );
  return false;
}

function cleanupBackend() {
  if (springProcess && springProcess.pid) {
    const pid = springProcess.pid;
    springProcess = null;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', windowsHide: true });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch (_) {}
  }
}

// A minimal inline page shown immediately while the JVM boots. Starting the backend takes
// several seconds (longer on the low-end hardware these terminals often run on), and the window
// used to stay hidden for that whole time - the app looked like it had failed to launch.
function bootSplash(message) {
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <style>
    html,body{height:100%;margin:0}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
         background:#14110e;color:#f3ece3;font-family:'Segoe UI',Tahoma,sans-serif}
    .ring{width:46px;height:46px;border:3px solid #3a322a;border-top-color:#c9a227;
          border-radius:50%;animation:spin 900ms linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    h1{font-size:20px;font-weight:600;margin:0;letter-spacing:.5px}
    p{margin:0;font-size:14px;color:#a89b8a}
  </style></head><body>
  <div class="ring"></div><h1>Caffio</h1><p>${message}</p>
  </body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function createWindow() {
  initLogging();

  // ── Main window ──
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false, // shown as soon as the splash is up, below
    title: 'Caffio - نظام إدارة الكافيهات والمطاعم',
    icon: path.join(__dirname, 'resources', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron', 'preload.js'),
    },
  });
  mainWindow.setMenuBarVisibility(false);
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);

  // ── Open external links in system browser ──
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // ── Log Frontend Console & Load Errors ──
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    writeLog(`[FRONTEND CONSOLE] [Level ${level}] ${message} (${sourceId}:${line})\n`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    writeLog(`[FRONTEND LOAD ERROR] Code ${errorCode}: ${errorDescription} (${validatedURL})\n`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    writeLog(`[FRONTEND CRASH] Reason: ${details.reason}\n`);
  });

  // ── Show the splash straight away so the app is visibly alive ──
  mainWindow.loadURL(bootSplash('جاري تشغيل النظام...'));
  mainWindow.maximize();
  mainWindow.show();

  // ── Resolve java executable & jar path ──
  const javaExe = locateJava();
  let jarPath;

  if (app.isPackaged) {
    jarPath = path.join(process.resourcesPath, 'backend.jar');
  } else {
    jarPath = path.join(__dirname, 'target', 'cafe-mangment-system-0.0.1-SNAPSHOT.jar');
  }

  // Write initialization diagnostics to backend.log
  writeLog(`[LAUNCHER] --- Startup at ${new Date().toISOString()} ---\n`);
  writeLog(`[LAUNCHER] app.isPackaged: ${app.isPackaged}\n`);
  writeLog(`[LAUNCHER] Resolved javaExe: ${javaExe}\n`);
  writeLog(`[LAUNCHER] Resolved jarPath: ${jarPath}\n`);

  if (!fs.existsSync(jarPath)) {
    const errorMsg = `ملف الباكند مش موجود:\n${jarPath}\n\nشغّل build.ps1 الأول.`;
    writeLog(`[LAUNCHER] ERROR: ${errorMsg}\n`);
    dialog.showErrorBox('خطأ في التشغيل', errorMsg);
    app.quit();
    return;
  }

  // ── Launch Spring Boot ──
  const spawnOptions = {
    detached: false,
    windowsHide: true,
    stdio: ['ignore', logFd, logFd]
  };

  // If using plain 'java' command, execute via shell to ensure path expansion works on Windows
  if (javaExe === 'java') {
    spawnOptions.shell = true;
    spawnOptions.windowsHide = true;
  }

  // ── Ensure Port 8080 is free before starting ──
  if (!(await ensurePortFree(8080))) {
    app.quit();
    return;
  }

  writeLog(`[LAUNCHER] Spawning backend process...\n`);

  // Argument order matters and was wrong before: anything after `-jar <file>` is handed to the
  // application's main(String[]), not to the JVM. The old `-Dspring.profiles.active=prod` sat
  // after `-jar` and was therefore silently ignored, so the production profile never activated
  // and SQL logging stayed on in shipped builds. JVM flags now come first, and the Spring
  // settings use the `--key=value` application-argument form, which Spring Boot does read.
  springProcess = spawn(javaExe, [
    '-Xms128m',
    '-Xmx512m',
    '-jar', jarPath,
    '--server.port=8080',
    '--spring.profiles.active=prod',
  ], spawnOptions);

  springProcess.on('error', (err) => {
    const errorMsg = `فشل تشغيل الباكند:\n${err.message}\n\nتأكد إن Java مثبتة على الجهاز.`;
    writeLog(`[LAUNCHER] SPAWN ERROR: ${err.message}\n`);
    dialog.showErrorBox('فشل تشغيل الباكند', errorMsg);
    app.quit();
  });

  let isHealthy = false;

  springProcess.on('close', (code) => {
    writeLog(`[LAUNCHER] Backend process closed with code: ${code}\n`);
    if (!isHealthy && code !== 0 && code !== null) {
      if (pollInterval) clearInterval(pollInterval);
      let extra = '';
      try {
        const content = fs.readFileSync(logFilePath, 'utf8');
        const lines = content.trim().split('\n');
        const lastFew = lines.slice(-8).join('\n');
        extra = `\n\nتفاصيل الخطأ:\n${lastFew}`;
      } catch (_) {}
      dialog.showErrorBox(
        'خطأ في تشغيل السيرفر',
        `توقف خادم التطبيق بشكل غير متوقع (كود: ${code}).${extra}\n\nمسار ملف اللوج:\n${logFilePath}`
      );
      app.quit();
    }
  });

  // ── Poll health endpoint until backend is ready ──
  // 120s rather than 60: the first launch on a low-end terminal pays for JVM startup *and*
  // Hibernate's schema sync against SQLite, and timing out on a backend that was merely slow
  // left the user with an error dialog and no app.
  let attempts = 0;
  const MAX_WAIT = 120;
  const pollInterval = setInterval(() => {
    attempts++;

    // Keep the splash honest once the wait gets noticeable.
    if (attempts === 15 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(bootSplash('التشغيل الأول قد يستغرق دقيقة...'));
    }

    if (attempts > MAX_WAIT) {
      clearInterval(pollInterval);
      const errorMsg = 'الباكند استغرق وقت طويل جداً للبدء. افتح ملف اللوج:\n' + logFilePath;
      writeLog(`[LAUNCHER] TIMEOUT: Actuator health did not respond after ${MAX_WAIT}s.\n`);
      dialog.showErrorBox('تأخر التشغيل', errorMsg);
      app.quit();
      return;
    }

    const req = http.get('http://localhost:8080/actuator/health', { timeout: 2000 }, (res) => {
      res.resume(); // drain, otherwise the socket is never released
      if (res.statusCode === 200) {
        isHealthy = true;
        clearInterval(pollInterval);
        writeLog(`[LAUNCHER] Backend is healthy! Loading app UI.\n`);
        mainWindow.loadURL('http://localhost:8080');
      }
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => {
      // Backend not ready yet
    });
  }, 1000);

  // ── IPC: list the printers installed on this machine ──
  // Used by Settings to let each POS terminal map Kitchen / Bar / Receipt to a
  // real Windows printer, so tickets can print silently to the right device.
  ipcMain.handle('list-printers', async (event) => {
    try {
      const wc = event.sender ?? (mainWindow && mainWindow.webContents);
      const printers = await wc.getPrintersAsync();
      return printers.map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: !!p.isDefault,
        status: p.status,
      }));
    } catch (err) {
      return [];
    }
  });

  // ── Auto-Updater Integration ──
  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'checking', message: 'جاري فحص وجود تحديثات جديدة...' });
    });
    autoUpdater.on('update-available', (info) => {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'available', version: info.version, message: `يتوفر إصدار جديد (${info.version})!` });
    });
    autoUpdater.on('update-not-available', () => {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'not-available', message: 'أنت تعمل على أحدث إصدار متاح حالياً ✓' });
    });
    autoUpdater.on('error', (err) => {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', message: 'لم يتم العثور على تحديثات جديدة أو السيرفر غير متاح.' });
    });
    autoUpdater.on('download-progress', (progressObj) => {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloading', percent: Math.round(progressObj.percent), message: `جاري تحميل التحديث (${Math.round(progressObj.percent)}%)...` });
    });
    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version, message: `تم تحميل التحديث (${info.version}) بنجاح! جاهز للتثبيت.` });
    });
  } catch (e) {
    console.log('[AUTO-UPDATER] electron-updater not loaded:', e.message);
  }

  ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged || !autoUpdater) {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'not-available', message: 'أنت تعمل على أحدث إصدار متاح حالياً ✓' });
      return { status: 'not-available' };
    }
    try {
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      if (mainWindow) mainWindow.webContents.send('update-status', { status: 'error', message: 'تعذر الوصول إلى سيرفر التحديثات.' });
      return { status: 'error' };
    }
  });

  ipcMain.handle('install-update', () => {
    if (autoUpdater) {
      autoUpdater.quitAndInstall();
    }
  });

  ipcMain.on('open-external', (event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      require('electron').shell.openExternal(url);
    }
  });

  // ── IPC: Print receipt ──
  // Serialised: an order that hits both the kitchen and the bar fires two prints
  // back to back, and Chromium's print pipeline does not like two jobs racing.
  let printQueue = Promise.resolve();

  async function resolveTargetPrinter(targetDeviceName) {
    try {
      const wc = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
      if (!wc) return targetDeviceName || undefined;
      const printers = await wc.getPrintersAsync();
      if (!printers || printers.length === 0) return undefined;

      // 1. If an exact device name was requested and is installed, use it
      if (targetDeviceName) {
        const match = printers.find(
          (p) =>
            p.name.toLowerCase() === targetDeviceName.toLowerCase() ||
            p.displayName?.toLowerCase() === targetDeviceName.toLowerCase()
        );
        if (match) return match.name;
      }

      // 2. Auto-detect physical thermal / POS printer (e.g. POS-80 11.3.0.1 on USB)
      const thermalPrinters = printers.filter((p) => {
        const n = (p.name + ' ' + (p.displayName || '')).toLowerCase();
        return (
          n.includes('pos') ||
          n.includes('80') ||
          n.includes('receipt') ||
          n.includes('thermal') ||
          n.includes('xp-') ||
          n.includes('xprinter') ||
          n.includes('rongta') ||
          n.includes('epson') ||
          n.includes('sunmi') ||
          n.includes('58')
        );
      });

      if (thermalPrinters.length > 0) {
        // Pick the best match (favor active USB / versioned drivers like 11.3.0.1 or default)
        const best =
          thermalPrinters.find((p) => p.name.includes('11.3') || p.name.includes('USB') || p.isDefault) ||
          thermalPrinters[0];
        writeLog(`[PRINT] Auto-detected thermal printer: "${best.name}"\n`);
        return best.name;
      }

      // 3. Fallback to default printer if not a virtual PDF/Fax/OneNote printer
      const def = printers.find((p) => p.isDefault);
      if (def) {
        const defLower = def.name.toLowerCase();
        if (
          !defLower.includes('pdf') &&
          !defLower.includes('fax') &&
          !defLower.includes('onenote') &&
          !defLower.includes('xps')
        ) {
          return def.name;
        }
      }

      return undefined;
    } catch (e) {
      writeLog(`[PRINT] resolveTargetPrinter error: ${e.message}\n`);
      return targetDeviceName || undefined;
    }
  }

  ipcMain.on('print-receipt', (event, payload) => {
    printQueue = printQueue.then(() => runPrintJob(payload)).catch(() => {});
  });

  function runPrintJob(payload) {
    return new Promise(async (resolvePrint) => {
      let settled = false;
      let safetyTimer = null;
      let printWin = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (safetyTimer) clearTimeout(safetyTimer);
        try { if (printWin && !printWin.isDestroyed()) printWin.close(); } catch (_) {}
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        resolvePrint();
      };

      const { htmlContent, pageSize, deviceName, silent } =
        typeof payload === 'string' ? { htmlContent: payload } : payload;
      const os = require('os');
      const tmpFile = path.join(
        os.tmpdir(),
        `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.html`
      );
      fs.writeFileSync(tmpFile, htmlContent, 'utf8');

      printWin = new BrowserWindow({
        width: 400,
        height: 600,
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      printWin.loadURL(`file://${tmpFile}`);

      printWin.webContents.once('did-finish-load', async () => {
        await new Promise((r) => setTimeout(r, 600));

        const targetPrinter = await resolveTargetPrinter(deviceName);
        const useSilent = silent !== false && !!targetPrinter;

        // Measure actual rendered content height so it prints 100% full scale
        let contentMm = 160;
        try {
          const px = await printWin.webContents.executeJavaScript(
            'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight)'
          );
          if (px > 0) {
            contentMm = Math.ceil((px * 25.4) / 96) + 12;
          }
        } catch (_) {}

        const widthMicrons = (pageSize && pageSize.width ? pageSize.width : 80) * 1000;
        const heightMicrons = Math.max(contentMm, 60) * 1000;

        writeLog(
          `[PRINT] Sending print job: targetPrinter="${targetPrinter}", requestedDevice="${deviceName}", silent=${useSilent}, size=${widthMicrons}x${heightMicrons}um\n`
        );

        const printOptions = {
          silent: useSilent,
          deviceName: targetPrinter || undefined,
          printBackground: true,
          color: false,
          margins: { marginType: 'none' },
          pageSize: {
            width: widthMicrons,
            height: heightMicrons,
          },
          scaleFactor: 100,
        };

        printWin.webContents.print(printOptions, (success, errorType) => {
          writeLog(`[PRINT] Print result: success=${success}, errorType=${errorType}\n`);

          const isCancelled = !errorType || /cancel/i.test(errorType);
          if (!success && !isCancelled) {
            // Automatic fallback: Try with native OS print dialog so user can select their POS-80 printer
            writeLog(`[PRINT] Retrying with OS print dialog fallback...\n`);
            printWin.webContents.print(
              {
                silent: false,
                deviceName: targetPrinter || undefined,
                printBackground: true,
                color: false,
                margins: { marginType: 'none' },
                pageSize: {
                  width: widthMicrons,
                  height: heightMicrons,
                },
                scaleFactor: 100,
              },
              (fallbackSuccess, fallbackError) => {
                writeLog(`[PRINT] Fallback result: success=${fallbackSuccess}, error=${fallbackError}\n`);
                if (!fallbackSuccess && fallbackError && !/cancel/i.test(fallbackError)) {
                  dialog.showErrorBox(
                    'تنبيه الطباعة',
                    `تعذر إرسال أمر الطباعة إلى الطابعة «${targetPrinter || 'الافتراضية'}».\n\n` +
                    'تأكد من توصيل كابل الطابعة (USB) وتشغيلها، واختيار طابعة POS-80 من صفحة الإعدادات.'
                  );
                }
                finish();
              }
            );
          }
          // Let the next queued ticket start only after this one is fully done.
          finish();
        }
      );
    });

    // Safety valve: never let a stuck job block the whole queue.
    safetyTimer = setTimeout(finish, 30000);
    });
  }

} // end createWindow


// ── App lifecycle ──
if (gotSingleInstanceLock) {
  app.whenReady().then(createWindow).catch((err) => {
    // createWindow is async now, so a throw inside it would otherwise surface as an unhandled
    // rejection and leave the user staring at a splash screen that never resolves.
    writeLog(`[LAUNCHER] FATAL: ${err && err.stack ? err.stack : err}\n`);
    dialog.showErrorBox('فشل تشغيل التطبيق', String(err && err.message ? err.message : err));
    app.quit();
  });

  app.on('window-all-closed', () => {
    cleanupBackend();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', cleanupBackend);
  app.on('will-quit', cleanupBackend);

  process.on('exit', cleanupBackend);
  process.on('SIGINT', () => {
    cleanupBackend();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanupBackend();
    process.exit(0);
  });
} // end if (gotSingleInstanceLock)
