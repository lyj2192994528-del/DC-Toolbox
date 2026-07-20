<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bytesToHex, parseHexInput } from '@/utils/hex'

type Encoding = 'utf8' | 'gbk' | 'latin1'
type Suffix = 'none' | 'lf' | 'cr' | 'lfcr' | 'crlf'
type Checksum = 'none' | 'sum8' | 'xor8' | 'crc16modbus'
type SendFormat = 'ascii' | 'hex' | 'bin' | 'dec'
interface DisplayEntry { time: Date; data: Uint8Array }

const props = defineProps<{ connected: boolean }>()
const displayMode = ref<'ascii' | 'hex'>('ascii')
const sendMode = ref<SendFormat>('ascii')
const encoding = ref<Encoding>('utf8')
const sendText = ref('')
const showTimestamp = ref(true)
const autoLineBreak = ref(false)
const autoScroll = ref(true)
const receiveFraming = ref<'auto' | 'timeout' | 'lf' | 'cr' | 'crlf'>('auto')
const receiveTimeoutText = ref('50')
const adaptiveTimeout = ref(35)
const paused = ref(false)
const searchText = ref('')
const suffix = ref<Suffix>('none')
const checksum = ref<Checksum>('none')
const intervalText = ref('1000')
const timerRunning = ref(false)
const errorMessage = ref('')
const sendHistory = ref<string[]>([])
const quickCommands = ref(['AT', 'help', 'AA 55 01 02'])
const entries = ref<DisplayEntry[]>([])
const pendingEntries: DisplayEntry[] = []
let nextRowId = 21
const multiRows = ref(Array.from({ length: 20 }, (_, index) => ({ id: index + 1, enabled: index === 0, format: 'ascii' as SendFormat, text: '' })))
const multiRunning = ref(false)
const multiCurrentId = ref<number | null>(null)
const receiveBytes = ref(0)
const sendBytes = ref(0)
const receiveRate = ref(0)
const terminalRef = ref<HTMLElement>()
let bytesThisSecond = 0
let timerId: ReturnType<typeof setInterval> | undefined
let multiTimerId: ReturnType<typeof setInterval> | undefined
let rateTimerId: ReturnType<typeof setInterval> | undefined
let removeDataListener: (() => void) | undefined
let burstTimer: ReturnType<typeof setTimeout> | undefined
let burstBytes: number[] = []
let lastReceiveAt = 0
let averageChunkGap = 12
const MAX_DISPLAY_BYTES = 200_000

function appendEntry(entry: DisplayEntry): void {
  entries.value.push(entry)
  let total = entries.value.reduce((sum, item) => sum + item.data.length, 0)
  while (total > MAX_DISPLAY_BYTES && entries.value.length > 1) total -= entries.value.shift()!.data.length
}

function flushBurst(): void {
  if (!burstBytes.length) return
  const entry = { time: new Date(), data: Uint8Array.from(burstBytes) }
  burstBytes = []
  if (paused.value) pendingEntries.push(entry); else appendEntry(entry)
}

function delimiterBytes(): number[] | null {
  if (receiveFraming.value === 'lf') return [10]
  if (receiveFraming.value === 'cr') return [13]
  if (receiveFraming.value === 'crlf') return [13, 10]
  return null
}

function flushDelimitedMessages(): void {
  const delimiter = delimiterBytes()
  if (!delimiter) return
  let start = 0
  for (let index = 0; index <= burstBytes.length - delimiter.length;) {
    if (delimiter.every((byte, offset) => burstBytes[index + offset] === byte)) {
      const message = burstBytes.slice(start, index + delimiter.length)
      const entry = { time: new Date(), data: Uint8Array.from(message) }
      if (paused.value) pendingEntries.push(entry); else appendEntry(entry)
      index += delimiter.length
      start = index
    } else index += 1
  }
  if (start > 0) burstBytes = burstBytes.slice(start)
  if (burstBytes.length >= 65536) flushBurst()
}

function receiveData(data: Uint8Array): void {
  receiveBytes.value += data.length
  bytesThisSecond += data.length
  const now = performance.now()
  if (lastReceiveAt > 0) {
    const gap = now - lastReceiveAt
    if (gap < 1000) averageChunkGap = averageChunkGap * 0.8 + gap * 0.2
  }
  lastReceiveAt = now
  burstBytes.push(...data)
  if (burstTimer) clearTimeout(burstTimer)
  if (delimiterBytes()) { flushDelimitedMessages(); return }
  const configured = Math.max(1, Math.min(5000, Number(receiveTimeoutText.value) || 50))
  adaptiveTimeout.value = Math.max(10, Math.min(500, Math.round(averageChunkGap * 3 + 5)))
  // 串口驱动可能把一次回包拆成 A + BC；等线路空闲后再作为一条消息显示。
  burstTimer = setTimeout(flushBurst, receiveFraming.value === 'auto' ? adaptiveTimeout.value : configured)
}

