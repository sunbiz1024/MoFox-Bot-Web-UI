import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveLastDirectory: (path: string) => ipcRenderer.invoke('save-last-directory', path),
  getLastDirectory: () => ipcRenderer.invoke('get-last-directory'),
  getProcessUptime: (processName: string, scriptName: string, directory: string) =>
    ipcRenderer.invoke('get-process-uptime', processName, scriptName, directory)
});