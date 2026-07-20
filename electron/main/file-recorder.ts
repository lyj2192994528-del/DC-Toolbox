import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface RecorderStatus {
  recording: boolean
  filePath?: string
  bytesWritten: number
  error?: string
}

export class FileRecorder {
  private stream: WriteStream | null = null
  private status: RecorderStatus = { recording: false, bytesWritten: 0 }
  private readonly onStatus: (status: RecorderStatus) => void
  private lastStatusEmit = 0

  constructor(onStatus: (status: RecorderStatus) => void) { this.onStatus = onStatus }

  getStatus(): RecorderStatus { return { ...this.status } }

  async start(directory: string, serialSummary: string): Promise<RecorderStatus> {
    if (this.stream) throw new Error('原始数据记录已经在运行。')
    await mkdir(directory, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = join(directory, `UartScope-${stamp}.bin`)
    const metadataPath = join(directory, `UartScope-${stamp}.json`)
    await writeFile(metadataPath, JSON.stringify({ createdAt: new Date().toISOString(), serial: serialSummary, rawFile: filePath }, null, 2), 'utf8')

    const stream = createWriteStream(filePath, { flags: 'wx' })
    this.stream = stream
    this.status = { recording: true, filePath, bytesWritten: 0 }
    stream.on('error', (error) => {
      this.status = { ...this.status, recording: false, error: `文件写入失败：${error.message}` }
      this.stream = null
      this.onStatus(this.getStatus())
    })
    this.onStatus(this.getStatus())
    return this.getStatus()
  }

  write(data: Uint8Array): void {
    if (!this.stream) return
    this.stream.write(Buffer.from(data))
    this.status.bytesWritten += data.length
    const now = Date.now()
    if (now - this.lastStatusEmit >= 500) {
      this.lastStatusEmit = now
      this.onStatus(this.getStatus())
    }
  }

  async stop(): Promise<RecorderStatus> {
    const stream = this.stream
    if (!stream) {
      this.status = { ...this.status, recording: false }
      return this.getStatus()
    }
    this.stream = null
    await new Promise<void>((resolve, reject) => stream.end((error?: Error | null) => (error ? reject(error) : resolve())))
    this.status = { ...this.status, recording: false }
    this.onStatus(this.getStatus())
    return this.getStatus()
  }
}
