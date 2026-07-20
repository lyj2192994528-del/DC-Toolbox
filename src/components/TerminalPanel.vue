<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bytesToHex, parseHexInput } from '@/utils/hex'

interface DisplayEntry { time: Date; data: Uint8Array; asciiText: string }

const props = defineProps<{ connected: boolean }>()
const displayMode = ref<'ascii' | 'hex'>('ascii')
const sendMode = ref<'ascii' | 'hex'>('ascii')
const sendText = ref('')
const showTimestamp = ref(true)
const autoLineBreak = ref(false)
const autoScroll = ref(true)
const paused = ref(false)
const searchText = ref('')
const suffix = ref<'none' | 'cr' | 'lf' | 'crlf'>('none')
const intervalText = ref('1000')
const timerRunning = ref(false)
const errorMessage = ref('')
const sendHistory = ref<string[]>([])
const quickCommands = ref(['AT', 'help\r\n', 'AA 55 01 02'])
const entries = ref<DisplayEntry[]>([])
const pendingEntries: DisplayEntry[] = []
const receiveBytes = ref(0)
const sendBytes = ref(0)
const receiveRate = ref(0)
const terminalRef = ref<HTMLElement>()
let bytesThisSecond = 0
let timerId: ReturnType<typeof setInterval> | undefined
let rateTimerId: ReturnType<typeof setInterval> | undefined
let removeDataListener: (() => void) | undefined
const decoder = new TextDecoder('utf-8', { fatal: false })
const MAX_DISPLAY_BYTES = 200_000

function appendEntry(entry: DisplayEntry): void {
  entries.value.push(entry)
  let total = entries.value.reduce((sum, item) => sum + item.data.length, 0)
  while (total > MAX_DISPLAY_BYTES && entries.value.length > 1) total -= entries.value.shift()!.data.length
}

function receiveData(data: Uint8Array): void {
  receiveBytes.value += data.length
  bytesThisSecond += data.length
  const entry = { time: new Date(), data, asciiText: decoder.decode(data, { stream: true }) }
  if (paused.value) pendingEntries.push(entry)
  else appendEntry(entry)
}

watch(paused, (isPaused) => {
  if (!isPaused && pendingEntries.length > 0) {
    for (const entry of pendingEntries.splice(0)) appendEntry(entry)
  }
})

const terminalText = computed(() => entries.value.map((entry) => {
  const stamp = showTimestamp.value ? `[${entry.time.toLocaleTimeString('zh-CN', { hour12: false })}.${String(entry.time.getMilliseconds()).padStart(3, '0')}] ` : ''
  const content = displayMode.value === 'hex' ? bytesToHex(entry.data) : entry.asciiText
  return `${stamp}${content}${autoLineBreak.value || displayMode.value === 'hex' ? '\n' : ''}`
}).join(''))

const highlightedText = computed(() => {
  if (!searchText.value) return terminalText.value
  return terminalText.value
})
const matchCount = computed(() => {
  if (!searchText.value) return 0
  return terminalText.value.toLocaleLowerCase().split(searchText.value.toLocaleLowerCase()).length - 1
})

watch(terminalText, async () => {
  if (!autoScroll.value) return
  await nextTick()
  if (terminalRef.value) terminalRef.value.scrollTop = terminalRef.value.scrollHeight
})

function buildPayload(): number[] | null {
  errorMessage.value = ''
  let bytes: number[]
  if (sendMode.value === 'hex') {
    const result = parseHexInput(sendText.value)
    if (!result.ok) {
      errorMessage.value = result.error ?? 'HEX 格式错误。'
      return null
    }
    bytes = result.bytes
  } else {
    if (!sendText.value) {
      errorMessage.value = '发送内容不能为空。'
      return null
    }
    bytes = Array.from(new TextEncoder().encode(sendText.value))
  }

  const endings = { none: [], cr: [13], lf: [10], crlf: [13, 10] } as const
  return [...bytes, ...endings[suffix.value]]
}

async function sendOnce(): Promise<boolean> {
  if (!props.connected) {
    errorMessage.value = '请先打开串口。'
    return false
  }
  const payload = buildPayload()
  if (!payload) return false
  const result = await window.uartScope.writeSerialData(payload)
  if (!result.ok) {
    errorMessage.value = result.error
    stopTimer()
    return false
  }
  sendBytes.value += result.bytesWritten
  if (!sendHistory.value.includes(sendText.value)) sendHistory.value = [sendText.value, ...sendHistory.value].slice(0, 20)
  return true
}