watch(receiveFraming, () => { if (burstTimer) clearTimeout(burstTimer); flushBurst() })

watch(paused, (value) => { if (!value) for (const entry of pendingEntries.splice(0)) appendEntry(entry) })

function decode(data: Uint8Array): string {
  try { return new TextDecoder(encoding.value === 'utf8' ? 'utf-8' : encoding.value, { fatal: false }).decode(data) }
  catch { return new TextDecoder('utf-8').decode(data) }
}

const terminalText = computed(() => entries.value.map((entry) => {
  const stamp = showTimestamp.value ? `[${entry.time.toLocaleTimeString('zh-CN', { hour12: false })}.${String(entry.time.getMilliseconds()).padStart(3, '0')}] ` : ''
  const content = displayMode.value === 'hex' ? bytesToHex(entry.data) : decode(entry.data)
  return `${stamp}${content}${autoLineBreak.value || displayMode.value === 'hex' ? '\n' : ''}`
}).join(''))
const matchCount = computed(() => searchText.value ? terminalText.value.toLocaleLowerCase().split(searchText.value.toLocaleLowerCase()).length - 1 : 0)

watch(terminalText, async () => { if (autoScroll.value) { await nextTick(); if (terminalRef.value) terminalRef.value.scrollTop = terminalRef.value.scrollHeight } })

function addChecksum(bytes: number[]): number[] {
  if (checksum.value === 'none') return bytes
  if (checksum.value === 'sum8') return [...bytes, bytes.reduce((sum, byte) => (sum + byte) & 0xff, 0)]
  if (checksum.value === 'xor8') return [...bytes, bytes.reduce((value, byte) => value ^ byte, 0)]
  let crc = 0xffff
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc & 1) ? ((crc >>> 1) ^ 0xa001) : (crc >>> 1) }
  return [...bytes, crc & 0xff, (crc >>> 8) & 0xff]
}

function parseNumberInput(text: string, format: 'bin' | 'dec'): number[] | null {
  if (!text.trim()) { errorMessage.value = '发送内容不能为空。'; return null }
  if (format === 'bin') {
    if (!/^[01\s,]+$/.test(text)) { errorMessage.value = 'BIN 只能包含 0、1、空格或逗号。'; return null }
    const compact = text.replace(/[\s,]/g, '')
    if (compact.length % 8 !== 0) { errorMessage.value = `BIN 位数必须是 8 的倍数，当前为 ${compact.length} 位。`; return null }
    return compact.match(/.{8}/g)!.map((value) => Number.parseInt(value, 2))
  }
  const tokens = text.trim().split(/[\s,]+/)
  const values = tokens.map(Number)
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) { errorMessage.value = 'DEC 必须是由空格或逗号分隔的 0～255 整数。'; return null }
  return values
}

async function buildPayload(text = sendText.value, format: SendFormat = sendMode.value): Promise<number[] | null> {
  errorMessage.value = ''
  let bytes: number[]
  if (format === 'hex') {
    const result = parseHexInput(text)
    if (!result.ok) { errorMessage.value = result.error ?? 'HEX 格式错误。'; return null }
    bytes = result.bytes
  } else if (format === 'bin' || format === 'dec') {
    const parsed = parseNumberInput(text, format)
    if (!parsed) return null
    bytes = parsed
  } else {
    if (!text) { errorMessage.value = '发送内容不能为空。'; return null }
    const encoded = await window.uartScope.encodeText(text, encoding.value)
    if (!encoded.ok) { errorMessage.value = encoded.error; return null }
    bytes = encoded.bytes
  }
  const endings: Record<Suffix, number[]> = { none: [], lf: [10], cr: [13], lfcr: [10, 13], crlf: [13, 10] }
  return addChecksum([...bytes, ...endings[suffix.value]])
}

async function sendValue(text: string, remember = false, format: SendFormat = sendMode.value): Promise<boolean> {
  if (!props.connected) { errorMessage.value = '请先打开串口。'; return false }
  const payload = await buildPayload(text, format)
  if (!payload) return false
  const result = await window.uartScope.writeSerialData(payload)
  if (!result.ok) { errorMessage.value = result.error; stopAllTimers(); return false }
  sendBytes.value += result.bytesWritten
  if (remember && !sendHistory.value.includes(text)) sendHistory.value = [text, ...sendHistory.value].slice(0, 20)
  return true
}

