const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hl', {
  readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
  writeClipboardImage: (png) => ipcRenderer.invoke('clipboard:write-image', png),
  savePng: (png) => ipcRenderer.invoke('file:save-png', png),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
  listThemes: () => ipcRenderer.invoke('themes:list'),
  saveTheme: (id, theme) => ipcRenderer.invoke('themes:save', id, theme),
  openRepo: () => ipcRenderer.invoke('shell:open-repo'),
  onCommand: (cb) => ipcRenderer.on('command', (_e, name) => cb(name)),
  platform: process.platform
})
