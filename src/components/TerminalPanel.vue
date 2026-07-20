<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bytesToHex, parseHexInput } from '@/utils/hex'

type Encoding = 'utf8' | 'gbk' | 'latin1'
type Suffix = 'none' | 'lf' | 'cr' | 'lfcr' | 'crlf'
type Checksum = 'none' | 'sum8' | 'xor8' | 'crc16modbus'
interface DisplayEntry { time: Date; data: Uint8Array }

const props = defineProps<{ connected: boolean }>()
const displayMode = ref<'ascii' | 'hex'>('ascii')
const sendMode = ref<'ascii' | 'hex'>('ascii')
const encoding = ref<Encoding>('utf8')
const sendText = ref('')
const showTimestamp = ref(true)
const autoLineBreak = ref(false)
const autoScroll = ref(true)
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
const multiRows = ref(Array.from({ length: 8 }, (_, index) => ({ enabled: index === 0, text: '' })))
const multiRunning = ref(false)
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

function receiveData(data: Uint8Array): void {
  receiveBytes.value += data.length
  bytesThisSecond += data.length
  burstBytes.push(...data)
  if (burstTimer) clearTimeout(burstTimer)
  // 串口驱动可能把一次回包拆成 A + BC；短暂合并后再作为一条消息显示。
  burstTimer = setTimeout(flushBurst, 35)
}

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

async function buildPayload(text = sendText.value): Promise<number[] | null> {
  errorMessage.value = ''
  let bytes: number[]
  if (sendMode.value === 'hex') {
    const result = parseHexInput(text)
    if (!result.ok) { errorMessage.value = result.error ?? 'HEX 格式错误。'; return null }
    bytes = result.bytes
  } else {
    if (!text) { errorMessage.value = '发送内容不能为空。'; return null }
    const encoded = await window.uartScope.encodeText(text, encoding.value)
    if (!encoded.ok) { errorMessage.value = encoded.error; return null }
    bytes = encoded.bytes
  }
  const endings: Record<Suffix, number[]> = { none: [], lf: [10], cr: [13], lfcr: [10, 13], crlf: [13, 10] }
  return addChecksum([...bytes, ...endings[suffix.value]])
}

async function sendValue(text: string, remember = false): Promise<boolean> {
  if (!props.connected) { errorMessage.value = '请先打开串口。'; return false }
  const payload = await buildPayload(text)
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

async function sendMultiOnce(): Promise<boolean> {
  const rows = multiRows.value.filter((row) => row.enabled && row.text)
  if (!rows.length) { errorMessage.value = '请至少启用并填写一条多条发送指令。'; return false }
  for (const row of rows) if (!(await sendValue(row.text))) return false
  return true
}

async function toggleMulti(): Promise<void> {
  if (multiRunning.value) { stopAllTimers(); return }
  if (!(await sendMultiOnce())) return
  const interval = Number(intervalText.value)
  if (!Number.isInteger(interval) || interval < 20) { errorMessage.value = '循环周期不能小于 20 ms。'; return }
  multiRunning.value = true
  multiTimerId = setInterval(() => void sendMultiOnce(), interval)
}

function stopAllTimers(): void {
  if (timerId) clearInterval(timerId)
  if (multiTimerId) clearInterval(multiTimerId)
  timerId = multiTimerId = undefined
  timerRunning.value = multiRunning.value = false
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
      <div class="receive-options"><label><input v-model="showTimestamp" type="checkbox" /> 时间戳</label><label><input v-model="autoLineBreak" type="checkbox" /> 每条回包换行</label><label><input v-model="autoScroll" type="checkbox" /> 自动滚动</label><input v-model="searchText" class="search-input" placeholder="搜索文本" /><span v-if="searchText">{{ matchCount }} 处</span></div>
      <pre ref="terminalRef" class="terminal-output">{{ terminalText || '等待接收串口数据…' }}</pre>
    </div>

    <div class="panel send-panel">
      <div class="panel-toolbar"><div><h2>发送数据</h2><p>TX {{ sendBytes }} B</p></div><select v-model="sendMode" class="compact-select"><option value="ascii">ASCII</option><option value="hex">HEX</option></select></div>
      <textarea v-model="sendText" :placeholder="sendMode === 'hex' ? '例如 AA 55 01 02 或 AA550102' : '输入要发送的文本'"></textarea>
      <div class="quick-commands"><button v-for="(command, index) in quickCommands" :key="command" class="command-chip" @click="useQuickCommand(command, index)">{{ command }}</button></div>
      <div class="send-option-grid">
        <label>字符编码<select v-model="encoding" :disabled="sendMode === 'hex'"><option value="utf8">UTF-8</option><option value="gbk">GBK / GB2312</option><option value="latin1">Latin-1</option></select></label>
        <label>追加回车换行<select v-model="suffix"><option value="none">无追加</option><option value="lf">\n (LF)</option><option value="cr">\r (CR)</option><option value="lfcr">\n\r (LF+CR)</option><option value="crlf">\r\n (CR+LF)</option></select></label>
        <label>发送校验<select v-model="checksum"><option value="none">无校验</option><option value="sum8">SUM8</option><option value="xor8">XOR8</option><option value="crc16modbus">CRC16 Modbus</option></select></label>
      </div>
      <div class="send-controls"><button :disabled="!connected" @click="sendOnce">发送</button><button class="soft-button" @click="sendText = ''">清空输入</button></div>
      <select v-if="sendHistory.length" class="history-select" @change="sendText = ($event.target as HTMLSelectElement).value"><option value="">发送历史（最近 20 条）</option><option v-for="item in sendHistory" :key="item" :value="item">{{ item }}</option></select>
      <div class="timer-controls"><label>周期 <input v-model="intervalText" inputmode="numeric" /> ms</label><button :class="{ danger: timerRunning }" :disabled="!connected" @click="toggleTimer">{{ timerRunning ? '停止定时' : '定时发送' }}</button></div>
      <details class="multi-send"><summary>多条发送（8 条）</summary><div v-for="(row, index) in multiRows" :key="index" class="multi-row"><input v-model="row.enabled" type="checkbox" /><span>{{ index + 1 }}</span><input v-model="row.text" :placeholder="`第 ${index + 1} 条指令`" /><button class="soft-button" :disabled="!connected || !row.text" @click="sendValue(row.text)">发送</button></div><div class="multi-actions"><button :disabled="!connected" @click="sendMultiOnce">发送已启用</button><button :class="{ danger: multiRunning }" :disabled="!connected" @click="toggleMulti">{{ multiRunning ? '停止循环' : '循环发送' }}</button></div></details>
      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
    </div>
  </section>
</template>
