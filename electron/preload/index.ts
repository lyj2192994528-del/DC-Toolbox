import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('uartScope', {
  listSerialPorts: () => ipcRenderer.invoke('serial:list')
})
