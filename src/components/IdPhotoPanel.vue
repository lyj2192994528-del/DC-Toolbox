<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SelfieSegmentation, type Results } from '@mediapipe/selfie_segmentation'
import graphUrl from '@mediapipe/selfie_segmentation/selfie_segmentation.binarypb?url'
import portraitModelUrl from '@mediapipe/selfie_segmentation/selfie_segmentation.tflite?url'
import landscapeModelUrl from '@mediapipe/selfie_segmentation/selfie_segmentation_landscape.tflite?url'
import simdLoaderUrl from '@mediapipe/selfie_segmentation/selfie_segmentation_solution_simd_wasm_bin.js?url'
import simdWasmUrl from '@mediapipe/selfie_segmentation/selfie_segmentation_solution_simd_wasm_bin.wasm?url'
import wasmLoaderUrl from '@mediapipe/selfie_segmentation/selfie_segmentation_solution_wasm_bin.js?url'
import wasmUrl from '@mediapipe/selfie_segmentation/selfie_segmentation_solution_wasm_bin.wasm?url'
import { useI18n } from '@/i18n'
import { encodePhoto, formatFileSize, ID_PHOTO_HEIGHT, ID_PHOTO_WIDTH, type PhotoOutputMode } from '@/tools/id-photo/image'

type BackgroundPreset = 'white' | 'blue' | 'red' | 'custom'

const { tr } = useI18n()
const fileInput = ref<HTMLInputElement>()
const previewCanvas = ref<HTMLCanvasElement>()
const hasPhoto = ref(false)
const processing = ref(false)
const exporting = ref(false)
const error = ref('')
const sourceName = ref('')
const zoom = ref(100)
const offsetX = ref(0)
const offsetY = ref(0)
const backgroundPreset = ref<BackgroundPreset>('blue')
const customBackground = ref('#438edb')
const outputMode = ref<PhotoOutputMode>('target-size')
const targetKilobytes = ref(100)
const qualityPercent = ref(90)
const estimatedBytes = ref(0)
const estimatedQuality = ref(0)
const sizeTargetReached = ref(true)
const estimating = ref(false)

const targetSizeOptions = [0, 50, 100, 200, 500, 800, 1000] as const
const qualityOptions = [90, 80, 70, 50, 30] as const
function fetchableRuntimeUrl(importedUrl: string): string {
  const url = new URL(importedUrl, window.location.href)
  if (url.protocol !== 'file:') return url.href
  const fileName = url.pathname.split('/').pop()
  return fileName ? `dc-toolbox-resource://renderer-assets/${encodeURIComponent(fileName)}` : url.href
}

const runtimeFiles: Readonly<Record<string, string>> = {
  'selfie_segmentation.binarypb': fetchableRuntimeUrl(graphUrl),
  'selfie_segmentation.tflite': fetchableRuntimeUrl(portraitModelUrl),
  'selfie_segmentation_landscape.tflite': fetchableRuntimeUrl(landscapeModelUrl),
  'selfie_segmentation_solution_simd_wasm_bin.js': fetchableRuntimeUrl(simdLoaderUrl),
  'selfie_segmentation_solution_simd_wasm_bin.wasm': fetchableRuntimeUrl(simdWasmUrl),
  'selfie_segmentation_solution_wasm_bin.js': fetchableRuntimeUrl(wasmLoaderUrl),
  'selfie_segmentation_solution_wasm_bin.wasm': fetchableRuntimeUrl(wasmUrl)
}

