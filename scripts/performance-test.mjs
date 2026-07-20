import { RingBuffer } from '../src/buffers/RingBuffer.ts'
import { TextProtocolParser } from '../src/parsers/TextProtocolParser.ts'

const FRAME_COUNT = 100_000
const CHANNEL_COUNT = 16
const BUFFER_SIZE = 10_000
const parser = new TextProtocolParser('csv')
const buffers = Array.from({ length: CHANNEL_COUNT }, () => new RingBuffer(BUFFER_SIZE))
const encoder = new TextEncoder()
const started = performance.now()
const heapBefore = process.memoryUsage().heapUsed
let parsedFrames = 0
let carry = ''

for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
  carry += `${Array.from({ length: CHANNEL_COUNT }, (_, channel) => (Math.sin((frame + channel) / 50) * 100).toFixed(5)).join(',')}\r\n`
  if (carry.length < 4096 && frame !== FRAME_COUNT - 1) continue
  const splitAt = Math.max(1, Math.floor(carry.length * 0.63))
  for (const text of [carry.slice(0, splitAt), carry.slice(splitAt)]) {
    const batch = parser.consume(encoder.encode(text))
    if (batch.errors.length) throw new Error(batch.errors[0].message)
    for (const parsed of batch.frames) {
      parsedFrames += 1
      let channel = 0
      for (const value of parsed.values.values()) buffers[channel++].push(value)
    }
  }
  carry = ''
}

if (parsedFrames !== FRAME_COUNT) throw new Error(`帧数不一致：${parsedFrames}/${FRAME_COUNT}`)
if (buffers.some((buffer) => buffer.size !== BUFFER_SIZE)) throw new Error('环形缓冲区未保持固定容量。')

const elapsed = performance.now() - started
const heapGrowth = process.memoryUsage().heapUsed - heapBefore
console.log(`性能测试通过：${FRAME_COUNT} 帧 × ${CHANNEL_COUNT} 通道`)
console.log(`耗时：${elapsed.toFixed(0)} ms，速率：${Math.round(FRAME_COUNT / (elapsed / 1000))} 帧/秒`)
console.log(`16 个环形缓冲共保留：${buffers.reduce((sum, buffer) => sum + buffer.size, 0)} 点`)
console.log(`堆内存变化：${(heapGrowth / 1024 / 1024).toFixed(2)} MiB`)
