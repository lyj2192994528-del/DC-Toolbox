<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '@/i18n'
const { tr } = useI18n()
const input = ref(''), output = ref(''), bitrate = ref('192k')
const format = ref<'mp3' | 'm4a' | 'wav'>('mp3')
const busy = ref(false), error = ref(''), completed = ref('')
watch(format, () => { output.value = ''; completed.value = ''; error.value = '' })
async function chooseInput(): Promise<void> { const value = await window.uartScope.chooseAudioInput(); if (value) { input.value = value; completed.value = ''; error.value = '' } }
async function chooseOutput(): Promise<void> { const value = await window.uartScope.chooseAudioOutput(format.value); if (value) { output.value = value; completed.value = ''; error.value = '' } }
async function extract(): Promise<void> { busy.value = true; error.value = ''; completed.value = ''; const result = await window.uartScope.extractAudio({ input: input.value, output: output.value, format: format.value, bitrate: bitrate.value }); if (result.ok) completed.value = result.output; else error.value = result.error; busy.value = false }
</script>
<template>
  <section class="audio-extractor-layout">
    <div class="panel"><div class="panel-toolbar"><div><h2>{{ tr('音频提取工具', 'Audio Extractor') }}</h2><p>{{ tr('从本地视频或音频文件中提取并转换音轨，全程在本机处理', 'Extract and convert audio tracks from local media files, entirely on this computer') }}</p></div><span class="virtual-status ready">FFmpeg</span></div>
      <label class="field"><span>{{ tr('源媒体文件', 'Source media file') }}</span><div class="media-directory-row"><input :value="input" readonly :placeholder="tr('选择视频或音频文件', 'Choose a video or audio file')"><button class="soft-button" @click="chooseInput">{{ tr('选择文件', 'Choose') }}</button></div></label>
      <div class="audio-format-grid"><label class="field"><span>{{ tr('输出格式', 'Output format') }}</span><select v-model="format"><option value="mp3">MP3</option><option value="m4a">M4A / AAC</option><option value="wav">WAV PCM</option></select></label><label class="field"><span>{{ tr('音频码率', 'Audio bitrate') }}</span><select v-model="bitrate" :disabled="format === 'wav'"><option value="128k">128 kbps</option><option value="192k">192 kbps</option><option value="256k">256 kbps</option><option value="320k">320 kbps</option></select></label></div>
      <label class="field"><span>{{ tr('输出文件', 'Output file') }}</span><div class="media-directory-row"><input :value="output" readonly :placeholder="tr('选择保存位置和文件名', 'Choose a destination and filename')"><button class="soft-button" @click="chooseOutput">{{ tr('选择位置', 'Choose') }}</button></div></label>
      <button :disabled="busy || !input || !output" @click="extract">{{ busy ? tr('正在提取…', 'Extracting…') : tr('开始提取音频', 'Extract audio') }}</button><p v-if="completed" class="success-message">{{ tr('音频提取完成：', 'Audio extraction complete:') }} {{ completed }}</p><p v-if="error" class="error-message">{{ error }}</p>
    </div>
    <aside class="panel media-guide"><h2>{{ tr('功能说明', 'How it works') }}</h2><ol><li>{{ tr('支持常见视频及音频文件，由 FFmpeg 读取媒体轨道。', 'Supports common video and audio formats through FFmpeg.') }}</li><li>{{ tr('MP3 兼容性最好；M4A 通常文件更小；WAV 无压缩、体积较大。', 'MP3 offers broad compatibility; M4A is often smaller; WAV is uncompressed and larger.') }}</li><li>{{ tr('转换会重新编码音频，不会修改源文件。', 'Conversion re-encodes audio and never modifies the source file.') }}</li></ol><p class="license-note">{{ tr('本工具仅处理你选择的本地文件。请确保你有权转换和使用其中的音频。', 'This tool only processes files you select locally. Make sure you have the right to convert and use their audio.') }}</p></aside>
  </section>
</template>
