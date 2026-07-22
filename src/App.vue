<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BaseConverter, BlePanel, CapacitanceConverter, CapacitorNetworkCalculator, ChecksumCalculator, CsvAnalyzer, LedResistorCalculator, NetworkProtocolsPanel, OhmsLawCalculator, OpAmpCalculator, PowerCalculator, RecordingPanel, ReplayPanel, ResistorDividerCalculator, ResistorNetworkCalculator, TerminalPanel, UsbHidPanel, VirtualPortPanel, WaveformPanel } from '@/tools'
import { toolCount, toolGroups, type ToolPageId } from '@/tools/catalog'
import AboutPanel from '@/components/AboutPanel.vue'
import { PROJECT_INFO } from '../shared/project-info'

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
const activePage = ref<ToolPageId | 'about'>('terminal')
const settingsWarning = ref('')
const connectionExpanded = ref(false)
const signals = ref({ dtr: false, rts: false, brk: false })
const signalError = ref('')
const showWelcome = ref(false)
const hideWelcomeNextTime = ref(false)
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
const isSerialPage = computed(() => ['terminal', 'waveform', 'recording'].includes(activePage.value))
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

async function toggleSignal(name: 'dtr' | 'rts' | 'brk'): Promise<void> {
  signalError.value = ''
  const next = !signals.value[name]
  const result = await window.uartScope.setSerialSignals({ [name]: next })
  if (result.ok) signals.value[name] = next
  else signalError.value = result.error
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

/** 关闭启动欢迎窗口；用户勾选后，后续启动不再自动弹出。 */
function closeWelcome(): void {
  if (hideWelcomeNextTime.value) localStorage.setItem('dc-toolbox-hide-welcome', '1')
  else localStorage.removeItem('dc-toolbox-hide-welcome')
  showWelcome.value = false
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
  showWelcome.value = localStorage.getItem('dc-toolbox-hide-welcome') !== '1'
  removeStatusListener = window.uartScope.onSerialStatus((status) => {
    connectionState.value = status.state === 'error' ? 'error' : status.state
    connectionMessage.value = status.message
    if (status.state === 'error') errorMessage.value = status.message
    if (status.state === 'connected' && reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = undefined }
    if (status.state === 'connected') connectionExpanded.value = false
    if (status.state === 'disconnected' && !status.unexpected) connectionExpanded.value = true
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
    <div v-if="showWelcome" class="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title" @click.self="closeWelcome">
      <section class="welcome-dialog">
        <button class="welcome-close" aria-label="关闭欢迎窗口" @click="closeWelcome">×</button>
        <div class="welcome-brand">
          <div class="welcome-logo">DC</div>
          <div><span>WELCOME</span><h2 id="welcome-title">{{ PROJECT_INFO.fullName }}</h2><p>免费开放的 Windows 嵌入式开发调试工具箱</p></div>
        </div>
        <div class="welcome-contact-grid">
          <div><span>作者邮箱</span><strong>{{ PROJECT_INFO.email }}</strong></div>
          <div><span>QQ 交流群</span><strong>{{ PROJECT_INFO.qqGroup }}</strong><small>{{ PROJECT_INFO.qqGroupName }}</small></div>
          <div><span>GitHub 仓库</span><strong>{{ PROJECT_INFO.githubUrl || '待添加' }}</strong></div>
        </div>
        <div class="welcome-group-description"><strong>交流群介绍</strong><p>{{ PROJECT_INFO.qqGroupDescription }}</p></div>
        <div class="welcome-actions"><label><input v-model="hideWelcomeNextTime" type="checkbox"> 启动时不再显示</label><button @click="activePage = 'about'; closeWelcome()">查看项目信息</button><button class="welcome-primary" @click="closeWelcome">进入工具箱</button></div>
      </section>
    </div>
    <header class="app-header">
      <div>
        <h1>DC Toolbox</h1>
        <p class="subtitle">嵌入式开发调试工具箱</p>
      </div>
      <span class="status-pill" :class="{ online: isConnected, danger: connectionState === 'error' }">● {{ connectionMessage }}</span>
    </header>

    <div class="toolbox-layout">
      <aside class="tool-sidebar">
        <div class="sidebar-heading"><strong>工具导航</strong><span>{{ toolCount }} 个工具</span></div>
        <section v-for="group in toolGroups" :key="group.title" class="tool-group"><h3>{{ group.title }}</h3><button v-for="tool in group.tools" :key="tool.id" :class="{ active: activePage === tool.id }" @click="activePage = tool.id"><span>{{ tool.icon }}</span>{{ tool.label }}</button></section>
        <button class="about-nav-button" :class="{ active: activePage === 'about' }" @click="activePage = 'about'"><span>i</span>关于与联系</button>
        <div class="sidebar-footer">QQ群 {{ PROJECT_INFO.qqGroup }}<br>{{ PROJECT_INFO.qqGroupName }}</div>
      </aside>

      <main class="tool-workspace">
    <section v-if="isSerialPage" class="panel connection-panel">
      <div class="card-heading compact-connection-heading">
        <div><h2>串口连接</h2><p>{{ statusMessage }} · 打开串口后配置将被锁定</p></div>
        <div class="connection-heading-actions"><div v-if="isConnected" class="signal-controls" aria-label="流控信号"><span>流控信号</span><button v-for="name in (['dtr', 'rts', 'brk'] as const)" :key="name" class="signal-button" :class="{ active: signals[name] }" @click="toggleSignal(name)">{{ name === 'brk' ? 'Break' : name.toUpperCase() }}</button></div><button class="soft-button" @click="connectionExpanded = !connectionExpanded">{{ connectionExpanded ? '收起参数' : '展开参数' }}</button><button class="refresh-button" type="button" :disabled="isScanning || isConnected || isBusy" @click="refreshPorts">{{ isScanning ? '扫描中…' : '刷新串口' }}</button></div>
      </div>

      <div v-if="!connectionExpanded" class="connection-quick-row">
        <div><strong>{{ selectedPath || '未选择串口' }}</strong><span>{{ baudRateText }} baud · {{ dataBits }}{{ parity[0].toUpperCase() }}{{ stopBits }} · {{ flowControl === 'rtscts' ? 'RTS/CTS' : '无流控' }}</span></div>
        <button class="connect-button" type="button" :class="{ danger: isConnected }" :disabled="isBusy || (!isConnected && (!selectedPath || Boolean(baudRateError)))" @click="toggleConnection">{{ isBusy ? '连接中…' : isConnected ? '关闭串口' : '打开串口' }}</button>
      </div>

      <div v-if="connectionExpanded" class="port-action-row">
        <label class="field port-field"><span>COM 端口</span><select v-model="selectedPath" :disabled="isScanning || ports.length === 0 || isConnected || isBusy">
          <option v-if="ports.length === 0" value="">暂无可用串口</option>
          <option v-for="port in ports" :key="port.path" :value="port.path">{{ port.path }}{{ port.manufacturer ? ` — ${port.manufacturer}` : '' }}</option>
        </select></label>
        <button class="connect-button" type="button" :class="{ danger: isConnected }" :disabled="isBusy || (!isConnected && Boolean(baudRateError))" @click="toggleConnection">
          {{ isBusy ? '连接中…' : isConnected ? '关闭串口' : '打开串口' }}
        </button>
      </div>

      <div v-if="connectionExpanded" class="settings-grid">
        <label class="field"><span>波特率</span><input v-model="baudRateText" list="baud-rate-options" inputmode="numeric" :disabled="isConnected || isBusy" @input="normalizeBaudRate" /></label>
        <datalist id="baud-rate-options"><option v-for="rate in allBaudRates" :key="rate" :value="rate" /></datalist>
        <label class="field"><span>数据位</span><select v-model.number="dataBits" :disabled="isConnected || isBusy"><option :value="5">5</option><option :value="6">6</option><option :value="7">7</option><option :value="8">8</option></select></label>
        <label class="field"><span>停止位</span><select v-model.number="stopBits" :disabled="isConnected || isBusy"><option :value="1">1</option><option :value="1.5">1.5</option><option :value="2">2</option></select></label>
        <label class="field"><span>校验位</span><select v-model="parity" :disabled="isConnected || isBusy"><option value="none">None</option><option value="even">Even</option><option value="odd">Odd</option><option value="mark">Mark</option><option value="space">Space</option></select></label>
        <label class="field"><span>流控</span><select v-model="flowControl" :disabled="isConnected || isBusy"><option value="none">None</option><option value="rtscts">RTS/CTS</option></select></label>
      </div>
      <label v-if="connectionExpanded" class="reconnect-option"><input v-model="autoReconnect" type="checkbox" :disabled="isConnected" /> 设备意外拔出后自动重连</label>
      <p v-if="connectionExpanded && baudRateError" class="field-error">{{ baudRateError }}</p>

      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

      <dl v-if="connectionExpanded && selectedPort" class="device-summary">
        <div><dt>端口</dt><dd>{{ selectedPort.path }}</dd></div>
        <div><dt>制造商</dt><dd>{{ selectedPort.manufacturer || '未提供' }}</dd></div>
        <div><dt>VID / PID</dt><dd>{{ selectedPort.vendorId || '—' }} / {{ selectedPort.productId || '—' }}</dd></div>
        <div><dt>序列号</dt><dd :title="selectedPort.serialNumber">{{ selectedPort.serialNumber || '未提供' }}</dd></div>
      </dl>

      <div v-else-if="connectionExpanded && !isScanning && !errorMessage && !selectedPort" class="empty-state">
        <strong>没有检测到串口</strong>
        <span>请插入 USB 转串口设备，然后点击“刷新串口”。</span>
      </div>
      <p v-if="signalError" class="field-error">{{ signalError }}</p>
    </section>

    <p v-if="settingsWarning" class="config-warning">{{ settingsWarning }}</p>
    <div class="page-content" :class="{ hidden: activePage !== 'terminal' }"><TerminalPanel :connected="isConnected" /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'waveform' }"><WaveformPanel /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'recording' }"><RecordingPanel :connected="isConnected" :serial-summary="`${selectedPath} @ ${baudRate}, ${dataBits}${parity[0].toUpperCase()}${stopBits}, ${flowControl}`" /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'replay' }"><ReplayPanel /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'virtualPort' }"><VirtualPortPanel /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'ble' }"><BlePanel kind="ble" /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'usb' }"><UsbHidPanel kind="usb" /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'networkProtocols' }"><NetworkProtocolsPanel kind="network" /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'baseConverter' }"><BaseConverter /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'checksum' }"><ChecksumCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'csv' }"><CsvAnalyzer /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'ohms' }"><OhmsLawCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'opamp' }"><OpAmpCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'divider' }"><ResistorDividerCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'power' }"><PowerCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'network' }"><ResistorNetworkCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'capacitors' }"><CapacitorNetworkCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'capconvert' }"><CapacitanceConverter /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'led' }"><LedResistorCalculator /></div>
    <div class="page-content" :class="{ hidden: activePage !== 'about' }"><AboutPanel /></div>
      </main>
    </div>
    <footer class="project-promo-bar"><strong>{{ PROJECT_INFO.fullName }}</strong><span>邮箱：{{ PROJECT_INFO.email }}</span><span>QQ群：{{ PROJECT_INFO.qqGroup }} · {{ PROJECT_INFO.qqGroupName }}</span><span>GitHub：{{ PROJECT_INFO.githubUrl || '待添加' }}</span></footer>
  </div>
</template>
