import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { shell } from 'electron'

const execFileAsync = promisify(execFile)
const OFFICIAL_PROJECT_URL = 'https://sourceforge.net/projects/com0com/'

export interface VirtualPortStatus {
  installed: boolean
  toolPath?: string
  managerPath?: string
  output: string
  ports: string[]
  warning: string
}

async function existingPath(paths: string[]): Promise<string | undefined> {
  for (const path of paths) {
    try { await access(path); return path } catch { /* 继续检查下一个标准安装位置。 */ }
  }
  return undefined
}

function installationRoots(): string[] {
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter((value): value is string => Boolean(value))
  return Array.from(new Set(roots.flatMap((root) => [join(root, 'com0com'), join(root, 'com0com\setup')])))
}

export async function getVirtualPortStatus(): Promise<VirtualPortStatus> {
  const roots = installationRoots()
  const toolPath = await existingPath(roots.map((root) => join(root, 'setupc.exe')))
  const managerPath = await existingPath(roots.flatMap((root) => [join(root, 'setupg.exe'), join(root, 'setup.exe')]))
  if (!toolPath && !managerPath) return { installed: false, output: '', ports: [], warning: '未检测到 com0com。请仅从官方项目页下载，并确认驱动签名与 Windows 版本兼容。' }

  let output = ''
  let warning = ''
  if (toolPath) {
    try {
      const result = await execFileAsync(toolPath, ['list'], { windowsHide: true, timeout: 8_000, maxBuffer: 512_000 })
      output = `${result.stdout}${result.stderr}`.trim()
    } catch (error) {
      warning = `已找到 com0com，但读取端口列表失败：${error instanceof Error ? error.message : String(error)}`
    }
  }
  const ports = Array.from(new Set(output.match(/\b(?:COM\d+|CNC[AB]\d+)\b/gi) ?? [])).map((port) => port.toUpperCase())
  return { installed: true, toolPath, managerPath, output, ports, warning }
}

export async function openVirtualPortManager(): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = await getVirtualPortStatus()
  const target = status.managerPath ?? status.toolPath
  if (!target) return { ok: false, error: '未检测到 com0com，请先从官方项目页安装已签名且兼容当前 Windows 的版本。' }
  const error = await shell.openPath(target)
  return error ? { ok: false, error } : { ok: true }
}

export async function openVirtualPortFolder(): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = await getVirtualPortStatus()
  const target = status.managerPath ?? status.toolPath
  if (!target) return { ok: false, error: '未检测到 com0com 安装目录。' }
  const error = await shell.openPath(dirname(target))
  return error ? { ok: false, error } : { ok: true }
}

export async function openVirtualPortDownload(): Promise<void> {
  await shell.openExternal(OFFICIAL_PROJECT_URL)
}
