import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('shellius', {
  onDeepLink: (callback: (url: string) => void) => {
    ipcRenderer.on('deep-link', (_event, url) => callback(url));
  },
  platform: process.platform,
});