let segmenter: SelfieSegmentation | undefined
let sourceLayer: HTMLCanvasElement | undefined
let personLayer: HTMLCanvasElement | undefined
let sourceObjectUrl = ''
let estimateTimer: ReturnType<typeof setTimeout> | undefined
let estimateSequence = 0
let pendingResult: { resolve: (results: Results) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined

const backgroundColor = computed(() => ({ white: '#ffffff', blue: '#438edb', red: '#d62832', custom: customBackground.value })[backgroundPreset.value])
const estimatedLabel = computed(() => estimatedBytes.value > 0 ? formatFileSize(estimatedBytes.value) : '—')

function getSegmenter(): SelfieSegmentation {
  if (segmenter) return segmenter
  segmenter = new SelfieSegmentation({ locateFile: (path) => runtimeFiles[path] ?? path })
  segmenter.setOptions({ modelSelection: 0, selfieMode: false })
  segmenter.onResults((results) => {
    if (!pendingResult) return
    clearTimeout(pendingResult.timer)
    pendingResult.resolve(results)
    pendingResult = undefined
  })
  return segmenter
}

async function runSegmentation(image: HTMLCanvasElement): Promise<Results> {
  const solution = getSegmenter()
  const resultPromise = new Promise<Results>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResult = undefined
      reject(new Error(tr('人物识别超时，请换一张主体更清晰的照片后重试。', 'Person detection timed out. Try another photo with a clearer subject.')))
    }, 30_000)
    pendingResult = { resolve, reject, timer }
  })
  try {
    await solution.send({ image })
    return await resultPromise
  } catch (cause) {
    if (pendingResult) clearTimeout(pendingResult.timer)
    pendingResult = undefined
    throw cause
  }
}

function makeWorkingCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const maximumDimension = 1600
  const ratio = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const context = canvas.getContext('2d')
  if (!context) throw new Error(tr('无法创建图片处理画布。', 'Unable to create the image-processing canvas.'))
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

function makePersonLayer(results: Results, source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error(tr('无法创建抠图画布。', 'Unable to create the cutout canvas.'))
  context.save()
  context.filter = 'blur(1.2px)'
  context.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height)
  context.restore()
  context.globalCompositeOperation = 'source-in'
  context.drawImage(source, 0, 0)
  context.globalCompositeOperation = 'source-over'
  return canvas
}

function drawPhoto(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = backgroundColor.value
  context.fillRect(0, 0, canvas.width, canvas.height)
  const layer = personLayer ?? sourceLayer
  if (!layer) return
  const coverScale = Math.max(canvas.width / layer.width, canvas.height / layer.height)
  const scale = coverScale * zoom.value / 100
  const width = layer.width * scale
  const height = layer.height * scale
  const left = (canvas.width - width) / 2 + canvas.width * offsetX.value / 100
  const top = (canvas.height - height) / 2 + canvas.height * offsetY.value / 100
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(layer, left, top, width, height)
}

function buildOutputCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ID_PHOTO_WIDTH
  canvas.height = ID_PHOTO_HEIGHT
  drawPhoto(canvas)
  return canvas
}

function encodingOptions(): { mode: PhotoOutputMode; targetKilobytes: number; qualityPercent: number } {
  return { mode: outputMode.value, targetKilobytes: targetKilobytes.value, qualityPercent: qualityPercent.value }
}

function schedulePreview(): void {
  void nextTick(() => {
    if (previewCanvas.value) drawPhoto(previewCanvas.value)
  })
  if (!hasPhoto.value) return
  if (estimateTimer) clearTimeout(estimateTimer)
  const sequence = ++estimateSequence
  estimateTimer = setTimeout(async () => {
    estimating.value = true
    try {
      const encoded = await encodePhoto(buildOutputCanvas(), encodingOptions())
      if (sequence !== estimateSequence) return
      estimatedBytes.value = encoded.blob.size
      estimatedQuality.value = Math.round(encoded.quality * 100)
      sizeTargetReached.value = encoded.targetReached
    } catch (cause) {
      if (sequence !== estimateSequence) return
      estimatedBytes.value = 0
      estimatedQuality.value = 0
      sizeTargetReached.value = true
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (sequence === estimateSequence) estimating.value = false
    }
  }, 180)
}

function resetPosition(): void {
  zoom.value = 100
  offsetX.value = 0
  offsetY.value = 0
}

function choosePhoto(): void {
  fileInput.value?.click()
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(tr('无法读取这张图片，请选择 JPG、PNG 或 WebP 文件。', 'Unable to read this image. Choose a JPG, PNG or WebP file.')))
    image.src = url
  })
}

async function handleFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = tr('请选择 JPG、PNG 或 WebP 图片。', 'Choose a JPG, PNG or WebP image.')
    return
  }

  processing.value = true
  error.value = ''
  hasPhoto.value = false
  estimateSequence += 1
  if (estimateTimer) clearTimeout(estimateTimer)
  estimatedBytes.value = 0
  estimatedQuality.value = 0
  sizeTargetReached.value = true
  estimating.value = false
  try {
    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl)
    sourceObjectUrl = URL.createObjectURL(file)
    const image = await loadImage(sourceObjectUrl)
    sourceLayer = makeWorkingCanvas(image)
    const results = await runSegmentation(sourceLayer)
    personLayer = makePersonLayer(results, sourceLayer)
    sourceName.value = file.name
    hasPhoto.value = true
    resetPosition()
    schedulePreview()
  } catch (cause) {
    sourceLayer = undefined
    personLayer = undefined
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    processing.value = false
  }
}

