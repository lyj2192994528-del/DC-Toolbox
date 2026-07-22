<script setup lang="ts">
import { onMounted, ref } from 'vue'

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
        <div><h2>虚拟串口</h2><p>检测并管理 com0com 虚拟串口对，用于无硬件回环测试和软件间串口通信</p></div>
        <span class="virtual-status" :class="{ ready: status?.installed }">{{ loading ? '检测中…' : status?.installed ? '已安装' : '未安装' }}</span>
      </div>

      <div class="virtual-flow" aria-label="虚拟串口工作原理">
        <div><strong>DC Toolbox</strong><span>打开端口 A</span></div><i>⇄</i><div><strong>com0com</strong><span>虚拟零调制解调器</span></div><i>⇄</i><div><strong>被测软件</strong><span>打开端口 B</span></div>
      </div>

      <div v-if="status?.installed" class="virtual-installed">
        <h3>检测到的虚拟端口</h3>
        <div v-if="status.ports.length" class="virtual-port-list"><span v-for="port in status.ports" :key="port">{{ port }}</span></div>
        <p v-else>已检测到 com0com，但命令行没有返回可识别的端口名称。可以打开管理器查看或创建端口对。</p>
        <small v-if="status.toolPath">命令行工具：{{ status.toolPath }}</small>
      </div>
      <div v-else class="virtual-empty"><strong>尚未检测到 com0com</strong><p>DC Toolbox 不会自动安装内核驱动。请从官方项目页选择与 Windows 版本兼容、带有效数字签名的版本。</p></div>

      <p v-if="status?.warning" class="config-warning">{{ status.warning }}</p>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="message" class="export-message">{{ message }}</p>

      <div class="virtual-actions">
        <button class="soft-button" :disabled="loading" @click="refresh">重新检测</button>
        <button v-if="status?.installed" @click="run('manager')">打开 com0com 管理器</button>
        <button v-if="status?.installed" class="soft-button" @click="run('folder')">打开安装目录</button>
        <button v-else @click="run('download')">打开官方下载页</button>
      </div>
    </div>

    <aside class="panel virtual-guide">
      <h2>使用方法</h2>
      <ol><li>安装兼容当前 Windows 的已签名 com0com 驱动。</li><li>打开管理器，创建一对端口，例如 COM101 与 COM102。</li><li>DC Toolbox 打开 COM101，被测串口软件打开 COM102。</li><li>任意一端发送的数据都会从另一端收到。</li></ol>
      <div class="driver-warning"><strong>驱动安全提醒</strong><p>不要关闭 Secure Boot、不要开启 Windows 测试签名模式，也不要安装来源不明的 SYS 驱动。端口正在被软件占用时，请先关闭串口再修改或删除端口对。</p></div>
      <p class="license-note">com0com 是独立的第三方 GPLv2 项目，不属于 DC Toolbox。本软件当前不打包或修改其驱动文件。</p>
    </aside>
  </section>
</template>
