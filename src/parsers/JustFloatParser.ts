export interface JustFloatBatch { frames: number[][]; errors: string[] }

const TAIL = [0x00, 0x00, 0x80, 0x7f]

export class JustFloatParser {
  private buffer: number[] = []
  private channelCount: number

  constructor(channelCount: number) {
    this.channelCount = this.validateCount(channelCount)
  }

  setChannelCount(channelCount: number): void {
    this.channelCount = this.validateCount(channelCount)
    this.reset()
  }

  reset(): void { this.buffer = [] }

  consume(data: Uint8Array): JustFloatBatch {
    this.buffer.push(...data)
    const result: JustFloatBatch = { frames: [], errors: [] }
    const payloadSize = this.channelCount * 4

    while (true) {
      const tailIndex = this.findTail()
      if (tailIndex < 0) {
        const maximumUseful = payloadSize + TAIL.length - 1
        if (this.buffer.length > maximumUseful * 3) {
          this.buffer.splice(0, this.buffer.length - maximumUseful)
          result.errors.push('JustFloat 缓冲区长时间未找到帧尾，已丢弃旧数据并继续同步。')
        }
        break
      }

      if (tailIndex < payloadSize) {
        this.buffer.splice(0, tailIndex + TAIL.length)
        result.errors.push('JustFloat 帧尾前的数据不足一帧，已跳过并继续同步。')
        continue
      }

      const frameStart = tailIndex - payloadSize
      if (frameStart > 0) result.errors.push(`JustFloat 重新同步时丢弃了 ${frameStart} 个多余字节。`)
      const payload = this.buffer.slice(frameStart, tailIndex)
      this.buffer.splice(0, tailIndex + TAIL.length)
      const view = new DataView(Uint8Array.from(payload).buffer)
      const values = Array.from({ length: this.channelCount }, (_, index) => view.getFloat32(index * 4, true))
      if (values.some((value) => !Number.isFinite(value))) {
        result.errors.push('JustFloat 帧包含 NaN 或 Infinity，已丢弃。')
        continue
      }
      result.frames.push(values)
    }
    return result
  }

  private findTail(): number {
    for (let index = 0; index <= this.buffer.length - TAIL.length; index += 1) {
      if (TAIL.every((byte, offset) => this.buffer[index + offset] === byte)) return index
    }
    return -1
  }

  private validateCount(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 16) throw new Error('JustFloat 通道数必须是 1～16。')
    return value
  }
}
