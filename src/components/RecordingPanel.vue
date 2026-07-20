<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ connected: boolean; serialSummary: string }>()
const directory = ref('')
const status = ref<RecorderStatus>({ recording: false, bytesWritten: 0 })
const message = ref('')
let removeListener: (() => void) | undefined

async function chooseDirectory(): Promise<void> {
  const selected = await window.uartScope.chooseRecordDirectory()
  if (selected) directory.value = selected
}

async function toggleRecording(): Promise<void> {
  message.value = ''
  if (status.value.recording) {
    const result = await window.uartScope.stopRecording()
    if (!result.ok) message.value = result.error
    else status.value = result.status
    return
  }
  if (!props.connected) { message.value = '请先打开串口，再开始原始数据记录。'; return }
  if (!directory.value) { message.value = '请先选择保存目录。'; return }
  const result = await window.uartScope.startRecording({ directory: directory.value, serialSummary: props.serialSummary })
  if (!result.ok) message.value = result.error
  else status.value = result.status
}

watch(() => props.connected, (connected) => {
  if (!connected && status.value.recording) message.value = '串口已断开，记录文件仍保持打开；重新连接后数据会继续写入，也可手动停止记录。'
})

onMounted(() => {
  removeListener = window.uartScope.onRecordStatus((nextStatus) => {
    status.value = nextStatus
    if (nextStatus.error) message.value = nextStatus.error
  })
})
onBeforeUnmount(() => removeListener?.())
</script>

<template>
  <section class="panel recording-panel">
    <div class="panel-toolbar">
      <div><h2>原始数据记录</h2><p>记录完整字节流，不受终端暂停或波形刷新影响</p></div>
      <span class="status-pill" :class="{ online: status.recording, danger: status.error }">● {{ status.recording ? '正在记录' : '未记录' }}</span>
    </div>
    <div class="record-directory">
      <label class="field"><span>保存目录</span><input v-model="directory" readonly placeholder="请选择保存目录" /></label>
      <button class="soft-button" :disabled="status.recording" @click="chooseDirectory">选择目录</button>
      <button :class="{ danger: status.recording }" @click="toggleRecording">{{ status.recording ? '停止记录' : '开始记录' }}</button>
    </div>
    <dl class="record-summary">
      <div><dt>已写入</dt><dd>{{ status.bytesWritten }} 字节</dd></div>
      <div><dt>当前文件</dt><dd :title="status.filePath">{{ status.filePath || '尚未创建' }}</dd></div>
    </dl>
    <p v-if="message" class="error-message">{{ message }}</p>
    <div class="record-help">
      <strong>记录文件说明</strong>
      <p>每次记录生成一个原始 <code>.bin</code> 文件和同名 <code>.json</code> 元数据文件。原始文件逐字节保存串口数据，元数据记录创建时间和串口参数。</p>
    </div>
  </section>
</template>
