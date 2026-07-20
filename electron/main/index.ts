import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { listSerialPorts } from './serial-manager'

ipcMain.handle('serial:list', async () => {
  try {
    return { ok: true as const, ports: await listSerialPorts() }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      ok: false as const,
      error: `扫描串口失败：${detail}。请检查串口驱动后重试。`
    }
  }
})

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 720,
    minHeight: 520,
    show: false,
    title: 'UartScope',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
