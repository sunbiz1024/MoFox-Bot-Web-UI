"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  openDirectoryDialog: () => electron.ipcRenderer.invoke("open-directory-dialog"),
  openFileDialog: () => electron.ipcRenderer.invoke("open-file-dialog"),
  saveLastDirectory: (path) => electron.ipcRenderer.invoke("save-last-directory", path),
  getLastDirectory: () => electron.ipcRenderer.invoke("get-last-directory"),
  getSystemStats: () => electron.ipcRenderer.invoke("get-system-stats")
});
