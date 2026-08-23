const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  // Print receipt via Electron native print dialog. Page is always sized to fit the
  // actual content. pageSize (optional) is {width, maxHeight} in mm - maxHeight just
  // caps that auto height to the physical stock (e.g. 210mm invoice paper).
  // options: { width, maxHeight, deviceName, silent }
  //   deviceName - the Windows printer to send this ticket to (per-station mapping)
  //   silent     - skip the OS print dialog entirely
  printReceipt: (htmlContent, options) =>
    ipcRenderer.send('print-receipt', {
      htmlContent,
      pageSize: options,
      deviceName: options && options.deviceName,
      silent: options && options.silent,
    }),
  // Printers installed on this machine, for the Settings mapping screen.
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  // Auto-updater methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (func) => {
    ipcRenderer.on('update-status', (event, data) => func(data));
  },
  isElectron: true,
  openExternal: (url) => ipcRenderer.send('open-external', url),
});

