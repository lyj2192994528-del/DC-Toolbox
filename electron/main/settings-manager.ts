import { readFile, rename, writeFile } from 'node:fs/promises'

export interface PersistedSettings {
  serial: {
    path: string
    baudRate: string
    dataBits: 5 | 6 | 7 | 8
    stopBits: 1 | 1.5 | 2
    parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
    flowControl: 'none' | 'rtscts'
    customBaudRates: number[]
  }
  window?: { x?: number; y?: number; width: number; height: number }
}

export const defaultSettings: PersistedSettings = {
  serial: { path: '', baudRate: '115200', dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', customBaudRates: [] }
}

export class SettingsManager {
  private settings: PersistedSettings = structuredClone(defaultSettings)
  warning = ''
  private readonly filePath: string

  constructor(filePath: string) { this.filePath = filePath }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<PersistedSettings>
      this.settings = {
        ...structuredClone(defaultSettings),
        ...parsed,
        serial: { ...defaultSettings.serial, ...parsed.serial }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.warning = '配置文件已损坏，软件已恢复默认设置。损坏文件已保留备查。'
        try { await rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`) } catch { /* 保留启动能力 */ }
      }
      this.settings = structuredClone(defaultSettings)
    }
  }

  get(): PersistedSettings { return structuredClone(this.settings) }

  async update(value: PersistedSettings): Promise<void> {
    this.settings = structuredClone(value)
    await writeFile(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8')
  }
}
