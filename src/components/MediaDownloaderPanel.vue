<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '@/i18n'
const { language, tr } = useI18n()

const status = ref<MediaToolStatus>()
const url = ref('')
const directory = ref('')
const mode = ref<'video' | 'audio'>('video')
const info = ref<MediaInfo>()
const progress = ref<MediaProgress>({ state: 'canceled', percent: 0, speed: '', eta: '', message: '' })
const busy = ref(false)
const installing = ref(false)
const error = ref('')
let removeProgress: (() => void) | undefined

function resetPreviousTask(): void {
  if (progress.value.state === 'running') return
  info.value = undefined
  error.value = ''
  progress.value = { state: 'canceled', percent: 0, speed: '', eta: '', message: '' }
}

watch(url, resetPreviousTask)

async function refresh(): Promise<void> {
  const result = await window.uartScope.getMediaToolStatus()
  if (result.ok) status.value = result.status
  else error.value = result.error
}
async function install(): Promise<void> {
  installing.value = true; error.value = ''
  const result = await window.uartScope.installMediaTool()
  if (result.ok) status.value = result.status
  else error.value = result.error
  installing.value = false
}
async function analyze(): Promise<void> {
  busy.value = true; resetPreviousTask()
  const result = await window.uartScope.analyzeMedia(url.value)
  if (result.ok) info.value = result.info
  else error.value = result.error
  busy.value = false
}
async function chooseDirectory(): Promise<void> {
  const selected = await window.uartScope.chooseMediaDirectory()
  if (selected) directory.value = selected
}
async function download(): Promise<void> {
  error.value = ''; progress.value = { state: 'running', percent: 0, speed: '', eta: '', message: tr('正在准备下载…', 'Preparing download…') }
  const result = await window.uartScope.downloadMedia({ url: url.value, directory: directory.value, mode: mode.value })
  if (!result.ok) { error.value = result.error; progress.value.state = 'error' }
}
async function cancel(): Promise<void> { await window.uartScope.cancelMediaDownload() }
function formatDuration(seconds: number | null): string {
  if (seconds === null) return tr('未知', 'Unknown')
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = Math.floor(seconds % 60)
  return [hours, minutes, rest].filter((_, index) => hours > 0 || index > 0).map((part) => String(part).padStart(2, '0')).join(':')
}
onMounted(async () => { removeProgress = window.uartScope.onMediaProgress((value) => { progress.value = value }); await refresh() })
onBeforeUnmount(() => removeProgress?.())
</script>

<template>
  <section class="media-downloader-layout">
    <div class="panel media-main">
      <div class="panel-toolbar"><div><h2>{{ tr('网页媒体下载', 'Web Media Downloader') }}</h2><p>{{ tr('粘贴公开网页地址，解析后下载视频或原始音频', 'Paste a public webpage URL, analyze it, then download video or original audio') }}</p></div><div class="media-tool-actions"><span class="virtual-status" :class="{ ready: status?.installed }">{{ status?.installed ? `yt-dlp ${status.version}` : tr('组件未安装', 'Component not installed') }}</span><button v-if="status?.installed" class="soft-button" :disabled="installing || progress.state === 'running'" @click="install">{{ installing ? tr('更新并校验中…', 'Updating and verifying…') : tr('更新 / 修复组件', 'Update / Repair') }}</button></div></div>
      <div v-if="!status?.installed" class="media-install-card"><strong>{{ tr('需要官方解析组件', 'Official parser required') }}</strong><p>{{ tr('DC Toolbox 将从 yt-dlp 官方 GitHub Release 下载 Windows x64 程序，并在安装前校验 SHA-256。', 'DC Toolbox downloads the Windows x64 executable from the official yt-dlp GitHub Release and verifies SHA-256 before installation.') }}</p><button :disabled="installing" @click="install">{{ installing ? tr('下载并校验中…', 'Downloading and verifying…') : tr('安装 yt-dlp 组件', 'Install yt-dlp') }}</button></div>
      <template v-else>
        <label class="field"><span>{{ tr('网页或视频地址', 'Webpage or video URL') }}</span><div class="media-url-row"><input v-model="url" type="url" placeholder="https://…" @keyup.enter="analyze"><button :disabled="busy || !url.trim()" @click="analyze">{{ busy ? tr('解析中…', 'Analyzing…') : tr('解析链接', 'Analyze') }}</button></div></label>
        <div v-if="info" class="media-info-card"><img v-if="info.thumbnail" :src="info.thumbnail" alt=""><div><span>{{ info.extractor }}</span><h3>{{ info.title }}</h3><p>{{ tr('时长', 'Duration') }}：{{ formatDuration(info.duration) }}</p></div></div>
        <div class="media-options"><label class="field"><span>{{ tr('下载内容', 'Download content') }}</span><select v-model="mode"><option value="video">{{ tr('最佳兼容视频（优先 MP4）', 'Best compatible video (prefer MP4)') }}</option><option value="audio">{{ tr('最佳原始音频（优先 M4A）', 'Best original audio (prefer M4A)') }}</option></select></label><label class="field"><span>{{ tr('保存目录', 'Save directory') }}</span><div class="media-directory-row"><input :value="directory" readonly :placeholder="tr('请选择保存目录', 'Choose a save folder')"><button class="soft-button" @click="chooseDirectory">{{ tr('选择目录', 'Choose') }}</button></div></label></div>
        <div v-if="progress.message" class="media-progress"><div><span>{{ progress.message }}</span><strong>{{ progress.percent.toFixed(1) }}%</strong></div><progress :value="progress.percent" max="100"></progress><small v-if="progress.state === 'running'">{{ progress.speed }} · ETA {{ progress.eta }}</small></div>
        <div class="media-actions"><button :disabled="!info || !directory || progress.state === 'running'" @click="download">{{ tr('开始下载', 'Start download') }}</button><button v-if="progress.state === 'running'" class="danger-button" @click="cancel">{{ tr('取消下载', 'Cancel') }}</button></div>
      </template>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>
    <aside class="panel media-guide"><h2>{{ tr('使用与版权说明', 'Usage & Copyright') }}</h2><ol><li>{{ tr('仅粘贴公开、无需绕过访问控制的 HTTPS 网页地址。', 'Paste only public HTTPS pages that require no access-control bypass.') }}</li><li>{{ tr('点击“解析链接”，确认标题和时长。', 'Analyze the link and confirm title and duration.') }}</li><li>{{ tr('选择视频或音频及保存目录，然后开始下载。', 'Choose video or audio and a save folder, then start downloading.') }}</li></ol><div class="driver-warning"><strong>{{ tr('重要限制', 'Important limits') }}</strong><p>{{ tr('不支持 DRM、付费墙、私人内容或权限绕过。请只下载你有权保存和使用的内容，并遵守网站条款及当地法律。', 'DRM, paywalls, private content and access-control bypass are not supported. Download only content you are entitled to save and use, following site terms and local law.') }}</p></div><p class="license-note">{{ tr('解析能力由独立开源项目 yt-dlp 提供。DC Toolbox 不保证所有网站长期可用。', 'Parsing is provided by the independent open-source yt-dlp project. DC Toolbox cannot guarantee long-term support for every website.') }}</p></aside>
  </section>
</template>
