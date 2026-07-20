<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TerminalPanel from '@/components/TerminalPanel.vue'
import WaveformPanel from '@/components/WaveformPanel.vue'
import RecordingPanel from '@/components/RecordingPanel.vue'

const ports = ref<SerialPortInfo[]>([])
const selectedPath = ref('')
const isScanning = ref(false)
const statusMessage = ref('正在准备扫描串口…')
const errorMessage = ref('')
const connectionState = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
const connectionMessage = ref('未连接')
const baudRateText = ref('115200')
const dataBits = ref<5 | 6 | 7 | 8>(8)
const stopBits = ref<1 | 1.5 | 2>(1)
const parity = ref<'none' | 'even' | 'odd' | 'mark' | 'space'>('none')
const flowControl = ref<'none' | 'rtscts'>('none')
const customBaudRates = ref<number[]>([])
const autoReconnect = ref(true)
const activePage = ref<'terminal' | 'waveform' | 'recording'>('terminal')
const settingsWarning = ref('')
let settingsCache: PersistedSettings | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let reconnecting = false

const baudRates = [300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 56000, 57600, 115200, 128000, 230400, 256000, 460800, 500000, 512000, 921600, 1000000, 1500000, 2000000]
const allBaudRates = computed(() => Array.from(new Set([...baudRates, ...customBaudRates.value])).sort((a, b) => a - b))

const selectedPort = computed(() => ports.value.find((port) => port.path === selectedPath.value))
const isConnected = computed(() => connectionState.value === 'connected')
const isBusy = computed(() => connectionState.value === 'connecting')
const baudRate = computed(() => Number(baudRateText.value))
const baudRateError = computed(() => {
  if (!/^\d+$/.test(baudRateText.value)) return '波特率只能输入正整数。'
  if (baudRate.value < 50 || baudRate.value > 4_000_000) return '波特率范围是 50～4000000。'
  return ''
})

function normalizeBaudRate(event: Event): void {
  baudRateText.value = (event.target as HTMLInputElement).value.replace(/\D/g, '')
}

async function refreshPorts(): Promise<void> {
  isScanning.value = true
  errorMessage.value = ''

  try {
    const result = await window.uartScope.listSerialPorts()
    if (!result.ok) {
      ports.value = []
      selectedPath.value = ''
      errorMessage.value = result.error
      statusMessage.value = '扫描失败'
      return
    }

    ports.value = result.ports
    if (!ports.value.some((port) => port.path === selectedPath.value)) {
      selectedPath.value = ports.value[0]?.path ?? ''
    }
    statusMessage.value = ports.value.length > 0 ? `检测到 ${ports.value.length} 个串口` : '没有检测到串口'
  } catch (error) {
    errorMessage.value = `页面调用串口扫描失败：${error instanceof Error ? error.message : String(error)}`
    statusMessage.value = '扫描失败'
  } finally {
    isScanning.value = false
  }
}

async function toggleConnection(): Promise<void> {
  errorMessage.value = ''

  if (isConnected.value) {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    const result = await window.uartScope.closeSerialPort()
    if (!result.ok) errorMessage.value = result.error
    return
  }

  if (!selectedPath.value) {
    errorMessage.value = '请先选择一个 COM 端口。'
    return
  }
  if (baudRateError.value) {
    errorMessage.value = baudRateError.value
    return
  }

  connectionState.value = 'connecting'
  connectionMessage.value = `正在连接 ${selectedPath.value}…`
  const result = await window.uartScope.openSerialPort({
    path: selectedPath.value,
    baudRate: baudRate.value,
    dataBits: dataBits.value,
    stopBits: stopBits.value,
    parity: parity.value,
    rtscts: flowControl.value === 'rtscts'
  })
  if (!result.ok) {
    connectionState.value = 'error'
    connectionMessage.value = '连接失败'
    errorMessage.value = result.error
  } else if (!baudRates.includes(baudRate.value) && !customBaudRates.value.includes(baudRate.value)) {
    customBaudRates.value = [baudRate.value, ...customBaudRates.value].slice(0, 20)
  }
}

function scheduleReconnect(): void {
  if (!autoReconnect.value || reconnectTimer || reconnecting || !selectedPath.value) return
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = undefined
    reconnecting = true
    connectionMessage.value = `正在尝试重新连接 ${selectedPath.value}…`
    const result = await window.uartScope.openSerialPort({ path: selectedPath.value, baudRate: baudRate.value, dataBits: dataBits.value, stopBits: stopBits.value, parity: parity.value, rtscts: flowControl.value === 'rtscts' })
    reconnecting = false
    if (!result.ok) {
      connectionState.value = 'disconnected'
      connectionMessage.value = `等待 ${selectedPath.value} 重新插入…`
      scheduleReconnect()
    }
  }, 2000)
}

let removeStatusListener: (() => void) | undefined

watch([selectedPath, baudRateText, dataBits, stopBits, parity, flowControl, customBaudRates], () => {
  if (!settingsCache) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    settingsCache = {
      ...settingsCache!,
      serial: { path: selectedPath.value, baudRate: baudRateText.value, dataBits: dataBits.value, stopBits: stopBits.value, parity: parity.value, flowControl: flowControl.value, customBaudRates: customBaudRates.value }
    }
    void window.uartScope.setSettings(settingsCache)
  }, 300)
})

