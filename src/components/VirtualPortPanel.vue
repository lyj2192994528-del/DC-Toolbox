<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from '@/i18n'
const { language } = useI18n()

const loading = ref(false)
const status = ref<VirtualPortStatus>()
const message = ref('')
const error = ref('')

async function refresh(): Promise<void> {
  loading.value = true
  error.value = ''
  const result = await window.uartScope.getVirtualPortStatus()
  if (result.ok) status.value = result.status
  else error.value = result.error
  loading.value = false
}

async function run(action: 'manager' | 'folder' | 'download'): Promise<void> {
  error.value = ''
  message.value = ''
  const result = action === 'manager'
    ? await window.uartScope.openVirtualPortManager()
    : action === 'folder'
      ? await window.uartScope.openVirtualPortFolder()
      : await window.uartScope.openVirtualPortDownload()
  if (!result.ok) error.value = result.error
  else message.value = action === 'download' ? '已在浏览器打开 com0com 官方项目页。' : '已打开 com0com。创建或删除端口时 Windows 可能要求管理员授权。'
}

onMounted(refresh)
</script>

<template>
  <section class="virtual-port-layout">
    <div class="panel">
      <div class="panel-toolbar">
        <div><h2>{{ language === 'en-US' ? 'Virtual Serial Ports' : '虚拟串口' }}</h2><p>{{ language === 'en-US' ? 'Detect and manage com0com pairs for hardware-free loopback and inter-application tests' : '检测并管理 com0com 虚拟串口对，用于无硬件回环测试和软件间串口通信' }}</p></div>
        <span class="virtual-status" :class="{ ready: status?.installed }">{{ loading ? (language === 'en-US' ? 'Detecting…' : '检测中…') : status?.installed ? (language === 'en-US' ? 'Installed' : '已安装') : (language === 'en-US' ? 'Not installed' : '未安装') }}</span>
      </div>

      <div class="virtual-flow" aria-label="虚拟串口工作原理">
        <div><strong>DC Toolbox</strong><span>{{ language === 'en-US' ? 'Open port A' : '打开端口 A' }}</span></div><i>⇄</i><div><strong>com0com</strong><span>{{ language === 'en-US' ? 'Virtual null modem' : '虚拟零调制解调器' }}</span></div><i>⇄</i><div><strong>{{ language === 'en-US' ? 'Application under test' : '被测软件' }}</strong><span>{{ language === 'en-US' ? 'Open port B' : '打开端口 B' }}</span></div>
      </div>

      <div v-if="status?.installed" class="virtual-installed">
        <h3>{{ language === 'en-US' ? 'Detected virtual ports' : '检测到的虚拟端口' }}</h3>
        <div v-if="status.ports.length" class="virtual-port-list"><span v-for="port in status.ports" :key="port">{{ port }}</span></div>
        <p v-else>{{ language === 'en-US' ? 'com0com is installed, but its command line did not return recognizable port names. Open the manager to view or create a pair.' : '已检测到 com0com，但命令行没有返回可识别的端口名称。可以打开管理器查看或创建端口对。' }}</p>
        <small v-if="status.toolPath">{{ language === 'en-US' ? 'CLI tool' : '命令行工具' }}：{{ status.toolPath }}</small>
      </div>
      <div v-else class="virtual-empty"><strong>{{ language === 'en-US' ? 'com0com was not detected' : '尚未检测到 com0com' }}</strong><p>{{ language === 'en-US' ? 'DC Toolbox never installs a kernel driver silently. Download a Windows-compatible build with a valid digital signature from the official project.' : 'DC Toolbox 不会自动安装内核驱动。请从官方项目页选择与 Windows 版本兼容、带有效数字签名的版本。' }}</p></div>

      <p v-if="status?.warning" class="config-warning">{{ status.warning }}</p>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="message" class="export-message">{{ message }}</p>

      <div class="virtual-actions">
        <button class="soft-button" :disabled="loading" @click="refresh">{{ language === 'en-US' ? 'Detect Again' : '重新检测' }}</button>
        <button v-if="status?.installed" @click="run('manager')">{{ language === 'en-US' ? 'Open com0com Manager' : '打开 com0com 管理器' }}</button>
        <button v-if="status?.installed" class="soft-button" @click="run('folder')">{{ language === 'en-US' ? 'Open Installation Folder' : '打开安装目录' }}</button>
        <button v-else @click="run('download')">{{ language === 'en-US' ? 'Official Download Page' : '打开官方下载页' }}</button>
      </div>
    </div>

    <aside class="panel virtual-guide">
      <h2>{{ language === 'en-US' ? 'How to Use' : '使用方法' }}</h2>
      <ol v-if="language === 'en-US'"><li>Install a signed com0com driver compatible with your Windows version.</li><li>Create a pair such as COM101 and COM102 in its manager.</li><li>Open COM101 in DC Toolbox and COM102 in the application under test.</li><li>Data written to either end is received by the other end.</li></ol><ol v-else><li>安装兼容当前 Windows 的已签名 com0com 驱动。</li><li>打开管理器，创建一对端口，例如 COM101 与 COM102。</li><li>DC Toolbox 打开 COM101，被测串口软件打开 COM102。</li><li>任意一端发送的数据都会从另一端收到。</li></ol>
      <div class="driver-warning"><strong>{{ language === 'en-US' ? 'Driver Safety' : '驱动安全提醒' }}</strong><p>{{ language === 'en-US' ? 'Do not disable Secure Boot or enable Windows test-signing mode. Never install an untrusted SYS driver. Close applications using the ports before changing or deleting a pair.' : '不要关闭 Secure Boot、不要开启 Windows 测试签名模式，也不要安装来源不明的 SYS 驱动。端口正在被软件占用时，请先关闭串口再修改或删除端口对。' }}</p></div>
      <p class="license-note">{{ language === 'en-US' ? 'com0com is an independent third-party GPLv2 project. It is not part of DC Toolbox, and its driver is neither bundled nor modified.' : 'com0com 是独立的第三方 GPLv2 项目，不属于 DC Toolbox。本软件当前不打包或修改其驱动文件。' }}</p>
    </aside>
  </section>
</template>