async function exportPhoto(): Promise<void> {
  if (!hasPhoto.value) return
  exporting.value = true
  error.value = ''
  try {
    const encoded = await encodePhoto(buildOutputCanvas(), encodingOptions())
    const date = new Date()
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const url = URL.createObjectURL(encoded.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `DC-Toolbox-ID-Photo-${stamp}.jpg`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    exporting.value = false
  }
}

function openMediaPipe(): void {
  void window.uartScope.openExternal('https://github.com/google-ai-edge/mediapipe')
}

watch([zoom, offsetX, offsetY, backgroundPreset, customBackground, outputMode, targetKilobytes, qualityPercent], schedulePreview)
onMounted(schedulePreview)
onBeforeUnmount(() => {
  if (estimateTimer) clearTimeout(estimateTimer)
  if (pendingResult) clearTimeout(pendingResult.timer)
  if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl)
  void segmenter?.close()
})
</script>

<template>
  <section class="id-photo-layout">
    <div class="panel id-photo-main">
      <div class="panel-toolbar">
        <div><h2>{{ tr('一寸照制作', 'ID Photo Maker') }}</h2><p>{{ tr('本地智能抠图、证件照背景替换与 JPEG 大小控制', 'Local person cutout, ID-photo backgrounds and JPEG size control') }}</p></div>
        <button class="license-badge" type="button" title="MediaPipe repository" @click="openMediaPipe">MediaPipe · Apache-2.0</button>
      </div>

      <div class="id-photo-workbench">
        <div class="id-photo-preview-column">
          <div class="id-photo-preview" :class="{ empty: !hasPhoto }">
            <canvas ref="previewCanvas" :width="ID_PHOTO_WIDTH" :height="ID_PHOTO_HEIGHT"></canvas>
            <div v-if="!hasPhoto" class="id-photo-placeholder"><strong>{{ processing ? tr('正在识别人像…', 'Detecting person…') : tr('选择一张正面人像照片', 'Choose a front-facing portrait') }}</strong><span>{{ tr('建议光线均匀、人物与背景边界清楚', 'Use even lighting and a clear subject/background boundary') }}</span></div>
          </div>
          <small>{{ tr('常用一寸：25 × 35 mm · 295 × 413 px · 300 DPI', 'Common 1-inch: 25 × 35 mm · 295 × 413 px · 300 DPI') }}</small>
          <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="handleFile">
          <button type="button" :disabled="processing" @click="choosePhoto">{{ processing ? tr('正在抠图…', 'Removing background…') : hasPhoto ? tr('更换照片', 'Replace photo') : tr('选择照片', 'Choose photo') }}</button>
          <span v-if="sourceName" class="id-photo-source-name" :title="sourceName">{{ sourceName }}</span>
        </div>

        <div class="id-photo-controls">
          <div class="id-photo-control-section"><h3>{{ tr('画面调整', 'Framing') }}</h3>
            <label><span>{{ tr('人物缩放', 'Person zoom') }} <b>{{ zoom }}%</b></span><input v-model.number="zoom" type="range" min="70" max="220" step="1" :disabled="!hasPhoto"></label>
            <label><span>{{ tr('左右位置', 'Horizontal position') }} <b>{{ offsetX }}</b></span><input v-model.number="offsetX" type="range" min="-50" max="50" step="1" :disabled="!hasPhoto"></label>
            <label><span>{{ tr('上下位置', 'Vertical position') }} <b>{{ offsetY }}</b></span><input v-model.number="offsetY" type="range" min="-50" max="50" step="1" :disabled="!hasPhoto"></label>
            <button class="soft-button" type="button" :disabled="!hasPhoto" @click="resetPosition">{{ tr('恢复默认构图', 'Reset framing') }}</button>
          </div>

          <div class="id-photo-control-section"><h3>{{ tr('背景颜色', 'Background') }}</h3>
            <div class="background-presets">
              <button v-for="item in ([['white', '#ffffff', tr('白底', 'White')], ['blue', '#438edb', tr('蓝底', 'Blue')], ['red', '#d62832', tr('红底', 'Red')]] as const)" :key="item[0]" type="button" :class="{ active: backgroundPreset === item[0] }" @click="backgroundPreset = item[0]"><i :style="{ background: item[1] }"></i>{{ item[2] }}</button>
              <label class="custom-color" :class="{ active: backgroundPreset === 'custom' }"><input v-model="customBackground" type="color" @focus="backgroundPreset = 'custom'" @input="backgroundPreset = 'custom'"><span>{{ tr('自定义', 'Custom') }}</span></label>
            </div>
          </div>

          <div class="id-photo-control-section"><h3>{{ tr('输出控制', 'Output control') }}</h3>
            <div class="output-mode-tabs"><label :class="{ active: outputMode === 'target-size' }"><input v-model="outputMode" type="radio" value="target-size">{{ tr('目标文件大小', 'Target file size') }}</label><label :class="{ active: outputMode === 'quality' }"><input v-model="outputMode" type="radio" value="quality">{{ tr('JPEG 质量', 'JPEG quality') }}</label></div>
            <label v-if="outputMode === 'target-size'" class="field"><span>{{ tr('尽量不超过', 'Try not to exceed') }}</span><select v-model.number="targetKilobytes"><option v-for="size in targetSizeOptions" :key="size" :value="size">{{ size === 0 ? tr('不限制', 'Unlimited') : tr(`约 ${size} KB`, `About ${size} KB`) }}</option></select></label>
            <label v-else class="field"><span>{{ tr('编码质量', 'Encoding quality') }}</span><select v-model.number="qualityPercent"><option v-for="quality in qualityOptions" :key="quality" :value="quality">{{ quality }}%</option></select></label>
            <div class="id-photo-estimate"><span>{{ tr('预计文件大小', 'Estimated file size') }}</span><strong>{{ estimating ? tr('计算中…', 'Calculating…') : estimatedLabel }}</strong><small v-if="estimatedBytes">JPEG {{ estimatedQuality }}%</small></div>
            <p v-if="!sizeTargetReached" class="field-error">{{ tr('照片在最低 JPEG 质量下仍大于目标值，导出时将保留可达到的最小文件。', 'The photo is still above the target at minimum JPEG quality; export will use the smallest achievable file.') }}</p>
            <button class="id-photo-export" type="button" :disabled="!hasPhoto || exporting || estimating" @click="exportPhoto">{{ exporting ? tr('正在生成…', 'Generating…') : tr('导出 JPG 一寸照', 'Export JPG ID photo') }}</button>
          </div>
        </div>
      </div>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>

    <aside class="panel id-photo-guide"><h2>{{ tr('功能说明', 'How it works') }}</h2><ol><li>{{ tr('选择 JPG、PNG 或 WebP 人像，软件在本机完成抠图，不会上传照片。', 'Choose a JPG, PNG or WebP portrait. Cutout runs locally and the photo is never uploaded.') }}</li><li>{{ tr('选择白、蓝、红或自定义背景，再调整人物缩放与位置。', 'Choose a white, blue, red or custom background, then adjust subject scale and position.') }}</li><li>{{ tr('目标大小模式会寻找不超过目标值的最高 JPEG 质量；简单图片可能明显小于目标值。', 'Target-size mode finds the highest JPEG quality below the limit; simple photos may be considerably smaller.') }}</li><li>{{ tr('不同报名系统的尺寸要求可能不同，提交前请核对对方规定。', 'Application systems may have different requirements; verify their specification before submitting.') }}</li></ol>
      <div class="id-photo-privacy"><strong>{{ tr('完全本地处理', 'Fully local processing') }}</strong><p>{{ tr('人物分割由 MediaPipe Selfie Segmentation 0.1.1675465747 提供，采用 Apache License 2.0。组件、版本、仓库与完整许可已列入“帮助 → 开源组件”和第三方声明。', 'Person segmentation is provided by MediaPipe Selfie Segmentation 0.1.1675465747 under Apache License 2.0. Component, version, repository and full license are included under Help → Open-Source Components and in third-party notices.') }}</p></div>
    </aside>
  </section>
</template>
