<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RingBuffer } from '@/buffers/RingBuffer'
import { TextProtocolParser, type TextProtocol } from '@/parsers/TextProtocolParser'
import { JustFloatParser } from '@/parsers/JustFloatParser'

interface Sample { index: number; value: number }
interface Channel {
  key: string
  name: string
  color: string
  visible: boolean
  samples: RingBuffer<Sample>
  current: number
  min: number
  max: number
  sum: number
  total: number
}

const colors = ['#176fd1', '#10a2be', '#e68a00', '#8b5cf6', '#e34850', '#16a36a', '#d45ca6', '#6772e5', '#7a8b28', '#9a6324', '#34a4eb', '#f0669b', '#4f7c4f', '#8464a0', '#c55b3c', '#178b8b']
const protocol = ref<TextProtocol | 'justfloat'>('csv')
const parser = new TextProtocolParser('csv')
const justFloatChannels = ref(3)
const justFloatParser = new JustFloatParser(justFloatChannels.value)
const channels = reactive(new Map<string, Channel>())
const channelList = computed(() => Array.from(channels.values()))
const canvasRef = ref<HTMLCanvasElement>()
const paused = ref(false)
const autoScale = ref(true)
const fixedMin = ref('-10')
const fixedMax = ref('10')
const pointLimit = ref(50000)
const frameRate = ref(0)
const receiveFrames = ref(0)
const parseErrors = ref(0)
const lastError = ref('')
const exportMessage = ref('')
const channelCountPolicy = ref<'accept' | 'drop' | 'reset'>('accept')
const missingChannelPolicy = ref<'skip' | 'hold'>('skip')
const expectedCsvChannels = ref(0)
const visiblePoints = ref(1000)
const protocolHelp = computed(() => ({
  csv: 'CSV：每行是一帧，多个通道用英文逗号分隔。例如：1.25,-2.5,3e-2，并以换行结尾。',
  named: 'NamedData：每行是一帧，名称和值用冒号或等号连接。例如：voltage:3.3,current=0.12，并以换行结尾。',
  justfloat: 'JustFloat：按小端 Float32 依次发送各通道，每帧末尾追加 00 00 80 7F；请先选择正确的通道数。'
}[protocol.value]))
const viewOffset = ref(0)
let dragging = false
let dragStartX = 0
let dragStartOffset = 0
let sampleIndex = 0
let removeDataListener: (() => void) | undefined
let animationId = 0
let lastDrawTime = 0
let fpsCounter = 0
let fpsStarted = performance.now()

watch(protocol, (value) => { if (value !== 'justfloat') parser.setProtocol(value); clearWaveform() })
watch(justFloatChannels, (value) => { justFloatParser.setChannelCount(value); clearWaveform() })
watch(pointLimit, (value) => {
  const normalized = Math.max(1, Math.min(50000, Math.round(Number(value) || 1)))
  if (normalized !== value) { pointLimit.value = normalized; return }
  visiblePoints.value = Math.min(visiblePoints.value, normalized)
  for (const channel of channels.values()) channel.samples.resize(normalized)
})
watch(visiblePoints, (value) => { const normalized = Math.max(1, Math.min(pointLimit.value, Math.round(Number(value) || 1))); if (normalized !== value) visiblePoints.value = normalized })

function consume(data: Uint8Array): void {
  if (protocol.value === 'justfloat') {
    const batch = justFloatParser.consume(data)
    parseErrors.value += batch.errors.length
    if (batch.errors.length) lastError.value = batch.errors.at(-1)!
    for (const values of batch.frames) appendFrame(new Map(values.map((value, index) => [`CH${index + 1}`, value])))
    return
  }
  const batch = parser.consume(data)
  parseErrors.value += batch.errors.length
  if (batch.errors.length) lastError.value = `${batch.errors.at(-1)!.message} 原始行：${batch.errors.at(-1)!.raw}`
  for (const frame of batch.frames) appendFrame(frame.values)
}