function useQuickCommand(command: string, index: number): void {
  sendMode.value = index === 2 ? 'hex' : 'ascii'
  sendText.value = command
}

async function toggleTimer(): Promise<void> {
  if (timerRunning.value) {
    stopTimer()
    return
  }
  const interval = Number(intervalText.value)
  if (!Number.isInteger(interval) || interval < 20 || interval > 86_400_000) {
    errorMessage.value = '定时周期必须是 20～86400000 毫秒之间的正整数。'
    return
  }
  if (!(await sendOnce())) return
  timerRunning.value = true
  timerId = setInterval(() => void sendOnce(), interval)
}

function stopTimer(): void {
  if (timerId) clearInterval(timerId)
  timerId = undefined
  timerRunning.value = false
}

function clearReceive(): void {
  entries.value = []
  pendingEntries.splice(0)
}

watch(() => props.connected, (connected) => { if (!connected) stopTimer() })

onMounted(() => {
  removeDataListener = window.uartScope.onSerialData(receiveData)
  rateTimerId = setInterval(() => {
    receiveRate.value = bytesThisSecond
    bytesThisSecond = 0
  }, 1000)
})

onBeforeUnmount(() => {
  stopTimer()
  if (rateTimerId) clearInterval(rateTimerId)
  removeDataListener?.()
})
</script>

<template>
  <section class="terminal-layout">
    <div class="panel receive-panel">
      <div class="panel-toolbar">
        <div><h2>接收终端</h2><p>RX {{ receiveBytes }} B · {{ receiveRate }} B/s</p></div>
        <div class="toolbar-actions">
          <select v-model="displayMode" class="compact-select"><option value="ascii">ASCII</option><option value="hex">HEX</option></select>
          <button class="soft-button" type="button" @click="paused = !paused">{{ paused ? '恢复显示' : '暂停显示' }}</button>
          <button class="soft-button" type="button" @click="clearReceive">清空</button>
        </div>
      </div>
      <div class="receive-options">
        <label><input v-model="showTimestamp" type="checkbox" /> 时间戳</label>
        <label><input v-model="autoLineBreak" type="checkbox" /> 自动换行</label>
        <label><input v-model="autoScroll" type="checkbox" /> 自动滚动</label>
        <input v-model="searchText" class="search-input" placeholder="搜索文本" /><span v-if="searchText">{{ matchCount }} 处</span>
      </div>
      <pre ref="terminalRef" class="terminal-output">{{ highlightedText || '等待接收串口数据…' }}</pre>
    </div>

    <div class="panel send-panel">
      <div class="panel-toolbar"><div><h2>发送数据</h2><p>TX {{ sendBytes }} B</p></div><select v-model="sendMode" class="compact-select"><option value="ascii">ASCII</option><option value="hex">HEX</option></select></div>
      <textarea v-model="sendText" :placeholder="sendMode === 'hex' ? '例如 AA 55 01 02 或 AA550102' : '输入要发送的文本'"></textarea>
      <div class="quick-commands"><button v-for="(command, index) in quickCommands" :key="command" class="command-chip" @click="useQuickCommand(command, index)">{{ command.replace(/\r/g, '\\r').replace(/\n/g, '\\n') }}</button></div>
      <div class="send-controls">
        <select v-model="suffix"><option value="none">不追加</option><option value="cr">追加 CR</option><option value="lf">追加 LF</option><option value="crlf">追加 CRLF</option></select>
        <button type="button" :disabled="!connected" @click="sendOnce">发送</button>
        <button class="soft-button" type="button" @click="sendText = ''">清空输入</button>
      </div>
      <select v-if="sendHistory.length" class="history-select" @change="sendText = ($event.target as HTMLSelectElement).value"><option value="">发送历史（最近 20 条）</option><option v-for="item in sendHistory" :key="item" :value="item">{{ item }}</option></select>
      <div class="timer-controls">
        <label>周期 <input v-model="intervalText" inputmode="numeric" /> ms</label>
        <button type="button" :class="{ danger: timerRunning }" :disabled="!connected" @click="toggleTimer">{{ timerRunning ? '停止定时' : '定时发送' }}</button>
      </div>
      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
    </div>
  </section>
</template>
