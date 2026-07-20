import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { FileRecorder } from '../electron/main/file-recorder.ts'
import { SettingsManager, defaultSettings } from '../electron/main/settings-manager.ts'

const root = resolve('tests', `.tmp-storage-${process.pid}`)
await mkdir(root, { recursive: true })

try {
  const recorder = new FileRecorder(() => {})
  const started = await recorder.start(root, 'COM10 @ 115200, 8N1')
  const expected = Buffer.alloc(1024 * 1024)
  for (let index = 0; index < expected.length; index += 1) expected[index] = index % 256
  for (let offset = 0; offset < expected.length; offset += 4096) recorder.write(expected.subarray(offset, offset + 4096))
  const stopped = await recorder.stop()
  assert.equal(stopped.bytesWritten, expected.length)
  assert.deepEqual(await readFile(started.filePath), expected)

  const settingsPath = join(root, 'settings.json')
  const manager = new SettingsManager(settingsPath)
  await manager.load()
  await manager.update({ ...defaultSettings, serial: { ...defaultSettings.serial, path: 'COM10', baudRate: '333333', customBaudRates: [333333] } })
  const reloaded = new SettingsManager(settingsPath)
  await reloaded.load()
  assert.equal(reloaded.get().serial.baudRate, '333333')
  assert.deepEqual(reloaded.get().serial.customBaudRates, [333333])

  await writeFile(settingsPath, '{broken json', 'utf8')
  const recovered = new SettingsManager(settingsPath)
  await recovered.load()
  assert.match(recovered.warning, /配置文件已损坏/)
  assert.equal(recovered.get().serial.baudRate, '115200')
  console.log('存储测试通过：1 MiB 原始数据逐字节一致；配置保存、恢复和损坏回退正常。')
} finally {
  await rm(root, { recursive: true, force: true })
}
