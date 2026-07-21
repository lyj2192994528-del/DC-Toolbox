import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import iconv from 'iconv-lite'
import { SerialManager, type SerialOpenOptions } from './serial-manager'
import { FileRecorder } from './file-recorder'
import { SettingsManager, type PersistedSettings } from './settings-manager'
import { PROJECT_INFO } from '../../shared/project-info'

function broadcastSerialStatus(status: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('serial:status', status)
  }
}

function broadcast(channel: string, value: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, value)
}

const fileRecorder = new FileRecorder((status) => broadcast('record:status', status))
let settingsManager: SettingsManager

const serialManager = new SerialManager(broadcastSerialStatus, (data) => {
  fileRecorder.write(data)
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('serial:data', data)
  }
})

function validateOpenOptions(value: unknown): SerialOpenOptions {
  if (!value || typeof value !== 'object') throw new Error('串口参数格式错误。')
  const options = value as Record<string, unknown>
  const dataBits = Number(options.dataBits)
  const stopBits = Number(options.stopBits)
  const baudRate = Number(options.baudRate)
  const parity = options.parity

  if (typeof options.path !== 'string' || !/^COM\d+$/i.test(options.path)) throw new Error('请选择有效的 COM 端口。')
  if (!Number.isInteger(baudRate) || baudRate < 50 || baudRate > 4_000_000) throw new Error('波特率必须是 50～4000000 之间的正整数。')
  if (![5, 6, 7, 8].includes(dataBits)) throw new Error('数据位只能是 5、6、7 或 8。')
  if (![1, 1.5, 2].includes(stopBits)) throw new Error('停止位只能是 1、1.5 或 2。')
  if (!['none', 'even', 'odd', 'mark', 'space'].includes(String(parity))) throw new Error('校验位参数无效。')
  if (typeof options.rtscts !== 'boolean') throw new Error('流控参数无效。')

  return {
    path: options.path,
    baudRate,
    dataBits: dataBits as SerialOpenOptions['dataBits'],
    stopBits: stopBits as SerialOpenOptions['stopBits'],
    parity: parity as SerialOpenOptions['parity'],
    rtscts: options.rtscts
  }
}

ipcMain.handle('serial:list', async () => {
  try {
    return { ok: true as const, ports: await serialManager.list() }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      ok: false as const,
      error: `扫描串口失败：${detail}。请检查串口驱动后重试。`
    }
  }
})

