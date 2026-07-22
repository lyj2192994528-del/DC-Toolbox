<script setup lang="ts">
import { PROJECT_INFO } from '../../shared/project-info'
import { useI18n } from '@/i18n'
const { language, tr } = useI18n()

function openRepository(): void {
  if (PROJECT_INFO.githubUrl) void window.uartScope.openExternal(PROJECT_INFO.githubUrl)
}
</script>

<template>
  <section class="about-layout">
    <div class="panel about-hero">
      <span class="about-badge">ABOUT</span>
      <h2>{{ language === 'en-US' ? PROJECT_INFO.fullNameEn : PROJECT_INFO.fullName }}</h2>
      <p>{{ tr('面向 MCU 开发工程师、硬件工程师、电子爱好者与开源开发者的 Windows 桌面工具箱。', 'A Windows desktop toolkit for MCU developers, hardware engineers, electronics enthusiasts and open-source developers.') }}</p>
      <div class="about-contact-grid">
        <div><span>{{ tr('作者邮箱', 'Email') }}</span><strong>{{ PROJECT_INFO.email }}</strong><small>{{ tr('问题反馈、功能建议与合作联系', 'Bug reports, feature requests and collaboration') }}</small></div>
        <div><span>{{ tr('QQ 交流群', 'QQ Group') }}</span><strong>{{ PROJECT_INFO.qqGroup }}</strong><small>{{ language === 'en-US' ? PROJECT_INFO.qqGroupNameEn : PROJECT_INFO.qqGroupName }}</small></div>
        <div><span>{{ tr('GitHub 仓库', 'GitHub Repository') }}</span><button class="external-link" type="button" @click="openRepository">{{ PROJECT_INFO.githubUrl }}</button><small>{{ tr('查看源码、提交问题与下载正式版本', 'Browse source, report issues and download releases') }}</small></div>
      </div>
      <div class="group-description"><strong>{{ tr('群介绍', 'Community') }}</strong><p>{{ language === 'en-US' ? PROJECT_INFO.qqGroupDescriptionEn : PROJECT_INFO.qqGroupDescription }}</p></div>
    </div>
    <aside class="panel about-roadmap"><h2>{{ tr('项目方向', 'Roadmap') }}</h2><ul><li>{{ tr('串口、波形与数据记录', 'Serial, waveform and data recording') }}</li><li>{{ tr('电子开发计算工具', 'Engineering calculators') }}</li><li>BLE, USB, HID & OTA</li><li>TCP, UDP & MQTT</li></ul><p>{{ tr('DC Toolbox 会保持模块化结构，后续工具按类别持续加入。', 'DC Toolbox keeps a modular structure so new tools can be added by category.') }}</p></aside>
  </section>
</template>
