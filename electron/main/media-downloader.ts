import { app, net } from 'electron'
import { createHash } from 'node:crypto'
import { access, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { join } from 'node:path'

const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
const CHECKSUM_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS'

export interface MediaToolStatus { installed: boolean; version: string; executablePath: string; ffmpegAvailable: boolean }
export interface MediaInfo { title: string; webpageUrl: string; duration: number | null; thumbnail: string; extractor: string }
export interface MediaProgress { state: 'running' | 'completed' | 'canceled' | 'error'; percent: number; speed: string; eta: string; message: string }

type ProgressListener = (progress: MediaProgress) => void

function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

function runCapture(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
    child.stdout.on('data', (value: string) => { stdout += value })
    child.stderr.on('data', (value: string) => { stderr += value })
    child.once('error', reject)
    child.once('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

export class MediaDownloader {
  private active?: ChildProcessWithoutNullStreams
  private cancelRequested = false
  constructor(private readonly onProgress: ProgressListener) {}

  private get directory(): string { return join(app.getPath('userData'), 'tools', 'yt-dlp') }
  private get downloadedExecutablePath(): string { return join(this.directory, 'yt-dlp.exe') }
  private get bundledExecutablePath(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'tools', 'yt-dlp.exe')
      : join(app.getAppPath(), 'build', 'tools', 'yt-dlp.exe')
  }
  private async resolveExecutablePath(): Promise<string> {
    return await exists(this.downloadedExecutablePath) ? this.downloadedExecutablePath : this.bundledExecutablePath
  }

  async getStatus(): Promise<MediaToolStatus> {
    const executablePath = await this.resolveExecutablePath()
    const installed = await exists(executablePath)
    const versionResult = installed ? await runCapture(executablePath, ['--version']).catch(() => undefined) : undefined
    const ffmpegResult = await runCapture('where.exe', ['ffmpeg.exe']).catch(() => undefined)
    return {
      installed,
      version: versionResult?.code === 0 ? versionResult.stdout.trim() : '',
      executablePath,
      ffmpegAvailable: ffmpegResult?.code === 0
    }
  }

  async install(): Promise<MediaToolStatus> {
    await mkdir(this.directory, { recursive: true })
    const [binaryResponse, checksumResponse] = await Promise.all([net.fetch(DOWNLOAD_URL), net.fetch(CHECKSUM_URL)])
    if (!binaryResponse.ok || !checksumResponse.ok) throw new Error('无法从 yt-dlp 官方 Release 下载组件。')
    const bytes = new Uint8Array(await binaryResponse.arrayBuffer())
    const checksums = await checksumResponse.text()
    const expected = checksums.split(/\r?\n/).map((line) => line.trim().split(/\s+/)).find((parts) => parts.at(-1) === 'yt-dlp.exe')?.[0]?.toLowerCase()
    if (!expected) throw new Error('官方校验文件中没有 yt-dlp.exe。')
    const actual = createHash('sha256').update(bytes).digest('hex')
    if (actual !== expected) throw new Error('yt-dlp.exe SHA-256 校验失败，已拒绝安装。')
    const temporaryPath = `${this.downloadedExecutablePath}.download`
    await writeFile(temporaryPath, bytes)
    await unlink(this.downloadedExecutablePath).catch(() => undefined)
    await rename(temporaryPath, this.downloadedExecutablePath)
    return this.getStatus()
  }

  async analyze(value: unknown): Promise<MediaInfo> {
    const url = typeof value === 'string' ? value.trim() : ''
    if (!isHttpsUrl(url)) throw new Error('请输入有效的 HTTPS 网页地址。')
    const executablePath = await this.resolveExecutablePath()
    if (!await exists(executablePath)) throw new Error('请先安装 yt-dlp 解析组件。')
    const result = await runCapture(executablePath, ['--ignore-config', '--no-playlist', '--skip-download', '--dump-single-json', '--no-warnings', url])
    if (result.code !== 0) throw new Error(result.stderr.trim() || '无法解析该网页。')
    const data = JSON.parse(result.stdout) as Record<string, unknown>
    return {
      title: typeof data.title === 'string' ? data.title : '未命名媒体',
      webpageUrl: typeof data.webpage_url === 'string' ? data.webpage_url : url,
      duration: typeof data.duration === 'number' ? data.duration : null,
      thumbnail: typeof data.thumbnail === 'string' && isHttpsUrl(data.thumbnail) ? data.thumbnail : '',
      extractor: typeof data.extractor_key === 'string' ? data.extractor_key : String(data.extractor ?? '')
    }
  }

  async download(value: unknown): Promise<void> {
    if (!value || typeof value !== 'object') throw new Error('下载参数格式错误。')
    if (this.active) throw new Error('已有下载任务正在运行。')
    const options = value as Record<string, unknown>
    const url = typeof options.url === 'string' ? options.url.trim() : ''
    const directory = typeof options.directory === 'string' ? options.directory : ''
    const mode = options.mode === 'audio' ? 'audio' : 'video'
    if (!isHttpsUrl(url)) throw new Error('请输入有效的 HTTPS 网页地址。')
    if (!directory) throw new Error('请先选择保存目录。')
    const executablePath = await this.resolveExecutablePath()
    if (!await exists(executablePath)) throw new Error('请先安装 yt-dlp 解析组件。')
    await mkdir(directory, { recursive: true })
    const format = mode === 'audio' ? 'bestaudio[ext=m4a]/bestaudio' : 'best[ext=mp4]/best'
    const args = ['--ignore-config', '--no-playlist', '--windows-filenames', '--newline', '--no-warnings', '--format', format, '--output', join(directory, '%(title).180B [%(id)s].%(ext)s'), '--progress-template', 'download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s', url]
    const child = spawn(executablePath, args, { windowsHide: true })
    this.active = child
    this.cancelRequested = false
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        const match = line.match(/^\s*([\d.]+)%\|([^|]*)\|([^|]*)/)
        if (match) this.onProgress({ state: 'running', percent: Number(match[1]), speed: match[2].trim(), eta: match[3].trim(), message: line.trim() })
      }
    })
    let errorText = ''
    child.stderr.on('data', (chunk: string) => { errorText += chunk })
    child.once('error', (error) => { this.active = undefined; this.onProgress({ state: 'error', percent: 0, speed: '', eta: '', message: error.message }) })
    child.once('close', (code) => {
      const canceled = this.cancelRequested
      this.active = undefined
      this.cancelRequested = false
      this.onProgress(canceled
        ? { state: 'canceled', percent: 0, speed: '', eta: '', message: '下载已取消。' }
        : code === 0
          ? { state: 'completed', percent: 100, speed: '', eta: '', message: '下载完成。' }
          : { state: 'error', percent: 0, speed: '', eta: '', message: errorText.trim() || `下载进程退出：${code}` })
    })
  }

  cancel(): boolean {
    if (!this.active) return false
    this.cancelRequested = true
    this.active.kill()
    return true
  }
}