function appendFrame(frameValues: Map<string, number>): void {
    const frame = { values: frameValues }
    if (frame.values.size > 16) {
      parseErrors.value += 1
      lastError.value = `收到 ${frame.values.size} 个通道，第一版最多支持 16 个通道，该帧已丢弃。`
      return
    }
    if (protocol.value === 'csv') {
      if (expectedCsvChannels.value === 0) expectedCsvChannels.value = frame.values.size
      else if (frame.values.size !== expectedCsvChannels.value) {
        lastError.value = `CSV 通道数从 ${expectedCsvChannels.value} 变为 ${frame.values.size}。策略：${channelCountPolicy.value}。`
        if (channelCountPolicy.value === 'drop') { parseErrors.value += 1; return }
        if (channelCountPolicy.value === 'reset') channels.clear()
        expectedCsvChannels.value = frame.values.size
      }
    }
    receiveFrames.value += 1
    sampleIndex += 1
    if (protocol.value === 'named' && missingChannelPolicy.value === 'hold') {
      for (const channel of channels.values()) {
        if (!frame.values.has(channel.key)) frame.values.set(channel.key, channel.current)
      }
    }
    for (const [key, value] of frame.values) {
      let channel = channels.get(key)
      if (!channel) {
        channel = { key, name: key, color: colors[channels.size % colors.length], visible: true, samples: new RingBuffer<Sample>(pointLimit.value), current: value, min: value, max: value, sum: 0, total: 0 }
        channels.set(key, channel)
      }
      channel.samples.push({ index: sampleIndex, value })
      channel.current = value
      channel.min = Math.min(channel.min, value)
      channel.max = Math.max(channel.max, value)
      channel.sum += value
      channel.total += 1
    }
}

function clearWaveform(): void {
  channels.clear()
  sampleIndex = 0
  receiveFrames.value = 0
  parseErrors.value = 0
  lastError.value = ''
  expectedCsvChannels.value = 0
  viewOffset.value = 0
}

function draw(now: number): void {
  animationId = requestAnimationFrame(draw)
  if (paused.value || now - lastDrawTime < 1000 / 30) return
  lastDrawTime = now
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  if (canvas.width !== Math.floor(rect.width * ratio) || canvas.height !== Math.floor(rect.height * ratio)) {
    canvas.width = Math.floor(rect.width * ratio); canvas.height = Math.floor(rect.height * ratio)
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  const width = rect.width; const height = rect.height
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#fbfdff'; context.fillRect(0, 0, width, height)
  context.strokeStyle = '#e8eef5'; context.lineWidth = 1
  for (let i = 1; i < 6; i += 1) { context.beginPath(); context.moveTo(0, (height * i) / 6); context.lineTo(width, (height * i) / 6); context.stroke() }

  const visible = channelList.value.filter((channel) => channel.visible && channel.samples.size > 0)
  const allValues = visible.flatMap((channel) => channel.samples.toArray().map((sample) => sample.value))
  let yMin = autoScale.value ? Math.min(...allValues) : Number(fixedMin.value)
  let yMax = autoScale.value ? Math.max(...allValues) : Number(fixedMax.value)
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = -1; yMax = 1 }
  if (yMin === yMax) { const padding = Math.abs(yMin || 1) * 0.1; yMin -= padding; yMax += padding }
  const range = yMax - yMin

  for (const channel of visible) {
    const allSamples = channel.samples.toArray()
    const end = Math.max(0, allSamples.length - viewOffset.value)
    const samples = allSamples.slice(Math.max(0, end - visiblePoints.value), end)
    if (samples.length < 2) continue
    const step = Math.max(1, Math.ceil(samples.length / Math.max(1, width)))
    context.strokeStyle = channel.color; context.lineWidth = 1.5; context.beginPath()
    for (let i = 0; i < samples.length; i += step) {
      const x = (i / Math.max(1, samples.length - 1)) * width
      const y = height - ((samples[i].value - yMin) / range) * height
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y)
    }
    context.stroke()
  }
  fpsCounter += 1
  if (now - fpsStarted >= 1000) { frameRate.value = fpsCounter; fpsCounter = 0; fpsStarted = now }
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const factor = event.deltaY > 0 ? 1.25 : 0.8
  visiblePoints.value = Math.max(1, Math.min(pointLimit.value, Math.round(visiblePoints.value * factor)))
}

function onPointerDown(event: PointerEvent): void {
  dragging = true; dragStartX = event.clientX; dragStartOffset = viewOffset.value
  canvasRef.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging || !canvasRef.value) return
  const pixels = dragStartX - event.clientX
  viewOffset.value = Math.max(0, Math.min(pointLimit.value - 1, dragStartOffset + Math.round((pixels / canvasRef.value.clientWidth) * visiblePoints.value)))
}

function onPointerUp(event: PointerEvent): void {
  dragging = false; canvasRef.value?.releasePointerCapture(event.pointerId)
}

