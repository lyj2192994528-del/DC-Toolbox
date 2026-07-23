import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('uartScope', {
  listSerialPorts: () => ipcRenderer.invoke('serial:list'),
  openSerialPort: (options: unknown) => ipcRenderer.invoke('serial:open', options),
  closeSerialPort: () => ipcRenderer.invoke('serial:close'),
  writeSerialData: (data: number[]) => ipcRenderer.invoke('serial:write', data),
  setSerialSignals: (signals: { dtr?: boolean; rts?: boolean; brk?: boolean }) => ipcRenderer.invoke('serial:set-signals', signals),
  encodeText: (text: string, encoding: 'utf8' | 'gbk' | 'latin1') => ipcRenderer.invoke('text:encode', text, encoding),
  onSerialStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown): void => listener(status)
    ipcRenderer.on('serial:status', handler)
    return () => ipcRenderer.removeListener('serial:status', handler)
  },
  onSerialData: (listener: (data: Uint8Array) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: Uint8Array): void => listener(new Uint8Array(data))
    ipcRenderer.on('serial:data', handler)
    return () => ipcRenderer.removeListener('serial:data', handler)
  },
  chooseRecordDirectory: () => ipcRenderer.invoke('record:choose-directory'),
  startRecording: (options: unknown) => ipcRenderer.invoke('record:start', options),
  stopRecording: () => ipcRenderer.invoke('record:stop'),
  onRecordStatus: (listener: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown): void => listener(status)
    ipcRenderer.on('record:status', handler)
    return () => ipcRenderer.removeListener('record:status', handler)
  },
  exportCsv: (csv: string) => ipcRenderer.invoke('export:csv', csv),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: unknown) => ipcRenderer.invoke('settings:set', settings),
  getVirtualPortStatus: () => ipcRenderer.invoke('virtual-port:status'),
  openVirtualPortManager: () => ipcRenderer.invoke('virtual-port:open-manager'),
  openVirtualPortFolder: () => ipcRenderer.invoke('virtual-port:open-folder'),
  openVirtualPortDownload: () => ipcRenderer.invoke('virtual-port:download'),
  getMediaToolStatus: () => ipcRenderer.invoke('media:status'),
  installMediaTool: () => ipcRenderer.invoke('media:install'),
  installFfmpeg: () => ipcRenderer.invoke('media:install-ffmpeg'),
  analyzeMedia: (url: string) => ipcRenderer.invoke('media:analyze', url),
  chooseMediaDirectory: () => ipcRenderer.invoke('media:choose-directory'),
  downloadMedia: (options: { url: string; directory: string; mode: 'video' | 'audio' }) => ipcRenderer.invoke('media:download', options),
  cancelMediaDownload: () => ipcRenderer.invoke('media:cancel'),
  onMediaProgress: (listener: (progress: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown): void => listener(progress)
    ipcRenderer.on('media:progress', handler)
    return () => ipcRenderer.removeListener('media:progress', handler)
  },
  chooseAudioInput: () => ipcRenderer.invoke('audio:choose-input'),
  chooseAudioOutput: (format: 'mp3' | 'm4a' | 'wav') => ipcRenderer.invoke('audio:choose-output', format),
  extractAudio: (options: { input: string; output: string; format: 'mp3' | 'm4a' | 'wav'; bitrate: string }) => ipcRenderer.invoke('audio:extract', options),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  setLanguage: (language: 'zh-CN' | 'en-US') => ipcRenderer.invoke('app:set-language', language),
  onLanguageChange: (listener: (language: 'zh-CN' | 'en-US') => void) => {
    const handler = (_event: Electron.IpcRendererEvent, language: 'zh-CN' | 'en-US'): void => listener(language)
    ipcRenderer.on('app:language', handler)
    return () => ipcRenderer.removeListener('app:language', handler)
  }
})