ipcMain.handle('serial:open', async (_event, value: unknown) => {
  try {
    const options = validateOpenOptions(value)
    await serialManager.open(options)
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('serial:close', async () => {
  try {
    await serialManager.close()
    return { ok: true as const }
  } catch (error) {
    return { ok: false as const, error: `关闭串口失败：${error instanceof Error ? error.message : String(error)}` }
  }
})

ipcMain.handle('serial:write', async (_event, value: unknown) => {
  try {
    if (!Array.isArray(value) || value.length === 0 || value.length > 1_048_576) {
      throw new Error('发送数据必须包含 1～1048576 个字节。')
    }
    if (!value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      throw new Error('发送数据包含无效字节。')
    }
    await serialManager.write(Uint8Array.from(value))
    return { ok: true as const, bytesWritten: value.length }
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('serial:set-signals', async (_event, value: unknown) => {
  try {
    if (!value || typeof value !== 'object') throw new Error('流控信号参数无效。')
    const source = value as Record<string, unknown>
    const signals: { dtr?: boolean; rts?: boolean; brk?: boolean } = {}
    for (const key of ['dtr', 'rts', 'brk'] as const) {
      if (source[key] !== undefined) {
        if (typeof source[key] !== 'boolean') throw new Error(`${key.toUpperCase()} 必须是布尔值。`)
        signals[key] = source[key]
      }
    }
    await serialManager.setSignals(signals)
    return { ok: true as const }
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : String(error) } }
})

ipcMain.handle('text:encode', (_event, text: unknown, encoding: unknown) => {
  try {
    if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('待编码文本无效或过长。')
    if (!['utf8', 'gbk', 'latin1'].includes(String(encoding))) throw new Error('不支持该字符编码。')
    return { ok: true as const, bytes: Array.from(iconv.encode(text, String(encoding))) }
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : String(error) } }
})

ipcMain.handle('record:choose-directory', async () => {
  const result = await dialog.showOpenDialog({ title: '选择原始数据保存目录', properties: ['openDirectory', 'createDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('record:start', async (_event, value: unknown) => {
  try {
    if (!value || typeof value !== 'object') throw new Error('记录参数格式错误。')
    const { directory, serialSummary } = value as Record<string, unknown>
    if (typeof directory !== 'string' || !directory) throw new Error('请选择记录目录。')
    if (typeof serialSummary !== 'string') throw new Error('串口摘要格式错误。')
    return { ok: true as const, status: await fileRecorder.start(directory, serialSummary) }
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : String(error) } }
})

ipcMain.handle('record:stop', async () => {
  try { return { ok: true as const, status: await fileRecorder.stop() } }
  catch (error) { return { ok: false as const, error: `停止记录失败：${error instanceof Error ? error.message : String(error)}` } }
})

ipcMain.handle('export:csv', async (_event, csv: unknown) => {
  try {
    if (typeof csv !== 'string' || csv.length > 200_000_000) throw new Error('CSV 数据格式或大小无效。')
    const result = await dialog.showSaveDialog({ title: '导出波形 CSV', defaultPath: `DC-Toolbox-${new Date().toISOString().slice(0, 10)}.csv`, filters: [{ name: 'CSV 文件', extensions: ['csv'] }] })
    if (result.canceled || !result.filePath) return { ok: true as const, canceled: true }
    await writeFile(result.filePath, `\uFEFF${csv}`, 'utf8')
    return { ok: true as const, canceled: false, filePath: result.filePath }
  } catch (error) { return { ok: false as const, error: `CSV 导出失败：${error instanceof Error ? error.message : String(error)}` } }
})

ipcMain.handle('settings:get', () => ({ settings: settingsManager.get(), warning: settingsManager.warning }))
ipcMain.handle('settings:set', async (_event, value: PersistedSettings) => {
  try { await settingsManager.update(value); return { ok: true as const } }
  catch (error) { return { ok: false as const, error: `保存配置失败：${error instanceof Error ? error.message : String(error)}` } }
})

function createWindow(): void {
  const savedBounds = settingsManager.get().window
  const mainWindow = new BrowserWindow({
    width: Math.max(savedBounds?.width ?? 1440, 1280),
    height: Math.max(savedBounds?.height ?? 900, 800),
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 720,
    minHeight: 520,
    show: false,
    title: 'DC Toolbox',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    // 工具数量增加后优先使用完整桌面空间，用户仍可点击“还原”调整大小。
    mainWindow.maximize()
    mainWindow.show()
  })
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds()
    const current = settingsManager.get()
    void settingsManager.update({ ...current, window: bounds })
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function installChineseMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    { label: '文件', submenu: [{ label: '退出', accelerator: 'Alt+F4', click: () => app.quit() }] },
    { label: '编辑', submenu: [
      { label: '撤销', role: 'undo' }, { label: '重做', role: 'redo' }, { type: 'separator' },
      { label: '剪切', role: 'cut' }, { label: '复制', role: 'copy' }, { label: '粘贴', role: 'paste' }, { label: '全选', role: 'selectAll' }
    ] },
    { label: '视图', submenu: [
      { label: '重新加载', role: 'reload' }, { type: 'separator' },
      { label: '放大', role: 'zoomIn' }, { label: '缩小', role: 'zoomOut' }, { label: '重置缩放', role: 'resetZoom' },
      { type: 'separator' }, { label: '切换全屏', role: 'togglefullscreen' }
    ] },
    { label: '窗口', submenu: [{ label: '最小化', role: 'minimize' }, { label: '关闭', role: 'close' }] },
    { label: '帮助', submenu: [{ label: '关于与联系', click: () => { void dialog.showMessageBox({ type: 'info', title: '关于 DC Toolbox', message: PROJECT_INFO.fullName, detail: `版本 ${app.getVersion()}\n作者邮箱：${PROJECT_INFO.email}\nQQ群：${PROJECT_INFO.qqGroup}\n群名：${PROJECT_INFO.qqGroupName}\nGitHub：${PROJECT_INFO.githubUrl || '待添加'}` }) } }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function migrateLegacySettings(): Promise<void> {
  const newFile = join(app.getPath('userData'), 'settings.json')
  const oldFile = join(app.getPath('appData'), 'UartScope', 'settings.json')
  try { await access(newFile); return } catch { /* 新配置不存在时尝试迁移 */ }
  try {
    await access(oldFile)
    await mkdir(app.getPath('userData'), { recursive: true })
    await copyFile(oldFile, newFile)
  } catch { /* 没有旧配置时使用默认值 */ }
}

app.whenReady().then(async () => {
  await migrateLegacySettings()
  settingsManager = new SettingsManager(join(app.getPath('userData'), 'settings.json'))
  await settingsManager.load()
  installChineseMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void serialManager.close()
  void fileRecorder.stop()
})
