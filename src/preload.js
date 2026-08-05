const { contextBridge, ipcRenderer } = require('electron');

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
  onState: (callback) => ipcRenderer.on('app:state', (_event, state) => callback(state)),
  onOverlayState: (callback) => ipcRenderer.on('overlay:state', (_event, state) => callback(state))
});