function saveScreenshot(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const link = document.createElement('a')
  link.download = `UartScope-waveform-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
  link.href = canvas.toDataURL('image/png'); link.click()
}

async function exportCsv(): Promise<void> {
  exportMessage.value = ''
  const channelArray = channelList.value
  if (!channelArray.length) { exportMessage.value = '当前没有可导出的波形数据。'; return }
  const rows = new Map<number, Map<string, number>>()
  for (const channel of channelArray) {
    for (const sample of channel.samples.toArray()) {
      if (!rows.has(sample.index)) rows.set(sample.index, new Map())
      rows.get(sample.index)!.set(channel.key, sample.value)
    }
  }
  const escape = (value: string): string => `"${value.replace(/"/g, '""')}"`
  const csvLines = [['sample', ...channelArray.map((channel) => escape(channel.name))].join(',')]
  for (const [index, values] of rows) csvLines.push([String(index), ...channelArray.map((channel) => values.get(channel.key)?.toString() ?? '')].join(','))
  const result = await window.uartScope.exportCsv(csvLines.join('\r\n'))
  exportMessage.value = result.ok ? (result.canceled ? '已取消导出。' : `CSV 已保存：${result.filePath}`) : result.error
}

onMounted(async () => {
  removeDataListener = window.uartScope.onSerialData(consume)
  await nextTick(); animationId = requestAnimationFrame(draw)
})
onBeforeUnmount(() => { removeDataListener?.(); cancelAnimationFrame(animationId) })
</script>

<template>
  <section class="waveform-layout">
    <div class="panel chart-panel">
      <div class="panel-toolbar">
        <div><h2>实时波形</h2><p>{{ receiveFrames }} 帧 · {{ frameRate }} FPS · {{ parseErrors }} 个解析错误</p></div>
        <div class="toolbar-actions">
          <select v-model="protocol" class="compact-select"><option value="csv">FireWater / CSV</option><option value="named">NamedData</option><option value="justfloat">JustFloat</option></select>
          <button class="soft-button" @click="paused = !paused">{{ paused ? '恢复' : '暂停' }}</button>
          <button class="soft-button" @click="clearWaveform">清空</button>
          <button class="soft-button" @click="saveScreenshot">截图</button>
          <button class="soft-button" @click="exportCsv">导出 CSV</button>
        </div>
      </div>
      <div class="chart-options">
        <label><input v-model="autoScale" type="checkbox" /> Y 轴自动缩放</label>
        <label>最小 <input v-model="fixedMin" :disabled="autoScale" /></label>
        <label>最大 <input v-model="fixedMax" :disabled="autoScale" /></label>
        <label>缓存点数 <input v-model.number="pointLimit" type="number" min="1" max="50000" /></label>
        <label>显示点数 <input v-model.number="visiblePoints" type="number" min="1" :max="pointLimit" /></label>
        <label v-if="protocol === 'csv'">通道变化 <select v-model="channelCountPolicy"><option value="accept">接受</option><option value="drop">丢弃</option><option value="reset">清空重建</option></select></label>
        <label v-else-if="protocol === 'named'">缺少通道 <select v-model="missingChannelPolicy"><option value="skip">跳过该通道</option><option value="hold">保持上一值</option></select></label>
        <label v-else>JustFloat 通道 <select v-model.number="justFloatChannels"><option v-for="count in 16" :key="count" :value="count">{{ count }}</option></select></label>
      </div>
      <div class="protocol-help"><strong>当前协议：{{ protocol === 'csv' ? 'FireWater / CSV' : protocol === 'named' ? 'NamedData' : 'JustFloat' }}</strong><span>{{ protocolHelp }}</span></div>
      <canvas ref="canvasRef" class="waveform-canvas" @wheel="onWheel" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp"></canvas>
      <p class="chart-hint">鼠标滚轮缩放 · 左右拖动查看历史 · 当前窗口 {{ visiblePoints }} 点<span v-if="viewOffset"> · 距最新 {{ viewOffset }} 点</span></p>
      <p v-if="lastError" class="parse-warning">{{ lastError }}</p>
      <p v-if="exportMessage" class="export-message">{{ exportMessage }}</p>
    </div>
    <aside class="panel channel-panel">
      <div class="panel-toolbar"><div><h2>通道</h2><p>最多 16 路</p></div></div>
      <div v-if="channelList.length" class="channel-list">
        <div v-for="channel in channelList" :key="channel.key" class="channel-item">
          <div class="channel-title"><input v-model="channel.visible" type="checkbox" /><i :style="{ background: channel.color }"></i><input v-model="channel.name" class="channel-name" /></div>
          <strong>{{ channel.current.toPrecision(6) }}</strong>
          <small>最小 {{ channel.min.toPrecision(5) }} · 最大 {{ channel.max.toPrecision(5) }}</small>
          <small>平均 {{ (channel.sum / channel.total).toPrecision(5) }} · {{ channel.total }} 点</small>
        </div>
      </div>
      <div v-else class="empty-state"><strong>等待波形数据</strong><span>请选择协议并发送数值行。</span></div>
    </aside>
  </section>
</template>