onMounted(async () => {
  removeStatusListener = window.uartScope.onSerialStatus((status) => {
    connectionState.value = status.state === 'error' ? 'error' : status.state
    connectionMessage.value = status.message
    if (status.state === 'error') errorMessage.value = status.message
    if (status.state === 'connected' && reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = undefined }
    if (status.state === 'disconnected' && status.unexpected) scheduleReconnect()
  })
  const loaded = await window.uartScope.getSettings()
  settingsCache = loaded.settings
  settingsWarning.value = loaded.warning
  selectedPath.value = loaded.settings.serial.path
  baudRateText.value = loaded.settings.serial.baudRate
  dataBits.value = loaded.settings.serial.dataBits
  stopBits.value = loaded.settings.serial.stopBits
  parity.value = loaded.settings.serial.parity
  flowControl.value = loaded.settings.serial.flowControl
  customBaudRates.value = loaded.settings.serial.customBaudRates ?? []
  await refreshPorts()
})

onBeforeUnmount(() => { removeStatusListener?.(); if (reconnectTimer) clearTimeout(reconnectTimer) })
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <h1>UartScope</h1>
        <p class="subtitle">Windows 串口调试与实时波形助手</p>
      </div>
      <span class="status-pill" :class="{ online: isConnected, danger: connectionState === 'error' }">● {{ connectionMessage }}</span>
    </header>

    <main class="panel connection-panel">
      <div class="card-heading">
        <div><h2>串口连接</h2><p>{{ statusMessage }} · 打开串口后配置将被锁定</p></div>
        <button class="refresh-button" type="button" :disabled="isScanning || isConnected || isBusy" @click="refreshPorts">
          {{ isScanning ? '扫描中…' : '刷新串口' }}
        </button>
      </div>

      <div class="port-action-row">
        <label class="field port-field"><span>COM 端口</span><select v-model="selectedPath" :disabled="isScanning || ports.length === 0 || isConnected || isBusy">
          <option v-if="ports.length === 0" value="">暂无可用串口</option>
          <option v-for="port in ports" :key="port.path" :value="port.path">{{ port.path }}{{ port.manufacturer ? ` — ${port.manufacturer}` : '' }}</option>
        </select></label>
        <button class="connect-button" type="button" :class="{ danger: isConnected }" :disabled="isBusy || (!isConnected && Boolean(baudRateError))" @click="toggleConnection">
          {{ isBusy ? '连接中…' : isConnected ? '关闭串口' : '打开串口' }}
        </button>
      </div>

      <div class="settings-grid">
        <label class="field"><span>波特率</span><input v-model="baudRateText" list="baud-rate-options" inputmode="numeric" :disabled="isConnected || isBusy" @input="normalizeBaudRate" /></label>
        <datalist id="baud-rate-options"><option v-for="rate in allBaudRates" :key="rate" :value="rate" /></datalist>
        <label class="field"><span>数据位</span><select v-model.number="dataBits" :disabled="isConnected || isBusy"><option :value="5">5</option><option :value="6">6</option><option :value="7">7</option><option :value="8">8</option></select></label>
        <label class="field"><span>停止位</span><select v-model.number="stopBits" :disabled="isConnected || isBusy"><option :value="1">1</option><option :value="1.5">1.5</option><option :value="2">2</option></select></label>
        <label class="field"><span>校验位</span><select v-model="parity" :disabled="isConnected || isBusy"><option value="none">None</option><option value="even">Even</option><option value="odd">Odd</option><option value="mark">Mark</option><option value="space">Space</option></select></label>
        <label class="field"><span>流控</span><select v-model="flowControl" :disabled="isConnected || isBusy"><option value="none">None</option><option value="rtscts">RTS/CTS</option></select></label>
      </div>
      <label class="reconnect-option"><input v-model="autoReconnect" type="checkbox" :disabled="isConnected" /> 设备意外拔出后自动重连</label>
      <p v-if="baudRateError" class="field-error">{{ baudRateError }}</p>

      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

      <dl v-if="selectedPort" class="device-summary">
        <div><dt>端口</dt><dd>{{ selectedPort.path }}</dd></div>
        <div><dt>制造商</dt><dd>{{ selectedPort.manufacturer || '未提供' }}</dd></div>
        <div><dt>VID / PID</dt><dd>{{ selectedPort.vendorId || '—' }} / {{ selectedPort.productId || '—' }}</dd></div>
        <div><dt>序列号</dt><dd :title="selectedPort.serialNumber">{{ selectedPort.serialNumber || '未提供' }}</dd></div>
      </dl>

      <div v-else-if="!isScanning && !errorMessage" class="empty-state">
        <strong>没有检测到串口</strong>
        <span>请插入 USB 转串口设备，然后点击“刷新串口”。</span>
      </div>
    </main>

    <p v-if="settingsWarning" class="config-warning">{{ settingsWarning }}</p>
    <nav class="page-tabs"><button :class="{ active: activePage === 'terminal' }" @click="activePage = 'terminal'">串口终端</button><button :class="{ active: activePage === 'waveform' }" @click="activePage = 'waveform'">实时波形</button><button :class="{ active: activePage === 'recording' }" @click="activePage = 'recording'">数据记录</button></nav>
    <TerminalPanel v-show="activePage === 'terminal'" :connected="isConnected" />
    <WaveformPanel v-show="activePage === 'waveform'" />
    <RecordingPanel v-show="activePage === 'recording'" :connected="isConnected" :serial-summary="`${selectedPath} @ ${baudRate}, ${dataBits}${parity[0].toUpperCase()}${stopBits}, ${flowControl}`" />
  </div>
</template>
