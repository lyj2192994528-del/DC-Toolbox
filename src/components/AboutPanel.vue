<script setup lang="ts">
import { PROJECT_INFO } from '../../shared/project-info'
import { useI18n } from '@/i18n'
const { tr } = useI18n()
</script>

<template>
  <section class="about-layout">
    <div class="panel about-hero">
      <span class="about-badge">ABOUT</span>
      <h2>{{ PROJECT_INFO.fullName }}</h2>
      <p>{{ tr('面向 MCU 开发工程师、硬件工程师、电子爱好者与开源开发者的 Windows 桌面工具箱。', 'A Windows desktop toolkit for MCU developers, hardware engineers, electronics enthusiasts and open-source developers.') }}</p>
      <div class="about-contact-grid">
        <div><span>{{ tr('作者邮箱', 'Email') }}</span><strong>{{ PROJECT_INFO.email }}</strong><small>{{ tr('问题反馈、功能建议与合作联系', 'Bug reports, feature requests and collaboration') }}</small></div>
        <div><span>{{ tr('QQ 交流群', 'QQ Group') }}</span><strong>{{ PROJECT_INFO.qqGroup }}</strong><small>{{ PROJECT_INFO.qqGroupName }}</small></div>
        <div><span>{{ tr('GitHub 仓库', 'GitHub Repository') }}</span><strong>{{ PROJECT_INFO.githubUrl || tr('待添加', 'Not configured') }}</strong><small>{{ tr('创建仓库后填写统一配置', 'Configure after creating the repository') }}</small></div>
      </div>
      <div class="group-description"><strong>{{ tr('群介绍', 'Community') }}</strong><p>{{ tr(PROJECT_INFO.qqGroupDescription, 'A community for DC Toolbox users and embedded developers to discuss serial debugging, MCU development, hardware design and feature ideas. Please stay respectful and avoid advertising.') }}</p></div>
    </div>
    <aside class="panel about-roadmap"><h2>{{ tr('项目方向', 'Roadmap') }}</h2><ul><li>{{ tr('串口、波形与数据记录', 'Serial, waveform and data recording') }}</li><li>{{ tr('电子开发计算工具', 'Engineering calculators') }}</li><li>BLE, USB, HID & OTA</li><li>TCP, UDP & MQTT</li></ul><p>{{ tr('DC Toolbox 会保持模块化结构，后续工具按类别持续加入。', 'DC Toolbox keeps a modular structure so new tools can be added by category.') }}</p></aside>
  </section>
</template>