function sendOnce(): Promise<boolean> { return sendValue(sendText.value, true) }
function useQuickCommand(command: string, index: number): void { sendMode.value = index === 2 ? 'hex' : 'ascii'; sendText.value = command }

async function toggleTimer(): Promise<void> {
  if (timerRunning.value) { stopAllTimers(); return }
  const interval = Number(intervalText.value)
  if (!Number.isInteger(interval) || interval < 20 || interval > 86_400_000) { errorMessage.value = '定时周期必须是 20～86400000 毫秒之间的正整数。'; return }
  if (!(await sendOnce())) return
  timerRunning.value = true
  timerId = setInterval(() => void sendOnce(), interval)
}

function enabledMultiRows(): typeof multiRows.value { return multiRows.value.filter((row) => row.enabled && row.text) }
function wait(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }

async function sendMultiOnce(): Promise<boolean> {
  const rows = enabledMultiRows()
  if (!rows.length) { errorMessage.value = '请至少启用并填写一条多条发送指令。'; return false }
  const interval = Math.max(20, Number(intervalText.value) || 20)
  for (let index = 0; index < rows.length; index += 1) {
    multiCurrentId.value = rows[index].id
    if (!(await sendValue(rows[index].text, false, rows[index].format))) { multiCurrentId.value = null; return false }
    if (index < rows.length - 1) await wait(interval)
  }
  multiCurrentId.value = null
  return true
}

async function sendNextMulti(index = 0): Promise<void> {
  if (!multiRunning.value) return
  const rows = enabledMultiRows()
  if (!rows.length) { errorMessage.value = '没有可继续发送的已启用指令。'; stopAllTimers(); return }
  const row = rows[index % rows.length]
  multiCurrentId.value = row.id
  if (!(await sendValue(row.text, false, row.format))) return
  const interval = Number(intervalText.value)
  multiTimerId = setTimeout(() => void sendNextMulti((index + 1) % rows.length), interval)
}

async function toggleMulti(): Promise<void> {
  if (multiRunning.value) { stopAllTimers(); return }
  const interval = Number(intervalText.value)
  if (!Number.isInteger(interval) || interval < 20 || interval > 86_400_000) { errorMessage.value = '循环周期必须是 20～86400000 ms。'; return }
  if (!enabledMultiRows().length) { errorMessage.value = '请至少启用并填写一条多条发送指令。'; return }
  multiRunning.value = true
  await sendNextMulti(0)
}

function setAllRows(enabled: boolean): void { for (const row of multiRows.value) row.enabled = enabled }
function addRows(count = 10): void { for (let i = 0; i < count && multiRows.value.length < 100; i += 1) multiRows.value.push({ id: nextRowId++, enabled: false, format: 'ascii', text: '' }) }
function removeRow(id: number): void { if (!multiRunning.value && multiRows.value.length > 1) multiRows.value = multiRows.value.filter((row) => row.id !== id) }

function stopAllTimers(): void {
  if (timerId) clearInterval(timerId)
  if (multiTimerId) clearInterval(multiTimerId)
  timerId = multiTimerId = undefined
  timerRunning.value = multiRunning.value = false
  multiCurrentId.value = null
}

function clearReceive(): void { entries.value = []; pendingEntries.splice(0); burstBytes = [] }
watch(() => props.connected, (connected) => { if (!connected) stopAllTimers() })

onMounted(() => {
  removeDataListener = window.uartScope.onSerialData(receiveData)
  rateTimerId = setInterval(() => { receiveRate.value = bytesThisSecond; bytesThisSecond = 0 }, 1000)
})
onBeforeUnmount(() => { stopAllTimers(); if (burstTimer) clearTimeout(burstTimer); flushBurst(); if (rateTimerId) clearInterval(rateTimerId); removeDataListener?.() })
</script>

