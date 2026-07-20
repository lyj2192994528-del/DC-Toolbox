<script setup lang="ts">
const applicationName = 'UartScope'
</script>

<template>
  <main class="welcome-card">
    <div class="status-dot" aria-hidden="true"></div>
    <p class="eyebrow">Windows 串口波形助手</p>
    <h1>{{ applicationName }} 启动成功</h1>
    <p class="description">Electron、Vue 3 和 TypeScript 开发环境已经正常运行。</p>
  </main>
</template>
