<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '@/i18n'

const props = defineProps<{ connected: boolean; serialSummary: string }>()
const { tr } = useI18n()
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
  if (!props.connected) { message.value = tr('请先打开串口，再开始原始数据记录。', 'Open the serial port before starting raw data recording.'); return }
  if (!directory.value) { message.value = tr('请先选择保存目录。', 'Select a destination folder first.'); return }
  const result = await window.uartScope.startRecording({ directory: directory.value, serialSummary: props.serialSummary })
  if (!result.ok) message.value = result.error
  else status.value = result.status
}

watch(() => props.connected, (connected) => {
  if (!connected && status.value.recording) message.value = tr('串口已断开，记录文件仍保持打开；重新连接后数据会继续写入，也可手动停止记录。', 'The serial port disconnected. Recording will continue after reconnection, or you can stop it manually.')
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
      <div><h2>{{ tr('原始数据记录', 'Raw Data Recording') }}</h2><p>{{ tr('记录完整字节流，不受终端暂停或波形刷新影响', 'Capture the complete byte stream independently of the terminal and waveform') }}</p></div>
      <span class="status-pill" :class="{ online: status.recording, danger: status.error }">● {{ status.recording ? tr('正在记录', 'Recording') : tr('未记录', 'Idle') }}</span>
    </div>
    <div class="record-directory">
      <label class="field"><span>{{ tr('保存目录', 'Destination') }}</span><input v-model="directory" readonly :placeholder="tr('请选择保存目录', 'Select a destination folder')" /></label>
      <button class="soft-button" :disabled="status.recording" @click="chooseDirectory">{{ tr('选择目录', 'Browse') }}</button>
      <button :class="{ danger: status.recording }" @click="toggleRecording">{{ status.recording ? tr('停止记录', 'Stop Recording') : tr('开始记录', 'Start Recording') }}</button>
    </div>
    <dl class="record-summary">
      <div><dt>{{ tr('已写入', 'Written') }}</dt><dd>{{ status.bytesWritten }} {{ tr('字节', 'bytes') }}</dd></div>
      <div><dt>{{ tr('当前文件', 'Current File') }}</dt><dd :title="status.filePath">{{ status.filePath || tr('尚未创建', 'Not created') }}</dd></div>
    </dl>
    <p v-if="message" class="error-message">{{ message }}</p>
    <div class="record-help">
      <strong>{{ tr('记录文件说明', 'Recording Files') }}</strong>
      <p>{{ tr('每次记录生成一个原始文件和同名元数据文件。原始文件逐字节保存串口数据，元数据记录创建时间和串口参数。', 'Each session creates a raw byte file and matching metadata containing its creation time and serial settings.') }} <code>.bin</code> / <code>.json</code></p>
    </div>
  </section>
</template>
