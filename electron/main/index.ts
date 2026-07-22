import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import iconv from 'iconv-lite'
import { SerialManager, type SerialOpenOptions } from './serial-manager'
import { FileRecorder } from './file-recorder'
import { SettingsManager, type PersistedSettings } from './settings-manager'
import { PROJECT_INFO } from '../../shared/project-info'
import { getVirtualPortStatus, openVirtualPortDownload, openVirtualPortFolder, openVirtualPortManager } from './virtual-port-manager'

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

ipcMain.handle('virtual-port:status', async () => {
  try { return { ok: true as const, status: await getVirtualPortStatus() } }
  catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : String(error) } }
})
ipcMain.handle('virtual-port:open-manager', () => openVirtualPortManager())
ipcMain.handle('virtual-port:open-folder', () => openVirtualPortFolder())
ipcMain.handle('virtual-port:download', async () => { await openVirtualPortDownload(); return { ok: true as const } })

interface SplashState { window: BrowserWindow; startedAt: number }

/**
 * 独立启动窗口不依赖 Vue、串口扫描或设置加载，应用就绪后优先显示。
 * 图形与 build/icon.svg 使用同一条波形路径，避免标题栏和软件图标不一致。
 */
function createSplashWindow(): SplashState {
  const splash = new BrowserWindow({
    width: 520,
    height: 430,
    center: true,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#09182d',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  const version = app.getVersion()
  const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box}body{margin:0;overflow:hidden;color:#fff;background:radial-gradient(circle at 50% 35%,#183f75,#0c213f 55%,#071426);font-family:"Microsoft YaHei UI","Segoe UI",sans-serif}
    .screen{height:100vh;display:grid;place-items:center;position:relative}.ring{position:absolute;width:390px;height:390px;border:1px solid #48b8e733;border-radius:50%;animation:ring 1.65s ease-out infinite}.ring.two{animation-delay:.5s}
    .card{position:relative;width:360px;padding:30px 36px 24px;text-align:center;border:1px solid #ffffff2b;border-radius:28px;background:#ffffff12;box-shadow:0 24px 70px #0005;animation:enter .55s cubic-bezier(.2,.8,.2,1) both}
    svg{width:132px;height:132px;filter:drop-shadow(0 13px 24px #0005);animation:icon .75s cubic-bezier(.2,.8,.2,1) both}h1{margin:15px 0 3px;font-size:31px}p{margin:0;color:#b9cbe3;font-size:12px;letter-spacing:.14em}.bar{height:4px;margin-top:23px;overflow:hidden;border-radius:99px;background:#ffffff1f}.bar i{display:block;height:100%;transform-origin:left;background:linear-gradient(90deg,#46d7de,#4da1ff);animation:load 1.5s ease-out both}.version{display:block;margin-top:13px;color:#c6d5e8;font:600 13px Consolas;letter-spacing:.1em}
    @keyframes enter{from{transform:translateY(18px) scale(.96);opacity:0}}@keyframes icon{from{transform:rotate(-8deg) scale(.72);opacity:0}}@keyframes load{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes ring{from{transform:scale(.35);opacity:.7}to{transform:scale(1);opacity:0}}
  </style></head><body><div class="screen"><div class="ring"></div><div class="ring two"></div><div class="card">
  <svg viewBox="0 0 512 512" aria-label="DC Toolbox 软件图标"><defs><linearGradient id="g" x1="64" y1="64" x2="448" y2="448"><stop stop-color="#176fd1"/><stop offset="1" stop-color="#10a2be"/></linearGradient></defs><rect x="24" y="24" width="464" height="464" rx="108" fill="url(#g)"/><path d="M92 274h66l34-98 55 196 48-154 33 86h92" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><circle cx="92" cy="274" r="22" fill="#fff"/><circle cx="420" cy="304" r="22" fill="#fff"/></svg>
  <h1>DC Toolbox</h1><p>嵌入式开发调试工具箱</p><div class="bar"><i></i></div><strong class="version">v${version}</strong></div></div></body></html>`
  splash.once('ready-to-show', () => splash.show())
  void splash.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`)
  return { window: splash, startedAt: Date.now() }
}

function createWindow(splashState: SplashState): void {
  const savedBounds = settingsManager.get().window
  const applicationIcon = join(app.getAppPath(), 'build', 'icon.png')
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    title: 'DC Toolbox',
    icon: applicationIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    // 启动画面至少展示 1.5 秒，之后无缝切换到尺寸适中的主窗口。
    const remaining = Math.max(0, 1500 - (Date.now() - splashState.startedAt))
    setTimeout(() => {
      if (!splashState.window.isDestroyed()) splashState.window.close()
      mainWindow.center()
      mainWindow.show()
    }, remaining)
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

type AppLanguage = 'zh-CN' | 'en-US'

async function setApplicationLanguage(language: AppLanguage): Promise<void> {
  const current = settingsManager.get()
  await settingsManager.update({ ...current, language })
  installApplicationMenu(language)
  broadcast('app:language', language)
}

function installApplicationMenu(language: AppLanguage): void {
  const en = language === 'en-US'
  const template: MenuItemConstructorOptions[] = [
    { label: en ? 'File' : '文件', submenu: [{ label: en ? 'Exit' : '退出', accelerator: 'Alt+F4', click: () => app.quit() }] },
    { label: en ? 'Edit' : '编辑', submenu: [
      { label: en ? 'Undo' : '撤销', role: 'undo' }, { label: en ? 'Redo' : '重做', role: 'redo' }, { type: 'separator' },
      { label: en ? 'Cut' : '剪切', role: 'cut' }, { label: en ? 'Copy' : '复制', role: 'copy' }, { label: en ? 'Paste' : '粘贴', role: 'paste' }, { label: en ? 'Select All' : '全选', role: 'selectAll' }
    ] },
    { label: en ? 'View' : '视图', submenu: [
      { label: en ? 'Reload' : '重新加载', role: 'reload' }, { type: 'separator' },
      { label: en ? 'Zoom In' : '放大', role: 'zoomIn' }, { label: en ? 'Zoom Out' : '缩小', role: 'zoomOut' }, { label: en ? 'Reset Zoom' : '重置缩放', role: 'resetZoom' },
      { type: 'separator' }, { label: en ? 'Toggle Full Screen' : '切换全屏', role: 'togglefullscreen' }
    ] },
    { label: en ? 'Window' : '窗口', submenu: [{ label: en ? 'Minimize' : '最小化', role: 'minimize' }, { label: en ? 'Close' : '关闭', role: 'close' }] },
    { label: en ? 'Help' : '帮助', submenu: [{ label: en ? 'About & Contact' : '关于与联系', click: () => { void dialog.showMessageBox({ type: 'info', title: en ? 'About DC Toolbox' : '关于 DC Toolbox', message: en ? 'DC Toolbox — Embedded Development & Debugging Toolkit' : PROJECT_INFO.fullName, detail: en ? `Version ${app.getVersion()}\nEmail: ${PROJECT_INFO.email}\nQQ Group: ${PROJECT_INFO.qqGroup}\nGitHub: ${PROJECT_INFO.githubUrl || 'Coming soon'}` : `版本 ${app.getVersion()}\n作者邮箱：${PROJECT_INFO.email}\nQQ群：${PROJECT_INFO.qqGroup}\n群名：${PROJECT_INFO.qqGroupName}\nGitHub：${PROJECT_INFO.githubUrl || '待添加'}` }) } }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('app:set-language', async (_event, value: unknown) => {
  try {
    if (value !== 'zh-CN' && value !== 'en-US') throw new Error('不支持的语言。')
    await setApplicationLanguage(value)
    return { ok: true as const }
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : String(error) } }
})

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
  const splashState = createSplashWindow()
  await migrateLegacySettings()
  settingsManager = new SettingsManager(join(app.getPath('userData'), 'settings.json'))
  await settingsManager.load()
  installApplicationMenu(settingsManager.get().language)
  createWindow(splashState)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(createSplashWindow())
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void serialManager.close()
  void fileRecorder.stop()
})
