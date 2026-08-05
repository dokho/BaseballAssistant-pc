const { contextBridge, ipcRenderer } = require('electron');

function reportRendererError(kind, payload) {
  ipcRenderer.send('diagnostics:renderer-error', { kind, ...payload });
}

window.addEventListener('error', (event) => {
  reportRendererError('window-error', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportRendererError('unhandled-rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

contextBridge.exposeInMainWorld('baseballAPI', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  dispatch: (action) => ipcRenderer.invoke('game:dispatch', action),
  newGame: (input) => ipcRenderer.invoke('game:new', input),
  activateGame: (id) => ipcRenderer.invoke('game:activate', id),
  duplicateGame: (id) => ipcRenderer.invoke('game:duplicate', id),
  deleteGame: (id) => ipcRenderer.invoke('game:delete', id),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  overlayCommand: (command) => ipcRenderer.invoke('overlay:command', command),
  openDataFolder: () => ipcRenderer.invoke('system:open-data-folder'),
  openLogFolder: () => ipcRenderer.invoke('system:open-log-folder'),
  onState: (callback) => ipcRenderer.on('app:state', (_event, state) => callback(state)),
  onOverlayState: (callback) => ipcRenderer.on('overlay:state', (_event, state) => callback(state))
});
