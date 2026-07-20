<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const ports = ref<SerialPortInfo[]>([])
const selectedPath = ref('')
const isScanning = ref(false)
const statusMessage = ref('正在准备扫描串口…')
const errorMessage = ref('')

const selectedPort = computed(() => ports.value.find((port) => port.path === selectedPath.value))

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

onMounted(refreshPorts)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <h1>UartScope</h1>
        <p class="subtitle">Windows 串口调试与实时波形助手</p>
      </div>
      <span class="status-pill" :class="{ online: ports.length > 0 }">● {{ statusMessage }}</span>
    </header>

    <section class="overview-card">
      <span class="overview-label">当前串口</span>
      <div class="overview-value">
        <strong>{{ selectedPath || '—' }}</strong>
        <span>{{ ports.length }} 个设备</span>
      </div>
      <span class="overview-meta">{{ selectedPort?.manufacturer || '等待选择串口设备' }}</span>
    </section>

    <main class="panel">
      <div class="card-heading">
        <div>
          <h2>串口设备</h2>
          <p>{{ statusMessage }}</p>
        </div>
        <button type="button" :disabled="isScanning" @click="refreshPorts">
          {{ isScanning ? '扫描中…' : '刷新串口' }}
        </button>
      </div>

      <label for="serial-port">COM 端口</label>
      <select id="serial-port" v-model="selectedPath" :disabled="isScanning || ports.length === 0">
        <option v-if="ports.length === 0" value="">暂无可用串口</option>
        <option v-for="port in ports" :key="port.path" :value="port.path">
          {{ port.path }}{{ port.manufacturer ? ` — ${port.manufacturer}` : '' }}
        </option>
      </select>

      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

      <dl v-if="selectedPort" class="port-details">
        <div><dt>端口</dt><dd>{{ selectedPort.path }}</dd></div>
        <div><dt>制造商</dt><dd>{{ selectedPort.manufacturer || 'Windows 未提供' }}</dd></div>
        <div><dt>VID / PID</dt><dd>{{ selectedPort.vendorId || '—' }} / {{ selectedPort.productId || '—' }}</dd></div>
        <div><dt>序列号</dt><dd>{{ selectedPort.serialNumber || 'Windows 未提供' }}</dd></div>
      </dl>

      <div v-else-if="!isScanning && !errorMessage" class="empty-state">
        <strong>没有检测到串口</strong>
        <span>请插入 USB 转串口设备，然后点击“刷新串口”。</span>
      </div>
    </main>
  </div>
</template>