<template>
  <section class="terminal-layout">
    <div class="panel receive-panel">
      <div class="panel-toolbar">
        <div><h2>接收终端</h2><p>RX {{ receiveBytes }} B · {{ receiveRate }} B/s</p></div>
        <div class="toolbar-actions"><select v-model="displayMode" class="compact-select"><option value="ascii">ASCII</option><option value="hex">HEX</option></select><select v-model="encoding" class="compact-select" title="字符编码"><option value="utf8">UTF-8</option><option value="gbk">GBK</option><option value="latin1">Latin-1</option></select><button class="soft-button" @click="paused = !paused">{{ paused ? '恢复显示' : '暂停显示' }}</button><button class="soft-button" @click="clearReceive">清空</button></div>
      </div>
      <div class="receive-options"><label><input v-model="showTimestamp" type="checkbox" /> 时间戳</label><label><input v-model="autoLineBreak" type="checkbox" /> 每条回包换行</label><label><input v-model="autoScroll" type="checkbox" /> 自动滚动</label><label class="framing-option">分帧<select v-model="receiveFraming"><option value="auto">自适应超时（{{ adaptiveTimeout }} ms）</option><option value="timeout">固定空闲超时</option><option value="lf">遇到 \n (LF)</option><option value="cr">遇到 \r (CR)</option><option value="crlf">遇到 \r\n (CR+LF)</option></select></label><label v-if="receiveFraming === 'timeout'" class="timeout-option"><input v-model="receiveTimeoutText" type="number" min="1" max="5000" /> ms</label><input v-model="searchText" class="search-input" placeholder="搜索文本" /><span v-if="searchText">{{ matchCount }} 处</span></div>
      <pre ref="terminalRef" class="terminal-output">{{ terminalText || '等待接收串口数据…' }}</pre>
    </div>

    <div class="panel send-panel">
      <div class="panel-toolbar"><div><h2>发送数据</h2><p>TX {{ sendBytes }} B</p></div><select v-model="sendMode" class="compact-select"><option value="ascii">ASCII</option><option value="hex">HEX</option><option value="bin">BIN</option><option value="dec">DEC</option></select></div>
      <textarea v-model="sendText" :placeholder="sendMode === 'hex' ? 'HEX：AA 55 01 02 或 AA550102' : sendMode === 'bin' ? 'BIN：01000001 01000010' : sendMode === 'dec' ? 'DEC：65 66 67' : '输入要发送的文本'"></textarea>
      <div class="quick-commands"><button v-for="(command, index) in quickCommands" :key="command" class="command-chip" @click="useQuickCommand(command, index)">{{ command }}</button></div>
      <div class="send-option-grid">
        <label>字符编码<select v-model="encoding" :disabled="sendMode === 'hex'"><option value="utf8">UTF-8</option><option value="gbk">GBK / GB2312</option><option value="latin1">Latin-1</option></select></label>
        <label>追加回车换行<select v-model="suffix"><option value="none">无追加</option><option value="lf">\n (LF)</option><option value="cr">\r (CR)</option><option value="lfcr">\n\r (LF+CR)</option><option value="crlf">\r\n (CR+LF)</option></select></label>
        <label>发送校验<select v-model="checksum"><option value="none">无校验</option><option value="sum8">SUM8</option><option value="xor8">XOR8</option><option value="crc16modbus">CRC16 Modbus</option></select></label>
      </div>
      <div class="send-controls"><button :disabled="!connected" @click="sendOnce">发送</button><button class="soft-button" @click="sendText = ''">清空输入</button></div>
      <select v-if="sendHistory.length" class="history-select" @change="sendText = ($event.target as HTMLSelectElement).value"><option value="">发送历史（最近 20 条）</option><option v-for="item in sendHistory" :key="item" :value="item">{{ item }}</option></select>
      <div class="timer-controls"><label>周期 <input v-model="intervalText" inputmode="numeric" /> ms</label><button :class="{ danger: timerRunning }" :disabled="!connected" @click="toggleTimer">{{ timerRunning ? '停止定时' : '定时发送' }}</button></div>
      <details class="multi-send"><summary>多条顺序循环发送（{{ multiRows.length }} 条）</summary><div class="multi-toolbar"><button class="soft-button" @click="setAllRows(true)">全选</button><button class="soft-button" @click="setAllRows(false)">取消全选</button><button class="soft-button" :disabled="multiRows.length >= 100" @click="addRows(10)">增加 10 条</button><span>循环时每隔 {{ intervalText }} ms 只发送下一条</span></div><div class="multi-list"><div v-for="(row, index) in multiRows" :key="row.id" class="multi-row" :class="{ current: multiCurrentId === row.id }"><input v-model="row.enabled" type="checkbox" /><span>{{ index + 1 }}</span><select v-model="row.format"><option value="ascii">ASCII</option><option value="hex">HEX</option><option value="bin">BIN</option><option value="dec">DEC</option></select><input v-model="row.text" :placeholder="`第 ${index + 1} 条指令`" /><button class="soft-button" :disabled="!connected || !row.text" @click="sendValue(row.text, false, row.format)">发送</button><button class="row-delete" title="删除此条" :disabled="multiRunning" @click="removeRow(row.id)">×</button></div></div><div class="multi-actions"><button :disabled="!connected || multiRunning" @click="sendMultiOnce">按周期顺序发送一次</button><button :class="{ danger: multiRunning }" :disabled="!connected" @click="toggleMulti">{{ multiRunning ? '停止循环' : '开始顺序循环' }}</button></div></details>
      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
    </div>
  </section>
</template>
