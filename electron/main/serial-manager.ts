import { SerialPort } from 'serialport'

export interface SerialPortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  locationId?: string
  productId?: string
  vendorId?: string
}

export interface SerialOpenOptions {
  path: string
  baudRate: number
  dataBits: 5 | 6 | 7 | 8
  stopBits: 1 | 1.5 | 2
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space'
  rtscts: boolean
}

export type SerialStatusEvent =
  | { state: 'connected'; message: string; path: string; baudRate: number }
  | { state: 'disconnected'; message: string; unexpected: boolean }
  | { state: 'error'; message: string }

type StatusListener = (status: SerialStatusEvent) => void
type DataListener = (data: Uint8Array) => void

function explainSerialError(error: unknown, path?: string): string {
  const detail = error instanceof Error ? error.message : String(error)
  const normalized = detail.toLowerCase()

  if (normalized.includes('access denied') || normalized.includes('permission denied')) {
    return `串口 ${path ?? ''} 可能正被其他软件占用。请关闭其他串口工具后重试。原始错误：${detail}`
  }
  if (normalized.includes('file not found') || normalized.includes('cannot find')) {
    return `串口 ${path ?? ''} 不存在或已被拔出。请刷新串口列表后重试。原始错误：${detail}`
  }
  if (normalized.includes('invalid') || normalized.includes('parameter')) {
    return `串口参数不受设备或驱动支持。请检查波特率等设置。原始错误：${detail}`
  }
  return `串口操作失败。原始错误：${detail}`
}

export class SerialManager {
  private port: SerialPort | null = null
  private closingIntentionally = false

  constructor(
    private readonly onStatus: StatusListener,
    private readonly onData: DataListener
  ) {}

  async list(): Promise<SerialPortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      pnpId: port.pnpId,
      locationId: port.locationId,
      productId: port.productId,
      vendorId: port.vendorId
    }))
  }

  async open(options: SerialOpenOptions): Promise<void> {
    if (this.port?.isOpen) throw new Error('已有串口处于打开状态，请先关闭当前串口。')

    const port = new SerialPort({ ...options, autoOpen: false })
    this.port = port
    this.closingIntentionally = false

    port.on('error', (error) => {
      this.onStatus({ state: 'error', message: explainSerialError(error, options.path) })
    })
    port.on('data', (data: Buffer) => this.onData(new Uint8Array(data)))
    port.on('close', (error) => {
      const wasIntentional = this.closingIntentionally
      this.port = null
      this.closingIntentionally = false
      if (!wasIntentional) {
        const detail = error ? ` 原始错误：${error.message}` : ''
        this.onStatus({ state: 'disconnected', message: `串口 ${options.path} 已意外断开，等待设备重新插入后自动重连。${detail}`, unexpected: true })
      }
    })

    try {
      await new Promise<void>((resolve, reject) => {
        port.open((error) => (error ? reject(error) : resolve()))
      })
      this.onStatus({
        state: 'connected',
        message: `已连接 ${options.path} @ ${options.baudRate}`,
        path: options.path,
        baudRate: options.baudRate
      })
    } catch (error) {
      this.port = null
      throw new Error(explainSerialError(error, options.path))
    }
  }

  async close(): Promise<void> {
    if (!this.port?.isOpen) {
      this.port = null
      this.onStatus({ state: 'disconnected', message: '串口未连接', unexpected: false })
      return
    }

    const port = this.port
    this.closingIntentionally = true
    await new Promise<void>((resolve, reject) => {
      port.close((error) => (error ? reject(error) : resolve()))
    })
    this.port = null
    this.closingIntentionally = false
    this.onStatus({ state: 'disconnected', message: '串口已关闭', unexpected: false })
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port?.isOpen) throw new Error('串口未打开，无法发送数据。')
    const port = this.port
    await new Promise<void>((resolve, reject) => {
      port.write(Buffer.from(data), (writeError) => {
        if (writeError) {
          reject(new Error(explainSerialError(writeError, port.path)))
          return
        }
        port.drain((drainError) => (drainError ? reject(new Error(explainSerialError(drainError, port.path))) : resolve()))
      })
    })
  }
}
